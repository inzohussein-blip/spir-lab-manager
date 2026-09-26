"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, X, Wand2, Eraser, Check } from "lucide-react";
import {
  templateOf, cultureOf, formTitle, isSub, fieldsOf, sfaComputed, sfaAuto, sfaDiagnosis, CS_GROWTH, AST_SCALE, astValue,
  type Opt, type FormCode, type FormValues, type FormOptions,
} from "@/lib/station/templates";

/** Move the cursor to the next text field of the same form window (Enter = next field). */
function focusNext(from: HTMLElement) {
  const scope = from.closest("[role=dialog]") ?? document;
  const all = Array.from(scope.querySelectorAll<HTMLInputElement>("input[data-combo]"));
  const next = all[all.indexOf(from as HTMLInputElement) + 1];
  if (next) { next.focus(); next.select(); }
}

/**
 * Text field with a dropdown of standard values; free typing is always allowed.
 * Keyboard: ↓ / ↑ move through the list (typing narrows it), Enter picks the highlighted
 * value and goes to the next field, Esc closes the list.
 */
export function Combo({ value, onChange, opts, placeholder, ariaLabel }: {
  value: string; onChange: (v: string) => void; opts?: Opt[]; placeholder?: string; ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(false);
  const [hi, setHi] = useState(-1);
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const q = value.trim().toLowerCase();
  const shown = (typed && q ? opts?.filter((o) => o.v.toLowerCase().includes(q) || o.ar?.includes(value.trim())) : opts) ?? [];
  const has = shown.length > 0;
  useEffect(() => { list.current?.querySelector<HTMLElement>(`[data-i="${hi}"]`)?.scrollIntoView({ block: "nearest" }); }, [hi]);

  function pick(v: string) { onChange(v); setOpen(false); setTyped(false); setHi(-1); }
  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!opts?.length) return;
      e.preventDefault();
      if (!open) { setOpen(true); setHi(Math.max(0, shown.findIndex((o) => o.v === value))); return; }
      setHi((i) => (e.key === "ArrowDown" ? Math.min(shown.length - 1, i + 1) : Math.max(0, i - 1)));
    } else if (e.key === "Escape") {
      if (open) { e.stopPropagation(); setOpen(false); }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && hi >= 0 && shown[hi]) pick(shown[hi].v); else { setOpen(false); setTyped(false); }
      focusNext(e.currentTarget);
    }
  }

  return (
    <div ref={box} className="relative" dir="ltr">
      <input
        data-combo=""
        value={value}
        onChange={(e) => { onChange(e.target.value); setTyped(true); setOpen(true); setHi(0); }}
        onFocus={() => { setTyped(false); setHi(-1); if (opts?.length) setOpen(true); }}
        onKeyDown={onKey}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={`w-full rounded-lg border bg-surface py-2 pl-3 text-left text-sm outline-none focus:border-brand ${opts?.length ? "pr-8" : "pr-3"} ${value ? "border-teal-300 font-semibold" : "border-line"}`}
      />
      {!!opts?.length && (
        <button type="button" tabIndex={-1} onClick={() => { setTyped(false); setOpen((x) => !x); }} aria-label="القائمة"
          className="absolute inset-y-0 right-0 grid w-8 place-items-center text-muted hover:text-ink">
          <ChevronDown className="size-4" />
        </button>
      )}
      {open && has && (
        <ul ref={list} className="absolute left-0 right-0 z-[70] mt-1 max-h-60 overflow-auto rounded-lg border border-line bg-surface py-1 text-sm shadow-[var(--shadow-pop)]">
          {shown.map((o, i) => (
            <li key={o.v}>
              <button type="button" data-i={i} tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o.v)} onMouseEnter={() => setHi(i)}
                className={`flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-left ${i === hi ? "bg-canvas" : ""} ${o.v === value ? "bg-brand-light font-semibold text-brand-dark" : ""}`}>
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
export function FormDialog({ code, testName, values, onChange, onClose, opts }: {
  code: FormCode; testName: string; values: FormValues; onChange: (v: FormValues) => void; onClose: () => void; opts: FormOptions;
}) {
  const set = (k: string, v: string) => {
    const next = { ...values, [k]: v };
    onChange(code === "SFA" && opts.autoCalc ? { ...next, ...sfaAuto(next, k) } : next);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !(e.target as HTMLElement)?.closest?.("[dir=ltr]")) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const dx = code === "SFA" && opts.diagnosis ? sfaDiagnosis(values) : "";

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
          <p className="mb-3 text-[11px] text-muted">لوحة المفاتيح: ↓ ↑ للتنقل في القائمة (الكتابة تُضيّقها)، Enter للاختيار والانتقال للحقل التالي.</p>
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
                        {code === "SFA" && !opts.autoCalc && (r.k === "tm" || r.k === "total") && (() => {
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

              <section dir="ltr" className="grid gap-x-4 gap-y-3 md:grid-cols-2">
                {code === "SFA" && opts.diagnosis && (
                  <div className="text-left md:col-span-2">
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                      <span className="font-semibold">Conclusion</span>
                      <span dir="rtl" className="text-[11px] text-muted">تُحسب تلقائياً وتُطبع — اكتب غيرها لتستبدلها</span>
                    </div>
                    <Combo value={values.dx ?? ""} onChange={(v) => set("dx", v)} placeholder={dx || "—"} ariaLabel="Conclusion" />
                    {dx && <div className="mt-1 text-[11px] text-violet-700">التلقائية: <b>{dx}</b>{values.dx?.trim() && values.dx.trim() !== dx ? " — ستُطبع التي كتبتها" : ""}</div>}
                  </div>
                )}
                <div className="text-left md:col-span-2">
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                    <span className="font-semibold">Remarks</span><span dir="rtl" className="text-[11px] text-muted">ملاحظات — اختياري، تُطبع أسفل التقرير</span>
                  </div>
                  <Combo value={values.notes ?? ""} onChange={(v) => set("notes", v)} ariaLabel="Remarks" />
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const btnCls = (on: boolean, v: string) => `h-7 w-10 rounded-md border text-xs font-bold ${on
  ? v === "H.S" ? "border-green-600 bg-green-600 text-white" : v === "M.S" ? "border-amber-500 bg-amber-500 text-white" : "border-red-600 bg-red-600 text-white"
  : "border-line text-muted hover:bg-canvas"}`;

function CultureForm({ values, set }: { values: FormValues; set: (k: string, v: string) => void }) {
  const lists = cultureOf();
  const organisms: Opt[] = lists.organisms.flatMap((g) => g.items.map((v) => ({ v, ar: g.group })));
  const noGrowth = /^no growth/i.test(values.growth ?? "");
  const two = !!values.organism2?.trim();
  const [showSecond, setShowSecond] = useState(two);
  const count = (p: string) => Object.entries(values).filter(([k, v]) => k.startsWith(p) && v).length;
  const total = lists.antibiotics.reduce((n, g) => n + g.items.length, 0);
  const title = (t: string, extra?: React.ReactNode) => (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-brand-light px-3 py-1.5" dir="ltr">
      <span className="text-sm font-bold text-brand-dark">{t}</span>{extra}
    </div>
  );
  const field = (label: string, hint: string, node: React.ReactNode) => (
    <div dir="ltr" className="text-left">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs"><span className="font-semibold">{label}</span><span dir="rtl" className="text-[11px] text-muted">{hint}</span></div>
      {node}
    </div>
  );
  const Buttons = ({ ab, prefix }: { ab: string; prefix: string }) => {
    const cur = astValue(values[`${prefix}${ab}`]);
    return (
      <div className="flex gap-1">
        {AST_SCALE.map(({ v }) => (
          <button key={v} type="button" onClick={() => set(`${prefix}${ab}`, cur === v ? "" : v)}
            aria-label={prefix === "ab2:" ? `${ab} ${v} (2)` : `${ab} ${v}`} aria-pressed={cur === v} className={btnCls(cur === v, v)}>
            {v}
          </button>
        ))}
      </div>
    );
  };
  return (
    <div className="flex flex-col gap-5">
      <section>
        {title("1. Specimen & Culture")}
        <div dir="ltr" className="grid gap-x-4 gap-y-3 md:grid-cols-2">
          {field("Specimen", "نوع العينة", <Combo value={values.specimen ?? ""} onChange={(v) => set("specimen", v)} opts={lists.specimens} ariaLabel="Specimen" />)}
          {field("Culture Result", "نتيجة النمو", <Combo value={values.growth ?? ""} onChange={(v) => set("growth", v)} opts={CS_GROWTH} ariaLabel="Culture" />)}
          {field(two || showSecond ? "Isolated Organism (1)" : "Isolated Organism", "يُطبع: Growth of …", <Combo value={values.organism ?? ""} onChange={(v) => set("organism", v)} opts={organisms} ariaLabel="Organism" />)}
          {field(two || showSecond ? "Colony Count (1)" : "Colony Count", "اختياري", <Combo value={values.colony ?? ""} onChange={(v) => set("colony", v)} opts={lists.colony} ariaLabel="Colony" />)}
          {(two || showSecond) ? (
            <>
              {field("Isolated Organism (2)", "بكتيريا ثانية — Mixed growth", <Combo value={values.organism2 ?? ""} onChange={(v) => set("organism2", v)} opts={organisms} ariaLabel="Organism 2" />)}
              {field("Colony Count (2)", "اختياري", <Combo value={values.colony2 ?? ""} onChange={(v) => set("colony2", v)} opts={lists.colony} ariaLabel="Colony 2" />)}
            </>
          ) : (
            <button type="button" onClick={() => setShowSecond(true)} className="w-fit rounded-lg border border-dashed border-line px-3 py-1.5 text-xs hover:bg-canvas md:col-span-2" dir="rtl">
              + بكتيريا ثانية (نمو مختلط)
            </button>
          )}
        </div>
      </section>

      <section className={noGrowth ? "opacity-60" : ""}>
        {title("2. Antibiotic Sensitivity Test (AST)",
          <span className="text-[11px] font-semibold">
            <span className="text-green-700">H.S = High sensitive</span> · <span className="text-amber-700">M.S = Moderate sensitive</span> · <span className="text-red-700">R = Resistant</span>
            <span className="ms-2 text-muted">({two ? `${count("ab:")} + ${count("ab2:")}` : count("ab:")} / {total})</span>
          </span>)}
        <p className="mb-2 text-[11px] text-muted">
          {noGrowth ? "النتيجة «No growth» — لا يُطبع جدول الحساسية."
            : two ? "العمود (1) للبكتيريا الأولى و(2) للثانية. اضغط الدرجة مرة أخرى للإلغاء."
            : "اضغط الدرجة لكل مضاد جُرِّب، واضغطها مرة أخرى للإلغاء. غير المحدد يُطبع فارغاً كما في الورقة."}
        </p>
        {lists.antibiotics.map((g, gi) => (
          <div key={gi} className="mb-3 rounded-xl border border-line px-3 py-2" dir="ltr">
            {lists.antibiotics.length > 1 && <div className="mb-1.5 text-left text-[11px] font-bold uppercase tracking-wide text-muted">{g.group}</div>}
            {two && (
              <div className="flex justify-end gap-6 border-b border-line pb-1 text-[11px] font-bold text-muted">
                <span className="w-[128px] truncate text-center">(1) {values.organism}</span>
                <span className="w-[128px] truncate text-center">(2) {values.organism2}</span>
              </div>
            )}
            <div className={two ? "" : "gap-x-8 md:columns-2"}>
              {g.items.map((ab) => (
                <div key={ab} className="flex break-inside-avoid items-center justify-between gap-2 border-b border-line/60 py-1 text-sm">
                  <span className={`text-left ${astValue(values[`ab:${ab}`]) || astValue(values[`ab2:${ab}`]) ? "font-semibold" : ""}`}>{ab}</span>
                  <div className="flex gap-6">
                    <Buttons ab={ab} prefix="ab:" />
                    {two && <Buttons ab={ab} prefix="ab2:" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {field("Remarks", "ملاحظات — اختياري", <Combo value={values.notes ?? ""} onChange={(v) => set("notes", v)} ariaLabel="Remarks" />)}
    </div>
  );
}
