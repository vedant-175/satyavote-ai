import * as cheerio from "cheerio";
import { safeFetch } from "../security/ssrf";

/**
 * Strips script tags, ads, navigation, and boilerplate from HTML
 * and extracts main article text and metadata.
 */
export async function scrapeArticleFromUrl(url) {
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
    maxBytes: 3 * 1024 * 1024,
  });

  if (!contentType.includes("html") && !html.includes("<html")) {
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
    $("title").text().trim() ||
    $("h1").first().text().trim() ||
    "Untitled Article";

  const author =
    $('meta[name="author"]').attr("content") ||
    $('meta[property="article:author"]').attr("content") ||
    null;

  const publishedDate =
    $('meta[property="article:published_time"]').attr("content") ||
    $('meta[name="publish-date"]').attr("content") ||
    $("time").first().attr("datetime") ||
    null;

  const siteName =
    $('meta[property="og:site_name"]').attr("content") ||
    new URL(url).hostname;

  // 4. Extract Main Article Body Text
  let mainText = "";
  const candidateSelectors = ["article", "main", ".article-body", ".story-content", "#main-content"];

  for (const selector of candidateSelectors) {
    const el = $(selector);
    if (el.length > 0 && el.text().trim().length > 200) {
      mainText = el.text().replace(/\s+/g, " ").trim();
      break;
    }
  }

  if (!mainText) {
    const paragraphs = $("p")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter((p) => p.length > 25);
    mainText = paragraphs.join(" ");
  }

  if (!mainText) {
    mainText = $("body").text().replace(/\s+/g, " ").trim();
  }

  // Truncate to reasonable size (10k chars)
  mainText = mainText.slice(0, 10000);
  const excerpt = mainText.slice(0, 250) + (mainText.length > 250 ? "..." : "");

  return {
    url,
    title,
    author,
    publishedDate,
    mainText,
    excerpt,
    siteName,
  };
}
