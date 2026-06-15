import type { FeedError, NewsSource } from "@/lib/news/types";

type SourcePanelProps = {
  sources: NewsSource[];
  errors: FeedError[];
  generatedAt: string;
};

export function SourcePanel({ sources, errors, generatedAt }: SourcePanelProps) {
  const offlineSourceIds = new Set(errors.map((error) => error.sourceId));

  return (
    <aside className="space-y-5">
      <section
        className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card"
        id="sources"
      >
        <h2 className="text-lg font-black text-ink">Verified Sources</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Finance News only displays allowlisted public feeds and always sends
          readers to the original publisher.
        </p>
        <div className="mt-5 space-y-3">
          {sources.map((source) => (
            <a
              className="block rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:border-teal-200 hover:bg-teal-50"
              href={source.homepageUrl}
              key={source.id}
              rel="noreferrer"
              target="_blank"
            >
              <span className="block text-sm font-black text-ink">
                {source.name}
              </span>
              <span className="mt-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                <span>{source.category}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {offlineSourceIds.has(source.id) ? "Retrying" : "Live"}
                </span>
              </span>
            </a>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="text-lg font-black text-ink">Source Policy</h2>
        <ul className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
          <li>Feeds are allowlisted from trusted publishers.</li>
          <li>Reader mode extracts content when the publisher page provides it.</li>
          <li>Original source links stay available on every story.</li>
          <li>Last refreshed {formatDate(generatedAt)}.</li>
        </ul>
      </section>

      {errors.length > 0 ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <h2 className="font-black">Temporarily unavailable</h2>
          <p className="mt-2 leading-6">
            Some sources did not respond during the latest refresh. Available
            sources are still shown.
          </p>
        </section>
      ) : null}
    </aside>
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
