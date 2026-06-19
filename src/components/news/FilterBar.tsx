import Link from "next/link";
import type { NewsCategory, NewsSource } from "@/lib/news/types";

type FilterBarProps = {
  categories: NewsCategory[];
  sources: NewsSource[];
  activeCategory?: string;
  activeSource?: string;
  activeTag?: string;
  query?: string;
};

export function FilterBar({
  categories,
  sources,
  activeCategory = "All",
  activeSource = "All",
  activeTag = "",
  query = "",
}: FilterBarProps) {
  return (
    <section className="space-y-3">
      <form className="flex flex-col gap-2.5 sm:flex-row" role="search">
        <label className="relative flex-1">
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3-3" strokeLinecap="round" />
          </svg>
          <input
            className="w-full rounded-full border border-line bg-surface py-2.5 pl-10 pr-4 text-sm font-medium text-ink outline-none transition placeholder:text-faint focus:border-rh-green"
            defaultValue={query}
            name="q"
            placeholder="Search news, tickers, companies"
            type="search"
          />
        </label>
        <select
          className="rounded-full border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink outline-none transition focus:border-rh-green sm:w-52"
          defaultValue={activeSource}
          name="source"
        >
          <option value="All">All sources</option>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.name}
            </option>
          ))}
        </select>
        {activeTag ? <input name="tag" type="hidden" value={activeTag} /> : null}
        <button
          className="rounded-full bg-rh-green px-6 py-2.5 text-sm font-bold text-black transition hover:brightness-110"
          type="submit"
        >
          Search
        </button>
      </form>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {["All", ...categories].map((category) => {
          const active = category === activeCategory;

          return (
            <Link
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                active
                  ? "bg-rh-green text-black"
                  : "border border-line bg-surface text-muted hover:border-[#2f333b] hover:text-ink"
              }`}
              href={buildCategoryHref(category, activeSource, query, activeTag)}
              key={category}
            >
              {category}
            </Link>
          );
        })}
      </div>

      {activeTag ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink">
          <span>
            Filtering by{" "}
            <span className="font-bold text-rh-green">${activeTag.toUpperCase()}</span>
          </span>
          <Link
            className="rounded-full bg-surface-2 px-3 py-1 text-xs font-bold text-muted transition hover:text-ink"
            href="/"
          >
            Clear
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function buildCategoryHref(
  category: string,
  source: string,
  query: string,
  tag: string,
): string {
  const params = new URLSearchParams();

  if (category !== "All") {
    params.set("category", category);
  }
  if (source !== "All") {
    params.set("source", source);
  }
  if (query) {
    params.set("q", query);
  }
  if (tag) {
    params.set("tag", tag);
  }

  const value = params.toString();
  return value ? `/?${value}` : "/";
}
