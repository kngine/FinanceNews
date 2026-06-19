import { unstable_cache } from "next/cache";
import Parser from "rss-parser";
import { enabledSources } from "./sources";
import type { Article, FeedError, NewsFeed, NewsSource } from "./types";

type MediaNode = {
  $?: { url?: string; medium?: string; type?: string };
  url?: string;
};

type FeedItem = {
  title?: string;
  link?: string;
  guid?: string;
  isoDate?: string;
  pubDate?: string;
  contentSnippet?: string;
  content?: string;
  "content:encoded"?: string;
  summary?: string;
  categories?: Array<string | { _?: string; $?: Record<string, string> }>;
  enclosure?: { url?: string; type?: string };
  "media:content"?: MediaNode | MediaNode[];
  "media:thumbnail"?: MediaNode | MediaNode[];
};

const parser = new Parser<Record<string, unknown>, FeedItem>({
  headers: {
    "User-Agent":
      "FinanceNews/0.1 (+https://example.com; open-access RSS aggregator)",
    Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
  },
  timeout: 10000,
  customFields: {
    item: [
      ["media:content", "media:content", { keepArray: true }],
      ["media:thumbnail", "media:thumbnail"],
      ["content:encoded", "content:encoded"],
    ],
  },
});

const COMPANY_TICKERS: Record<string, string> = {
  "Apple": "AAPL",
  "Amazon": "AMZN",
  "Alphabet": "GOOGL",
  "Google": "GOOGL",
  "Microsoft": "MSFT",
  "Meta": "META",
  "Facebook": "META",
  "Nvidia": "NVDA",
  "Tesla": "TSLA",
  "Netflix": "NFLX",
  "Berkshire Hathaway": "BRK.B",
  "JPMorgan": "JPM",
  "JPMorgan Chase": "JPM",
  "Goldman Sachs": "GS",
  "Morgan Stanley": "MS",
  "Bank of America": "BAC",
  "Wells Fargo": "WFC",
  "Citigroup": "C",
  "BlackRock": "BLK",
  "Charles Schwab": "SCHW",
  "Visa": "V",
  "Mastercard": "MA",
  "American Express": "AXP",
  "PayPal": "PYPL",
  "Coinbase": "COIN",
  "Robinhood": "HOOD",
  "SoFi": "SOFI",
  "Affirm": "AFRM",
  "Walmart": "WMT",
  "Target": "TGT",
  "Costco": "COST",
  "Home Depot": "HD",
  "Lowe's": "LOW",
  "Nike": "NKE",
  "Starbucks": "SBUX",
  "McDonald's": "MCD",
  "Chipotle": "CMG",
  "Coca-Cola": "KO",
  "PepsiCo": "PEP",
  "Procter & Gamble": "PG",
  "Disney": "DIS",
  "Comcast": "CMCSA",
  "Warner Bros": "WBD",
  "Paramount": "PARA",
  "Spotify": "SPOT",
  "Roku": "ROKU",
  "Boeing": "BA",
  "Lockheed Martin": "LMT",
  "Raytheon": "RTX",
  "Caterpillar": "CAT",
  "Deere": "DE",
  "General Electric": "GE",
  "Honeywell": "HON",
  "Ford": "F",
  "General Motors": "GM",
  "Rivian": "RIVN",
  "Lucid": "LCID",
  "Exxon": "XOM",
  "ExxonMobil": "XOM",
  "Chevron": "CVX",
  "ConocoPhillips": "COP",
  "Occidental": "OXY",
  "Palantir": "PLTR",
  "Broadcom": "AVGO",
  "AMD": "AMD",
  "Intel": "INTC",
  "Oracle": "ORCL",
  "Salesforce": "CRM",
  "Adobe": "ADBE",
  "Cisco": "CSCO",
  "IBM": "IBM",
  "Qualcomm": "QCOM",
  "Texas Instruments": "TXN",
  "Micron": "MU",
  "Marvell": "MRVL",
  "Super Micro": "SMCI",
  "Supermicro": "SMCI",
  "Dell": "DELL",
  "ASML": "ASML",
  "Taiwan Semiconductor": "TSM",
  "TSMC": "TSM",
  "Snowflake": "SNOW",
  "ServiceNow": "NOW",
  "CrowdStrike": "CRWD",
  "Palo Alto Networks": "PANW",
  "Fortinet": "FTNT",
  "Datadog": "DDOG",
  "MongoDB": "MDB",
  "Shopify": "SHOP",
  "Uber": "UBER",
  "Lyft": "LYFT",
  "Airbnb": "ABNB",
  "DoorDash": "DASH",
  "Reddit": "RDDT",
  "Pinterest": "PINS",
  "Roblox": "RBLX",
  "GameStop": "GME",
  "United Airlines": "UAL",
  "Delta Air Lines": "DAL",
  "American Airlines": "AAL",
  "FedEx": "FDX",
  "Pfizer": "PFE",
  "Moderna": "MRNA",
  "Merck": "MRK",
  "AbbVie": "ABBV",
  "Eli Lilly": "LLY",
  "Johnson & Johnson": "JNJ",
  "UnitedHealth": "UNH",
  "AT&T": "T",
  "Verizon": "VZ",
  "T-Mobile": "TMUS",
};

const EXCHANGE_TICKER =
  /\b(?:NYSE\s*American|NYSEAMERICAN|NYSE|NASDAQ|AMEX|OTCMKTS|OTC|CBOE|BATS|TSXV|TSX)\s*:\s*([A-Z]{1,5}(?:\.[A-Z])?)\b/gi;

