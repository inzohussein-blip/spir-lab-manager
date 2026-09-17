"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, ListChecks, X, Layers } from "lucide-react";
import {
  getTests, saveTests, getPanels, savePanels, uid, rangeLabel,
  type StationTest, type NormalRange, type StationPanel,
} from "@/lib/station/store";

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

type RangeKind = "none" | "numeric" | "sex" | "text";

const empty = {
  name_ar: "", name_en: "", category: "", sample_type: "", unit: "",
  kind: "numeric" as RangeKind,
  low: "", high: "",
  mLow: "", mHigh: "", fLow: "", fHigh: "",
  text: "",
};

const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));

function buildNormal(f: typeof empty): NormalRange {
  if (f.kind === "numeric") return { kind: "numeric", low: numOrNull(f.low), high: numOrNull(f.high) };
  if (f.kind === "sex")
    return {
      kind: "sex",
      male: { low: numOrNull(f.mLow), high: numOrNull(f.mHigh) },
      female: { low: numOrNull(f.fLow), high: numOrNull(f.fHigh) },
    };
  if (f.kind === "text") return { kind: "text", text: f.text.trim() };
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
    text: n.kind === "text" ? n.text : "",
  };
}

export default function StationTestsPage() {
  const [tests, setTests] = useState<StationTest[]>([]);
  const [f, setF] = useState({ ...empty });
  const [editId, setEditId] = useState<string | null>(null);
  const [panels, setPanels] = useState<StationPanel[]>([]);
  const [panelName, setPanelName] = useState("");
  const [panelSel, setPanelSel] = useState<Set<string>>(new Set());

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

  function persist(next: StationTest[]) {
    setTests(next);
    saveTests(next);
  }
  function reset() { setF({ ...empty }); setEditId(null); }

  function submit() {
    if (!f.name_ar.trim()) return;
    const rec: StationTest = {
      id: editId ?? uid(),
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
    if (editId === id) reset();
  }

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

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
            {tests.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">لا توجد فحوصات بعد</td></tr>
            )}
            {tests.map((t) => (
              <tr key={t.id} className="border-b border-line last:border-0 hover:bg-canvas">
                <td className="px-4 py-3 font-medium">
                  {t.name_ar}
                  {t.name_en && <span className="block text-xs font-normal text-muted">{t.name_en}</span>}
                </td>
                <td className="px-4 py-3 text-muted">{t.category ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{t.sample_type ?? "—"}</td>
                <td className="px-4 py-3 text-muted">
                  {t.normal.kind === "sex" ? (
                    <span>
                      <span className="text-blue-600">ذكر</span> {rangeLabel(t.normal, "male", t.unit)}
                      {" · "}
                      <span className="text-pink-600">أنثى</span> {rangeLabel(t.normal, "female", t.unit)}
                    </span>
                  ) : (
                    rangeLabel(t.normal, "", t.unit)
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => edit(t)} className="grid size-8 place-items-center rounded-lg border border-line hover:bg-canvas" title="تعديل"><Pencil className="size-4" /></button>
                    <button onClick={() => del(t.id)} className="grid size-8 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50" title="حذف"><Trash2 className="size-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
