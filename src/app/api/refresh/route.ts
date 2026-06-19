import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  // Expire the cached feed immediately so the next render refetches live data.
  revalidateTag("finance-news-feed-v7", { expire: 0 });
  revalidatePath("/", "page");

  return NextResponse.json({
    ok: true,
    refreshedAt: new Date().toISOString(),
  });
}
