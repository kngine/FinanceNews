import type { FeedError, NewsSource } from "@/lib/news/types";

type SourcePanelProps = {
  sources: NewsSource[];
  errors: FeedError[];
  generatedAt: string;
};

export function SourcePanel({ sources, errors, generatedAt }: SourcePanelProps) {
  const offlineSourceIds = new Set(errors.map((error) => error.sourceId));

  return (
    <aside className="space-y-4" id="sources">
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-faint">
          Sources
        </h2>
        <div className="mt-3 space-y-1">
          {sources.map((source) => {
            const offline = offlineSourceIds.has(source.id);

            return (
              <a
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition hover:bg-surface-2"
                href={source.homepageUrl}
                key={source.id}
                rel="noreferrer"
                target="_blank"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {source.name}
                  </span>
                  <span className="block text-xs text-faint">
                    {source.category}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold">
                  <span
                    aria-hidden="true"
                    className={`size-1.5 rounded-full ${
                      offline ? "bg-rh-red" : "bg-rh-green"
                    }`}
                  />
                  <span className={offline ? "text-rh-red" : "text-muted"}>
                    {offline ? "Retrying" : "Live"}
                  </span>
                </span>
              </a>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-faint">
          How it works
        </h2>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
          <li>Allowlisted public feeds from trusted publishers.</li>
          <li>Reader mode pulls the full article text when available.</li>
          <li>Original source links stay on every story.</li>
          <li>Last refreshed {formatDate(generatedAt)}.</li>
        </ul>
      </section>

      {errors.length > 0 ? (
        <section className="rounded-2xl border border-rh-red/30 bg-rh-red/5 p-4 text-sm text-rh-red">
          <h2 className="font-bold">Some feeds are retrying</h2>
          <p className="mt-1.5 leading-6 text-muted">
            A few sources did not respond in the latest refresh. Everything else
            is still live.
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
