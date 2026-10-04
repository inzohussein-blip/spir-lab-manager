import { NAV_ITEMS, allows } from "@/lib/nav";

/**
 * Server-side access check: can this role open this path? Detail routes inherit
 * their base nav item's roles (longest-prefix match). Unknown routes are
 * allowed (auth is enforced separately by the middleware).
 */
export function canAccess(pathname: string, role: string): boolean {
  if (role === "admin") return true;
  if (pathname === "/") return true; // the collector is sent on to his window by the page itself

  // The collector prints his receipts and tube labels.
  if (role === "collector" && /^\/orders\/[^/]+\/(receipt|label)$/.test(pathname)) return true;

  let match: (typeof NAV_ITEMS)[number] | null = null;
  for (const it of NAV_ITEMS) {
    if (it.href === "/") continue;
    if (pathname === it.href || pathname.startsWith(it.href + "/")) {
      if (!match || it.href.length > match.href.length) match = it;
    }
  }
  if (!match) return role !== "collector" || /^\/(login|verify|api)(\/|$)/.test(pathname);
  return allows(match, role);
}
