"use client";

import { useEffect, useState } from "react";
import { TestTubes, Plus, Pencil, Trash2, X, Info, Printer } from "lucide-react";
import { getTubes, saveTubes, unlinkFromTests, usageCount, uid, getSettings, type Tube, type TrainingSettings } from "@/lib/training/store";
import { SopLetterhead, SopPrintStyle, SopFooter, SOP_INK, exact } from "@/components/training/SopSheet";
import { ImagePicker } from "@/components/training/ImagePicker";
import { Img } from "@/components/training/Img";

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
const empty = { name: "", color: "#7c3aed", additive: "", uses: "", notes: "", imageId: undefined as string | undefined };

export default function TubesPage() {
  const [list, setList] = useState<Tube[]>([]);
  const [f, setF] = useState({ ...empty });
  const [editId, setEditId] = useState<string | null>(null);
  const [settings, setSettings] = useState<TrainingSettings | null>(null);

  useEffect(() => { setList(getTubes()); setSettings(getSettings()); }, []);

  function persist(next: Tube[]) { setList(next); saveTubes(next); }
  function reset() { setF({ ...empty }); setEditId(null); }
  function submit() {
    if (!f.name.trim()) return;
    const rec: Tube = { id: editId ?? uid(), name: f.name.trim(), color: f.color, additive: f.additive.trim() || undefined, uses: f.uses.trim() || undefined, notes: f.notes.trim() || undefined, imageId: f.imageId };
    persist(editId ? list.map((x) => (x.id === editId ? rec : x)) : [...list, rec]);
    reset();
  }
  function edit(t: Tube) {
    setF({ name: t.name, color: t.color, additive: t.additive ?? "", uses: t.uses ?? "", notes: t.notes ?? "", imageId: t.imageId });
    setEditId(t.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function del(t: Tube) {
    const n = usageCount("tubeIds", t.id);
    if (!window.confirm(n ? `هذا التيوب مستعمل في ${n} فحص — سيُزال منها. متابعة؟` : `حذف «${t.name}»؟`)) return;
    persist(list.filter((x) => x.id !== t.id));
    unlinkFromTests("tubeIds", t.id);
    if (editId === t.id) reset();
  }

  return (
    <div>
      <div className="no-print">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold"><TestTubes className="size-6 text-brand" /> التيوبات والحاويات</h1>
          <p className="text-sm text-muted">لون الغطاء، المادة المضافة، الاستعمالات، وملاحظات عملية — مع صورة لكل تيوب.</p>
        </div>
        <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas"><Printer className="size-4" /> طباعة لوحة التيوبات</button>
      </div>

      <div className="mb-5 flex gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
        <Info className="mt-0.5 size-5 shrink-0 text-sky-600" />
        <div>
          <div className="font-bold">ترتيب سحب التيوبات (Order of Draw)</div>
          <div className="mt-1">مزرعة الدم ← السترات (أزرق) ← العادي / الجل (أحمر / أصفر) ← الهيبارين (أخضر) ← EDTA (بنفسجي) ← الفلورايد (رمادي).</div>
          <div className="mt-0.5 text-xs text-sky-800">الالتزام بالترتيب يمنع انتقال المواد المضافة بين التيوبات — مثلاً EDTA يرفع البوتاسيوم ويُخفض الكالسيوم زوراً.</div>
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold">{editId ? "تعديل تيوب" : "إضافة تيوب / حاوية"}</div>
          {editId && <button onClick={reset} className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink"><X className="size-3.5" /> إلغاء</button>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium lg:col-span-2">الاسم *<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium">لون الغطاء
            <div className="mt-1 flex items-center gap-2"><input type="color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} className="h-9 w-14 cursor-pointer rounded border border-line" /><span className="text-xs text-muted" dir="ltr">{f.color}</span></div>
          </label>
          <div className="text-sm font-medium">الصورة<div className="mt-1"><ImagePicker value={f.imageId} onChange={(v) => setF({ ...f, imageId: v })} label={f.name || "تيوب"} size="size-14" /></div></div>
          <label className="text-sm font-medium lg:col-span-2">المادة المضافة<input value={f.additive} onChange={(e) => setF({ ...f, additive: e.target.value })} className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium lg:col-span-2">الاستعمالات<input value={f.uses} onChange={(e) => setF({ ...f, uses: e.target.value })} className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium sm:col-span-2 lg:col-span-4">ملاحظات عملية<textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} className={`mt-1 ${inp}`} /></label>
        </div>
        <button onClick={submit} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
          <Plus className="size-4" /> {editId ? "حفظ التعديل" : "إضافة"}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((t) => (
          <div key={t.id} className="flex gap-3 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
            {t.imageId ? <Img id={t.imageId} className="size-16 shrink-0 rounded-xl border border-line bg-white" /> : (
              <span className="flex w-10 shrink-0 flex-col items-center">
                <span className="h-4 w-8 rounded-t-md border border-black/10" style={{ background: t.color }} />
                <span className="h-12 w-6 rounded-b-full border border-t-0 border-line bg-canvas" />
              </span>
            )}
            <div className="min-w-0 flex-1 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="font-bold">{t.name}</div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => edit(t)} title="تعديل" className="grid size-7 place-items-center rounded-lg border border-line hover:bg-canvas"><Pencil className="size-3.5" /></button>
                  <button onClick={() => del(t)} title="حذف" className="grid size-7 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50"><Trash2 className="size-3.5" /></button>
                </div>
              </div>
              {t.additive && <div className="text-xs text-muted">{t.additive}</div>}
              {t.uses && <div className="mt-1 text-xs"><b>الاستعمال:</b> {t.uses}</div>}
              {t.notes && <div className="mt-1 rounded-lg bg-canvas px-2 py-1 text-xs">{t.notes}</div>}
            </div>
          </div>
        ))}
      </div>
      </div>

      {/* Printable wall chart */}
      {settings && (
        <div className="sop-doc hidden bg-white text-[12px] text-black print:block">
          <SopPrintStyle />
          <SopLetterhead settings={settings} right={<div className="font-bold" style={{ color: SOP_INK }}>لوحة التيوبات والحاويات</div>} />
          <div className="sop-keep mt-4 rounded-lg border-2 p-3" style={{ borderColor: SOP_INK }}>
            <div className="mb-2 text-sm font-bold" style={{ color: SOP_INK }}>ترتيب سحب التيوبات (Order of Draw)</div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
              {[["مزرعة الدم", "#f3f4f6"], ["سترات", "#38bdf8"], ["عادي / جل", "#eab308"], ["هيبارين", "#16a34a"], ["EDTA", "#7c3aed"], ["فلورايد", "#6b7280"]].map(([l, c], k, arr) => (
                <span key={l} className="inline-flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full border border-gray-300 px-2 py-1"><span className="size-3.5 rounded-full border border-black/20" style={{ background: c, ...exact }} /> {k + 1}. {l}</span>
                  {k < arr.length - 1 && <span className="text-gray-400">←</span>}
                </span>
              ))}
            </div>
            <div className="mt-1.5 text-[10.5px] text-gray-600">الالتزام بالترتيب يمنع انتقال المواد المضافة بين التيوبات (مثلاً EDTA يرفع البوتاسيوم ويُخفض الكالسيوم زوراً).</div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {list.map((t) => (
              <div key={t.id} className="sop-keep flex gap-3 rounded-lg border border-gray-300 p-2.5">
                {t.imageId ? <Img id={t.imageId} className="size-16 shrink-0 rounded" /> : (
                  <span className="flex w-9 shrink-0 flex-col items-center">
                    <span className="h-4 w-8 rounded-t-md border border-black/20" style={{ background: t.color, ...exact }} />
                    <span className="h-11 w-6 rounded-b-full border border-t-0 border-gray-300" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 font-bold"><span className="size-3 rounded-full border border-black/20" style={{ background: t.color, ...exact }} />{t.name}</div>
                  {t.additive && <div className="text-[11px] text-gray-600">{t.additive}</div>}
                  {t.uses && <div className="text-[11px]"><b>الاستعمال:</b> {t.uses}</div>}
                  {t.notes && <div className="mt-0.5 text-[10.5px] text-gray-700">{t.notes}</div>}
                </div>
              </div>
            ))}
          </div>
          <SopFooter text={settings.footer} />
        </div>
      )}
    </div>
  );
}
