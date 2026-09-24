"use client";

import type { CSSProperties } from "react";
import { flagFor, rangeLabel, type Gender, type PrevResult, type StationSettings, type StationTest } from "@/lib/station/store";
import { Barcode } from "@/components/station/Barcode";

// Lab identity colours (from the printed letterhead): purple + gold.
const PURPLE = "#5a2a82";
const GOLD = "#c9a227";
const GOLD_DARK = "#9c7c1e";
const exact = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as CSSProperties;

export interface ReportRow {
  key: string;
  name: string;
  value: string;
  unit?: string;
  /** Catalog entry — supplies range, flag and category (may be gone for old visits). */
  test?: StationTest;
}

const ymd = (ms: number) => new Date(ms).toLocaleDateString("en-CA");

/** English headings for the built-in categories (the printed results table is English). */
const CATEGORY_EN: Record<string, string> = {
  "أمراض الدم": "Hematology",
  "وظائف الكلى": "Renal Function Tests",
  "وظائف الكبد": "Liver Function Tests",
  "السكري": "Diabetes",
  "الدهون": "Lipid Profile",
  "الهرمونات": "Hormones",
  "الفيتامينات والحديد": "Vitamins & Iron",
  "العظام والمعادن": "Bone & Minerals",
  "المصليات والمناعة": "Serology & Immunology",
  "حساسية الحنطة": "Wheat Allergy / Celiac",
  "فحوصات TORCH": "TORCH Panel",
  "الفيروسات": "Virology",
  "أدرار": "Urinalysis",
  "فحوصات أخرى": "Other Tests",
};

/**
 * The printable A4/A5 result sheet, shared by the entry screen and reprints.
 *
 * Multi-page printing: page padding is cloned onto every page fragment
 * (box-decoration-break), so content never touches a page edge; the footer bar
 * and watermark are fixed in print, which repeats them on every page; the
 * table header repeats and rows never split across pages.
 */
