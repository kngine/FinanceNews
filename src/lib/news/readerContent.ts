import { unstable_cache } from "next/cache";
import type { Article } from "./types";

type JSDOMConstructor = typeof import("jsdom").JSDOM;

export type ReaderContent = {
  title: string;
  byline: string;
  excerpt: string;
  paragraphs: string[];
  source: "json-ld" | "readability" | "article-html" | "metadata" | "rss";
};

const BLOCKED_TEXT_PATTERNS = [
  /subscribe/i,
  /sign in/i,
  /enable javascript/i,
  /advertisement/i,
  /cookies/i,
];

export async function getReaderContent(article: Article): Promise<ReaderContent> {
  return getCachedReaderContent(article.url, article.title, article.summary);
}

const getCachedReaderContent = unstable_cache(
  async (
    url: string,
    fallbackTitle: string,
    fallbackSummary: string,
  ): Promise<ReaderContent> => {
    try {
      const [{ Readability }, { JSDOM }] = await Promise.all([
        import("@mozilla/readability"),
        import("jsdom"),
      ]);
      const html = await fetchArticleHtml(url);
      const dom = new JSDOM(html, { url });
      const document = dom.window.document;
      const jsonLd = extractJsonLd(document, fallbackTitle);

      if (jsonLd.paragraphs.length > 0) {
        return jsonLd;
      }

      const readable = new Readability(document.cloneNode(true) as Document, {
        keepClasses: false,
      }).parse();

      const readabilityParagraphs = paragraphsFromHtml(
        readable?.content ?? "",
        JSDOM,
      );

      if (readabilityParagraphs.length > 0) {
        return {
          title: cleanText(readable?.title ?? "") || fallbackTitle,
          byline: cleanText(readable?.byline ?? ""),
          excerpt: cleanText(readable?.excerpt ?? ""),
          paragraphs: readabilityParagraphs,
          source: "readability",
        };
      }

      const articleParagraphs = extractArticleParagraphs(document);

      if (articleParagraphs.length > 0) {
        return {
          title: titleFromDocument(document) || fallbackTitle,
          byline: "",
          excerpt: metaDescription(document),
          paragraphs: articleParagraphs,
          source: "article-html",
        };
      }

      const description = metaDescription(document);

      if (description) {
        return {
          title: titleFromDocument(document) || fallbackTitle,
          byline: "",
          excerpt: description,
          paragraphs: [description],
          source: "metadata",
        };
      }
    } catch {
      // Fall through to the RSS fallback. Some publishers block direct HTML fetches.
    }

    return {
      title: fallbackTitle,
      byline: "",
      excerpt: fallbackSummary,
      paragraphs: fallbackSummary ? [fallbackSummary] : [],
      source: "rss",
    };
  },
  ["reader-content-v1"],
  {
    revalidate: 1800,
    tags: ["reader-content-v1"],
  },
);

async function fetchArticleHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36 FinanceNewsReader/0.1",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    next: {
      revalidate: 1800,
    },
  });

  if (!response.ok) {
    throw new Error(`Article fetch failed with ${response.status}`);
  }

  return response.text();
}

function extractJsonLd(
  document: Document,
  fallbackTitle: string,
): ReaderContent {
  const scripts = Array.from(
    document.querySelectorAll('script[type="application/ld+json"]'),
  );

  for (const script of scripts) {
    const nodes = flattenJsonLd(safeJsonParse(script.textContent ?? ""));
    const article = nodes.find((node) => {
      const type = node["@type"];
      const values = Array.isArray(type) ? type : [type];

      return values.some((value) =>
        ["Article", "NewsArticle", "ReportageNewsArticle"].includes(
          String(value),
        ),
      );
    });

    if (!article) {
      continue;
    }

    const articleBody = cleanText(String(article.articleBody ?? ""));
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

  return {
    title: fallbackTitle,
    byline: "",
    excerpt: "",
    paragraphs: [],
    source: "json-ld",
  };
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

function paragraphsFromHtml(
  html: string,
  JSDOM: JSDOMConstructor,
): string[] {
  const dom = new JSDOM(html);

  return Array.from(dom.window.document.querySelectorAll("p"))
    .map((node) => cleanText(node.textContent ?? ""))
    .filter(isUsefulParagraph);
}

function extractArticleParagraphs(document: Document): string[] {
  const selectors = [
    "article p",
    '[data-module="ArticleBody"] p',
    '[data-testid="article-body"] p',
    ".article-body p",
    ".caas-body p",
    "main p",
  ];

  for (const selector of selectors) {
    const paragraphs = Array.from(document.querySelectorAll(selector))
      .map((node) => cleanText(node.textContent ?? ""))
      .filter(isUsefulParagraph);

    if (paragraphs.length > 0) {
      return dedupeParagraphs(paragraphs);
    }
  }

  return [];
}

function titleFromDocument(document: Document): string {
  return cleanText(
    document.querySelector('meta[property="og:title"]')?.getAttribute("content") ??
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
    .split(/\n{2,}|(?<=\.)\s{2,}/)
    .map(cleanText)
    .filter(isUsefulParagraph);
}

function isUsefulParagraph(value: string): boolean {
  return (
    value.length > 80 &&
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
