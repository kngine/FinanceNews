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

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 md:px-5 md:py-10" id="feed">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-ink md:text-4xl">
          News
        </h1>
        <p className="mt-1 text-sm text-muted">
          {totalArticles.toLocaleString()} stories · {sources.length} sources ·
          updated {formatTime(generatedAt)}
        </p>
      </header>

      <div className="mb-6">
        <FilterBar
          activeCategory={selectedCategory}
          activeTag={selectedTag}
          activeSource={selectedSource}
          categories={categories}
          query={query}
          sources={sources}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          {leadArticle ? (
            <>
              <ArticleCard article={leadArticle} featured />
              {restArticles.length > 0 ? (
                <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                  <div className="divide-y divide-line">
                    {restArticles.map((article) => (
                      <ArticleCard article={article} key={article.id} />
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <EmptyState />
          )}
        </div>

        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <SourcePanel
            errors={errors}
            generatedAt={generatedAt}
            sources={sources}
          />
        </div>
      </div>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface p-10 text-center">
      <h2 className="text-xl font-bold text-ink">No matching stories</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-muted">
        Try clearing the search, changing the source, or checking back after the
        next refresh.
      </p>
      <Link
        className="mt-6 inline-flex rounded-full bg-rh-green px-5 py-2.5 text-sm font-bold text-black"
        href="/"
      >
        Clear filters
      </Link>
    </div>
  );
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
