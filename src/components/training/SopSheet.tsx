"use client";

import type { CSSProperties } from "react";
import type { TrainingSettings, TrainingTest, Tube, Tool } from "@/lib/training/store";
import { Img } from "./Img";

const INK = "#312e81"; // indigo-900
const ACCENT = "#4f46e5";
const exact = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as CSSProperties;

/**
 * Printable Standard Operating Procedure (SOP) for one test — rendered only in
 * print. Page padding is cloned on every page, the footer repeats, and blocks
 * never split across pages.
 */
export function SopSheet({
  test, tubes, tools, settings, withImages,
}: { test: TrainingTest; tubes: Tube[]; tools: Tool[]; settings: TrainingSettings; withImages: boolean }) {
  const myTubes = test.tubeIds.map((id) => tubes.find((t) => t.id === id)).filter(Boolean) as Tube[];
  const myTools = test.toolIds.map((id) => tools.find((t) => t.id === id)).filter(Boolean) as Tool[];
  const safety = (test.safety?.trim() || settings.defaultSafety || "").split("\n").map((s) => s.trim()).filter(Boolean);
  const today = new Date().toLocaleDateString("en-CA");
  const sampleRows = [
    ["نوع العينة", test.sampleType], ["الحجم", test.volume], ["تحضير المريض", test.patientPrep], ["الثبات والحفظ", test.storage],
  ].filter(([, v]) => v?.trim());

  const H = ({ children }: { children: string }) => (
    <div className="sop-keep mb-1.5 mt-4 flex items-center gap-2 text-sm font-bold" style={{ color: INK }}>
      <span className="h-4 w-1.5 rounded" style={{ background: ACCENT, ...exact }} /> {children}
    </div>
  );

  return (
    <div id="sop-sheet" className="hidden bg-white text-[12px] leading-relaxed text-black print:block">
      <style>{`@media print {
        @page { size: A4; margin: 0; }
        #sop-sheet { padding: 12mm 13mm 20mm; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
        #sop-sheet .sop-keep, #sop-sheet li, #sop-sheet tr { break-inside: avoid; }
        #sop-sheet .sop-footer { position: fixed; left: 13mm; right: 13mm; bottom: 7mm; }
      }`}</style>

      {/* Letterhead */}
      <div className="flex items-center justify-between gap-4 border-b-2 pb-3" style={{ borderColor: ACCENT }}>
        <div className="flex items-center gap-3">
          {settings.logoImageId ? <Img id={settings.logoImageId} className="size-16" /> : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/lab-logo.png" alt="" className="size-16 object-contain" />
          )}
          <div>
            <div className="text-xl font-extrabold" style={{ color: INK }}>{settings.title}</div>
            <div className="text-xs text-gray-600">{settings.subtitle}</div>
          </div>
        </div>
        <div className="text-left text-[11px] text-gray-600">
          <div className="font-bold" style={{ color: ACCENT }}>إجراء عمل قياسي — SOP</div>
          <div>رمز الوثيقة: <span dir="ltr">SOP-{(test.abbr || test.name_en || "TEST").toUpperCase().replace(/\s+/g, "-")}</span></div>
          <div>تاريخ الإصدار: <span dir="ltr">{today}</span></div>
        </div>
      </div>

      {/* Title */}
      <div className="sop-keep mt-4 rounded-lg px-4 py-3 text-white" style={{ background: INK, ...exact }}>
        <div className="text-lg font-extrabold">{test.name_ar}</div>
        {(test.name_en || test.abbr) && <div className="text-xs opacity-90" dir="ltr">{test.name_en}{test.abbr ? ` (${test.abbr})` : ""}</div>}
      </div>

      {(test.purpose || test.summary) && (
        <>
          <H>الغرض ومبدأ الفحص</H>
          {test.purpose && <p><b>الغرض:</b> {test.purpose}</p>}
          {test.summary && <p><b>المبدأ:</b> {test.summary}</p>}
        </>
      )}

      {sampleRows.length > 0 && (
        <>
          <H>العينة والتحضير</H>
          <table className="sop-keep w-full border-collapse text-[11.5px]">
            <tbody>
              {sampleRows.map(([k, v]) => (
                <tr key={k}><td className="w-32 border border-gray-300 bg-gray-50 px-2 py-1 font-semibold" style={exact}>{k}</td><td className="border border-gray-300 px-2 py-1">{v}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {myTubes.length > 0 && (
        <>
          <H>التيوبات / الحاويات</H>
          <div className="sop-keep flex flex-wrap gap-2">
            {myTubes.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-2 py-1">
                <span className="size-3 rounded-full border border-black/20" style={{ background: t.color, ...exact }} />
                <b>{t.name}</b>{t.additive && <span className="text-gray-600">— {t.additive}</span>}
              </span>
            ))}
          </div>
        </>
      )}

      {myTools.length > 0 && (
        <>
          <H>الأدوات والأجهزة والكواشف</H>
          <ul className="list-inside list-disc columns-2 gap-6">
            {myTools.map((t) => <li key={t.id}>{t.name}</li>)}
          </ul>
        </>
      )}

      {test.steps.length > 0 && (
        <>
          <H>خطوات العمل</H>
          <ol className="flex flex-col gap-1.5">
            {test.steps.map((s, i) => (
              <li key={s.id} className={`flex gap-2 rounded-md px-2 py-1.5 ${s.warn ? "border border-red-300 bg-red-50" : ""}`} style={exact}>
                <span className="grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: s.warn ? "#dc2626" : ACCENT, ...exact }}>{i + 1}</span>
                <div className="flex-1">
                  <div className="whitespace-pre-line">{s.text}</div>
                  {withImages && s.imageId && <Img id={s.imageId} className="mt-1 h-28 rounded border border-gray-200" />}
                </div>
              </li>
            ))}
          </ol>
        </>
      )}

      {test.tips.length > 0 && (
        <>
          <H>ملاحظات من الخبرة العملية</H>
          <ul className="flex flex-col gap-1">
            {test.tips.map((t, i) => <li key={i} className="rounded-md border-r-4 bg-amber-50 px-2 py-1" style={{ borderColor: "#f59e0b", ...exact }}>{t}</li>)}
          </ul>
        </>
      )}

      {test.normals.length > 0 && (
        <>
          <H>القيم الطبيعية</H>
          <table className="sop-keep w-full border-collapse text-[11.5px]">
            <tbody>
              {test.normals.map((n, i) => (
                <tr key={i}><td className="w-40 border border-gray-300 bg-gray-50 px-2 py-1 font-semibold" style={exact}>{n.label}</td><td className="border border-gray-300 px-2 py-1" dir="ltr" style={{ textAlign: "right" }}>{n.value}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {(test.high || test.low) && (
        <>
          <H>التفسير</H>
          {test.high && <p><b style={{ color: "#b91c1c" }}>الارتفاع:</b> {test.high}</p>}
          {test.low && <p><b style={{ color: "#1d4ed8" }}>الانخفاض:</b> {test.low}</p>}
        </>
      )}

      {safety.length > 0 && (
        <div className="sop-keep mt-4 rounded-lg border-2 p-3" style={{ borderColor: "#16a34a", background: "#f0fdf4", ...exact }}>
          <div className="mb-1 text-sm font-bold" style={{ color: "#15803d" }}>تعليمات السلامة والجودة</div>
          <ul className="list-inside list-disc">{safety.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}

      {/* Sign-off */}
      <div className="sop-keep mt-6 grid grid-cols-3 gap-4 text-center text-[11px] text-gray-600">
        {[["أعدّه", settings.preparedBy ?? ""], ["راجعه واعتمده", ""], ["تاريخ المراجعة القادمة", ""]].map(([k, v]) => (
          <div key={k}>
            <div className="h-7 font-semibold text-black">{v}</div>
            <div className="border-t border-gray-400 pt-1">{k}</div>
          </div>
        ))}
      </div>

      {settings.footer && (
        <div className="sop-footer mt-4 rounded-md px-3 py-1.5 text-center text-[10px] text-white" style={{ background: INK, ...exact }}>{settings.footer}</div>
      )}
    </div>
  );
}
