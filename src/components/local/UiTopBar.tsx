"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Moon, Search, Sun, Home, CornerDownLeft, Tag, UserRound } from "lucide-react";
import { useShellNav, useUi, type ShellLink } from "@/lib/local/ui";
import { setMode } from "@/components/local/LocalTheme";
import { getSettings, getStock, getVisits } from "@/lib/station/store";
import { cn } from "@/lib/utils";

/** Back to the stations. The lab's stations never link to one another (only to the welcome page,
 *  checked by pages.crawl), so the search offers this station's pages and records, and this. */
const STATIONS: ShellLink[] = [
  { href: "/welcome", label: "الصفحة الرئيسية", icon: Home },
];

/**
 * The new green look's top bar (screens wider than a phone): search ⌘K over this station's pages and
 * the stations, the station's light/dark switch, the alerts (the numbers in its menu) and the lab.
 * Nothing at all in the classic look.
 */
export function UiTopBar({ themeKey }: { themeKey?: string }) {
  const ui = useUi();
  const nav = useShellNav();
  const router = useRouter();
  const pathname = usePathname();
  const [pal, setPal] = useState(false);
  const [bell, setBell] = useState(false);
  const [dark, setDark] = useState(false);
  const [company, setCompany] = useState("");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ui !== "new") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- this device's data is read once the page is on screen
    setCompany(getSettings().labName || "");
    const run = () => setDark(document.documentElement.getAttribute("data-theme") === "dark");
    run();
    const obs = new MutationObserver(run);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setQ(""); setSel(0); setPal((p) => !p); } };
    window.addEventListener("keydown", k);
    return () => { obs.disconnect(); window.removeEventListener("keydown", k); };
  }, [ui]);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    const pages = nav.links.map((l) => ({ ...l, group: nav.app }));
    const all = [...pages, ...STATIONS.filter((s) => !pages.some((p) => p.href === s.href)).map((s) => ({ ...s, group: "المحطات" }))];
    if (!t) return all;
    const found = all.filter((l) => `${l.label} ${l.hint ?? ""}`.toLowerCase().includes(t));
    if (t.length < 2 || !pal) return found;
    // The records themselves, this station's only: the patients' visits (lab station), the stock items (store).
    const has = (x: string | null | undefined) => !!x && x.toLowerCase().includes(t);
    const here = "/" + (pathname.split("/")[1] ?? "");
    const visits = here !== "/station" ? [] : getVisits().filter((v) => has(v.patient.name) || has(v.patient.phone)).sort((a, b) => b.created_at - a.created_at).slice(0, 5)
      .map((v) => ({ href: `/station/visits?open=${v.id}`, label: v.patient.name, hint: `زيارة ${new Date(v.created_at).toLocaleDateString("en-CA")}`, icon: UserRound, group: "المراجعون" }));
    const items = here !== "/store" ? [] : getStock().filter((i) => has(i.name)).slice(0, 5)
      .map((i) => ({ href: "/store/inventory", label: i.name, hint: `الرصيد ${i.qty}`, icon: Tag, group: "المخزن" }));
    return [...found, ...visits, ...items];
  }, [q, nav, pal, pathname]);
  // This station's own pages as pills (not the linked stations).
  const base = "/" + (pathname.split("/")[1] ?? "");
  const tabs = nav.links.filter((l) => l.href === base || l.href.startsWith(base + "/"));
  const tabOn = (href: string) => pathname === href || (href !== base && pathname.startsWith(href + "/")) || (href === base && pathname === base);

  if (ui !== "new") return null;
  const alerts = nav.links.filter((l) => (l.n ?? 0) > 0);
  const go = (href: string) => { setPal(false); router.push(href); };
  const toggleTheme = () => {
    if (!themeKey) return;
    setMode(themeKey, dark ? "light" : "dark"); // this station's own choice, as in its Settings
  };

  return (
    <>
      <header data-testid="ui-topbar" className="no-print mb-5 hidden items-center gap-3 rounded-[28px] bg-surface px-5 py-3 shadow-[var(--shadow-card)] md:flex">
        <button type="button" onClick={() => { setQ(""); setSel(0); setPal(true); }} aria-label="بحث" data-testid="ui-search"
          className="flex h-11 min-w-0 flex-1 items-center gap-3 rounded-full bg-canvas px-4 text-start text-sm text-muted md:max-w-md">
          <Search className="size-[18px] shrink-0" /><span className="flex-1 truncate">ابحث عن صفحة أو سجل…</span>
          <kbd className="hidden rounded-md border border-line bg-surface px-1.5 text-[10px] sm:block" dir="ltr">⌘K</kbd>
        </button>
        <div className="ms-auto flex items-center gap-1.5">
          {themeKey && (
            <button type="button" onClick={toggleTheme} aria-label="تبديل المظهر" className="grid size-10 place-items-center rounded-full text-muted hover:bg-canvas">
              {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
            </button>
          )}
          <div className="relative">
            <button type="button" onClick={() => setBell((b) => !b)} aria-label="التنبيهات" data-testid="ui-bell" className="relative grid size-10 place-items-center rounded-full text-muted hover:bg-canvas">
              <Bell className="size-[18px]" />
              {alerts.length > 0 && <span className="absolute end-2 top-2 size-2 rounded-full bg-red-500 ring-2 ring-surface" />}
            </button>
            {bell && (
              <div className="absolute end-0 top-12 z-50 w-72 rounded-3xl border border-line bg-surface p-3 shadow-[var(--shadow-pop)]">
                <div className="px-2 pb-2 text-sm font-bold">التنبيهات</div>
                {alerts.length ? alerts.map((a) => (
                  <Link key={a.href} href={a.href} onClick={() => setBell(false)} className="flex items-center gap-2 rounded-2xl px-3 py-2 text-sm hover:bg-canvas">
                    <a.icon className="size-4 text-brand" /><span className="flex-1 truncate">{a.label}</span>
                    <span className="rounded-md bg-brand-dark px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">{a.n}</span>
                  </Link>
                )) : <p className="px-3 py-4 text-center text-sm text-muted">لا تنبيهات. كل شيء على ما يرام.</p>}
              </div>
            )}
          </div>
          <div className="ms-2 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-brand-light text-sm font-bold text-brand-dark">{(company || nav.app || "م").trim().slice(0, 1)}</span>
            <div className="hidden leading-tight lg:block">
              <div className="max-w-44 truncate text-sm font-bold">{company || "المختبر"}</div>
              <div className="max-w-44 truncate text-[11px] text-muted">{nav.app}</div>
            </div>
          </div>
        </div>
      </header>
      {tabs.length > 1 && (
        <nav className="no-print mb-5 hidden gap-1.5 overflow-x-auto pb-1 md:flex" aria-label="صفحات المحطة" data-testid="ui-tabs">
          {tabs.map((t) => {
            const on = tabOn(t.href);
            return <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined}
              className={cn("shrink-0 rounded-full px-4 py-1.5 text-sm transition-colors", on ? "bg-gradient-to-b from-brand to-brand-dark font-semibold text-white shadow-[0_6px_14px_-6px_var(--color-brand)]" : "text-muted hover:bg-surface hover:text-ink")}>{t.label}</Link>;
          })}
        </nav>
      )}

      {pal && (
        <div className="no-print fixed inset-0 z-[60] grid place-items-start bg-slate-900/40 px-4 pt-[12vh] backdrop-blur-[2px]" onClick={() => setPal(false)}>
          <div role="dialog" aria-label="بحث" data-testid="ui-palette" onClick={(e) => e.stopPropagation()} className="mx-auto w-full max-w-lg overflow-hidden rounded-3xl bg-surface shadow-[var(--shadow-pop)]">
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="size-[18px] text-muted" />
              <input ref={input} autoFocus value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }} placeholder="ابحث عن صفحة أو سجل…" aria-label="ابحث"
                onKeyDown={(e) => {
                  if (e.key === "Escape") setPal(false);
                  else if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
                  else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
                  else if (e.key === "Enter" && results[sel]) go(results[sel].href);
                }}
                className="h-14 flex-1 bg-transparent text-sm outline-none" />
            </div>
            <ul className="max-h-[50vh] overflow-y-auto p-2">
              {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">لا نتائج</li>}
              {results.map((r, i) => (
                <li key={r.group + r.href}>
                  <button type="button" onMouseEnter={() => setSel(i)} onClick={() => go(r.href)}
                    className={cn("flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-start text-sm", i === sel ? "bg-brand-light text-brand-dark" : "hover:bg-canvas")}>
                    <r.icon className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{r.label}</span>{r.hint && <span className="block truncate text-[11px] text-muted">{r.hint}</span>}</span>
                    <span className="shrink-0 text-[10px] text-muted">{r.group}</span>
                    {i === sel && <CornerDownLeft className="size-3.5 shrink-0" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
