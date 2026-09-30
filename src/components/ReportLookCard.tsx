"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ImageUp, Palette, PenLine, Languages, RotateCcw, Trash2 } from "lucide-react";
import { updateReportImage, updateReportLook } from "@/app/actions/settings";
import { shrinkImage } from "@/lib/shrinkImage";
import { REPORT_PALETTES, tableColors } from "@/lib/station/tableStyle";
import type { ReportLook } from "@/lib/lab-identity";
import { notifySaved } from "@/components/SettingsLayout";

const field = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

/** How light a #rrggbb colour is (0 black … 1 white). */
const lightness = (h: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.299 * r + 0.587 * g + 0.114 * b;
};

/** Settings → «شكل تقرير النتائج»: the lab's colours, the signature and stamp, and the English report. */
export function ReportLookCard({ look, lab }: { look: ReportLook; lab: { name: string; subtitle: string; footer: string; logo: string } }) {
  const [v, setV] = useState(look);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();
  const set = (patch: Partial<ReportLook>) => { setV((cur) => ({ ...cur, ...patch })); setMsg(null); };
  const c = tableColors(v.intensity, v.primary, v.accent);
  const palette = REPORT_PALETTES.find((p) => p.primary === v.primary && p.accent === v.accent);
  const isOriginal = v.primary === "#5a2a82" && v.accent === "#c9a227" && v.intensity === 100;

  async function save() {
    setBusy(true);
    const { signature: _s, stamp: _t, ...rest } = v;
    const r = await updateReportLook(rest);
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: "✓ حُفظ شكل التقرير" } : { ok: false, text: "للمدير فقط." });
    if (r.ok) { notifySaved(); router.refresh(); }
  }

  return (
    <div className="mb-4 rounded-2xl border border-line bg-surface p-5 shadow-sm" data-testid="report-look">
      <div className="mb-1 font-semibold">شكل تقرير النتائج</div>
      <p className="mb-4 text-xs text-muted">ألوان المختبر والتوقيع والختم ولغة التقرير. تُطبَّق على تقرير النتائج، وتظهر الألوان في وصل الاستلام أيضاً.</p>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
      <div className="min-w-0">

      {/* ── Colours ── */}
      <div className="mb-2 flex items-center gap-2 text-sm font-medium"><Palette className="size-4" /> ألوان التقرير</div>
      <div className="flex flex-wrap gap-2" data-testid="look-palettes">
        {REPORT_PALETTES.map((p) => {
          const on = p === palette;
          return (
            <button key={p.name} type="button" onClick={() => set({ primary: p.primary, accent: p.accent })} aria-pressed={on} aria-label={p.name} title={p.name}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs ${on ? "border-brand bg-canvas font-semibold" : "border-line hover:bg-canvas"}`}>
              <span className="inline-flex">
                <span className="size-5 rounded-full border border-black/10" style={{ background: p.primary }} />
                <span className="-ms-1.5 size-5 rounded-full border border-white" style={{ background: p.accent }} />
              </span>
              {p.name}
              {on && <Check className="size-3.5" />}
            </button>
          );
        })}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="color" value={v.primary} onChange={(e) => set({ primary: e.target.value })} aria-label="اللون الرئيسي" className="h-9 w-12 cursor-pointer rounded border border-line bg-surface p-0.5" />
          <span>اللون الرئيسي<span className="block text-[10px]">اسم المختبر، عناوين الأقسام، التذييل</span></span>
          <span className="ms-auto font-mono text-[11px] text-ink" dir="ltr">{v.primary}</span>
        </label>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="color" value={v.accent} onChange={(e) => set({ accent: e.target.value })} aria-label="اللون الثانوي" className="h-9 w-12 cursor-pointer rounded border border-line bg-surface p-0.5" />
          <span>اللون الثانوي<span className="block text-[10px]">الخط تحت الرأس والخطوط الفاصلة</span></span>
          <span className="ms-auto font-mono text-[11px] text-ink" dir="ltr">{v.accent}</span>
        </label>
        <label className="text-xs text-muted sm:col-span-2">
          <span className="flex items-center justify-between">شدة الألوان <b className="tabular-nums text-ink" dir="ltr">{v.intensity}%</b></span>
          <input type="range" min={70} max={150} step={5} value={v.intensity} onChange={(e) => set({ intensity: Number(e.target.value) })}
            className="mt-2 w-full accent-[var(--color-brand)]" aria-label="شدة الألوان" />
          <span className="flex justify-between text-[10px]"><span>أفتح</span><span>أغمق</span></span>
        </label>
      </div>
      {lightness(c.bar) > 0.62 && <p className="mt-2 text-[11px] text-amber-700" data-testid="look-warning">اللون الرئيسي فاتح: قد يصعب قراءة الكتابة البيضاء فوقه في التذييل.</p>}
      <div className="mt-2">
        <button type="button" onClick={() => set({ primary: "#5a2a82", accent: "#c9a227", intensity: 100 })} disabled={isOriginal}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-canvas disabled:opacity-50">
          <RotateCcw className="size-4" /> الألوان الأصلية
        </button>
      </div>

      {/* ── Signature and stamp ── */}
      <div className="mt-6 flex items-center gap-2 text-sm font-medium"><PenLine className="size-4" /> التوقيع والختم على التقرير</div>
      <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={v.signatureOn} onChange={(e) => set({ signatureOn: e.target.checked })} aria-label="التوقيع والختم على التقرير" className="size-4 accent-[var(--color-brand)]" />
        إظهار توقيع المسؤول واسمه وختم المختبر بدل خانة «التوقيع / الختم» الفارغة
      </label>
      {v.signatureOn && (
        <div className="mt-3 grid gap-3 border-s-2 border-line ps-4 sm:grid-cols-2">
          <label className="text-sm font-medium">اسم المسؤول تحت التوقيع
            <input value={v.signatureName} onChange={(e) => set({ signatureName: e.target.value })} maxLength={80} placeholder="مثلاً: د. أحمد علي" aria-label="اسم المسؤول" className={`mt-1 ${field}`} />
          </label>
          <label className="text-sm font-medium">الصفة
            <input value={v.signatureTitle} onChange={(e) => set({ signatureTitle: e.target.value })} maxLength={120} placeholder="مثلاً: أخصائي تحليلات مرضية" aria-label="الصفة" className={`mt-1 ${field}`} />
          </label>
          <ImagePick kind="signature" label="صورة التوقيع" value={look.signature} />
          <ImagePick kind="stamp" label="صورة الختم" value={look.stamp} />
          <p className="text-[11px] text-muted sm:col-span-2">صوّر التوقيع والختم على ورقة بيضاء، ويُفضَّل PNG بخلفية شفافة. تُحفظ الصورة فور اختيارها.</p>
        </div>
      )}

      {/* ── English report ── */}
      <div className="mt-6 flex items-center gap-2 text-sm font-medium"><Languages className="size-4" /> التقرير بالإنجليزية</div>
      <p className="mt-1 text-xs text-muted">في صفحة التقرير زرّا «العربية» و«English» للتبديل عند كل طباعة. أسماء الفحوصات بالإنجليزية تؤخذ من «الاسم الإنجليزي» في كتالوج الفحوصات.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">لغة التقرير عند فتحه
          <select value={v.lang} onChange={(e) => set({ lang: e.target.value === "en" ? "en" : "ar" })} aria-label="لغة التقرير" className={`mt-1 ${field}`}>
            <option value="ar">العربية</option>
            <option value="en">English</option>
          </select>
        </label>
        <label className="text-sm font-medium">اسم المختبر بالإنجليزية
          <input value={v.nameEn} onChange={(e) => set({ nameEn: e.target.value })} maxLength={120} placeholder="Pathology Laboratory" aria-label="اسم المختبر بالإنجليزية" className={`mt-1 ${field}`} dir="ltr" />
        </label>
        <label className="text-sm font-medium">السطر تحت الاسم بالإنجليزية
          <input value={v.subtitleEn} onChange={(e) => set({ subtitleEn: e.target.value })} maxLength={300} aria-label="السطر تحت الاسم بالإنجليزية" className={`mt-1 ${field}`} dir="ltr" />
        </label>
        <label className="text-sm font-medium">العنوان والهاتف بالإنجليزية
          <input value={v.footerEn} onChange={(e) => set({ footerEn: e.target.value })} maxLength={300} aria-label="العنوان والهاتف بالإنجليزية" className={`mt-1 ${field}`} dir="ltr" />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <button type="button" onClick={save} disabled={busy} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
          {busy ? "جارٍ الحفظ…" : "حفظ شكل التقرير"}
        </button>
        {msg && <span data-testid="look-msg" className={`text-sm ${msg.ok ? "text-teal-700" : "text-red-700"}`}>{msg.text}</span>}
      </div>
      </div>
      {/* The preview stays beside the settings on wide screens */}
      <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">
      {/* Preview */}
        <div className="rounded-xl border border-line bg-white p-4 text-black" data-testid="look-preview">
          <div className="mb-2 text-[11px] text-gray-500">معاينة</div>
          <div className="flex items-center gap-3 border-b-4 pb-2" style={{ borderColor: c.border }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lab.logo} alt="" className="size-10 object-contain" />
            <div>
              <div className="text-lg font-extrabold" style={{ color: c.title }} data-testid="look-preview-name">{lab.name}</div>
              {lab.subtitle && <div className="text-xs font-medium" style={{ color: c.subtitle }}>{lab.subtitle}</div>}
            </div>
          </div>
          <div className="mt-3 border-b pb-1 text-sm font-bold" style={{ color: c.groupText, borderColor: c.line }}>وظائف الكلى</div>
          <div className="flex justify-between border-b border-gray-100 py-1.5 text-sm"><span>اليوريا</span><b>32</b><span className="text-gray-500">15 – 45</span></div>
          <div className="mt-3 rounded-md px-3 py-1.5 text-center text-[11px] font-medium text-white" style={{ background: c.bar }}>{lab.footer || "العنوان - الهاتف"}</div>
        </div>
      </div>
      </div>
    </div>
  );
}

/** The signature or the stamp: pick an image (saved at once), or remove it. */
function ImagePick({ kind, label, value }: { kind: "signature" | "stamp"; label: string; value: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  async function save(dataUrl: string) {
    setBusy(true); setErr("");
    const r = await updateReportImage(kind, dataUrl);
    setBusy(false);
    if (r.ok) { notifySaved(); router.refresh(); } else setErr(r.error === "bad_image" ? "الصورة غير مناسبة — اختر PNG أو JPG أصغر." : "للمدير فقط.");
  }
  return (
    <div className="text-sm font-medium" data-testid={`look-${kind}`}>
      {label}
      <div className="mt-1 flex items-center gap-2">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={label} className="h-12 w-24 rounded border border-line bg-white object-contain" data-testid={`look-${kind}-preview`} />
        ) : <span className="grid h-12 w-24 place-items-center rounded border border-dashed border-line text-[11px] text-muted">بلا صورة</span>}
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" aria-label={`ملف ${label}`} className="hidden"
          onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) await save(await shrinkImage(f, 400).catch(() => "")); }} />
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs hover:bg-canvas disabled:opacity-50">
          <ImageUp className="size-3.5" /> {value ? "تغيير" : "رفع"}
        </button>
        {value && (
          <button type="button" disabled={busy} onClick={() => save("")} aria-label={`إزالة ${label}`} className="rounded-lg border border-red-200 p-1 text-red-700 hover:bg-red-50 disabled:opacity-50">
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
      {err && <p className="mt-1 text-xs text-red-700">{err}</p>}
    </div>
  );
}
