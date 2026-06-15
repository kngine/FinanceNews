import Link from "next/link";
import type { Article } from "@/lib/news/types";

type ArticleCardProps = {
  article: Article;
  featured?: boolean;
};

export function ArticleCard({ article, featured = false }: ArticleCardProps) {
  const tickers = article.tickers ?? [];

  return (
    <article
      className={`group rounded-3xl border border-slate-200 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-teal-200 ${
        featured ? "md:p-7" : ""
      }`}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
        <span className="rounded-full bg-teal-50 px-3 py-1 text-market">
          {article.category}
        </span>
        <span>{article.sourceName}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
      </div>

      <Link href={`/reader/${encodeURIComponent(article.id)}`}>
        <h2
          className={`font-black leading-tight tracking-tight text-ink group-hover:text-market ${
            featured ? "text-3xl md:text-5xl" : "text-xl"
          }`}
        >
          {article.title}
        </h2>
      </Link>

      {article.summary ? (
        <p
          className={`mt-4 leading-7 text-slate-600 ${
            featured ? "text-base md:text-lg" : "text-sm"
          }`}
        >
          {article.summary}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          className="text-sm font-bold text-market"
          href={`/reader/${encodeURIComponent(article.id)}`}
        >
          Reader mode
        </Link>
        {tickers.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tickers.map((ticker) => (
              <Link
                className="rounded-full bg-slate-950 px-2.5 py-1 text-xs font-black text-white transition hover:bg-market"
                href={`/?tag=${encodeURIComponent(ticker)}`}
                key={ticker}
              >
                ${ticker}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
