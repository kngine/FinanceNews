import Link from "next/link";

export function TopNav() {
  return (
    <header className="border-b border-slate-200/80 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link className="flex items-center gap-3" href="/">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-market text-lg font-black text-white">
            FN
          </span>
          <span>
            <span className="block text-xl font-black tracking-tight text-ink">
              Finance News
            </span>
            <span className="block text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
              Trusted open access
            </span>
          </span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-600 md:flex">
          <a href="#top-stories">Top Stories</a>
          <a href="#sources">Sources</a>
          <a href="#policy">Policy</a>
        </nav>
      </div>
    </header>
  );
}
