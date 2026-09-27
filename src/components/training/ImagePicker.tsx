"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Images, X, Loader2 } from "lucide-react";
import { addImage, listImages, type MediaMeta } from "@/lib/training/media";
import { Img } from "./Img";
import { STATIC_IMAGES } from "@/lib/local/staticImages";

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
  // «صوري»: images added on this device; «صور المشروع»: the project's own (public/lab-images), the same on every device.
  const [tab, setTab] = useState<"mine" | "project">(STATIC_IMAGES.length ? "project" : "mine");
  useEffect(() => { listImages().then(setItems); }, []);
  const needle = q.trim().toLowerCase();
  const shown = (items ?? []).filter((m) => !needle || m.caption.toLowerCase().includes(needle));
  const statics = STATIC_IMAGES.filter((m) => !needle || m.caption.toLowerCase().includes(needle) || m.path.toLowerCase().includes(needle));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl border border-line bg-surface shadow-[var(--shadow-pop)]">
        <div className="flex items-center gap-2 border-b border-line p-4">
          <Images className="size-4" />
          <div className="flex-1 text-sm font-bold">مكتبة الصور</div>
          <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-lg hover:bg-canvas"><X className="size-4" /></button>
        </div>
        <div className="flex flex-wrap items-center gap-2 p-4 pb-2">
          <div className="inline-flex rounded-lg border border-line p-0.5 text-xs">
            <button type="button" onClick={() => setTab("project")} className={`rounded-md px-3 py-1 ${tab === "project" ? "bg-brand text-white" : "hover:bg-canvas"}`}>صور المشروع ({STATIC_IMAGES.length})</button>
            <button type="button" onClick={() => setTab("mine")} className={`rounded-md px-3 py-1 ${tab === "mine" ? "bg-brand text-white" : "hover:bg-canvas"}`}>صور هذا الجهاز ({items?.length ?? 0})</button>
          </div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالوصف…" className="min-w-40 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand" />
        </div>
        <div className="grid flex-1 grid-cols-3 gap-3 overflow-y-auto p-4 pt-2 sm:grid-cols-4" data-testid={`library-${tab}`}>
          {tab === "project" ? (
            <>
              {statics.length === 0 && (
                <div className="col-span-full py-8 text-center text-sm text-muted">
                  {STATIC_IMAGES.length ? "لا صور مطابقة." : <>لا صور في المشروع بعد — ضع الصور في المجلد <span dir="ltr" className="font-mono">public/lab-images</span> ثم انشر التحديث. تظهر على كل الأجهزة وتعمل بدون إنترنت.</>}
                </div>
              )}
              {statics.map((m) => (
                <button key={m.path} type="button" onClick={() => onPick(m.path)} title={m.path} className="group flex flex-col gap-1 rounded-xl border border-line p-1.5 text-right hover:border-brand">
                  <Img id={m.path} alt={m.caption} className="aspect-square w-full rounded-lg bg-white" />
                  <span className="truncate px-1 text-[11px] text-muted group-hover:text-ink">{m.caption}</span>
                </button>
              ))}
            </>
          ) : (
            <>
              {items === null && <div className="col-span-full py-8 text-center text-sm text-muted">جارٍ التحميل…</div>}
              {items && shown.length === 0 && <div className="col-span-full py-8 text-center text-sm text-muted">لا توجد صور بعد.</div>}
              {shown.map((m) => (
                <button key={m.id} type="button" onClick={() => onPick(m.id)} className="group flex flex-col gap-1 rounded-xl border border-line p-1.5 text-right hover:border-brand">
                  <Img id={m.id} className="aspect-square w-full rounded-lg bg-white" />
                  <span className="truncate px-1 text-[11px] text-muted group-hover:text-ink">{m.caption || "بدون وصف"}</span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
