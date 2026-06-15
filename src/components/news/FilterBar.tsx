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
    <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-3 shadow-card backdrop-blur">
      <form className="space-y-4" role="search">
        <div className="flex flex-col gap-3 md:flex-row">
          <label className="relative flex-1">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              Search
            </span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-20 pr-4 text-sm font-semibold outline-none transition focus:border-teal-300 focus:bg-white"
              defaultValue={query}
              name="q"
              placeholder="ticker, company, source, topic"
              type="search"
            />
          </label>
          <select
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-black text-ink outline-none transition focus:border-teal-300 focus:bg-white md:w-64"
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
          <button
            className="rounded-2xl bg-ink px-6 py-4 text-sm font-black text-white transition hover:bg-market"
            type="submit"
          >
            Apply
          </button>
        </div>

        {activeTag ? (
          <input name="tag" type="hidden" value={activeTag} />
        ) : null}

        <div className="flex gap-2 overflow-x-auto pb-1">
          {["All", ...categories].map((category) => {
            const active = category === activeCategory;

            return (
              <Link
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-black transition ${
                  active
                    ? "bg-market text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-teal-50 hover:text-market"
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
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">
            <span>Showing ticker ${activeTag.toUpperCase()}</span>
            <Link
              className="rounded-full bg-white/15 px-3 py-1 text-xs font-black transition hover:bg-white/25"
              href="/"
            >
              Clear
            </Link>
          </div>
        ) : null}
      </form>
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
