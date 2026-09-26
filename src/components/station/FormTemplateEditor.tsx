"use client";

import { useState } from "react";
import { ArrowUp, ArrowDown, Trash2, Plus, RotateCcw, Save, X, Heading } from "lucide-react";
import {
  templateOf, cultureOf, isCustomForm, saveCustomForm, isSub, TEMPLATES, CS_DEFAULT,
  type FormCode, type TplCode, type Template, type TSection, type TRow, type TField, type Opt, type Group, type CultureLists,
} from "@/lib/station/templates";

const inp = "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-brand";
const btn = "grid size-7 shrink-0 place-items-center rounded-md border border-line text-muted hover:bg-canvas disabled:opacity-30";
const COLS: TSection["col"][] = ["Reference Range", "Unit / Field", "Normal Values"];
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const newKey = () => `f_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Options as text: one per line, "Value | تلميح عربي". */
const optsToText = (o?: Opt[]) => (o ?? []).map((x) => (x.ar ? `${x.v} | ${x.ar}` : x.v)).join("\n");
function textToOpts(t: string): Opt[] {
  const seen = new Set<string>();
  const out: Opt[] = [];
  for (const line of t.split("\n")) {
    const [v, ...ar] = line.split("|");
    const val = v.trim();
    if (!val || seen.has(val)) continue;
    seen.add(val);
    out.push(ar.join("|").trim() ? { v: val, ar: ar.join("|").trim() } : { v: val });
  }
  return out;
}
const move = <T,>(a: T[], i: number, d: number): T[] => {
  const j = i + d;
  if (j < 0 || j >= a.length) return a;
  const n = [...a];
  [n[i], n[j]] = [n[j], n[i]];
  return n;
};

/** Edit one of the four report forms: add / remove / rename fields, sections and lists. */
export function FormTemplateEditor({ code, testName, onClose }: { code: FormCode; testName: string; onClose: () => void }) {
  const custom = isCustomForm(code);
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={`تعديل استمارة ${testName}`}>
      <div className="w-full max-w-5xl rounded-2xl border border-line bg-surface shadow-[var(--shadow-pop)]">
        {code === "CS"
          ? <CultureEditor testName={testName} custom={custom} onClose={onClose} />
          : <TemplateEditor code={code} testName={testName} custom={custom} onClose={onClose} />}
      </div>
    </div>
  );
}

function Bar({ testName, custom, onSave, onReset, onClose }: { testName: string; custom: boolean; onSave: () => void; onReset: () => void; onClose: () => void }) {
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-t-2xl border-b border-line bg-surface px-5 py-3">
      <div className="min-w-0 flex-1">
        <div className="truncate font-bold">تعديل الاستمارة — {testName}</div>
        <div className="text-[11px] text-muted">{custom ? "معدّلة من المختبر" : "النسخة الأصلية"} · التعديل يسري على الإدخال والطباعة من الآن، والزيارات القديمة تبقى محفوظة.</div>
      </div>
      <button type="button" onClick={onReset} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-canvas">
        <RotateCcw className="size-4" /> استعادة الأصلية
      </button>
      <button type="button" onClick={onSave} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark">
        <Save className="size-4" /> حفظ
      </button>
      <button type="button" onClick={onClose} aria-label="إغلاق" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-canvas"><X className="size-4" /></button>
    </div>
  );
}

function resetTo(code: FormCode, onClose: () => void) {
  if (!window.confirm("استعادة الاستمارة الأصلية وحذف كل تعديلاتك عليها؟")) return;
  saveCustomForm(code, null);
  onClose();
}

// ── Urine / stool / semen ────────────────────────────────────────────────────
function TemplateEditor({ code, testName, custom, onClose }: { code: TplCode; testName: string; custom: boolean; onClose: () => void }) {
  const [t, setT] = useState<Template>(() => clone(templateOf(code)));
  const setSec = (si: number, patch: Partial<TSection>) => setT((x) => ({ ...x, sections: x.sections.map((s, j) => (j === si ? { ...s, ...patch } : s)) }));
  const setRows = (si: number, f: (rows: TRow[]) => TRow[]) => setT((x) => ({ ...x, sections: x.sections.map((s, j) => (j === si ? { ...s, rows: f(s.rows) } : s)) }));
  const setRow = (si: number, ri: number, patch: Partial<TField> | { sub: string }) =>
    setRows(si, (rows) => rows.map((r, j) => (j === ri ? ({ ...r, ...patch } as TRow) : r)));

  function save() {
    const clean: Template = {
      ...t,
      title: t.title.trim() || TEMPLATES[code].title,
      sections: t.sections
        .map((s) => ({ ...s, title: s.title.trim(), rows: s.rows.filter((r) => (isSub(r) ? r.sub.trim() : r.label.trim())) }))
        .filter((s) => s.title || s.rows.length),
    };
    if (!clean.sections.some((s) => s.rows.some((r) => !isSub(r)))) return window.alert("أضف حقلاً واحداً على الأقل.");
    if (!saveCustomForm(code, clean)) return window.alert("تعذّر الحفظ — مساحة التخزين ممتلئة.");
    onClose();
  }

  return (
    <>
      <Bar testName={testName} custom={custom} onSave={save} onReset={() => resetTo(code, onClose)} onClose={onClose} />
      <div className="flex flex-col gap-5 p-5">
        <label className="text-sm font-medium">عنوان التقرير المطبوع
          <input dir="ltr" value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} className={`mt-1 text-left ${inp}`} />
        </label>

        {t.sections.map((s, si) => (
          <section key={si} className="rounded-xl border border-line">
            <div className="flex flex-wrap items-center gap-2 rounded-t-xl bg-brand-light/50 p-3">
              <input dir="ltr" value={s.title} onChange={(e) => setSec(si, { title: e.target.value })} aria-label="عنوان القسم" placeholder="Section title" className={`min-w-48 flex-1 text-left font-semibold ${inp}`} />
              <label className="flex items-center gap-1.5 text-xs text-muted">العمود الثالث
                <select dir="ltr" value={s.col} onChange={(e) => setSec(si, { col: e.target.value as TSection["col"] })} className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm">
                  {COLS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <button type="button" className={btn} title="للأعلى" disabled={si === 0} onClick={() => setT((x) => ({ ...x, sections: move(x.sections, si, -1) }))}><ArrowUp className="size-3.5" /></button>
              <button type="button" className={btn} title="للأسفل" disabled={si === t.sections.length - 1} onClick={() => setT((x) => ({ ...x, sections: move(x.sections, si, 1) }))}><ArrowDown className="size-3.5" /></button>
              <button type="button" className={`${btn} text-red-600`} title="حذف القسم"
                onClick={() => window.confirm("حذف هذا القسم بكل حقوله؟") && setT((x) => ({ ...x, sections: x.sections.filter((_, j) => j !== si) }))}>
                <Trash2 className="size-3.5" />
              </button>
            </div>

            <div className="hidden grid-cols-[2fr_1.5fr_1.2fr_auto] gap-2 px-3 pt-2 text-[11px] text-muted md:grid" dir="ltr">
              <span>Parameter (اسم الحقل)</span><span>{s.col} (يُطبع بجانبه)</span><span>Normal (لزر ملء الطبيعي)</span><span className="w-[124px]" />
            </div>
            <div className="flex flex-col divide-y divide-line">
              {s.rows.map((r, ri) => {
                const ctrls = (
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" className={btn} title="للأعلى" disabled={ri === 0} onClick={() => setRows(si, (rows) => move(rows, ri, -1))}><ArrowUp className="size-3.5" /></button>
                    <button type="button" className={btn} title="للأسفل" disabled={ri === s.rows.length - 1} onClick={() => setRows(si, (rows) => move(rows, ri, 1))}><ArrowDown className="size-3.5" /></button>
                    <button type="button" className={`${btn} text-red-600`} title="حذف" onClick={() => setRows(si, (rows) => rows.filter((_, j) => j !== ri))}><Trash2 className="size-3.5" /></button>
                  </div>
                );
                if (isSub(r)) return (
                  <div key={ri} className="flex items-center gap-2 p-3" dir="ltr">
                    <Heading className="size-4 shrink-0 text-muted" />
                    <input value={r.sub} onChange={(e) => setRow(si, ri, { sub: e.target.value })} aria-label="عنوان فرعي" placeholder="Sub-heading" className={`flex-1 text-left text-xs font-bold uppercase ${inp}`} />
                    {ctrls}
                  </div>
                );
                return (
                  <div key={r.k} className="p-3" dir="ltr">
                    <div className="grid gap-2 md:grid-cols-[2fr_1.5fr_1.2fr_auto]">
                      <input value={r.label} onChange={(e) => setRow(si, ri, { label: e.target.value })} aria-label="اسم الحقل" placeholder="Parameter" className={`text-left font-medium ${inp}`} />
                      <input value={r.ref ?? r.unit ?? ""} onChange={(e) => setRow(si, ri, { ref: e.target.value, unit: undefined })} aria-label="المعدل أو الوحدة" placeholder={s.col} className={`text-left ${inp}`} />
                      <input value={r.normal ?? ""} onChange={(e) => setRow(si, ri, { normal: e.target.value })} aria-label="القيمة الطبيعية" placeholder="Normal" className={`text-left ${inp}`} />
                      {ctrls}
                    </div>
                    <div className="mt-2 flex flex-wrap items-start gap-3">
                      <label className="flex items-center gap-1.5 text-xs text-muted">
                        <input type="checkbox" checked={!!r.indent} onChange={(e) => setRow(si, ri, { indent: e.target.checked })} /> بند فرعي (•)
                      </label>
                      <details className="min-w-64 flex-1">
                        <summary className="cursor-pointer text-xs text-brand-dark">القائمة المنسدلة ({r.opts?.length ?? 0})</summary>
                        <textarea
                          defaultValue={optsToText(r.opts)}
                          onBlur={(e) => setRow(si, ri, { opts: textToOpts(e.target.value) })}
                          rows={Math.min(10, Math.max(3, (r.opts?.length ?? 0) + 1))}
                          aria-label="خيارات القائمة"
                          placeholder={"Nil | لا يوجد\nFew | قليل\n+"}
                          className={`mt-1 text-xs ${inp}`}
                        />
                        <div className="text-[11px] text-muted" dir="rtl">خيار في كل سطر. التلميح العربي اختياري بعد «|» ولا يُطبع.</div>
                      </details>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-line p-3">
              <button type="button" onClick={() => setRows(si, (rows) => [...rows, { k: newKey(), label: "" }])}
                className="inline-flex items-center gap-1 rounded-lg border border-dashed border-line px-2.5 py-1 text-xs hover:bg-canvas"><Plus className="size-3.5" /> حقل</button>
              <button type="button" onClick={() => setRows(si, (rows) => [...rows, { sub: "" }])}
                className="inline-flex items-center gap-1 rounded-lg border border-dashed border-line px-2.5 py-1 text-xs hover:bg-canvas"><Heading className="size-3.5" /> عنوان فرعي</button>
            </div>
          </section>
        ))}

        <button type="button" onClick={() => setT((x) => ({ ...x, sections: [...x.sections, { title: "", col: "Reference Range", rows: [{ k: newKey(), label: "" }] }] }))}
          className="inline-flex w-fit items-center gap-1 rounded-lg border border-dashed border-line px-3 py-1.5 text-sm hover:bg-canvas"><Plus className="size-4" /> قسم جديد</button>
      </div>
    </>
  );
}

// ── Culture & sensitivity ────────────────────────────────────────────────────
function CultureEditor({ testName, custom, onClose }: { testName: string; custom: boolean; onClose: () => void }) {
  const [c, setC] = useState<CultureLists>(() => clone(cultureOf()));

  function save() {
    const groups = (gs: Group[]) => gs
      .map((g) => ({ group: g.group.trim(), items: Array.from(new Set(g.items.map((x) => x.trim()).filter(Boolean))) }))
      .filter((g) => g.items.length);
    const clean: CultureLists = { ...c, title: c.title.trim() || CS_DEFAULT.title, organisms: groups(c.organisms), antibiotics: groups(c.antibiotics) };
    if (!saveCustomForm("CS", clean)) return window.alert("تعذّر الحفظ — مساحة التخزين ممتلئة.");
    onClose();
  }

  return (
    <>
      <Bar testName={testName} custom={custom} onSave={save} onReset={() => resetTo("CS", onClose)} onClose={onClose} />
      <div className="flex flex-col gap-5 p-5">
        <label className="text-sm font-medium">عنوان التقرير المطبوع
          <input dir="ltr" value={c.title} onChange={(e) => setC({ ...c, title: e.target.value })} className={`mt-1 text-left ${inp}`} />
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <OptsBox label="أنواع العينات (Specimen)" value={c.specimens} onChange={(specimens) => setC({ ...c, specimens })} />
          <OptsBox label="عدد المستعمرات (Colony Count)" value={c.colony} onChange={(colony) => setC({ ...c, colony })} />
        </div>
        <GroupsBox label="المضادات الحيوية (AST) — حسب الصنف" value={c.antibiotics} onChange={(antibiotics) => setC({ ...c, antibiotics })} />
        <GroupsBox label="البكتيريا والفطريات (Isolated Organism)" value={c.organisms} onChange={(organisms) => setC({ ...c, organisms })} />
        <p className="text-xs text-muted">قائمة «نتيجة النمو» ثابتة لأن ظهور حقول البكتيريا والمضادات يعتمد عليها.</p>
      </div>
    </>
  );
}

function OptsBox({ label, value, onChange }: { label: string; value: Opt[]; onChange: (v: Opt[]) => void }) {
  return (
    <label className="text-sm font-medium">{label}
      <textarea dir="ltr" defaultValue={optsToText(value)} onBlur={(e) => onChange(textToOpts(e.target.value))} rows={Math.min(10, value.length + 1)} className={`mt-1 text-xs ${inp}`} />
      <span className="block text-[11px] font-normal text-muted">خيار في كل سطر، والتلميح العربي اختياري بعد «|».</span>
    </label>
  );
}

function GroupsBox({ label, value, onChange }: { label: string; value: Group[]; onChange: (v: Group[]) => void }) {
  const set = (i: number, g: Group) => onChange(value.map((x, j) => (j === i ? g : x)));
  return (
    <div>
      <div className="mb-2 text-sm font-medium">{label}</div>
      <div className="grid gap-3 md:grid-cols-2" dir="ltr">
        {value.map((g, i) => (
          <div key={i} className="rounded-xl border border-line p-3" dir="ltr">
            <div className="mb-2 flex items-center gap-1">
              <input value={g.group} onChange={(e) => set(i, { ...g, group: e.target.value })} aria-label="اسم الصنف" placeholder="Group" className={`flex-1 text-left text-xs font-bold uppercase ${inp}`} />
              <button type="button" className={btn} title="للأعلى" disabled={i === 0} onClick={() => onChange(move(value, i, -1))}><ArrowUp className="size-3.5" /></button>
              <button type="button" className={btn} title="للأسفل" disabled={i === value.length - 1} onClick={() => onChange(move(value, i, 1))}><ArrowDown className="size-3.5" /></button>
              <button type="button" className={`${btn} text-red-600`} title="حذف الصنف" onClick={() => window.confirm("حذف هذا الصنف؟") && onChange(value.filter((_, j) => j !== i))}><Trash2 className="size-3.5" /></button>
            </div>
            <textarea
              key={g.items.join("\n")}
              defaultValue={g.items.join("\n")}
              onBlur={(e) => set(i, { ...g, items: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) })}
              rows={Math.min(10, g.items.length + 1)} aria-label={`عناصر ${g.group}`} placeholder="واحد في كل سطر"
              className={`text-xs ${inp}`}
            />
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onChange([...value, { group: "", items: [] }])}
        className="mt-2 inline-flex items-center gap-1 rounded-lg border border-dashed border-line px-2.5 py-1 text-xs hover:bg-canvas"><Plus className="size-3.5" /> صنف جديد</button>
    </div>
  );
}
