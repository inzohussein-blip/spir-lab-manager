"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Trash2 } from "lucide-react";
import { updateLabLogo } from "@/app/actions/settings";

/** The largest side of the stored logo, in pixels (it prints at about 16 mm). */
const SIDE = 320;

/** Make the chosen image small (≤ 320 px, PNG keeps transparency) before it is saved. */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const png = c.toDataURL("image/png");
    return png.length < 200_000 ? png : c.toDataURL("image/webp", 0.9);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Settings → «شعار المختبر»: shown on the panel, the reports and the receipts. */
export function LogoCard({ logo, isDefault }: { logo: string; isDefault: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function save(dataUrl: string) {
    setBusy(true); setMsg(null);
    const r = await updateLabLogo(dataUrl);
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: dataUrl ? "✓ حُفظ الشعار" : "✓ أُعيد الشعار الافتراضي" } : { ok: false, text: r.error === "bad_image" ? "الصورة غير مناسبة — اختر PNG أو JPG أصغر." : "للمدير فقط." });
    if (r.ok) router.refresh();
  }

  return (
    <div data-testid="logo-card" className="mt-4 flex flex-wrap items-center gap-4 border-t border-line pt-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} alt="شعار المختبر" data-testid="logo-preview" className="size-16 rounded-lg border border-line bg-white object-contain p-1" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">شعار المختبر</div>
        <p className="text-xs text-muted">يظهر في القائمة الجانبية وعلى التقارير والوصولات. PNG بخلفية شفافة أفضل، ويُصغَّر تلقائياً.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" aria-label="ملف الشعار" className="hidden"
            onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) await save(await shrink(f).catch(() => "")); }} />
          <button type="button" disabled={busy} onClick={() => input.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-canvas disabled:opacity-50">
            <ImageUp className="size-4" /> {isDefault ? "رفع شعار المختبر" : "تغيير الشعار"}
          </button>
          {!isDefault && (
            <button type="button" disabled={busy} onClick={() => save("")} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50">
              <Trash2 className="size-4" /> الشعار الافتراضي
            </button>
          )}
        </div>
        {msg && <p data-testid="logo-msg" className={`mt-1 text-xs ${msg.ok ? "text-teal-700" : "text-red-700"}`}>{msg.text}</p>}
      </div>
    </div>
  );
}
