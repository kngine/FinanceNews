import { unstable_cache } from "next/cache";
import type { Article } from "./types";

type JSDOMConstructor = typeof import("jsdom").JSDOM;

export type ReaderSource =
  | "json-ld"
  | "readability"
  | "article-html"
  | "amp"
  | "jina"
  | "metadata"
  | "rss";

export type ReaderContent = {
  title: string;
  byline: string;
  excerpt: string;
  paragraphs: string[];
  source: ReaderSource;
  wordCount: number;
};

type Candidate = {
  title: string;
  byline: string;
  excerpt: string;
  paragraphs: string[];
  source: ReaderSource;
};

const BLOCKED_TEXT_PATTERNS = [
  /^subscribe\b/i,
  /^sign in\b/i,
  /enable javascript/i,
  /^advertisement$/i,
  /accept (all )?cookies/i,
  /please enable js/i,
  /you have reached your free article limit/i,
  /to continue reading/i,
];

// A candidate is "good enough" to stop searching once it clears this bar.
const STRONG_CONTENT_CHARS = 1800;
// Below this, we treat the extraction as a stub and keep trying other hacks.
const MIN_CONTENT_CHARS = 400;

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
// Many publishers serve the full, paywall-free article to search crawlers.
const GOOGLEBOT_UA =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

export async function getReaderContent(article: Article): Promise<ReaderContent> {
  return getCachedReaderContent(article.url, article.title, article.summary);
}

const getCachedReaderContent = unstable_cache(
  async (
    url: string,
    fallbackTitle: string,
    fallbackSummary: string,
  ): Promise<ReaderContent> => {
    const { JSDOM } = await import("jsdom");
    const { Readability } = await import("@mozilla/readability");

    let best: Candidate | null = null;

    const consider = (candidate: Candidate | null) => {
      if (!candidate || candidate.paragraphs.length === 0) {
        return;
      }
      if (!best || contentLength(candidate) > contentLength(best)) {
        best = candidate;
      }
    };

    // Strategy 1 & 2: fetch the publisher HTML with a couple of different
    // user agents (Googlebot first — it slips past many soft paywalls), then
    // run every extractor we have against whichever response looks richest.
    for (const ua of [GOOGLEBOT_UA, BROWSER_UA]) {
      if (best && contentLength(best) >= STRONG_CONTENT_CHARS) {
        break;
      }

      const html = await safeFetchHtml(url, ua);
      if (!html) {
        continue;
      }

      let dom: import("jsdom").JSDOM;
      try {
        dom = new JSDOM(html, { url });
      } catch {
        continue;
      }
      const document = dom.window.document;

      consider(extractJsonLd(document, fallbackTitle));
      consider(extractWithReadability(document, Readability, JSDOM, fallbackTitle));
      consider(extractArticleParagraphs(document, fallbackTitle));

      // Strategy 3: follow the AMP version, which is usually lean and
      // paywall-free, when the page advertises one.
      if (!best || contentLength(best) < STRONG_CONTENT_CHARS) {
        const ampUrl = findAmpUrl(document, url);
        if (ampUrl && ampUrl !== url) {
          const ampHtml = await safeFetchHtml(ampUrl, ua);
          if (ampHtml) {
            try {
              const ampDoc = new JSDOM(ampHtml, { url: ampUrl }).window.document;
              consider(toSource(extractJsonLd(ampDoc, fallbackTitle), "amp"));
              consider(
                toSource(
                  extractWithReadability(ampDoc, Readability, JSDOM, fallbackTitle),
                  "amp",
                ),
              );
              consider(toSource(extractArticleParagraphs(ampDoc, fallbackTitle), "amp"));
            } catch {
              // Ignore malformed AMP markup.
            }
          }
        }
      }

      // Keep meta description around as a weak fallback.
      if (!best) {
        const description = metaDescription(document);
        if (description) {
          consider({
            title: titleFromDocument(document) || fallbackTitle,
            byline: "",
            excerpt: description,
            paragraphs: [description],
            source: "metadata",
          });
        }
      }
    }

    // Strategy 4: when local extraction is thin (JS-rendered pages, hard
    // paywalls), fall back to the Jina AI reader proxy, which renders the page
    // server-side and returns clean article text.
    if (!best || contentLength(best) < STRONG_CONTENT_CHARS) {
      const jina = await fetchViaJina(url, fallbackTitle);
      consider(jina);
    }

    if (best && contentLength(best) >= MIN_CONTENT_CHARS) {
      return finalize(best);
    }

    // If everything thin out, still surface whatever we scraped before the
    // RSS summary, since partial text beats none.
    if (best) {
      return finalize(best);
    }

    return finalize({
      title: fallbackTitle,
      byline: "",
      excerpt: fallbackSummary,
      paragraphs: fallbackSummary ? [fallbackSummary] : [],
      source: "rss",
    });
  },
  ["reader-content-v2"],
  {
    revalidate: 1800,
    tags: ["reader-content-v2"],
  },
);

