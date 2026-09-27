import Link from "next/link";

/** «الأحدث / الأقدم» under a long list: pages of `size` rows, keeping the list's filters. */
export function Pager({ page, hasMore, path, params = {} }: {
  page: number; hasMore: boolean; path: string; params?: Record<string, string | undefined>;
}) {
  if (page <= 1 && !hasMore) return null;
  const href = (p: number) => {
    const qs = new URLSearchParams(Object.entries({ ...params, page: p > 1 ? String(p) : "" }).filter(([, v]) => v) as [string, string][]).toString();
    return qs ? `${path}?${qs}` : path;
  };
  const btn = "rounded-lg border border-line bg-surface px-3 py-1.5 text-sm hover:bg-canvas";
  return (
    <nav data-testid="pager" aria-label="الصفحات" className="mt-4 flex items-center justify-center gap-3 text-sm">
      {page > 1 ? <Link href={href(page - 1)} className={btn}>‹ الأحدث</Link> : <span className={`${btn} opacity-40`}>‹ الأحدث</span>}
      <span className="text-muted">صفحة <span className="tabular-nums">{page}</span></span>
      {hasMore ? <Link href={href(page + 1)} className={btn}>الأقدم ›</Link> : <span className={`${btn} opacity-40`}>الأقدم ›</span>}
    </nav>
  );
}

/** The page number from the address (1 when absent or wrong). */
export const pageOf = (v: string | undefined) => Math.max(1, Math.min(10_000, Math.floor(Number(v) || 1)));
