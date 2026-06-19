import Link from "next/link";
import type { Article } from "@/lib/news/types";

type ArticleCardProps = {
  article: Article;
  featured?: boolean;
};

export function ArticleCard({ article, featured = false }: ArticleCardProps) {
  const tickers = article.tickers ?? [];
  const readerHref = `/reader/${encodeURIComponent(article.id)}`;

  if (featured) {
    return (
      <article className="group overflow-hidden rounded-2xl border border-line bg-surface transition hover:border-[#2f333b]">
        {article.imageUrl ? (
          <Link href={readerHref} className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt=""
              className="h-52 w-full object-cover md:h-72"
              loading="lazy"
              src={article.imageUrl}
            />
          </Link>
        ) : null}

        <div className="p-5 md:p-6">
          <Meta article={article} />
          <Link href={readerHref}>
            <h2 className="mt-2.5 text-[17px] font-semibold leading-snug text-ink transition group-hover:text-rh-green">
              {article.title}
            </h2>
          </Link>
          {article.summary ? (
            <p className="mt-3 line-clamp-3 text-[15px] leading-7 text-muted">
              {article.summary}
            </p>
          ) : null}
          <Footer tickers={tickers} />
        </div>
      </article>
    );
  }

  return (
    <article className="group flex gap-4 px-5 py-4 transition hover:bg-surface-2">
      <div className="min-w-0 flex-1">
        <Meta article={article} />
        <Link href={readerHref}>
          <h3 className="mt-1.5 line-clamp-3 text-[17px] font-semibold leading-snug text-ink transition group-hover:text-rh-green">
            {article.title}
          </h3>
        </Link>
        {tickers.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {tickers.map((ticker) => (
              <TickerChip key={ticker} ticker={ticker} />
            ))}
          </div>
        ) : null}
      </div>

      {article.imageUrl ? (
        <Link
          href={readerHref}
          className="hidden shrink-0 self-start sm:block"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt=""
            className="size-24 rounded-xl object-cover"
            loading="lazy"
            src={article.imageUrl}
          />
        </Link>
      ) : null}
    </article>
  );
}

function Meta({ article }: { article: Article }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-faint">
      <span className="text-muted">{article.sourceName}</span>
      <span aria-hidden="true">·</span>
      <span>{formatRelative(article.publishedAt)}</span>
      <span className="rounded-full bg-rh-green-soft px-2 py-0.5 text-[10px] uppercase tracking-wide text-rh-green">
        {article.category}
      </span>
    </div>
  );
}

function Footer({ tickers }: { tickers: string[] }) {
  if (tickers.length === 0) {
    return null;
  }

  return (
    <div className="mt-5 flex flex-wrap gap-1.5">
      {tickers.map((ticker) => (
        <TickerChip key={ticker} ticker={ticker} />
      ))}
    </div>
  );
}

function TickerChip({ ticker }: { ticker: string }) {
  return (
    <Link
      className="rounded-md border border-line bg-surface-2 px-2 py-0.5 text-xs font-bold text-ink transition hover:border-rh-green hover:text-rh-green"
      href={`/?tag=${encodeURIComponent(ticker)}`}
    >
      {ticker}
    </Link>
  );
}

function formatRelative(value: string): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) {
    return "";
  }

  const diffMs = Date.now() - then;
  const minutes = Math.round(diffMs / 60000);

  if (minutes < 1) {
    return "now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(then);
}
