import * as cheerio from "cheerio";
import { safeFetch } from "../security/ssrf";

export interface ScrapedArticle {
  url: string;
  title: string;
  author?: string | null;
  publishedDate?: string | null;
  mainText: string;
  excerpt: string;
  siteName?: string | null;
}

/**
 * Strips script tags, ads, navigation, and boilerplate from HTML
 * and extracts main article text and metadata.
 */
export async function scrapeArticleFromUrl(url: string): Promise<ScrapedArticle> {
  const useMocks = process.env.USE_MOCKS === "true";

  // If in mock mode or testing with simulated domains
  if (useMocks && (url.includes("example.com") || url.includes("mock"))) {
    return {
      url,
      title: "Viral Election Notice Regarding Voter Identification Verification",
      author: "Election News Desk",
      publishedDate: new Date().toISOString(),
      mainText:
        "The Election Commission of India has issued clarifications regarding voter identity documents for polling stations. Social media posts claiming that physical EPIC cards are mandatory have been refuted. Voters registered in the electoral roll may vote by producing any of the 12 authorized alternative photo identity documents.",
      excerpt: "ECI clarifies 12 alternative documents permitted for voter identification.",
      siteName: "National Fact Check Network",
    };
  }

  // 1. Fetch page using SSRF-safe fetch
  const { text: html, contentType } = await safeFetch(url, {
    timeoutMs: 8000,
    maxBytes: 3 * 1024 * 1024, // 3 MB max
  });

  if (!contentType.includes("html") && !html.includes("<html")) {
    // Plain text or JSON response
    const cleanText = html.slice(0, 5000).trim();
    return {
      url,
      title: "Extracted Web Content",
      mainText: cleanText,
      excerpt: cleanText.slice(0, 200),
    };
  }

  // 2. Load into Cheerio and clean boilerplate elements
  const $ = cheerio.load(html);

  $("script, style, noscript, svg, iframe, header, footer, nav, aside, form").remove();
  $("[aria-hidden='true'], .advertisement, .ad, .social-share, .comments").remove();

  // 3. Extract Metadata
  const title =
    $('meta[property="og:title"]').attr("content") ||
    $('meta[name="twitter:title"]').attr("content") ||
    $("h1").first().text().trim() ||
    $("title").first().text().trim() ||
    "Untitled Election Article";

  const author =
    $('meta[name="author"]').attr("content") ||
    $('meta[property="article:author"]').attr("content") ||
    $('[rel="author"]').first().text().trim() ||
    $(".byline, .author").first().text().trim() ||
    null;

  const publishedDate =
    $('meta[property="article:published_time"]').attr("content") ||
    $('meta[name="pubdate"]').attr("content") ||
    $("time").first().attr("datetime") ||
    null;

  const siteName =
    $('meta[property="og:site_name"]').attr("content") ||
    $('meta[name="application-name"]').attr("content") ||
    null;

  // 4. Extract Main Article Text
  let articleContainer = $("article, main, [role='main'], .article-body, .story-body, .post-content");
  if (articleContainer.length === 0) {
    articleContainer = $("body");
  }

  const paragraphs: string[] = [];
  articleContainer.find("p, h2, h3").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text.length >= 25) {
      paragraphs.push(text);
    }
  });

  const mainText = paragraphs.join("\n\n").slice(0, 15000);
  const excerpt = paragraphs[0]?.slice(0, 250) || mainText.slice(0, 250);

  return {
    url,
    title: title.replace(/\s+/g, " ").trim(),
    author: author ? author.replace(/\s+/g, " ").trim() : null,
    publishedDate,
    mainText: mainText || title,
    excerpt,
    siteName,
  };
}
