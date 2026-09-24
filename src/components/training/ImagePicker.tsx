"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Images, X, Loader2 } from "lucide-react";
import { addImage, listImages, type MediaMeta } from "@/lib/training/media";
import { Img } from "./Img";

/** Pick an image: upload a new one (auto-compressed) or choose from the library. */
export function ImagePicker({
  value, onChange, label = "صورة", size = "size-20",
}: { value?: string; onChange: (id: string | undefined) => void; label?: string; size?: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true);
    try { onChange(await addImage(f, label)); } finally { setBusy(false); }
  }

  return (
    <div className="flex items-center gap-2">
      {value ? (
        <div className="relative">
          <Img id={value} className={`${size} rounded-lg border border-line bg-white`} />
          <button type="button" onClick={() => onChange(undefined)} title="إزالة الصورة" className="absolute -left-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-red-600 text-white shadow">
            <X className="size-3" />
          </button>
        </div>
      ) : (
        <span className={`grid ${size} place-items-center rounded-lg border border-dashed border-line text-muted`}>
          {busy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
        </span>
      )}
      <div className="flex flex-col gap-1">
        <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs hover:bg-canvas">
          <ImagePlus className="size-3.5" /> رفع صورة
        </button>
        <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs hover:bg-canvas">
          <Images className="size-3.5" /> من المكتبة
        </button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
      {open && <LibraryModal onClose={() => setOpen(false)} onPick={(id) => { onChange(id); setOpen(false); }} />}
    </div>
  );
}

function LibraryModal({ onClose, onPick }: { onClose: () => void; onPick: (id: string) => void }) {
  const [items, setItems] = useState<MediaMeta[] | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => { listImages().then(setItems); }, []);
  const shown = (items ?? []).filter((m) => !q.trim() || m.caption.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl border border-line bg-surface shadow-[var(--shadow-pop)]">
        <div className="flex items-center gap-2 border-b border-line p-4">
          <Images className="size-4" />
          <div className="flex-1 text-sm font-bold">مكتبة الصور</div>
          <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-lg hover:bg-canvas"><X className="size-4" /></button>
        </div>
        <div className="p-4 pb-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالوصف…" className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand" />
        </div>
        <div className="grid flex-1 grid-cols-3 gap-3 overflow-y-auto p-4 pt-2 sm:grid-cols-4">
          {items === null && <div className="col-span-full py-8 text-center text-sm text-muted">جارٍ التحميل…</div>}
          {items && shown.length === 0 && <div className="col-span-full py-8 text-center text-sm text-muted">لا توجد صور بعد.</div>}
          {shown.map((m) => (
            <button key={m.id} type="button" onClick={() => onPick(m.id)} className="group flex flex-col gap-1 rounded-xl border border-line p-1.5 text-right hover:border-brand">
              <Img id={m.id} className="aspect-square w-full rounded-lg bg-white" />
              <span className="truncate px-1 text-[11px] text-muted group-hover:text-ink">{m.caption || "بدون وصف"}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