function finalize(candidate: Candidate): ReaderContent {
  const paragraphs = dedupeParagraphs(candidate.paragraphs);
  return {
    title: candidate.title,
    byline: candidate.byline,
    excerpt: candidate.excerpt,
    paragraphs,
    source: candidate.source,
    wordCount: paragraphs.join(" ").split(/\s+/).filter(Boolean).length,
  };
}

function toSource(
  candidate: Candidate | null,
  source: ReaderSource,
): Candidate | null {
  return candidate ? { ...candidate, source } : null;
}

function contentLength(candidate: Candidate): number {
  return candidate.paragraphs.reduce((total, p) => total + p.length, 0);
}

async function safeFetchHtml(url: string, userAgent: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": userAgent,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        Referer: "https://www.google.com/",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "cross-site",
        "Upgrade-Insecure-Requests": "1",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(9000),
      next: { revalidate: 1800 },
    });

    if (!response.ok) {
      return null;
    }

    return await response.text();
  } catch {
    return null;
  }
}

async function fetchViaJina(
  url: string,
  fallbackTitle: string,
): Promise<Candidate | null> {
  try {
    const response = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        Accept: "text/plain",
        "X-Return-Format": "text",
      },
      signal: AbortSignal.timeout(15000),
      next: { revalidate: 1800 },
    });

    if (!response.ok) {
      return null;
    }

    const raw = await response.text();
    return parseJinaResponse(raw, fallbackTitle);
  } catch {
    return null;
  }
}

function parseJinaResponse(raw: string, fallbackTitle: string): Candidate | null {
  // Jina prepends a small metadata header before "Markdown Content:".
  let title = fallbackTitle;
  let body = raw;

  const titleMatch = raw.match(/^Title:\s*(.+)$/m);
  if (titleMatch) {
    title = cleanText(titleMatch[1]) || fallbackTitle;
  }

  const markerIndex = raw.indexOf("Markdown Content:");
  if (markerIndex !== -1) {
    body = raw.slice(markerIndex + "Markdown Content:".length);
  }

  const paragraphs = body
    .split(/\n{2,}/)
    .map(stripMarkdown)
    .map(cleanText)
    .filter(isUsefulParagraph);

  if (paragraphs.length === 0) {
    return null;
  }

  return {
    title,
    byline: "",
    excerpt: paragraphs[0]?.slice(0, 220) ?? "",
    paragraphs,
    source: "jina",
  };
}

