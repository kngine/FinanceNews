import { NextResponse } from "next/server";
import { getNewsFeed } from "@/lib/news/fetchFeeds";

export const revalidate = 900;

export async function GET() {
  const feed = await getNewsFeed();

  return NextResponse.json(feed, {
    headers: {
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
    },
  });
}
