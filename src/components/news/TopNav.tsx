import Link from "next/link";

export function TopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3.5">
        <Link className="flex items-center gap-2.5" href="/">
          <span className="flex size-8 items-center justify-center rounded-full bg-rh-green text-sm font-black text-black">
            F
          </span>
          <span className="text-[17px] font-bold tracking-tight text-ink">
            Finance
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm font-semibold text-muted">
          <Link
            className="rounded-full px-3.5 py-1.5 transition hover:bg-surface-2 hover:text-ink"
            href="/#feed"
          >
            News
          </Link>
          <Link
            className="rounded-full px-3.5 py-1.5 transition hover:bg-surface-2 hover:text-ink"
            href="/#sources"
          >
            Sources
          </Link>
        </nav>
      </div>
    </header>
  );
}