function stripMarkdown(value: string): string {
  return value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links -> text
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/^>\s?/gm, "") // blockquotes
    .replace(/^[-*+]\s+/gm, "") // list bullets
    .replace(/[*_`]{1,3}/g, "") // emphasis / code marks
    .replace(/^\s*\|.*\|\s*$/gm, "") // table rows
    .replace(/^[-=]{3,}\s*$/gm, ""); // rules
}

function extractWithReadability(
  document: Document,
  Readability: typeof import("@mozilla/readability").Readability,
  JSDOM: JSDOMConstructor,
  fallbackTitle: string,
): Candidate | null {
  try {
    const parsed = new Readability(document.cloneNode(true) as Document, {
      keepClasses: false,
    }).parse();

    const paragraphs = paragraphsFromHtml(parsed?.content ?? "", JSDOM);
    if (paragraphs.length === 0) {
      return null;
    }

    return {
      title: cleanText(parsed?.title ?? "") || fallbackTitle,
      byline: cleanText(parsed?.byline ?? ""),
      excerpt: cleanText(parsed?.excerpt ?? ""),
      paragraphs,
      source: "readability",
    };
  } catch {
    return null;
  }
}

function findAmpUrl(document: Document, baseUrl: string): string | null {
  const href = document
    .querySelector('link[rel="amphtml"]')
    ?.getAttribute("href");

  if (!href) {
    return null;
  }

  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function extractJsonLd(
  document: Document,
  fallbackTitle: string,
): Candidate | null {
  const scripts = Array.from(
    document.querySelectorAll('script[type="application/ld+json"]'),
  );

  for (const script of scripts) {
    const nodes = flattenJsonLd(safeJsonParse(script.textContent ?? ""));
    const article = nodes.find((node) => {
      const type = node["@type"];
      const values = Array.isArray(type) ? type : [type];

      return values.some((value) =>
        [
          "Article",
          "NewsArticle",
          "ReportageNewsArticle",
          "AnalysisNewsArticle",
          "OpinionNewsArticle",
          "BackgroundNewsArticle",
        ].includes(String(value)),
      );
    });

    if (!article) {
      continue;
    }

    const articleBody = extractArticleBody(article.articleBody);
    const paragraphs = splitParagraphs(articleBody);

    if (paragraphs.length === 0) {
      continue;
    }

    return {
      title: cleanText(String(article.headline ?? "")) || fallbackTitle,
      byline: extractAuthor(article.author),
      excerpt: cleanText(String(article.description ?? "")),
      paragraphs,
      source: "json-ld",
    };
  }

  return null;
}

function extractArticleBody(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((entry) => extractArticleBody(entry)).join("\n\n");
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return cleanText(String(record.text ?? record.articleBody ?? ""));
  }
  return cleanText(String(value ?? ""));
}

function flattenJsonLd(value: unknown): Record<string, unknown>[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(flattenJsonLd);
  }

  if (typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;
  const graph = record["@graph"];

  return [record, ...flattenJsonLd(graph)];
}

function extractAuthor(value: unknown): string {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return cleanText(value);
  }

  if (Array.isArray(value)) {
    return value.map(extractAuthor).filter(Boolean).join(", ");
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return cleanText(String(record.name ?? ""));
  }

  return "";
}

function paragraphsFromHtml(html: string, JSDOM: JSDOMConstructor): string[] {
  if (!html) {
    return [];
  }

  const dom = new JSDOM(html);
  const nodes = Array.from(
    dom.window.document.querySelectorAll("p, li, blockquote, h2, h3"),
  );

  return nodes
    .map((node) => cleanText(node.textContent ?? ""))
    .filter(isUsefulParagraph);
}

function extractArticleParagraphs(
  document: Document,
  fallbackTitle: string,
): Candidate | null {
  const selectors = [
    "article p",
    '[data-component="text-block"] p',
    '[data-module="ArticleBody"] p',
    '[data-testid="article-body"] p',
    '[itemprop="articleBody"] p',
    ".article-body p",
    ".article__body p",
    ".ArticleBody-articleBody p",
    ".caas-body p",
    ".RichTextStoryBody p",
    ".story-body p",
    ".entry-content p",
    "main p",
  ];

  for (const selector of selectors) {
    const paragraphs = Array.from(document.querySelectorAll(selector))
      .map((node) => cleanText(node.textContent ?? ""))
      .filter(isUsefulParagraph);

    if (paragraphs.length > 1) {
      return {
        title: titleFromDocument(document) || fallbackTitle,
        byline: "",
        excerpt: metaDescription(document),
        paragraphs: dedupeParagraphs(paragraphs),
        source: "article-html",
      };
    }
  }

  return null;
}

function titleFromDocument(document: Document): string {
  return cleanText(
    document.querySelector('meta[property="og:title"]')?.getAttribute("content") ??
      document.querySelector("h1")?.textContent ??
      document.querySelector("title")?.textContent ??
      "",
  );
}

function metaDescription(document: Document): string {
  return cleanText(
    document
      .querySelector('meta[property="og:description"]')
      ?.getAttribute("content") ??
      document.querySelector('meta[name="description"]')?.getAttribute("content") ??
      "",
  );
}

function splitParagraphs(value: string): string[] {
  return value
    .split(/\n{1,}|(?<=[.!?])\s{2,}/)
    .map(cleanText)
    .filter(isUsefulParagraph);
}

function isUsefulParagraph(value: string): boolean {
  return (
    value.length > 60 &&
    !BLOCKED_TEXT_PATTERNS.some((pattern) => pattern.test(value))
  );
}

function dedupeParagraphs(paragraphs: string[]): string[] {
  const seen = new Set<string>();

  return paragraphs.filter((paragraph) => {
    const key = paragraph.toLowerCase();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function cleanText(value?: string): string {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
