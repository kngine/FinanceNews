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

// Header/footer "chrome" that publishers wrap around the actual story:
// newsletter prompts, social calls-to-action, related-link rails, legal
// notices, wire-service editorial credits, photo captions, etc. These add no
// value in reader mode, so we drop any paragraph that matches — regardless of
// where it sits in the extracted text.
const BOILERPLATE_PATTERNS: RegExp[] = [
  // Newsletter / subscription prompts
  /sign up for (our|the|a)\b.*\b(newsletter|briefing|digest|daily|weekly|report)/i,
  /subscribe to (our|the)\b/i,
  /get (our|the)\b.*\bnewsletter/i,
  /delivered (straight )?to your inbox/i,
  /^sign up (here|now|today|for free)/i,
  /already a subscriber/i,
  /become a (member|subscriber|supporter)/i,
  /support (our|independent|quality) journalism/i,
  /enjoy unlimited access/i,

  // Follow / social calls-to-action
  /^follow (us|me|@|along|the)\b/i,
  /follow .{0,40}\bon (twitter|x|facebook|instagram|linkedin|youtube|threads)\b/i,
  /like us on facebook/i,
  /connect with us/i,
  /join (the conversation|our community)/i,
  /share this (article|story|post|page)/i,
  /^share on\b/i,
  /click to share/i,

  // Related / more-content rails
  /^(read|see) (more|also)\b/i,
  /^related(\s|:|$)/i,
  /^more (from|on|stories|coverage)\b/i,
  /^recommended\b/i,
  /^most (read|popular|viewed|recent)\b/i,
  /^trending\b/i,
  /^up next\b/i,
  /^you (may|might) also like/i,
  /^also read\b/i,
  /^watch:/i,
  /^in this article:/i,

  // Legal / copyright
  /all rights reserved/i,
  /^copyright\b/i,
  /^©/,
  /terms of (service|use)/i,
  /privacy policy/i,
  /cookie (policy|settings|preferences|notice)/i,
  /do not sell my (personal )?(information|data)/i,

  // Wire-service / editorial footers
  /^reporting by\b/i,
  /^writing by\b/i,
  /^editing by\b/i,
  /^additional reporting by\b/i,
  /our standards:/i,
  /thomson reuters trust principles/i,
  /this article was originally published/i,
  /this story (was|has been) (originally )?(published|updated)/i,
  /(first|originally) appeared on\b/i,
  /^source:/i,

  // Captions / credits
  /getty images/i,
  /^(photo|image|illustration|video|graphic|chart|figure):/i,
  /^credit:/i,
  /^\(image credit/i,

  // Tips / engagement chrome
  /have a (confidential )?(news )?tip/i,
  /^contact (the author|us|the reporter)\b/i,
  /^advertisement$/i,
  /leave a comment/i,
  /^comments?$/i,
];

// A candidate is "good enough" to stop searching once it clears this bar.
const STRONG_CONTENT_CHARS = 1800;
// Hard ceiling on total extraction time. Serverless platforms (Netlify,
// Vercel) kill long-running functions, so we always return whatever we have
// by this deadline rather than letting the request hang and fail.
const EXTRACTION_BUDGET_MS = 8000;
const HTML_FETCH_TIMEOUT_MS = 6000;
const AMP_FETCH_TIMEOUT_MS = 5000;
const JINA_FETCH_TIMEOUT_MS = 6500;

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
// Many publishers serve the full, paywall-free article to search crawlers.
const GOOGLEBOT_UA =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

export async function getReaderContent(article: Article): Promise<ReaderContent> {
  try {
    return await getCachedReaderContent(
      article.url,
      article.title,
      article.summary,
    );
  } catch {
    // Absolute last resort: never throw out of the reader page.
    return {
      title: article.title,
      byline: "",
      excerpt: article.summary,
      paragraphs: article.summary ? [article.summary] : [],
      source: "rss",
      wordCount: article.summary ? article.summary.split(/\s+/).length : 0,
    };
  }
}

const getCachedReaderContent = unstable_cache(
  async (
    url: string,
    fallbackTitle: string,
    fallbackSummary: string,
  ): Promise<ReaderContent> => {
    let best: Candidate | null = null;

    const consider = (candidate: Candidate | null) => {
      if (!candidate || candidate.paragraphs.length === 0) {
        return;
      }
      if (!best || contentLength(candidate) > contentLength(best)) {
        best = candidate;
      }
    };

    const isStrong = () => Boolean(best && contentLength(best) >= STRONG_CONTENT_CHARS);

    try {
      // jsdom / Readability rely on native-ish behavior that can fail to load
      // in some serverless runtimes. Load them defensively — if unavailable we
      // simply rely on the Jina proxy (which needs no DOM) below.
      let JSDOM: JSDOMConstructor | null = null;
      let Readability:
        | typeof import("@mozilla/readability").Readability
        | null = null;
      try {
        ({ JSDOM } = await import("jsdom"));
        ({ Readability } = await import("@mozilla/readability"));
      } catch {
        JSDOM = null;
        Readability = null;
      }

      const parseDocument = (
        html: string,
        jsdomCtor: JSDOMConstructor,
        ReadabilityCtor: typeof import("@mozilla/readability").Readability,
      ): Document | null => {
        try {
          const document = new jsdomCtor(html, { url }).window.document;
          consider(extractJsonLd(document, fallbackTitle));
          consider(
            extractWithReadability(document, ReadabilityCtor, jsdomCtor, fallbackTitle),
          );
          consider(extractArticleParagraphs(document, fallbackTitle));
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
          return document;
        } catch {
          return null;
        }
      };

      const work = (async () => {
        if (JSDOM && Readability) {
          const jsdomCtor = JSDOM;
          const ReadabilityCtor = Readability;

          // Strategy 1 & 2: fetch the publisher HTML with two user agents in
          // parallel (Googlebot first — it slips past many soft paywalls),
          // then run every extractor against whichever response looks richest.
          const [googlebotHtml, browserHtml] = await Promise.all([
            safeFetchHtml(url, GOOGLEBOT_UA, HTML_FETCH_TIMEOUT_MS),
            safeFetchHtml(url, BROWSER_UA, HTML_FETCH_TIMEOUT_MS),
          ]);

          let primaryDoc: Document | null = null;
          for (const html of [googlebotHtml, browserHtml]) {
            if (!html) {
              continue;
            }
            const document = parseDocument(html, jsdomCtor, ReadabilityCtor);
            if (document && !primaryDoc) {
              primaryDoc = document;
            }
            if (isStrong()) {
              break;
            }
          }

          // Strategy 3: follow the AMP version, which is usually lean and
          // paywall-free, when the page advertises one.
          if (primaryDoc && !isStrong()) {
            const ampUrl = findAmpUrl(primaryDoc, url);
            if (ampUrl && ampUrl !== url) {
              const ampHtml = await safeFetchHtml(
                ampUrl,
                GOOGLEBOT_UA,
                AMP_FETCH_TIMEOUT_MS,
              );
              if (ampHtml) {
                try {
                  const ampDoc = new jsdomCtor(ampHtml, { url: ampUrl }).window
                    .document;
                  consider(toSource(extractJsonLd(ampDoc, fallbackTitle), "amp"));
                  consider(
                    toSource(
                      extractWithReadability(
                        ampDoc,
                        ReadabilityCtor,
                        jsdomCtor,
                        fallbackTitle,
                      ),
                      "amp",
                    ),
                  );
                  consider(
                    toSource(extractArticleParagraphs(ampDoc, fallbackTitle), "amp"),
                  );
                } catch {
                  // Ignore malformed AMP markup.
                }
              }
            }
          }
        }

        // Strategy 4: when local extraction is thin or jsdom is unavailable,
        // fall back to the Jina AI reader proxy, which renders the page
        // server-side and returns clean article text without needing a DOM.
        if (!isStrong()) {
          consider(await fetchViaJina(url, fallbackTitle, JINA_FETCH_TIMEOUT_MS));
        }
      })();

      // Whichever finishes first: the extraction work or the time budget.
      // Either way `best` holds the richest candidate gathered so far.
      await Promise.race([
        work.catch(() => undefined),
        new Promise<void>((resolve) => {
          setTimeout(resolve, EXTRACTION_BUDGET_MS);
        }),
      ]);
    } catch {
      // Never let extraction failures crash the reader request.
    }

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
  const paragraphs = stripBoilerplate(dedupeParagraphs(candidate.paragraphs));
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

async function safeFetchHtml(
  url: string,
  userAgent: string,
  timeoutMs: number,
): Promise<string | null> {
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
      signal: AbortSignal.timeout(timeoutMs),
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
  timeoutMs: number,
): Promise<Candidate | null> {
  try {
    const response = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        Accept: "text/plain",
        "X-Return-Format": "text",
      },
      signal: AbortSignal.timeout(timeoutMs),
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
    !BLOCKED_TEXT_PATTERNS.some((pattern) => pattern.test(value)) &&
    !isBoilerplate(value)
  );
}

function isBoilerplate(value: string): boolean {
  return BOILERPLATE_PATTERNS.some((pattern) => pattern.test(value));
}

// Remove leftover header/footer chrome from the assembled article. This runs in
// finalize so every extraction source (JSON-LD, Readability, AMP, Jina, …) is
// cleaned the same way before the paragraphs reach the reader.
function stripBoilerplate(paragraphs: string[]): string[] {
  return paragraphs.filter((paragraph) => !isBoilerplate(paragraph));
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
