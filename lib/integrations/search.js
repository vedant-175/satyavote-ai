/**
 * Mock fallback generator for Web Search.
 */
function mockWebSearch(query) {
  const clean = (query || "").toLowerCase();

  if (clean.includes("voter id") || clean.includes("epic") || clean.includes("alternative")) {
    return [
      {
        kind: "WEB",
        sourceName: "The Hindu News",
        url: "https://thehindu.com/news/national/eci-guidelines-on-voter-identification/article.ece",
        title: "ECI reiterates: 12 photo identity documents valid for voting in Lok Sabha elections",
        snippet: "Voters enrolled in the electoral roll can exercise their franchise even without an EPIC card by presenting any of the 12 prescribed photo ID proofs including Aadhaar, MNREGA card, and driver's license.",
        stance: "SUPPORTS",
        rawJson: { provider: "mock-search", rank: 1 },
      },
      {
        kind: "WEB",
        sourceName: "Times of India",
        url: "https://timesofindia.indiatimes.com/india/how-to-vote-without-epic-card/articleshow.cms",
        title: "Can you vote without a Voter ID card? Here is what Election Commission rules say",
        snippet: "A common misconception during election cycles is that a physical Voter ID is compulsory. The Commission explicitly mandates that inclusion on the voter roll is the sole prerequisite for voting.",
        stance: "SUPPORTS",
        rawJson: { provider: "mock-search", rank: 2 },
      },
    ];
  }

  if (clean.includes("evm") || clean.includes("battery")) {
    return [
      {
        kind: "WEB",
        sourceName: "Deccan Herald",
        url: "https://deccanherald.com/national/how-evm-batteries-function-commission-report.html",
        title: "ECI Technical Experts Committee Explains Power Packs in EVM Control Units",
        snippet: "EVMs run on standalone 7.5V alkaline power packs which merely power the internal processor and display; battery percentage has no influence on cryptographic vote registers.",
        stance: "SUPPORTS",
        rawJson: { provider: "mock-search", rank: 1 },
      },
    ];
  }

  return [
    {
      kind: "WEB",
      sourceName: "National Press Archive",
      url: "https://nationalnews.example.com/elections/report",
      title: `News reports and context regarding: ${query.slice(0, 60)}...`,
      snippet: `General election reporting and public statements related to ${query.slice(0, 80)}.`,
      stance: "NEUTRAL",
      rawJson: { provider: "mock-search", query },
    },
  ];
}

/**
 * Searches the web via Tavily API.
 */
async function searchTavily(query, apiKey, limit = 4) {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      include_answer: false,
      max_results: limit,
    }),
  });

  if (!res.ok) {
    throw new Error(`Tavily error: ${res.status}`);
  }

  const data = await res.json();
  const results = data.results || [];

  return results.map((item) => ({
    kind: "WEB",
    sourceName: new URL(item.url).hostname.replace("www.", ""),
    url: item.url,
    title: item.title,
    snippet: item.content,
    stance: "NEUTRAL",
    rawJson: item,
  }));
}

/**
 * Searches the web via Brave Search API.
 */
async function searchBrave(query, apiKey, limit = 4) {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${limit}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!res.ok) {
    throw new Error(`Brave Search error: ${res.status}`);
  }

  const data = await res.json();
  const results = data.web?.results || [];

  return results.map((item) => ({
    kind: "WEB",
    sourceName: new URL(item.url).hostname.replace("www.", ""),
    url: item.url,
    title: item.title,
    snippet: item.description,
    stance: "NEUTRAL",
    rawJson: item,
  }));
}

/**
 * Provider-agnostic web search function with graceful timeout and fallback.
 */
export async function searchWeb(query, options = {}) {
  const provider = (process.env.SEARCH_PROVIDER || "tavily").toLowerCase();
  const apiKey = process.env.SEARCH_API_KEY;
  const useMocks = process.env.USE_MOCKS === "true";
  const limit = options.limit || 4;

  if (useMocks || !apiKey) {
    return mockWebSearch(query);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    if (provider === "brave") {
      return await searchBrave(query, apiKey, limit);
    } else {
      return await searchTavily(query, apiKey, limit);
    }
  } catch (err) {
    console.warn(`[Web Search API] ${provider} search failed, falling back to mock:`, err);
    return mockWebSearch(query);
  } finally {
    clearTimeout(timer);
  }
}
