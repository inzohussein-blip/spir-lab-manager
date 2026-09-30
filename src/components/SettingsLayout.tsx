"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Search, X } from "lucide-react";

/**
 * The shared frame of every settings page (the five stations, the admin panel): sections chosen
 * from a side list (a scrolling strip on a phone), the open section kept in the address (#id),
 * a search that finds a setting in any section, a count of what is switched on per section, and
 * a small «حُفظ ✓» whenever something is saved.
 *
 * Every section stays mounted (hidden when not open), so what was typed is kept while moving
 * between them. The direct children of a section's content are its cards: the search shows the
 * cards whose text holds the words and hides the others.
 */
export interface SettingsSection {
  id: string;
  label: string;
  /** One line under the section's title. */
  hint?: string;
  icon: ReactNode;
  /** E.g. «2 مفعّل» — shown beside the section's name. */
  badge?: ReactNode;
  content: ReactNode;
  /** Shown beside the cards on wide screens (e.g. a live preview), below them otherwise. */
  aside?: ReactNode;
}

const SAVED_EVENT = "settings-saved";
/** Show «حُفظ ✓» on the open settings page. */
export function notifySaved() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SAVED_EVENT));
}

/** Arabic-friendly matching: no diacritics or tatweel, one form of alef, ta marbuta and ya. */
const norm = (t: string) =>
  t.toLowerCase().replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/\s+/g, " ");

export function SettingsLayout({ title, icon, sections, search = false, intro }: {
  title: string;
  icon: ReactNode;
  sections: SettingsSection[];
  /** A search box above the sections (for the longer pages). */
  search?: boolean;
  intro?: ReactNode;
}) {
  const [active, setActive] = useState(sections[0]?.id ?? "");
  const [q, setQ] = useState("");
  const [saved, setSaved] = useState(false);
  const [found, setFound] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const ids = sections.map((s) => s.id).join(",");

  // The open section follows the address (#id), so a link or a reload opens the same one.
  useEffect(() => {
    const read = () => {
      const h = decodeURIComponent(location.hash.slice(1));
      if (ids.split(",").includes(h)) setActive(h);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [ids]);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const on = () => { setSaved(true); clearTimeout(t); t = setTimeout(() => setSaved(false), 1600); };
    window.addEventListener(SAVED_EVENT, on);
    return () => { window.removeEventListener(SAVED_EVENT, on); clearTimeout(t); };
  }, []);

  // Search: keep the cards whose text holds every word typed.
  useEffect(() => {
    const words = norm(q).trim().split(" ").filter(Boolean);
    let any = false;
    root.current?.querySelectorAll<HTMLElement>("[data-sec]").forEach((sec) => {
      let hits = 0;
      sec.querySelectorAll<HTMLElement>(":scope [data-sec-body] > *").forEach((card) => {
        const text = norm(card.textContent ?? "");
        const hit = words.every((w) => text.includes(w));
        card.toggleAttribute("data-miss", words.length > 0 && !hit);
        if (hit) hits++;
      });
      sec.toggleAttribute("data-miss", words.length > 0 && hits === 0);
      if (hits) any = true;
    });
    setFound(!words.length || any);
  }, [q]);

  function open(id: string) {
    setActive(id);
    setQ("");
    history.replaceState(null, "", `#${id}`);
    root.current?.scrollIntoView({ block: "start" });
  }

  const searching = q.trim().length > 0;
  return (
    <div ref={root} className="mx-auto max-w-6xl scroll-mt-4" data-testid="settings-layout">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold">{icon} {title}</h1>
        <span aria-live="polite" data-testid="settings-saved"
          className={`inline-flex items-center gap-1 rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-semibold text-brand-dark transition-opacity ${saved ? "opacity-100" : "opacity-0"}`}>
          <Check className="size-3.5" /> حُفظ
        </span>
        {search && (
          <label className="relative ms-auto w-full sm:w-72">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث في الإعدادات… (مثلاً: ملصق، توقيع)" aria-label="بحث في الإعدادات"
              className="w-full rounded-lg border border-line bg-surface py-2 pe-8 ps-9 text-sm outline-none focus:border-brand" />
            {q && <button type="button" onClick={() => setQ("")} aria-label="مسح البحث" className="absolute end-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink"><X className="size-4" /></button>}
          </label>
        )}
      </div>
      {intro}

      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="أقسام الإعدادات" data-testid="settings-nav"
          className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:sticky lg:top-4 lg:mx-0 lg:flex-col lg:self-start lg:overflow-visible lg:px-0">
          {sections.map((s) => {
            const on = !searching && s.id === active;
            return (
              <button key={s.id} type="button" onClick={() => open(s.id)} data-section={s.id} aria-current={on ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-start text-sm transition-colors ${on ? "bg-brand text-white" : "text-ink hover:bg-canvas"}`}>
                <span className="shrink-0 [&>svg]:size-4">{s.icon}</span>
                <span className="min-w-0">
                  <span className="block font-semibold">{s.label}</span>
                  {s.hint && <span className={`hidden text-[11px] lg:block ${on ? "text-white/80" : "text-muted"}`}>{s.hint}</span>}
                </span>
                {s.badge != null && s.badge !== "" && (
                  <span className={`ms-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${on ? "bg-white/20 text-white" : "bg-canvas text-muted"}`} data-testid={`badge-${s.id}`}>{s.badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0">
          {searching && !found && <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">لا إعداد يطابق «{q}».</p>}
          {sections.map((s) => (
            <section key={s.id} data-sec={s.id} hidden={!searching && s.id !== active} aria-label={s.label}
              className="mb-6 [&[data-miss]]:hidden">
              <div className="mb-3">
                <h2 className="flex items-center gap-2 text-lg font-bold"><span className="[&>svg]:size-5">{s.icon}</span> {s.label}</h2>
                {s.hint && <p className="text-xs text-muted">{s.hint}</p>}
              </div>
              <div className={s.aside && !searching ? "grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]" : ""}>
                <div data-sec-body className="flex min-w-0 flex-col gap-4 [&>*]:!m-0 [&>[data-miss]]:hidden">{s.content}</div>
                {s.aside && !searching && <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">{s.aside}</div>}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
