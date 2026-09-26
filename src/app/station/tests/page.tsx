"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil, ListChecks, X, Layers, Search, ClipboardList } from "lucide-react";
import { isFormCode, type FormCode } from "@/lib/station/templates";
import { FormTemplateEditor } from "@/components/station/FormTemplateEditor";
import {
  getTests, saveTests, getPanels, savePanels, unlinkTestFromStock, uid, rangeLabel, AGE_UNIT_LABEL, getSettings,
  type StationTest, type NormalRange, type StationPanel, type AgeBand, type AgeUnit,
} from "@/lib/station/store";

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

type RangeKind = "none" | "numeric" | "sex" | "text" | "qual";
type AgeRow = { from: string; to: string; unit: AgeUnit; low: string; high: string };
const UNIT_DAYS: Record<AgeUnit, number> = { d: 1, m: 30.4375, y: 365.25 };

const empty = {
  name_ar: "", name_en: "", category: "", sample_type: "", unit: "",
  kind: "numeric" as RangeKind,
  low: "", high: "",
  mLow: "", mHigh: "", fLow: "", fHigh: "",
  text: "", cutoff: "", note: "",
  ages: [] as AgeRow[],
};

const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));

/** Valid age rows → bands, youngest first (the first matching band is used). */
function buildAges(rows: AgeRow[]): AgeBand[] | undefined {
  const out = rows
    .filter((r) => r.from.trim() !== "" && Number.isFinite(Number(r.from)) && (r.low.trim() !== "" || r.high.trim() !== ""))
    .map((r) => ({ from: Number(r.from), to: numOrNull(r.to), unit: r.unit, low: numOrNull(r.low), high: numOrNull(r.high) }))
    .sort((a, b) => a.from * UNIT_DAYS[a.unit] - b.from * UNIT_DAYS[b.unit]);
  return out.length ? out : undefined;
}

function buildNormal(f: typeof empty): NormalRange {
  const ages = buildAges(f.ages);
  const note = { ...(f.note.trim() ? { note: f.note.trim() } : {}), ...(ages ? { ages } : {}) };
  if (f.kind === "numeric") return { kind: "numeric", low: numOrNull(f.low), high: numOrNull(f.high), ...note };
  if (f.kind === "sex")
    return {
      kind: "sex",
      male: { low: numOrNull(f.mLow), high: numOrNull(f.mHigh) },
      female: { low: numOrNull(f.fLow), high: numOrNull(f.fHigh) },
      ...note,
    };
  if (f.kind === "text") return { kind: "text", text: f.text.trim() };
  if (f.kind === "qual") return { kind: "qual", text: f.text.trim() || "Negative", cutoff: numOrNull(f.cutoff) };
  return { kind: "none" };
}

function fromTest(t: StationTest): typeof empty {
  const n = t.normal;
  return {
    name_ar: t.name_ar, name_en: t.name_en ?? "", category: t.category ?? "",
    sample_type: t.sample_type ?? "", unit: t.unit ?? "",
    kind: n.kind,
    low: n.kind === "numeric" ? String(n.low ?? "") : "",
    high: n.kind === "numeric" ? String(n.high ?? "") : "",
    mLow: n.kind === "sex" ? String(n.male.low ?? "") : "",
    mHigh: n.kind === "sex" ? String(n.male.high ?? "") : "",
    fLow: n.kind === "sex" ? String(n.female.low ?? "") : "",
    fHigh: n.kind === "sex" ? String(n.female.high ?? "") : "",
    text: n.kind === "text" || n.kind === "qual" ? n.text : "",
    cutoff: n.kind === "qual" && n.cutoff != null ? String(n.cutoff) : "",
    note: (n.kind === "numeric" || n.kind === "sex") && n.note ? n.note : "",
    ages: (n.kind === "numeric" || n.kind === "sex") && n.ages
      ? n.ages.map((b) => ({ from: String(b.from), to: b.to == null ? "" : String(b.to), unit: b.unit, low: b.low == null ? "" : String(b.low), high: b.high == null ? "" : String(b.high) }))
      : [],
  };
}

