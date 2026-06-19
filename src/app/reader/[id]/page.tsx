import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getNewsFeed } from "@/lib/news/fetchFeeds";
import { getReaderContent } from "@/lib/news/readerContent";
import type { ReaderSource } from "@/lib/news/readerContent";
import type { Article } from "@/lib/news/types";

export const runtime = "nodejs";
export const maxDuration = 30;

type ReaderPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const SOURCE_LABELS: Record<ReaderSource, string> = {
  "json-ld": "Structured data",
  readability: "Reader engine",
  "article-html": "Page extraction",
  amp: "AMP page",
  jina: "Reader proxy",
  metadata: "Page summary",
  rss: "Feed summary",
};

export default async function ReaderPage({ params }: ReaderPageProps) {
  const { id } = await params;
  const feed = await getNewsFeed();
  const article = feed.articles.find(
    (item) => item.id === decodeURIComponent(id),
  );

  if (!article) {
    notFound();
  }

  const tickers = article.tickers ?? [];

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 md:py-12">
      <Link
        className="mb-8 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-ink"
        href="/"
      >
        <span aria-hidden="true">←</span> Back to News
      </Link>

      <article>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-faint">
          <span className="rounded-full bg-rh-green-soft px-2.5 py-1 uppercase tracking-wide text-rh-green">
            {article.category}
          </span>
          <span className="text-muted">{article.sourceName}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={article.publishedAt}>
            {formatDate(article.publishedAt)}
          </time>
        </div>

        <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight text-ink md:text-5xl">
          {article.title}
        </h1>

        {tickers.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {tickers.map((ticker) => (
              <Link
                className="rounded-md border border-line bg-surface-2 px-2.5 py-1 text-xs font-bold text-ink transition hover:border-rh-green hover:text-rh-green"
                href={`/?tag=${encodeURIComponent(ticker)}`}
                key={ticker}
              >
                {ticker}
              </Link>
            ))}
          </div>
        ) : null}

        {article.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            className="mt-8 w-full rounded-2xl border border-line object-cover"
            src={article.imageUrl}
          />
        ) : null}

        <Suspense fallback={<ReaderSkeleton />}>
          <ReaderBody article={article} />
        </Suspense>
      </article>
    </main>
  );
}

async function ReaderBody({ article }: { article: Article }) {
  const readerContent = await getReaderContent(article);
  const readMinutes = Math.max(1, Math.round(readerContent.wordCount / 220));

  return (
    <>
      {readerContent.byline ? (
        <p className="mt-6 text-sm font-semibold text-muted">
          By {readerContent.byline}
          {readerContent.paragraphs.length > 0
            ? ` · ${readMinutes} min read`
            : ""}
        </p>
      ) : null}

      <div className="mt-8 space-y-5 border-t border-line pt-8">
        {readerContent.paragraphs.length > 0 ? (
          readerContent.paragraphs.map((paragraph, index) => (
            <p
              className="text-lg leading-8 text-[#d4d6db]"
              key={`${index}-${paragraph.slice(0, 40)}`}
            >
              {paragraph}
            </p>
          ))
        ) : (
          <p className="text-lg leading-8 text-muted">
            We could not extract the full text from this source. Open the
            original article below for the complete story.
          </p>
        )}
      </div>

      {article.tags.length > 0 ? (
        <div className="mt-8 flex flex-wrap gap-2">
          {article.tags.map((tag) => (
            <span
              className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-muted"
              key={tag}
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-10 rounded-2xl border border-line bg-surface p-5">
        <p className="text-sm leading-6 text-muted">
          Extracted via{" "}
          <span className="font-semibold text-ink">
            {SOURCE_LABELS[readerContent.source]}
          </span>
          . The publisher remains the canonical source.
        </p>
        <a
          className="mt-4 inline-flex rounded-full bg-rh-green px-5 py-2.5 text-sm font-bold text-black transition hover:brightness-110"
          href={article.url}
          rel="noreferrer"
          target="_blank"
        >
          Read full article at {article.sourceName}
        </a>
      </div>
    </>
  );
}

function ReaderSkeleton() {
  return (
    <div className="mt-8 space-y-4 border-t border-line pt-8" aria-hidden="true">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted">
        <span className="size-4 animate-spin rounded-full border-2 border-line border-t-rh-green" />
        Loading full article…
      </div>
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          className="h-4 animate-pulse rounded bg-surface-2"
          key={index}
          style={{ width: `${[100, 96, 98, 90, 94, 70][index]}%` }}
        />
      ))}
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
