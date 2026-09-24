"use client";

import { useEffect, useState } from "react";
import { Wrench, Plus, Pencil, Trash2, X } from "lucide-react";
import { getTools, saveTools, unlinkFromTests, usageCount, uid, type Tool } from "@/lib/training/store";
import { ImagePicker } from "@/components/training/ImagePicker";
import { Img } from "@/components/training/Img";

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
const KINDS = ["جهاز", "أداة", "كاشف", "مستهلكات"];
const empty = { name: "", kind: "أداة", description: "", imageId: undefined as string | undefined };

export default function ToolsPage() {
  const [list, setList] = useState<Tool[]>([]);
  const [f, setF] = useState({ ...empty });
  const [editId, setEditId] = useState<string | null>(null);
  const [kind, setKind] = useState("");

  useEffect(() => { setList(getTools()); }, []);

  function persist(next: Tool[]) { setList(next); saveTools(next); }
  function reset() { setF({ ...empty }); setEditId(null); }
  function submit() {
    if (!f.name.trim()) return;
    const rec: Tool = { id: editId ?? uid(), name: f.name.trim(), kind: f.kind.trim() || "أداة", description: f.description.trim() || undefined, imageId: f.imageId };
    persist(editId ? list.map((x) => (x.id === editId ? rec : x)) : [...list, rec]);
    reset();
  }
  function edit(t: Tool) {
    setF({ name: t.name, kind: t.kind, description: t.description ?? "", imageId: t.imageId });
    setEditId(t.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function del(t: Tool) {
    const n = usageCount("toolIds", t.id);
    if (!window.confirm(n ? `مستعمل في ${n} فحص — سيُزال منها. متابعة؟` : `حذف «${t.name}»؟`)) return;
    persist(list.filter((x) => x.id !== t.id));
    unlinkFromTests("toolIds", t.id);
    if (editId === t.id) reset();
  }

  const kinds = Array.from(new Set([...KINDS, ...list.map((t) => t.kind)]));
  const shown = list.filter((t) => !kind || t.kind === kind);

  return (
    <div>
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold"><Wrench className="size-6 text-brand" /> الأدوات والأجهزة</h1>
      <p className="mb-5 text-sm text-muted">الأجهزة والأدوات والكواشف والمستهلكات مع وصف مختصر وطريقة الاستعمال وصورة.</p>

      <div className="mb-5 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold">{editId ? "تعديل" : "إضافة أداة / جهاز / كاشف"}</div>
          {editId && <button onClick={reset} className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink"><X className="size-3.5" /> إلغاء</button>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium lg:col-span-2">الاسم *<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium">النوع
            <input list="kinds" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} className={`mt-1 ${inp}`} />
            <datalist id="kinds">{kinds.map((k) => <option key={k} value={k} />)}</datalist>
          </label>
          <div className="text-sm font-medium">الصورة<div className="mt-1"><ImagePicker value={f.imageId} onChange={(v) => setF({ ...f, imageId: v })} label={f.name || "أداة"} size="size-14" /></div></div>
          <label className="text-sm font-medium sm:col-span-2 lg:col-span-4">الوصف وطريقة الاستعمال<textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className={`mt-1 ${inp}`} /></label>
        </div>
        <button onClick={submit} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
          <Plus className="size-4" /> {editId ? "حفظ التعديل" : "إضافة"}
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {["", ...kinds].map((k) => (
          <button key={k || "all"} onClick={() => setKind(k)} className={`rounded-full border px-3 py-1 text-xs font-medium ${kind === k ? "border-brand bg-brand text-white" : "border-line bg-surface text-muted hover:text-ink"}`}>
            {k || `الكل (${list.length})`}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((t) => (
          <div key={t.id} className="flex gap-3 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
            {t.imageId && <Img id={t.imageId} className="size-14 shrink-0 rounded-xl border border-line bg-white" />}
            <div className="min-w-0 flex-1 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold">{t.name}</div>
                  <span className="rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-medium text-brand-dark">{t.kind}</span>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => edit(t)} title="تعديل" className="grid size-7 place-items-center rounded-lg border border-line hover:bg-canvas"><Pencil className="size-3.5" /></button>
                  <button onClick={() => del(t)} title="حذف" className="grid size-7 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50"><Trash2 className="size-3.5" /></button>
                </div>
              </div>
              {t.description && <div className="mt-1.5 text-xs text-muted">{t.description}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
