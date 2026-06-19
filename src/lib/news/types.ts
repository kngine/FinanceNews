export type NewsCategory =
  | "Markets"
  | "Economy"
  | "Policy"
  | "Regulation"
  | "Companies";

export type TrustTier = "official" | "public-rss";

export type NewsSource = {
  id: string;
  name: string;
  feedUrl: string;
  homepageUrl: string;
  category: NewsCategory;
  trustTier: TrustTier;
  enabled: boolean;
};

export type Article = {
  id: string;
  title: string;
  summary: string;
  url: string;
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  category: NewsCategory;
  publishedAt: string;
  tags: string[];
  tickers: string[];
  imageUrl?: string;
};

export type FeedError = {
  sourceId: string;
  sourceName: string;
  message: string;
};

export type NewsFeed = {
  articles: Article[];
  errors: FeedError[];
  generatedAt: string;
};
