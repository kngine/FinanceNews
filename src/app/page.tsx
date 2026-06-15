import { NewsDashboard } from "@/components/news/NewsDashboard";
import { getNewsFeed } from "@/lib/news/fetchFeeds";
import { NEWS_SOURCES, enabledSources } from "@/lib/news/sources";
import type { Article, NewsCategory } from "@/lib/news/types";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const query = getParam(params.q);
  const selectedCategory = getParam(params.category) || "All";
  const selectedSource = getParam(params.source) || "All";
  const selectedTag = getParam(params.tag);
  const feed = await getNewsFeed();
  const categories = uniqueCategories(NEWS_SOURCES.map((source) => source.category));
  const articles = filterArticles(
    feed.articles,
    query,
    selectedCategory,
    selectedSource,
    selectedTag,
  );

  return (
    <NewsDashboard
      articles={articles}
      categories={categories}
      errors={feed.errors}
      generatedAt={feed.generatedAt}
      query={query}
      selectedCategory={selectedCategory}
      selectedSource={selectedSource}
      selectedTag={selectedTag}
      sources={enabledSources}
      totalArticles={feed.articles.length}
    />
  );
}

function filterArticles(
  articles: Article[],
  query: string,
  category: string,
  source: string,
  tag: string,
): Article[] {
  const normalizedQuery = query.toLowerCase().trim();
  const normalizedTag = tag.toUpperCase().trim();

  return articles.filter((article) => {
    const matchesQuery =
      !normalizedQuery ||
      [
        article.title,
        article.summary,
        article.sourceName,
        article.category,
        ...article.tags,
        ...(article.tickers ?? []),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);

    const matchesCategory = category === "All" || article.category === category;
    const matchesSource = source === "All" || article.sourceId === source;
    const matchesTag =
      !normalizedTag || (article.tickers ?? []).includes(normalizedTag);

    return matchesQuery && matchesCategory && matchesSource && matchesTag;
  });
}

function getParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function uniqueCategories(categories: NewsCategory[]): NewsCategory[] {
  return Array.from(new Set(categories));
}
