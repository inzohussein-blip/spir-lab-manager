"use client";

import { LockGate } from "@/components/training/LockGate";
import { useEffect, useRef, useState } from "react";
import { Images, Upload, Trash2, Loader2, X } from "lucide-react";
import { addImage, deleteImage, listImages, setCaption, type MediaMeta } from "@/lib/training/media";
import { imageUsage, removeImageRefs } from "@/lib/training/store";
import { Img } from "@/components/training/Img";

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function MediaInner() {
  const [items, setItems] = useState<MediaMeta[] | null>(null);
  const [busy, setBusy] = useState(0);
  const [q, setQ] = useState("");
  const [zoom, setZoom] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => listImages().then(setItems);
  useEffect(() => { load(); }, []);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    setBusy(files.length);
    for (const f of files) {
      await addImage(f, f.name.replace(/\.[^.]+$/, ""));
      setBusy((n) => n - 1);
    }
    load();
  }
  async function remove(m: MediaMeta) {
    const used = imageUsage(m.id);
    const msg = used.length ? `هذه الصورة مستعملة في: ${used.join("، ")}.\nستُزال منها. حذف نهائياً؟` : "حذف الصورة نهائياً؟";
    if (!window.confirm(msg)) return;
    await deleteImage(m.id);
    removeImageRefs(m.id);
    load();
  }

  const shown = (items ?? []).filter((m) => !q.trim() || m.caption.toLowerCase().includes(q.trim().toLowerCase()));
  const total = (items ?? []).reduce((s, m) => s + m.size, 0);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Images className="size-6 text-brand" /> مكتبة الصور</h1>
          <p className="mt-1 text-sm text-muted">صور التيوبات والعينات والنتائج المجهرية — تُضغط تلقائياً وتُستعمل في أي فحص. {items && <span className="tabular-nums">({items.length} صورة · {kb(total)})</span>}</p>
        </div>
        <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
          {busy > 0 ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} {busy > 0 ? `جارٍ الرفع (${busy})…` : "رفع صور"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFiles} className="hidden" />
      </div>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالوصف…" className="mb-4 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand" />

      {items === null ? <p className="text-sm text-muted">جارٍ التحميل…</p> : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center text-sm text-muted">لا توجد صور بعد — ارفع صوراً أو أضفها من محرّر الفحص.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((m) => (
            <div key={m.id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
              <Img id={m.id} className="aspect-square w-full cursor-zoom-in bg-white" onClick={() => setZoom(m.id)} />
              <div className="flex flex-col gap-1.5 p-2">
                <input
                  defaultValue={m.caption}
                  onBlur={(e) => { if (e.target.value !== m.caption) setCaption(m.id, e.target.value.trim()); }}
                  placeholder="وصف الصورة…"
                  className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-xs outline-none hover:border-line focus:border-brand"
                />
                <div className="flex items-center justify-between px-1 text-[10px] text-muted">
                  <span className="tabular-nums" dir="ltr">{m.w}×{m.h} · {kb(m.size)}</span>
                  <button onClick={() => remove(m)} title="حذف" className="grid size-6 place-items-center rounded text-red-600 hover:bg-red-50"><Trash2 className="size-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {zoom && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-6" onClick={() => setZoom(null)}>
          <button className="absolute left-4 top-4 grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="إغلاق"><X className="size-5" /></button>
          <Img id={zoom} className="max-h-[85vh] max-w-[90vw] rounded-lg" />
        </div>
      )}
    </div>
  );
}

export default function MediaPage() {
  return (
    <LockGate>
      <MediaInner />
    </LockGate>
  );
}