export function ReportSheet({
  settings, paper = "A4", date, accession, patient, referrer, rows, prev = {}, printPrev = false,
  emptyText = "No tests selected", className = "",
}: {
  settings: StationSettings;
  paper?: "A4" | "A5";
  date: string;
  accession?: string;
  patient: { name: string; gender: Gender; age?: string; phone?: string };
  referrer?: string;
  rows: ReportRow[];
  prev?: Record<string, PrevResult>;
  printPrev?: boolean;
  emptyText?: string;
  className?: string;
}) {
  const gender = patient.gender;
  const cols = printPrev ? 6 : 5;

  // Group rows by catalog category, keeping first-appearance order.
  const groups: { cat: string; rows: ReportRow[] }[] = [];
  for (const r of rows) {
    const ar = r.test?.category?.trim() || "فحوصات أخرى";
    const cat = CATEGORY_EN[ar] ?? ar;
    const g = groups.find((x) => x.cat === cat);
    if (g) g.rows.push(r);
    else groups.push({ cat, rows: [r] });
  }

  return (
    <>
      <style>{`@media print {
        @page { size: ${paper}; margin: 0; }
        #report-sheet {
          min-height: ${paper === "A5" ? "208mm" : "295mm"};
          padding: 12mm 12mm 22mm !important;
          -webkit-box-decoration-break: clone;
          box-decoration-break: clone;
        }
        #report-sheet thead { display: table-header-group; }
        #report-sheet tr, #report-sheet .report-keep { break-inside: avoid; }
        #report-sheet .report-group { break-after: avoid; }
        #report-sheet .report-footer { position: fixed; left: 12mm; right: 12mm; bottom: 8mm; margin: 0; }
        #report-sheet .report-watermark { position: fixed; }
        #report-sheet td, #report-sheet th { padding-top: 5px; padding-bottom: 5px; }
        ${paper === "A5" ? `
        #report-sheet { padding: 8mm 8mm 18mm !important; }
        #report-sheet table { font-size: 10px; }
        #report-sheet td, #report-sheet th { padding: 3px 4px; }
        #report-sheet .report-footer { left: 8mm; right: 8mm; bottom: 5mm; padding: 4px 8px; font-size: 9px; }
        ` : ""}
      }`}</style>

      <div id="report-sheet" className={`relative isolate mx-auto flex max-w-[210mm] flex-col bg-white p-8 text-black shadow-sm print:mt-0 print:shadow-none ${className}`}>
        {/* Faint centred logo watermark (fixed in print → centred on every page) */}
        {settings.logo && (
          <div aria-hidden className="report-watermark pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={settings.logo} alt="" className="w-1/2 max-w-[110mm] opacity-[0.06]" style={exact} />
          </div>
        )}

        {/* Letterhead — purple/gold identity */}
        <div className="flex items-center justify-between gap-4 pb-3">
          <div className="flex items-center gap-3">
            {settings.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.logo} alt="" className="size-20 object-contain" />
            )}
            <div>
              <h2 className="text-2xl font-extrabold leading-tight" style={{ color: PURPLE }}>{settings.labName}</h2>
              {settings.labSubtitle && <p className="text-sm font-medium" style={{ color: GOLD_DARK }}>{settings.labSubtitle}</p>}
            </div>
          </div>
          <div className="text-left text-xs text-gray-600">
            <div>التاريخ: {date}</div>
            {accession && <div className="font-mono font-bold" style={{ color: PURPLE }}>{accession}</div>}
          </div>
        </div>
        {/* Gold rule with a purple center accent */}
        <div className="h-1 w-full rounded" style={{ background: `linear-gradient(90deg, ${GOLD} 0%, ${PURPLE} 50%, ${GOLD} 100%)`, ...exact }} />

        <div className="report-keep mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-lg border-2 p-3 text-sm sm:grid-cols-3" style={{ borderColor: GOLD }}>
          <div><span style={{ color: PURPLE }} className="font-semibold">المريض:</span> <b>{patient.name || "—"}</b></div>
          <div><span style={{ color: PURPLE }} className="font-semibold">الجنس:</span> {gender === "male" ? "ذكر" : gender === "female" ? "أنثى" : "—"}</div>
          <div><span style={{ color: PURPLE }} className="font-semibold">العمر:</span> {patient.age || "—"}</div>
          <div><span style={{ color: PURPLE }} className="font-semibold">الهاتف:</span> {patient.phone || "—"}</div>
          {referrer && <div><span style={{ color: PURPLE }} className="font-semibold">الطبيب المُحيل:</span> {referrer}</div>}
        </div>

        {/* Results — printed in English, left to right (the entry screen stays Arabic). */}
        <div dir="ltr" className="mt-5 flex items-center gap-2">
          <span className="h-5 w-1.5 rounded" style={{ background: GOLD, ...exact }} />
          <span className="text-sm font-bold" style={{ color: PURPLE }}>Test Results</span>
        </div>
        <div dir="ltr" className="mt-2 overflow-hidden rounded-lg border text-left" style={{ borderColor: GOLD }}>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-white" style={{ background: PURPLE, ...exact }}>
                <th className="px-3 py-2.5 font-semibold">Test</th>
                <th className="px-3 py-2.5 font-semibold">Result</th>
                <th className="px-3 py-2.5 font-semibold">Unit</th>
                <th className="px-3 py-2.5 font-semibold">Reference Range</th>
                {printPrev && <th className="px-3 py-2.5 font-semibold">Previous</th>}
                <th className="px-3 py-2.5 font-semibold">Flag</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={cols} className="py-6 text-center text-gray-400">{emptyText}</td></tr>
              )}
              {groups.map((g) => [
                <tr key={`g-${g.cat}`} className="report-group">
                  <td colSpan={cols} className="px-3 pb-1 pt-2.5 text-xs font-bold" style={{ color: PURPLE, background: "#fbf6e4", borderTop: `1px solid ${GOLD}`, ...exact }}>
                    {g.cat}
                  </td>
                </tr>,
                ...g.rows.map((r, idx) => {
                  const t = r.test;
                  const f = t ? flagFor(r.value, t.normal, gender) : null;
                  const abn = f === "H" || f === "L";
                  const p = prev[r.key];
                  return (
                    <tr key={r.key} className="align-top" style={{ background: idx % 2 ? "#f7f3fb" : "#ffffff", ...exact }}>
                      <td className="px-3 py-2 font-medium">{t?.name_en?.trim() || r.name}</td>
                      <td className={`px-3 py-2 tabular-nums ${abn ? "font-bold" : "font-semibold"}`} style={abn ? { color: f === "H" ? "#b91c1c" : "#1d4ed8" } : undefined}>{r.value || "—"}</td>
                      <td className="px-3 py-2 text-gray-600">{r.unit || "—"}</td>
                      <td className="px-3 py-2 text-gray-600">{t ? rangeLabel(t.normal, gender, t.unit) : "—"}</td>
                      {printPrev && (
                        <td className="px-3 py-2 text-gray-600">
                          {p ? (
                            <>
                              <span className="tabular-nums font-semibold text-gray-800">{p.value}</span>
                              <span className="block text-[10px] tabular-nums text-gray-500">{ymd(p.at)}</span>
                            </>
                          ) : "—"}
                        </td>
                      )}
                      <td className="px-3 py-2">
                        {f === "H" ? <span className="inline-grid size-6 place-items-center rounded-full text-xs font-bold text-white" style={{ background: "#b91c1c", ...exact }}>H</span>
                          : f === "L" ? <span className="inline-grid size-6 place-items-center rounded-full text-xs font-bold text-white" style={{ background: "#1d4ed8", ...exact }}>L</span>
                          : f === "N" ? <span className="inline-grid size-6 place-items-center rounded-full text-xs font-bold" style={{ background: "#e7f6ef", color: "#127a4f", ...exact }}>N</span>
                          : <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                  );
                }),
              ])}
            </tbody>
          </table>
        </div>

        {/* Bottom group — signature sits at the bottom of the last page */}
        <div className="report-keep mt-auto">
          <div className="mt-10 flex items-end justify-between text-xs text-gray-600">
            <div>
              <div className="mb-6">اعتمد النتائج:</div>
              <div className="w-48 border-t pt-1 text-center text-gray-500" style={{ borderColor: GOLD }}>التوقيع / الختم</div>
            </div>
            {accession && (
              <div className="text-center">
                <Barcode text={accession} className="block h-8 w-40" />
                <div className="font-mono text-[10px] text-gray-500">{accession}</div>
              </div>
            )}
          </div>

          {settings.footer && (
            <div className="report-footer mt-4 rounded-md px-4 py-2 text-center text-xs font-medium text-white" style={{ background: PURPLE, ...exact }}>
              {settings.footer}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
