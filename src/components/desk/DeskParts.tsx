"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, UserRound, X, Check } from "lucide-react";
import { deskFindPatients } from "@/app/actions/desk";
import type { DeskPatient, DeskTest } from "@/lib/desk/types";
import { money } from "@/lib/utils";

export const field = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
export const EMPTY_PATIENT: DeskPatient = { name: "", gender: "", age: "", phone: "" };

/** The patient: found by name or phone (an earlier visit), or typed as new. */
export function PatientBox({ value, onChange }: { value: DeskPatient; onChange: (p: DeskPatient) => void }) {
  const [hits, setHits] = useState<Awaited<ReturnType<typeof deskFindPatients>>>([]);
  const [open, setOpen] = useState(false);
  const q = value.id ? "" : value.name.trim().length >= 2 ? value.name : value.phone.trim().length >= 4 ? value.phone : "";
  useEffect(() => {
    if (!q) return;
    let live = true;
    const t = setTimeout(() => { void deskFindPatients(q).then((r) => { if (live) { setHits(r); setOpen(r.length > 0); } }); }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [q]);
  const set = (k: keyof DeskPatient, v: string) => onChange({ ...value, id: undefined, [k]: v });

  if (value.id) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm" data-testid="desk-patient-picked">
        <span className="flex items-center gap-2">
          <UserRound className="size-4 text-teal-700" />
          <b>{value.name}</b>
          <span className="text-muted">{[value.gender === "male" ? "ذكر" : value.gender === "female" ? "أنثى" : "", value.age && `${value.age} سنة`, value.phone].filter(Boolean).join(" · ")}</span>
        </span>
        <button type="button" onClick={() => onChange({ ...EMPTY_PATIENT })} className="rounded p-1 text-muted hover:bg-white" aria-label="مراجع آخر"><X className="size-4" /></button>
      </div>
    );
  }
  return (
    <div className="relative grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1.4fr]">
      <div className="relative">
        <Search className="pointer-events-none absolute inset-y-0 start-2.5 my-auto size-4 text-muted" />
        <input value={value.name} onChange={(e) => set("name", e.target.value)} onFocus={() => setOpen(hits.length > 0)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          aria-label="اسم المراجع" placeholder="اسم المراجع (أو ابحث)" className={`${field} ps-8`} autoComplete="off" />
      </div>
      <select value={value.gender} onChange={(e) => set("gender", e.target.value)} aria-label="الجنس" className={field}>
        <option value="">الجنس</option>
        <option value="male">ذكر</option>
        <option value="female">أنثى</option>
      </select>
      <input value={value.age} onChange={(e) => set("age", e.target.value.replace(/[^\d]/g, "").slice(0, 3))} inputMode="numeric" aria-label="العمر" placeholder="العمر (سنة)" className={field} />
      <input value={value.phone} onChange={(e) => set("phone", e.target.value)} dir="ltr" inputMode="tel" aria-label="الهاتف" placeholder="الهاتف" className={field} />
      {open && q && (
        <ul className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-auto rounded-lg border border-line bg-surface py-1 text-sm shadow-[var(--shadow-pop)]" data-testid="desk-patient-hits">
          {hits.map((h) => (
            <li key={h.id}>
              <button type="button" onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange({ id: h.id, name: h.name, gender: h.gender === "male" || h.gender === "female" ? h.gender : "", age: h.age, phone: h.phone }); setOpen(false); }}
                className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-start hover:bg-canvas">
                <b>{h.name}</b>
                <span className="text-xs text-muted" dir="ltr">{h.phone}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Tests by category with a search box; prices shown at the collector's desk only. */
export function TestPicker({ tests, chosen, onChange, prices, exclude }: {
  tests: DeskTest[]; chosen: string[]; onChange: (ids: string[]) => void; prices: boolean; exclude?: string[];
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const cats = useMemo(() => [...new Set(tests.filter((t) => t.active).map((t) => t.category || "أخرى"))], [tests]);
  const term = q.trim().toLowerCase();
  const shown = tests.filter((t) =>
    t.active && !exclude?.includes(t.id) &&
    (!cat || (t.category || "أخرى") === cat) &&
    (!term || t.name_ar.toLowerCase().includes(term) || (t.name_en ?? "").toLowerCase().includes(term) || t.code.toLowerCase().includes(term))
  );
  const has = new Set(chosen);
  const toggle = (id: string) => onChange(has.has(id) ? chosen.filter((x) => x !== id) : [...chosen, id]);
  return (
    <div data-testid="desk-tests">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute inset-y-0 start-2.5 my-auto size-4 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="بحث عن فحص" placeholder="ابحث عن فحص بالاسم أو الرمز"
            className={`${field} ps-8`}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (shown.length === 1 || (term && shown[0])) { toggle(shown[0].id); setQ(""); } } }} />
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="القسم" className="rounded-lg border border-line bg-surface px-2 py-2 text-sm">
          <option value="">كل الأقسام</option>
          {cats.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="mt-2 grid max-h-72 gap-1 overflow-auto rounded-lg border border-line p-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.length === 0 && <div className="p-3 text-sm text-muted">لا توجد فحوصات مطابقة.</div>}
        {shown.map((t) => (
          <button type="button" key={t.id} onClick={() => toggle(t.id)} data-testid="desk-test" aria-pressed={has.has(t.id)}
            className={`flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-start text-sm ${has.has(t.id) ? "bg-brand-light font-semibold text-brand-dark ring-1 ring-brand/30" : "hover:bg-canvas"}`}>
            <span className="flex min-w-0 items-center gap-1.5">
              <span className={`grid size-4 shrink-0 place-items-center rounded border ${has.has(t.id) ? "border-brand bg-brand text-white" : "border-line"}`}>{has.has(t.id) && <Check className="size-3" />}</span>
              <span className="truncate">{t.name_ar}</span>
            </span>
            {prices && <span className="shrink-0 tabular-nums text-xs text-muted">{money(t.price)}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Elapsed({ from, limit }: { from: number; limit: number }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  if (now == null) return null;
  const min = Math.max(0, Math.floor((now - from) / 60000));
  const late = limit > 0 && min > limit;
  const text = min < 60 ? `${min} د` : `${Math.floor(min / 60)} س ${min % 60} د`;
  return <span className={`tabular-nums ${late ? "font-bold text-red-600" : "text-muted"}`} data-late={late ? "1" : undefined}>{late ? `متأخرة · ${text}` : text}</span>;
}
