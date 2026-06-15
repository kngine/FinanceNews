import { unstable_cache } from "next/cache";
import Parser from "rss-parser";
import { enabledSources } from "./sources";
import type { Article, FeedError, NewsFeed, NewsSource } from "./types";

type FeedItem = {
  title?: string;
  link?: string;
  guid?: string;
  isoDate?: string;
  pubDate?: string;
  contentSnippet?: string;
  content?: string;
  summary?: string;
  categories?: string[];
};

const parser = new Parser<Record<string, unknown>, FeedItem>({
  headers: {
    "User-Agent":
      "FinanceNews/0.1 (+https://example.com; open-access RSS aggregator)",
    Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
  },
  timeout: 10000,
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
  "Goldman Sachs": "GS",
  "Morgan Stanley": "MS",
  "Bank of America": "BAC",
  "Walmart": "WMT",
  "Target": "TGT",
  "Costco": "COST",
  "Disney": "DIS",
  "Boeing": "BA",
  "Exxon": "XOM",
  "Chevron": "CVX",
  "Palantir": "PLTR",
  "Broadcom": "AVGO",
  "AMD": "AMD",
  "Intel": "INTC",
  "Oracle": "ORCL",
  "Salesforce": "CRM",
};

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
  const tags = normalizeTags(item.categories);
  const tickers = detectTickers([title, summary, ...tags].join(" "));

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
  };
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

function normalizeTags(categories?: string[]): string[] {
  return Array.from(
    new Set(
      (categories ?? [])
        .map((category) => cleanText(category))
        .filter(Boolean)
        .slice(0, 4),
    ),
  );
}

function detectTickers(value: string): string[] {
  const tickers = new Set<string>();
  const text = cleanText(value);
  const cashtags = text.match(/\$[A-Z][A-Z0-9.]{0,5}\b/g) ?? [];

  cashtags.forEach((ticker) => tickers.add(ticker.slice(1).toUpperCase()));

  Object.entries(COMPANY_TICKERS).forEach(([company, ticker]) => {
    const pattern = new RegExp(`\\b${escapeRegExp(company)}\\b`, "i");

    if (pattern.test(text)) {
      tickers.add(ticker);
    }
  });

  return Array.from(tickers).slice(0, 5);
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
