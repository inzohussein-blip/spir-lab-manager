"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";
import { saveLabPrint, saveLabRules } from "@/app/actions/desk";
import { REPORT_FONTS, PRE_TOP_DEFAULT, PRE_BOTTOM_DEFAULT } from "@/lib/station/reportExtras";
import { reportDateOf, reportDateText, type ReportDate } from "@/lib/station/reportDate";
import type { LabPrint, LabRules } from "@/lib/desk/types";
import { field } from "./DeskParts";

function Check({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-canvas">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} className="mt-0.5 size-4 accent-[var(--color-brand)]" />
      <span className="text-sm">{label}{hint && <span className="block text-[11px] text-muted">{hint}</span>}</span>
    </label>
  );
}
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="mb-1 text-sm font-bold">{title}</div>
      {children}
    </div>
  );
}

/** «إعدادات نافذة المختبر» (the manager): the verification rules and the printed report's options —
 *  the same ones as the lab station's report. */
export function LabSettingsDialog({ print, rules, onClose }: { print: LabPrint; rules: LabRules; onClose: () => void }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [p, setP] = useState<LabPrint>(print);
  const [r, setR] = useState<LabRules>(rules);
  const set = <K extends keyof LabPrint>(k: K, v: LabPrint[K]) => setP((x) => ({ ...x, [k]: v }));
  const d = reportDateOf(p);
  const setD = (k: keyof ReportDate, v: string | boolean) => set("reportDate", { ...d, [k]: v } as ReportDate);

  function save() {
    start(async () => {
      const a = await saveLabRules(r);
      const b = await saveLabPrint(p);
      if (!a.ok || !b.ok) { toast.error((!a.ok && a.error) || (!b.ok && b.error) || "تعذّر الحفظ"); return; }
      toast.success("حُفظت الإعدادات");
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="no-print fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-label="إعدادات نافذة المختبر">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-2xl bg-surface p-5 shadow-[var(--shadow-pop)]" data-testid="lab-settings-dialog">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-bold">إعدادات نافذة المختبر</div>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="rounded p-1 hover:bg-canvas"><X className="size-5" /></button>
        </div>
        <div className="grid gap-3">
          <Group title="مسار العمل">
            <Check label="اعتماد ثانٍ" hint="لا تصبح النتائج نهائية حتى يعتمدها شخص ثانٍ غير الذي اعتمدها أولاً." checked={r.twoStep} onChange={(v) => setR({ ...r, twoStep: v })} />
            <label className="flex items-center gap-2 px-2 py-1.5 text-sm">
              تظهر العيّنة «متأخرة» بعد
              <input value={String(r.tat)} onChange={(e) => setR({ ...r, tat: Number(e.target.value.replace(/[^\d]/g, "")) || 0 })} inputMode="numeric" aria-label="مدة التأخير بالدقائق" className="w-20 rounded-lg border border-line px-2 py-1 text-center" />
              دقيقة <span className="text-[11px] text-muted">(0 = بلا حد؛ ولكل فحص مدته في كتالوج الفحوصات)</span>
            </label>
          </Group>

          <Group title="إدخال النتائج">
            <Check label="مربع «تمييز» بجانب كل نتيجة" checked={p.entryHighlight !== false} onChange={(v) => set("entryHighlight", v)} />
            <Check label="الحساب التلقائي للفحوص المشتقة (LDL، VLDL، الغلوبيولين…)" checked={!!p.autoDerived} onChange={(v) => set("autoDerived", v)} />
            {p.autoDerived && (
              <div className="ms-6">
                <Check label="eGFR بمعادلة CKD-EPI 2021" checked={!!p.derivedEgfr} onChange={(v) => set("derivedEgfr", v)} />
                <Check label="LDL بمعادلة Sampson عند TG بين 400 و800" checked={!!p.derivedSampson} onChange={(v) => set("derivedSampson", v)} />
              </div>
            )}
            <Check label="زر واتساب (التقرير PDF)" checked={p.entryWhatsApp !== false} onChange={(v) => set("entryWhatsApp", v)} />
            <Check label="ملصقات الأنابيب" checked={!!p.tubeLabel} onChange={(v) => set("tubeLabel", v)} />
            {p.tubeLabel && (
              <div className="ms-8 flex flex-wrap gap-2 pb-1">
                <select value={p.labelSize ?? "50x25"} onChange={(e) => set("labelSize", e.target.value as "50x25" | "60x30")} aria-label="حجم الملصق" className="rounded-lg border border-line px-2 py-1 text-sm">
                  <option value="50x25">50 × 25 مم</option><option value="60x30">60 × 30 مم</option>
                </select>
                <select value={String(p.labelCopies ?? 1)} onChange={(e) => set("labelCopies", Number(e.target.value))} aria-label="عدد النسخ" className="rounded-lg border border-line px-2 py-1 text-sm">
                  {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} نسخة</option>)}
                </select>
              </div>
            )}
          </Group>

          <Group title="التقرير المطبوع">
            <label className="flex items-center gap-2 px-2 py-1.5 text-sm">حجم الورق
              <select value={p.paper ?? "A4"} onChange={(e) => set("paper", e.target.value as "A4" | "A5")} aria-label="حجم الورق" className="rounded-lg border border-line px-2 py-1">
                <option value="A4">A4</option><option value="A5">A5</option>
              </select>
            </label>
            <Check label="الباركود بجانب بيانات المريض" checked={p.reportBarcode !== false} onChange={(v) => set("reportBarcode", v)} />
            <Check label="رمز QR ببيانات المختبر أسفل التقرير" checked={p.labQr !== false} onChange={(v) => set("labQr", v)} />
            <Check label="طباعة النتيجة السابقة بجانب الجديدة" checked={!!p.printPrevious} onChange={(v) => set("printPrevious", v)} />
            <Check label="ملء الصفحة عند قلة الفحوص" checked={!!p.reportFill} onChange={(v) => set("reportFill", v)} />
            <Check label="الطباعة على ورق مطبوع مسبقاً (بلا ترويسة)" checked={!!p.prePrinted} onChange={(v) => set("prePrinted", v)} />
            {p.prePrinted && (
              <div className="ms-8 flex flex-wrap items-center gap-2 pb-1 text-sm">
                فراغ أعلى <input value={String(p.prePrintedTop ?? PRE_TOP_DEFAULT)} onChange={(e) => set("prePrintedTop", Number(e.target.value.replace(/[^\d]/g, "")) || 0)} aria-label="الفراغ الأعلى" className="w-16 rounded-lg border border-line px-2 py-1 text-center" /> مم
                · أسفل <input value={String(p.prePrintedBottom ?? PRE_BOTTOM_DEFAULT)} onChange={(e) => set("prePrintedBottom", Number(e.target.value.replace(/[^\d]/g, "")) || 0)} aria-label="الفراغ الأسفل" className="w-16 rounded-lg border border-line px-2 py-1 text-center" /> مم
              </div>
            )}
            <Check label="خط التقرير" checked={!!p.reportFontOn} onChange={(v) => set("reportFontOn", v)} />
            {p.reportFontOn && (
              <select value={p.reportFont ?? "plex"} onChange={(e) => set("reportFont", e.target.value)} aria-label="خط التقرير" className={`${field} ms-8 w-auto`}>
                {REPORT_FONTS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            )}
            <Check label="مكان الشعار والعلامة المائية" checked={!!p.reportHeadOn} onChange={(v) => set("reportHeadOn", v)} />
            {p.reportHeadOn && (
              <div className="ms-8 flex flex-wrap gap-2 pb-1">
                <select value={p.reportHead?.logo ?? "start"} onChange={(e) => set("reportHead", { ...p.reportHead, logo: e.target.value as "start" | "end" | "center" })} aria-label="مكان الشعار" className="rounded-lg border border-line px-2 py-1 text-sm">
                  <option value="start">الشعار بجانب الاسم</option><option value="end">في الجهة الأخرى</option><option value="center">في الوسط</option>
                </select>
                <select value={p.reportHead?.watermark === false ? "0" : "1"} onChange={(e) => set("reportHead", { ...p.reportHead, watermark: e.target.value === "1" })} aria-label="العلامة المائية" className="rounded-lg border border-line px-2 py-1 text-sm">
                  <option value="1">مع علامة مائية</option><option value="0">بلا علامة مائية</option>
                </select>
              </div>
            )}
            <div className="mt-1 grid gap-2 px-2 sm:grid-cols-3" data-testid="lab-date-options">
              <select value={d.show ? d.format : "off"} onChange={(e) => (e.target.value === "off" ? setD("show", false) : set("reportDate", { ...d, show: true, format: e.target.value as ReportDate["format"] }))} aria-label="صيغة التاريخ" className="rounded-lg border border-line px-2 py-1 text-sm">
                <option value="ymd">2026-10-03</option><option value="dmy">03/10/2026</option><option value="long-ar">3 تشرين الأول 2026</option><option value="long-en">3 Oct 2026</option><option value="off">بلا تاريخ</option>
              </select>
              <select value={d.time} onChange={(e) => setD("time", e.target.value)} aria-label="الوقت" className="rounded-lg border border-line px-2 py-1 text-sm">
                <option value="none">بلا وقت</option><option value="24h">14:05</option><option value="12h">2:05 م</option>
              </select>
              <select value={d.source} onChange={(e) => setD("source", e.target.value)} aria-label="أي وقت" className="rounded-lg border border-line px-2 py-1 text-sm">
                <option value="visit">وقت تسجيل العيّنة</option><option value="print">وقت الطباعة</option>
              </select>
            </div>
            {d.show && <div className="px-2 pt-1 text-[11px] text-muted">مثال: <bdi>{reportDateText(d, new Date(2026, 9, 3, 14, 5).getTime(), true)}</bdi></div>}
          </Group>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm">إلغاء</button>
          <button type="button" disabled={busy} onClick={save} data-testid="lab-settings-save" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">حفظ</button>
        </div>
      </div>
    </div>
  );
}