export const getNewsFeed = unstable_cache(
  async (): Promise<NewsFeed> => {
    const results = await Promise.allSettled(
      enabledSources.map((source) => fetchSourceArticles(source)),
    );

    const articles: Article[] = [];
    const errors: FeedError[] = [];

    results.forEach((result, index) => {
      const source = enabledSources[index];

      if (result.status === "fulfilled") {
        articles.push(...result.value);
        return;
      }

      errors.push({
        sourceId: source.id,
        sourceName: source.name,
        message:
          result.reason instanceof Error
            ? result.reason.message
            : "Unable to load this feed.",
      });
    });

    return {
      articles: dedupeArticles(articles)
        .sort(
          (a, b) =>
            new Date(b.publishedAt).getTime() -
            new Date(a.publishedAt).getTime(),
        )
        .slice(0, 500),
      errors,
      generatedAt: new Date().toISOString(),
    };
  },
  ["finance-news-feed-v7"],
  {
    revalidate: 900,
    tags: ["finance-news-feed-v7"],
  },
);

async function fetchSourceArticles(source: NewsSource): Promise<Article[]> {
  const feed = await parser.parseURL(source.feedUrl);

  return (feed.items ?? [])
    .map((item) => normalizeArticle(item, source))
    .filter((article): article is Article => Boolean(article));
}

function normalizeArticle(item: FeedItem, source: NewsSource): Article | null {
  const title = cleanText(item.title);
  const url = normalizeUrl(item.link ?? item.guid ?? "", source.homepageUrl);

  if (!title || !url) {
    return null;
  }

  const publishedAt = parsePublishedAt(item.isoDate ?? item.pubDate);
  const summary = cleanText(
    item.contentSnippet ?? item.summary ?? stripTags(item.content ?? ""),
  );
  const categoryStrings = toCategoryStrings(item.categories);
  const tags = normalizeTags(categoryStrings);
  const tickers = detectTickers([title, summary, ...categoryStrings].join(" "));
  const imageUrl = extractImageUrl(item);

  return {
    id: `${source.id}:${slugify(url)}`,
    title,
    summary,
    url,
    sourceId: source.id,
    sourceName: source.name,
    sourceUrl: source.homepageUrl,
    category: source.category,
    publishedAt,
    tags,
    tickers,
    imageUrl,
  };
}

function extractImageUrl(item: FeedItem): string | undefined {
  const enclosure = item.enclosure;
  if (enclosure?.url && (enclosure.type ?? "").startsWith("image")) {
    return enclosure.url;
  }

  const mediaContent = toArray(item["media:content"]).find(
    (node) =>
      isImageMedia(node) && Boolean(node.$?.url ?? node.url),
  );
  if (mediaContent) {
    return mediaContent.$?.url ?? mediaContent.url;
  }

  const thumbnail = toArray(item["media:thumbnail"])[0];
  if (thumbnail) {
    return thumbnail.$?.url ?? thumbnail.url;
  }

  const fromHtml =
    firstImageFromHtml(item["content:encoded"]) ??
    firstImageFromHtml(item.content);
  if (fromHtml) {
    return fromHtml;
  }

  return undefined;
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function isImageMedia(node: MediaNode): boolean {
  const medium = node.$?.medium;
  const type = node.$?.type ?? "";
  return medium === "image" || type.startsWith("image") || (!medium && !type);
}

function firstImageFromHtml(html?: string): string | undefined {
  if (!html) {
    return undefined;
  }
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1];
}

function dedupeArticles(articles: Article[]): Article[] {
  const seen = new Set<string>();

  return articles.filter((article) => {
    const key = normalizeUrl(article.url);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function normalizeUrl(rawUrl: string, baseUrl?: string): string {
  try {
    const url = new URL(rawUrl, baseUrl);

    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach(
      (param) => url.searchParams.delete(param),
    );

    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function parsePublishedAt(value?: string): string {
  if (!value) {
    return new Date().toISOString();
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp)
    ? new Date().toISOString()
    : new Date(timestamp).toISOString();
}

function toCategoryStrings(
  categories?: Array<string | { _?: string; $?: Record<string, string> }>,
): string[] {
  return (categories ?? [])
    .map((category) =>
      typeof category === "string" ? category : (category?._ ?? ""),
    )
    .map((category) => category.trim())
    .filter(Boolean);
}

function normalizeTags(categories: string[]): string[] {
  return Array.from(
    new Set(
      categories
        .map((category) => cleanText(category))
        // Drop bare exchange:ticker categories; those become ticker chips.
        .filter((category) => category && !/^[A-Za-z]+:[A-Za-z.]+$/.test(category))
        .slice(0, 4),
    ),
  );
}

function detectTickers(value: string): string[] {
  const tickers = new Set<string>();
  const text = cleanText(value);

  const cashtags = text.match(/\$[A-Z][A-Z0-9.]{0,5}\b/g) ?? [];
  cashtags.forEach((ticker) => tickers.add(ticker.slice(1).toUpperCase()));

  // Exchange-prefixed symbols common in earnings and press releases,
  // e.g. "(NASDAQ: AAPL)" or "NYSE: BRK.B".
  for (const match of text.matchAll(EXCHANGE_TICKER)) {
    if (match[1]) {
      tickers.add(match[1].toUpperCase());
    }
  }

  Object.entries(COMPANY_TICKERS).forEach(([company, ticker]) => {
    const pattern = new RegExp(`\\b${escapeRegExp(company)}\\b`, "i");

    if (pattern.test(text)) {
      tickers.add(ticker);
    }
  });

  return Array.from(tickers).slice(0, 6);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanText(value?: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }

  return stripTags(String(value))
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, "");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}
