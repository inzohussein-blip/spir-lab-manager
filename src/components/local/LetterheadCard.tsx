"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Copy, FileText, ImageUp, Trash2 } from "lucide-react";
import { kvGet } from "@/lib/local/kv";
import { shrinkImage } from "@/lib/shrinkImage";

export interface LetterheadValue { title: string; subtitle: string; footer: string; logo: string }

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

/** The lab station's letterhead on this device, if it has one (read only when asked to copy it). */
function labStationLetterhead(): Partial<LetterheadValue> | null {
  try {
    const s = JSON.parse(kvGet("station.settings.v1") ?? "null") as { labName?: string; labSubtitle?: string; footer?: string; logo?: string } | null;
    if (!s?.labName?.trim()) return null;
    return { title: s.labName.trim(), subtitle: s.labSubtitle ?? "", footer: s.footer ?? "", logo: s.logo?.startsWith("data:image/") ? s.logo : "" };
  } catch {
    return null;
  }
}

/**
 * A station's printed letterhead (procurement, staff, quality): name, sub-title, footer line and
 * logo. Each field saves when you leave it. «نسخ من محطة المختبر» fills them once from the lab
 * station on this device; the stations stay separate afterwards.
 */
export function LetterheadCard({ heading, value, onSave, nameLabel = "اسم الجهة", children }: {
  heading: string;
  value: LetterheadValue;
  onSave: (patch: Partial<LetterheadValue>) => void;
  nameLabel?: string;
  /** Extra fields for this station (e.g. «أعدّه»). */
  children?: ReactNode;
}) {
  const [v, setV] = useState(value);
  const [msg, setMsg] = useState("");
  const [lab, setLab] = useState<Partial<LetterheadValue> | null>(null);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { setLab(labStationLetterhead()); }, []);

  const field = (k: "title" | "subtitle" | "footer", label: string, wide = false, placeholder?: string) => (
    <label className={`text-sm font-medium ${wide ? "sm:col-span-2" : ""}`}>{label}
      <input value={v[k]} placeholder={placeholder} onChange={(e) => setV({ ...v, [k]: e.target.value })}
        onBlur={(e) => { if (e.target.value.trim() !== value[k]) onSave({ [k]: e.target.value.trim() }); }} className={`mt-1 ${inp}`} />
    </label>
  );

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]" data-testid="letterhead-card">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-sm font-semibold">
        <FileText className="size-4" /> {heading}
        {lab && (
          <button type="button" onClick={() => { const next = { ...v, ...lab } as LetterheadValue; setV(next); onSave(lab); setMsg("نُسخت ترويسة محطة المختبر."); }}
            className="ms-auto inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-normal hover:bg-canvas">
            <Copy className="size-3.5" /> نسخ من محطة المختبر
          </button>
        )}
      </div>
      <p className="mb-3 text-xs text-muted">تظهر في رأس المطبوعات وأسفلها. يُحفظ كل حقل عند الخروج منه.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {field("title", nameLabel)}
        {field("subtitle", "العنوان الفرعي")}
        {field("footer", "سطر التذييل (العنوان / الهاتف)", true, "العنوان - الهاتف")}
        {children}
        <div className="text-sm font-medium sm:col-span-2">الشعار
          <div className="mt-1 flex flex-wrap items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={v.logo || "/lab-logo.png"} alt="الشعار" className="size-14 rounded-lg border border-line bg-white object-contain p-1" data-testid="letterhead-logo" />
            <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" aria-label="ملف الشعار" className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]; e.target.value = "";
                if (!f) return;
                const logo = await shrinkImage(f, 320).catch(() => "");
                if (!logo) { setMsg("تعذّرت قراءة الصورة — اختر PNG أو JPG."); return; }
                setV({ ...v, logo }); onSave({ logo }); setMsg("");
              }} />
            <button type="button" onClick={() => file.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-canvas">
              <ImageUp className="size-4" /> {v.logo ? "تغيير الشعار" : "رفع شعار"}
            </button>
            {v.logo && (
              <button type="button" onClick={() => { setV({ ...v, logo: "" }); onSave({ logo: "" }); }} className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline">
                <Trash2 className="size-3.5" /> الشعار الافتراضي
              </button>
            )}
          </div>
        </div>
      </div>
      {msg && <p className="mt-2 text-xs text-brand-dark">{msg}</p>}
    </div>
  );
}
