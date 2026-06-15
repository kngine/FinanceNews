import Link from "next/link";
import { ArticleCard } from "./ArticleCard";
import { FilterBar } from "./FilterBar";
import { SourcePanel } from "./SourcePanel";
import type {
  Article,
  FeedError,
  NewsCategory,
  NewsSource,
} from "@/lib/news/types";

type NewsDashboardProps = {
  articles: Article[];
  categories: NewsCategory[];
  errors: FeedError[];
  generatedAt: string;
  query?: string;
  selectedCategory?: string;
  selectedSource?: string;
  selectedTag?: string;
  sources: NewsSource[];
  totalArticles: number;
};

export function NewsDashboard({
  articles,
  categories,
  errors,
  generatedAt,
  query,
  selectedCategory,
  selectedSource,
  selectedTag,
  sources,
  totalArticles,
}: NewsDashboardProps) {
  const [leadArticle, ...restArticles] = articles;
  const policyArticles = articles
    .filter((article) => article.category === "Policy")
    .slice(0, 3);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 md:py-12">
      <section className="mb-6 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card md:p-7">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.24em] text-slate-500">
              Live Market News
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-ink md:text-5xl">
              Finance News
            </h1>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric label="Articles" value={totalArticles.toString()} />
            <Metric label="Sources" value={sources.length.toString()} />
            <Metric label="Categories" value={categories.length.toString()} />
            <Metric label="Access" value="Open" />
          </div>
        </div>
      </section>

      <div className="mb-8">
        <FilterBar
          activeCategory={selectedCategory}
          activeTag={selectedTag}
          activeSource={selectedSource}
          categories={categories}
          query={query}
          sources={sources}
        />
      </div>

      <section
        className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]"
        id="top-stories"
      >
        <div className="space-y-6">
          {leadArticle ? (
            <>
              <ArticleCard article={leadArticle} featured />
              <div className="grid gap-5 md:grid-cols-2">
                {restArticles.map((article) => (
                  <ArticleCard article={article} key={article.id} />
                ))}
              </div>
            </>
          ) : (
            <EmptyState />
          )}
        </div>

        <div className="space-y-5">
          <SourcePanel
            errors={errors}
            generatedAt={generatedAt}
            sources={sources}
          />

          {policyArticles.length > 0 ? (
            <section
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card"
              id="policy"
            >
              <h2 className="text-lg font-black text-ink">Policy Watch</h2>
              <div className="mt-4 space-y-4">
                {policyArticles.map((article) => (
                  <a
                    className="block border-b border-slate-100 pb-4 last:border-b-0 last:pb-0"
                    href={article.url}
                    key={article.id}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <span className="text-sm font-black leading-6 text-ink hover:text-market">
                      {article.title}
                    </span>
                    <span className="mt-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {article.sourceName}
                    </span>
                  </a>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-slate-50 p-4">
      <span className="block text-3xl font-black text-market">{value}</span>
      <span className="mt-1 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center shadow-card">
      <h2 className="text-2xl font-black text-ink">No matching stories</h2>
      <p className="mx-auto mt-3 max-w-xl leading-7 text-slate-600">
        Try clearing the search, changing the source, or checking back after
        the next feed refresh.
      </p>
      <Link
        className="mt-6 inline-flex rounded-2xl bg-market px-5 py-3 text-sm font-black text-white"
        href="/"
      >
        Clear filters
      </Link>
    </div>
  );
}