export default function StationTestsPage() {
  const [tests, setTests] = useState<StationTest[]>([]);
  const [f, setF] = useState({ ...empty });
  const [editId, setEditId] = useState<string | null>(null);
  const [panels, setPanels] = useState<StationPanel[]>([]);
  const [panelName, setPanelName] = useState("");
  const [panelSel, setPanelSel] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [formEdit, setFormEdit] = useState<StationTest | null>(null);

  useEffect(() => { setTests(getTests()); setPanels(getPanels()); }, []);

  function persistPanels(next: StationPanel[]) {
    setPanels(next);
    savePanels(next);
  }
  function addPanel() {
    if (!panelName.trim() || panelSel.size === 0) return;
    persistPanels([...panels, { id: uid(), name: panelName.trim(), testIds: Array.from(panelSel) }]);
    setPanelName("");
    setPanelSel(new Set());
  }
  function togglePanelTest(id: string) {
    setPanelSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return tests;
    return tests.filter((t) => [t.name_ar, t.name_en, t.category, t.sample_type, t.code].some((x) => x?.toLowerCase().includes(k)));
  }, [tests, q]);

  function persist(next: StationTest[]) {
    setTests(next);
    saveTests(next);
  }
  function reset() { setF({ ...empty }); setEditId(null); }

  function submit() {
    if (!f.name_ar.trim()) return;
    const rec: StationTest = {
      id: editId ?? uid(),
      code: editId ? tests.find((t) => t.id === editId)?.code : undefined,
      name_ar: f.name_ar.trim(),
      name_en: f.name_en.trim() || undefined,
      category: f.category.trim() || undefined,
      sample_type: f.sample_type.trim() || undefined,
      unit: f.unit.trim() || undefined,
      normal: buildNormal(f),
    };
    persist(editId ? tests.map((t) => (t.id === editId ? rec : t)) : [...tests, rec]);
    reset();
  }
  function edit(t: StationTest) { setF(fromTest(t)); setEditId(t.id); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function del(id: string) {
    if (!window.confirm("حذف هذا الفحص؟")) return;
    persist(tests.filter((t) => t.id !== id));
    unlinkTestFromStock(id); // clear any stock item linked to this test
    if (editId === id) reset();
  }

  const set = (k: Exclude<keyof typeof empty, "ages">) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));
  const setAge = (i: number, patch: Partial<AgeRow>) =>
    setF((s) => ({ ...s, ages: s.ages.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><ListChecks className="size-6" /> إدارة الفحوصات</h1>
        <p className="mt-1 text-sm text-muted">أضف الفحوصات ونوعها ومعدّلها الطبيعي — يُدخَل مرة واحدة ويُخزَّن محلياً. بعض الفحوصات لها معدّل مختلف للذكور والإناث.</p>
      </div>

      {/* Add / edit form */}
      <div className="mb-5 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold">{editId ? "تعديل فحص" : "إضافة فحص جديد"}</div>
          {editId && (
            <button onClick={reset} className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
              <X className="size-3.5" /> إلغاء التعديل
            </button>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-medium">اسم الفحص (عربي) *<input value={f.name_ar} onChange={set("name_ar")} className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium">الاسم (إنجليزي)<input value={f.name_en} onChange={set("name_en")} className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium">النوع / التصنيف<input value={f.category} onChange={set("category")} placeholder="مثال: أمراض الدم" className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium">نوع العينة<input value={f.sample_type} onChange={set("sample_type")} placeholder="دم / إدرار…" className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium">الوحدة<input value={f.unit} onChange={set("unit")} placeholder="mg/dL…" className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium">نوع المعدل الطبيعي
            <select value={f.kind} onChange={set("kind")} className={`mt-1 ${inp}`}>
              <option value="numeric">رقمي (موحّد)</option>
              <option value="sex">حسب الجنس (ذكر/أنثى)</option>
              <option value="qual">نوعي: سالب / موجب (+ ، ++ ، +++)</option>
              <option value="text">نصّي (وصفي)</option>
              <option value="none">بدون معدل</option>
            </select>
          </label>
        </div>

        {/* Range editor by kind */}
        {f.kind === "numeric" && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:w-1/2">
            <label className="text-sm font-medium">أدنى<input value={f.low} onChange={set("low")} type="number" step="any" className={`mt-1 ${inp}`} /></label>
            <label className="text-sm font-medium">أعلى<input value={f.high} onChange={set("high")} type="number" step="any" className={`mt-1 ${inp}`} /></label>
          </div>
        )}
        {f.kind === "sex" && (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-line p-3">
              <div className="mb-2 text-xs font-semibold text-blue-600">الذكور</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-muted">أدنى<input value={f.mLow} onChange={set("mLow")} type="number" step="any" className={`mt-1 ${inp}`} /></label>
                <label className="text-xs text-muted">أعلى<input value={f.mHigh} onChange={set("mHigh")} type="number" step="any" className={`mt-1 ${inp}`} /></label>
              </div>
            </div>
            <div className="rounded-xl border border-line p-3">
              <div className="mb-2 text-xs font-semibold text-pink-600">الإناث</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-muted">أدنى<input value={f.fLow} onChange={set("fLow")} type="number" step="any" className={`mt-1 ${inp}`} /></label>
                <label className="text-xs text-muted">أعلى<input value={f.fHigh} onChange={set("fHigh")} type="number" step="any" className={`mt-1 ${inp}`} /></label>
              </div>
            </div>
          </div>
        )}
        {(f.kind === "numeric" || f.kind === "sex") && (
          <div className="mt-3 lg:w-1/2">
            <label className="text-sm font-medium">ملاحظة على المعدل (اختياري)<input value={f.note} onChange={set("note")} placeholder="مثال: Follicular Phase" className={`mt-1 ${inp}`} /></label>
          </div>
        )}
        {(f.kind === "numeric" || f.kind === "sex") && (
          <div className="mt-4 rounded-xl border border-dashed border-line p-3">
            <div className="text-sm font-medium">معدلات حسب العمر (اختياري)</div>
            <p className="mb-2 mt-0.5 text-xs text-muted">
              للأطفال مثلاً. إذا وقع عمر المريض ضمن فئة يُستخدم معدلها للجنسين بدل المعدل العام، ويُطبع بجانبه عمر الفئة.
              يُقرأ العمر من حقل «العمر»: رقم فقط = سنوات، أو اكتب «6 أشهر» أو «10 أيام».
            </p>
            {f.ages.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="hidden grid-cols-[1fr_1fr_1fr_1fr_1fr_auto] gap-2 text-[11px] text-muted sm:grid">
                  <span>من عمر</span><span>إلى أقل من (فارغ = بلا حد)</span><span>الوحدة</span><span>أدنى</span><span>أعلى</span><span className="w-8" />
                </div>
                {f.ages.map((r, i) => (
                  <div key={i} className="grid grid-cols-3 gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]">
                    <input value={r.from} onChange={(e) => setAge(i, { from: e.target.value })} type="number" step="any" min="0" placeholder="من" aria-label="من عمر" className={inp} />
                    <input value={r.to} onChange={(e) => setAge(i, { to: e.target.value })} type="number" step="any" min="0" placeholder="إلى" aria-label="إلى أقل من" className={inp} />
                    <select value={r.unit} onChange={(e) => setAge(i, { unit: e.target.value as AgeUnit })} aria-label="الوحدة" className={inp}>
                      {(["y", "m", "d"] as AgeUnit[]).map((u) => <option key={u} value={u}>{AGE_UNIT_LABEL[u]}</option>)}
                    </select>
                    <input value={r.low} onChange={(e) => setAge(i, { low: e.target.value })} type="number" step="any" placeholder="أدنى" aria-label="أدنى" className={inp} />
                    <input value={r.high} onChange={(e) => setAge(i, { high: e.target.value })} type="number" step="any" placeholder="أعلى" aria-label="أعلى" className={inp} />
                    <button type="button" onClick={() => setF((s) => ({ ...s, ages: s.ages.filter((_, j) => j !== i) }))} title="حذف الفئة" className="grid size-9 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50"><Trash2 className="size-4" /></button>
                  </div>
                ))}
              </div>
            )}
            <button type="button" onClick={() => setF((s) => ({ ...s, ages: [...s.ages, { from: "", to: "", unit: "y", low: "", high: "" }] }))}
              className="mt-2 inline-flex items-center gap-1 rounded-lg border border-dashed border-line px-2.5 py-1 text-xs hover:bg-canvas">
              <Plus className="size-3.5" /> فئة عمرية
            </button>
          </div>
        )}
        {f.kind === "qual" && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:w-2/3">
            <label className="text-sm font-medium">المعدل الطبيعي (نص)<input value={f.text} onChange={set("text")} placeholder="Negative" className={`mt-1 ${inp}`} /></label>
            <label className="text-sm font-medium">حد الإيجابية (اختياري)<input value={f.cutoff} onChange={set("cutoff")} type="number" step="any" placeholder="مثال: 6 أو 80 للعيار 1:80" className={`mt-1 ${inp}`} /></label>
            <p className="text-xs text-muted sm:col-span-2">يُعلَّم H عند إدخال + أو ++ أو +++ أو Positive، ويُعلَّم N عند Negative. إذا حدّدت حداً فالقيمة الرقمية أو العيار (مثل 1:160) الذي يساويه أو يزيد عليه يُعلَّم H.</p>
          </div>
        )}
        {f.kind === "text" && (
          <div className="mt-3 lg:w-1/2">
            <label className="text-sm font-medium">القيمة الطبيعية (نص)<input value={f.text} onChange={set("text")} placeholder="مثال: سلبي / طبيعي" className={`mt-1 ${inp}`} /></label>
          </div>
        )}

        <div className="mt-4">
          <button onClick={submit} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
            <Plus className="size-4" /> {editId ? "حفظ التعديل" : "إضافة الفحص"}
          </button>
        </div>
      </div>

      {/* Catalog list */}
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-line bg-surface px-3">
        <Search className="size-4 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن فحص بالاسم أو التصنيف أو العينة…" aria-label="بحث في الفحوصات" className="w-full bg-transparent py-2 text-sm outline-none" />
        {q && <span className="shrink-0 text-xs text-muted">{shown.length} من {tests.length}</span>}
        {q && <button onClick={() => setQ("")} aria-label="مسح البحث" className="text-muted hover:text-ink"><X className="size-4" /></button>}
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-right text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">الفحص</th>
              <th className="px-4 py-3 font-medium">التصنيف</th>
              <th className="px-4 py-3 font-medium">العينة</th>
              <th className="px-4 py-3 font-medium">المعدل الطبيعي</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">{tests.length ? "لا نتائج مطابقة للبحث" : "لا توجد فحوصات بعد"}</td></tr>
            )}
            {shown.map((t) => (
              <tr key={t.id} className="border-b border-line last:border-0 hover:bg-canvas">
                <td className="px-4 py-3 font-medium">
                  {t.name_ar}
                  {t.name_en && <span className="block text-xs font-normal text-muted">{t.name_en}</span>}
                </td>
                <td className="px-4 py-3 text-muted">{t.category ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{t.sample_type ?? "—"}</td>
                <td className="px-4 py-3 text-muted">
                  {isFormCode(t.code) ? <span className="text-brand-dark">استمارة — تُعدَّل من زر الاستمارة</span> : t.normal.kind === "sex" ? (
                    <span>
                      <span className="text-blue-600">ذكر</span> <span dir="ltr">{rangeLabel(t.normal, "male", t.unit)}</span>
                      {" · "}
                      <span className="text-pink-600">أنثى</span> <span dir="ltr">{rangeLabel(t.normal, "female", t.unit)}</span>
                    </span>
                  ) : (
                    <span dir="ltr">{rangeLabel(t.normal, "", t.unit)}</span>
                  )}
                  {(t.normal.kind === "numeric" || t.normal.kind === "sex") && (t.normal.ages?.length ?? 0) > 0 && (
                    <span className="mt-0.5 block text-[11px] text-brand-dark">+ {t.normal.ages!.length} فئة عمرية</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {isFormCode(t.code) && (
                      <button onClick={() => setFormEdit(t)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-brand/40 px-2 text-xs font-semibold text-brand-dark hover:bg-brand-light/50" title="إضافة أو حذف أو تعديل حقول الاستمارة">
                        <ClipboardList className="size-4" /> الاستمارة
                      </button>
                    )}
                    <button onClick={() => edit(t)} className="grid size-8 place-items-center rounded-lg border border-line hover:bg-canvas" title="تعديل"><Pencil className="size-4" /></button>
                    <button onClick={() => del(t.id)} className="grid size-8 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50" title="حذف"><Trash2 className="size-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {formEdit && <FormTemplateEditor code={formEdit.code as FormCode} testName={formEdit.name_ar} onClose={() => setFormEdit(null)} extraNormals={getSettings().formExtraNormals === true} />}

      {/* Panels (باقات) — named groups selected in one click */}
      <div className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold"><Layers className="size-4" /> الباقات</div>
        <p className="mb-3 text-xs text-muted">جمّع فحوصات متكرّرة في باقة (مثل CBC) لاختيارها بضغطة واحدة عند الإدخال.</p>

        {panels.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {panels.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs">
                {p.name} ({p.testIds.length})
                <button onClick={() => persistPanels(panels.filter((x) => x.id !== p.id))} className="text-red-600 hover:text-red-700" title="حذف الباقة">
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        <input
          value={panelName}
          onChange={(e) => setPanelName(e.target.value)}
          placeholder="اسم الباقة الجديدة"
          className={`mb-2 ${inp}`}
        />
        <div className="mb-3 grid max-h-48 grid-cols-2 gap-1 overflow-y-auto sm:grid-cols-3">
          {tests.map((t) => {
            const on = panelSel.has(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => togglePanelTest(t.id)}
                className={`truncate rounded-lg border px-2 py-1 text-right text-xs ${on ? "border-brand bg-brand-light/60" : "border-line hover:bg-canvas"}`}
              >
                {t.name_ar}
              </button>
            );
          })}
        </div>
        <button
          onClick={addPanel}
          disabled={!panelName.trim() || panelSel.size === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          <Plus className="size-4" /> إنشاء باقة ({panelSel.size})
        </button>
      </div>
    </div>
  );
}
