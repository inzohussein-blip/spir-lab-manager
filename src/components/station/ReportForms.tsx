"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, X, Wand2, Eraser, Check } from "lucide-react";
import {
  templateOf, cultureOf, formTitle, isSub, fieldsOf, sfaComputed, isGrowth, CS_GROWTH, AST_SCALE, astValue,
  type Opt, type FormCode, type FormValues,
} from "@/lib/station/templates";

/** Text field with a dropdown of standard values; free typing is always allowed. */
export function Combo({ value, onChange, opts, placeholder, ariaLabel }: {
  value: string; onChange: (v: string) => void; opts?: Opt[]; placeholder?: string; ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const has = !!opts?.length;
  return (
    <div ref={box} className="relative" dir="ltr">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => has && setOpen(true)}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); if (e.key === "Enter") { e.preventDefault(); setOpen(false); } }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={`w-full rounded-lg border bg-surface py-2 pl-3 text-left text-sm outline-none focus:border-brand ${has ? "pr-8" : "pr-3"} ${value ? "border-teal-300 font-semibold" : "border-line"}`}
      />
      {has && (
        <button type="button" tabIndex={-1} onClick={() => setOpen((x) => !x)} aria-label="القائمة"
          className="absolute inset-y-0 right-0 grid w-8 place-items-center text-muted hover:text-ink">
          <ChevronDown className="size-4" />
        </button>
      )}
      {open && has && (
        <ul className="absolute left-0 right-0 z-[70] mt-1 max-h-60 overflow-auto rounded-lg border border-line bg-surface py-1 text-sm shadow-[var(--shadow-pop)]">
          {opts!.map((o) => (
            <li key={o.v}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(o.v); setOpen(false); }}
                className={`flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-left hover:bg-canvas ${o.v === value ? "bg-brand-light font-semibold text-brand-dark" : ""}`}>
                <span>{o.v}</span>
                {o.ar && <span dir="rtl" className="shrink-0 text-[11px] text-muted">{o.ar}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Fill every empty field with its normal value (a normal culture is "no growth"). */
export function fillNormals(code: FormCode, values: FormValues): FormValues {
  if (code === "CS") return values.growth?.trim() ? values : { ...values, growth: CS_GROWTH[0].v };
  const next = { ...values };
  for (const f of fieldsOf(templateOf(code))) if (!next[f.k]?.trim() && f.normal) next[f.k] = f.normal;
  return next;
}

/** Wide form window for a structured test (urine, stool, semen, culture). */
export function FormDialog({ code, testName, values, onChange, onClose }: {
  code: FormCode; testName: string; values: FormValues; onChange: (v: FormValues) => void; onClose: () => void;
}) {
  const set = (k: string, v: string) => onChange({ ...values, [k]: v });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !(e.target as HTMLElement)?.closest?.("[dir=ltr]")) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="no-print fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={testName}>
      <div className="w-full max-w-4xl rounded-2xl border border-line bg-surface shadow-[var(--shadow-pop)]">
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-t-2xl border-b border-line bg-surface px-5 py-3">
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold">{testName}</div>
            <div className="text-[11px] text-muted" dir="ltr" style={{ textAlign: "right" }}>{formTitle(code)}</div>
          </div>
          <button type="button" onClick={() => onChange(fillNormals(code, values))} title={code === "CS" ? "نتيجة الزرع: No growth" : "يملأ الحقول الفارغة فقط"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-canvas">
            <Wand2 className="size-4" /> ملء القيم الطبيعية
          </button>
          <button type="button" onClick={() => window.confirm("مسح كل حقول الاستمارة؟") && onChange({})}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
            <Eraser className="size-4" /> مسح
          </button>
          <button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark">
            <Check className="size-4" /> تم
          </button>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-canvas"><X className="size-4" /></button>
        </div>

        <div className="p-5">
          {code === "CS" ? <CultureForm values={values} set={set} /> : (
            <div className="flex flex-col gap-5">
              {templateOf(code).sections.map((s, si) => (
                <section key={si}>
                  <div className="mb-2 rounded-lg bg-brand-light px-3 py-1.5 text-sm font-bold text-brand-dark" dir="ltr" style={{ textAlign: "left" }}>{s.title}</div>
                  <div dir="ltr" className="grid gap-x-4 gap-y-3 md:grid-cols-2">
                    {s.rows.map((r, i) => isSub(r) ? (
                      <div key={i} className="mt-1 text-[11px] font-bold uppercase tracking-wide text-muted md:col-span-2" dir="ltr" style={{ textAlign: "left" }}>{r.sub}</div>
                    ) : (
                      <div key={r.k} dir="ltr" className="text-left">
                        <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                          <span className={`font-semibold ${r.indent ? "ps-3" : ""}`}>{r.indent ? "• " : ""}{r.label}</span>
                          {(r.ref || r.unit) && <span className="truncate text-[11px] text-muted">{r.ref ?? r.unit}</span>}
                        </div>
                        <Combo value={values[r.k] ?? ""} onChange={(v) => set(r.k, v)} opts={r.opts} ariaLabel={r.label} />
                        {code === "SFA" && (r.k === "tm" || r.k === "total") && (() => {
                          const c = sfaComputed(values)[r.k as "tm" | "total"];
                          return c && c !== values[r.k] ? (
                            <button type="button" onClick={() => set(r.k, c)} className="mt-1 rounded-full border border-violet-300 px-2 py-0.5 text-[11px] font-semibold text-violet-700 hover:bg-violet-50">
                              احسب تلقائياً: {c}
                            </button>
                          ) : null;
                        })()}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CultureForm({ values, set }: { values: FormValues; set: (k: string, v: string) => void }) {
  const growth = isGrowth(values.growth);
  const lists = cultureOf();
  const organisms: Opt[] = lists.organisms.flatMap((g) => g.items.map((v) => ({ v, ar: g.group })));
  const field = (label: string, node: React.ReactNode) => (
    <div dir="ltr" className="text-left"><div className="mb-1 text-xs font-semibold">{label}</div>{node}</div>
  );
  return (
    <div className="flex flex-col gap-4">
      <div dir="ltr" className="grid gap-4 md:grid-cols-2">
        {field("Specimen (نوع العينة)", <Combo value={values.specimen ?? ""} onChange={(v) => set("specimen", v)} opts={lists.specimens} ariaLabel="Specimen" />)}
        {field("Culture Result (نتيجة النمو)", <Combo value={values.growth ?? ""} onChange={(v) => set("growth", v)} opts={CS_GROWTH} ariaLabel="Culture" />)}
        {growth && field("Isolated Organism (البكتيريا المعزولة)", <Combo value={values.organism ?? ""} onChange={(v) => set("organism", v)} opts={organisms} ariaLabel="Organism" />)}
        {growth && field("Colony Count (عدد المستعمرات — اختياري)", <Combo value={values.colony ?? ""} onChange={(v) => set("colony", v)} opts={lists.colony} ariaLabel="Colony" />)}
      </div>

      {growth && (
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-bold">فحص الحساسية للمضادات (AST)</div>
            <div className="text-[11px] text-muted">
              {AST_SCALE.map((x) => `${x.v} = ${x.ar}`).join(" · ")} — اضغط مرة أخرى للإلغاء. غير المحدد يُطبع فارغاً.
            </div>
          </div>
          {lists.antibiotics.map((g, gi) => (
            <div key={gi} className="mb-3 rounded-xl border border-line p-3" dir="ltr">
              {lists.antibiotics.length > 1 && <div className="mb-1.5 text-left text-[11px] font-bold uppercase tracking-wide text-muted">{g.group}</div>}
              <div className="gap-x-8 md:columns-2">
                {g.items.map((ab) => {
                  const cur = astValue(values[`ab:${ab}`]);
                  return (
                    <div key={ab} className="flex break-inside-avoid items-center justify-between gap-2 border-b border-line/60 py-1 text-sm">
                      <span className="text-left">{ab}</span>
                      <div className="flex gap-1">
                        {AST_SCALE.map(({ v }) => (
                          <button key={v} type="button" onClick={() => set(`ab:${ab}`, cur === v ? "" : v)} aria-label={`${ab} ${v}`} aria-pressed={cur === v}
                            className={`h-7 w-10 rounded-md border text-xs font-bold ${cur === v
                              ? v === "H.S" ? "border-green-600 bg-green-600 text-white" : v === "M.S" ? "border-amber-500 bg-amber-500 text-white" : "border-red-600 bg-red-600 text-white"
                              : "border-line text-muted hover:bg-canvas"}`}>
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {field("Remarks (ملاحظات — اختياري)", <Combo value={values.notes ?? ""} onChange={(v) => set("notes", v)} ariaLabel="Remarks" />)}
    </div>
  );
}
