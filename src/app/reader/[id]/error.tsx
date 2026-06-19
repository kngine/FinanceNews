"use client";

import Link from "next/link";

export default function ReaderError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16 text-center">
      <h1 className="text-2xl font-bold text-ink">This story couldn’t load</h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted">
        Something went wrong while preparing the article. You can try again or
        head back to the news feed.
      </p>
      <div className="mt-8 flex items-center justify-center gap-3">
        <button
          className="rounded-full bg-rh-green px-5 py-2.5 text-sm font-bold text-black transition hover:brightness-110"
          onClick={reset}
          type="button"
        >
          Try again
        </button>
        <Link
          className="rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-[#2f333b]"
          href="/"
        >
          Back to News
        </Link>
      </div>
    </main>
  );
}
