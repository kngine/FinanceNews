import Link from "next/link";
import { notFound } from "next/navigation";
import { getNewsFeed } from "@/lib/news/fetchFeeds";
import { getReaderContent } from "@/lib/news/readerContent";

export const runtime = "nodejs";
export const maxDuration = 30;

type ReaderPageProps = {
  params: Promise<{
    id: string;
  }>;
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
  const readerContent = await getReaderContent(article);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 md:py-16">
      <Link
        className="mb-8 inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-600 shadow-card transition hover:border-teal-200 hover:text-market"
        href="/"
      >
        Back to Finance News
      </Link>

      <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-card md:p-12">
        <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
          <span className="rounded-full bg-teal-50 px-3 py-1 text-market">
            {article.category}
          </span>
          <span>{article.sourceName}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={article.publishedAt}>
            {formatDate(article.publishedAt)}
          </time>
        </div>

        <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight text-ink md:text-6xl">
          {readerContent.title || article.title}
        </h1>

        {readerContent.byline ? (
          <p className="mt-4 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
            By {readerContent.byline}
          </p>
        ) : null}

        {tickers.length > 0 ? (
          <div className="mt-6 flex flex-wrap gap-2">
            {tickers.map((ticker) => (
              <Link
                className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-black text-white transition hover:bg-market"
                href={`/?tag=${encodeURIComponent(ticker)}`}
                key={ticker}
              >
                ${ticker}
              </Link>
            ))}
          </div>
        ) : null}

        <div className="mt-8 space-y-6">
          {readerContent.paragraphs.length > 0 ? (
            readerContent.paragraphs.map((paragraph) => (
              <p
                className="text-xl leading-9 text-slate-700"
                key={paragraph.slice(0, 80)}
              >
                {paragraph}
              </p>
            ))
          ) : (
            <p className="text-xl leading-9 text-slate-700">
              Could not extract readable open article text from this source.
              Open the original source for the full story.
            </p>
          )}
        </div>

        {article.tags.length > 0 ? (
          <div className="mt-8 flex flex-wrap gap-2">
            {article.tags.map((tag) => (
              <span
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500"
                key={tag}
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-10 rounded-3xl bg-slate-50 p-5">
          <p className="text-sm leading-6 text-slate-600">
            Reader mode extracted this from the publisher page using the{" "}
            <span className="font-bold">{readerContent.source}</span> parser.
            If extraction misses anything, the original source remains the
            canonical article.
          </p>
          <a
            className="mt-4 inline-flex rounded-2xl bg-market px-5 py-3 text-sm font-black text-white"
            href={article.url}
            rel="noreferrer"
            target="_blank"
          >
            Read full article at {article.sourceName}
          </a>
        </div>
      </article>
    </main>
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
