"use client";

import type { CSSProperties } from "react";
import { flagFor, rangeLabel, type Gender, type PrevResult, type StationSettings, type StationTest } from "@/lib/station/store";
import { tableStyleOf, tableColors, DENSITY_PAD, GAP_PX, type TableStyle } from "@/lib/station/tableStyle";
import { Barcode } from "@/components/station/Barcode";
import { FormReport } from "@/components/station/FormReport";
import { isFormCode, decodeForm, type FormCode } from "@/lib/station/templates";

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
  "الخروج": "Stool Examination",
  "السائل المنوي": "Semen Analysis",
  "الزرع الجرثومي": "Microbiology",
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
  emptyText = "No tests selected", className = "", printable = true,
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
  /** false while another sheet (e.g. tube labels) is being printed: stays on screen, not on paper. */
  printable?: boolean;
}) {
  const gender = patient.gender;
  const ts = tableStyleOf(settings.reportTable);
  const pad = DENSITY_PAD[ts.density];

  // Structured reports (urine / stool / semen / culture) print on their own page.
  const formRows = rows.filter((r) => isFormCode(r.test?.code));
  const regular = rows.filter((r) => !isFormCode(r.test?.code));

  // Group rows by catalog category, keeping first-appearance order.
  const groups: { cat: string; rows: ReportRow[] }[] = [];
  for (const r of regular) {
    const ar = r.test?.category?.trim() || "فحوصات أخرى";
    const cat = CATEGORY_EN[ar] ?? ar;
    const g = groups.find((x) => x.cat === cat);
    if (g) g.rows.push(r);
    else groups.push({ cat, rows: [r] });
  }

  const header = (
    <>
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
    </>
  );

  return (
    <>
      {printable && <style>{`@media print {
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
        #report-sheet .report-page { break-before: page; }
        #report-sheet .form-table td, #report-sheet .form-table th { padding-top: 2px !important; padding-bottom: 2px !important; }
        #report-sheet .report-footer { position: fixed; left: 12mm; right: 12mm; bottom: 8mm; margin: 0; }
        #report-sheet .report-watermark { position: fixed; }
        #report-sheet td, #report-sheet th { padding-top: ${pad.a4}px !important; padding-bottom: ${pad.a4}px !important; }
        ${paper === "A5" ? `
        #report-sheet { padding: 8mm 8mm 18mm !important; }
        #report-sheet table { font-size: ${(ts.fontSize * 10 / 14).toFixed(1)}px !important; }
        #report-sheet td, #report-sheet th { padding: ${pad.a5}px 4px !important; }
        #report-sheet .form-table td, #report-sheet .form-table th { padding: 0.5px 4px !important; }
        #report-sheet .form-sec { margin-bottom: 2.5mm; }
        #report-sheet .cs-box { padding: 5px 12px !important; font-size: ${(ts.fontSize * 10 / 14).toFixed(1)}px !important; }
        #report-sheet .cs-box > div { padding-top: 1px; padding-bottom: 1px; }
        #report-sheet .cs-ast { margin-top: 3mm; }
        #report-sheet .cs-ast-title { display: none; }
        #report-sheet .report-sign { margin-top: 3mm; }
        #report-sheet .report-sign .mb-6 { margin-bottom: 4mm; }
        #report-sheet .form-sec:last-child { margin-bottom: 0; }
        #report-sheet table.form-table { font-size: ${(ts.fontSize * 9 / 14).toFixed(1)}px !important; line-height: 1.2 !important; }
        #report-sheet .report-footer { left: 8mm; right: 8mm; bottom: 5mm; padding: 4px 8px; font-size: 9px; }
        ` : ""}
      }`}</style>}

      <div id="report-sheet" className={`relative isolate mx-auto flex max-w-[210mm] flex-col bg-white p-8 text-black shadow-sm print:mt-0 print:shadow-none ${printable ? "" : "print:hidden"} ${className}`}>
        {/* Faint centred logo watermark (fixed in print → centred on every page) */}
        {settings.logo && (
          <div aria-hidden className="report-watermark pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={settings.logo} alt="" className="w-1/2 max-w-[110mm] opacity-[0.06]" style={exact} />
          </div>
        )}

        {header}

        {/* Results — printed in English, left to right (the entry screen stays Arabic). */}
        {(regular.length > 0 || formRows.length === 0) && (
          <ResultsTable
            ts={ts} groups={groups} empty={rows.length === 0} emptyText={emptyText}
            gender={gender} age={patient.age} prev={prev} printPrev={printPrev} paper={paper}
          />
        )}

        {formRows.map((r, i) => {
          const first = i === 0 && regular.length === 0;
          return (
            <div key={r.key} className={first ? "" : "report-page mt-10 border-t-2 border-dashed border-gray-300 pt-8 print:mt-0 print:border-0 print:pt-0"}>
              {!first && header}
              <FormReport code={r.test!.code as FormCode} values={decodeForm(r.value)} ts={ts} />
            </div>
          );
        })}

        {/* Bottom group — signature sits at the bottom of the last page */}
        <div className="report-keep mt-auto">
          <div className="report-sign mt-10 flex items-end justify-between text-xs text-gray-600">
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

type Group = { cat: string; rows: ReportRow[] };

/** The results table alone — used by the printed sheet and by the Settings preview. */
export function ResultsTable({ ts, groups, empty = false, emptyText = "No tests selected", gender, age, prev = {}, printPrev = false }: {
  ts: TableStyle; groups: Group[]; empty?: boolean; emptyText?: string; gender: Gender; age?: string;
  prev?: Record<string, PrevResult>; printPrev?: boolean; paper?: "A4" | "A5";
}) {
  const c = tableColors(ts.intensity);
  const cols = printPrev ? 6 : 5;
  const py = DENSITY_PAD[ts.density].screen;
  const small = (ts.fontSize * 12) / 14; // header & group rows (text-xs at the original size)
  const cell = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    paddingTop: py, paddingBottom: py,
    ...(ts.layout === "grid" ? { border: `1px solid ${c.line}` } : ts.layout === "lines" ? { borderBottom: `1px solid ${c.line}` } : {}),
    ...extra,
  });
  const nameW = ts.nameWeight === "bold" ? 700 : ts.nameWeight === "medium" ? 500 : 400;
  const inset = ts.width === "inset" ? { marginInline: 24 } : {};

  return (
    <div dir="ltr" style={{ marginTop: GAP_PX[ts.gap], ...inset }}>
      <div className="flex items-center gap-2">
        <span className="h-5 w-1.5 rounded" style={{ background: c.border, ...exact }} />
        <span className="text-sm font-bold" style={{ color: c.groupText }}>Test Results</span>
      </div>
      <div className="mt-2 overflow-hidden rounded-lg border text-left" style={{ borderColor: c.border, ...exact }}>
        <table className="w-full border-collapse" style={{ fontSize: ts.fontSize, lineHeight: 1.4286 }}>
          <thead>
            <tr className="text-left text-white" style={{ background: c.header, fontSize: small, lineHeight: 1.3333, ...exact }}>
              {["Test", "Result", "Unit", "Reference Range", ...(printPrev ? ["Previous"] : []), "Flag"].map((h) => (
                <th key={h} className="px-3 font-semibold" style={cell({ paddingTop: py + 2, paddingBottom: py + 2, ...(ts.layout === "grid" ? { border: `1px solid ${c.header}` } : { borderBottom: 0 }) })}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {empty && (
              <tr><td colSpan={cols} className="py-6 text-center text-gray-400">{emptyText}</td></tr>
            )}
            {groups.map((g) => [
              <tr key={`g-${g.cat}`} className="report-group">
                <td colSpan={cols} className="px-3 font-bold" style={{ ...cell({ paddingTop: py + 2, paddingBottom: Math.max(2, py - 4) }), fontSize: small, lineHeight: 1.3333, color: c.groupText, background: c.groupBg, borderTop: `1px solid ${c.border}`, ...exact }}>
                  {g.cat}
                </td>
              </tr>,
              ...g.rows.map((r, idx) => {
                const t = r.test;
                const f = t ? flagFor(r.value, t.normal, gender, age) : null;
                const abn = f === "H" || f === "L";
                const p = prev[r.key];
                const bg = ts.layout === "striped" && idx % 2 ? c.stripe : "#ffffff";
                return (
                  <tr key={r.key} className="align-top" style={{ background: bg, ...exact }}>
                    <td className="px-3" style={cell({ fontWeight: nameW })}>{t?.name_en?.trim() || r.name}</td>
                    <td className="px-3 tabular-nums" style={cell({ fontWeight: abn ? 700 : 600, ...(abn ? { color: f === "H" ? "#b91c1c" : "#1d4ed8" } : {}) })}>{r.value || "—"}</td>
                    <td className="px-3" style={cell({ color: c.muted })}>{r.unit || "—"}</td>
                    <td className="px-3" style={cell({ color: c.muted })}>{t ? rangeLabel(t.normal, gender, t.unit, age) : "—"}</td>
                    {printPrev && (
                      <td className="px-3" style={cell({ color: c.muted })}>
                        {p ? (
                          <>
                            <span className="tabular-nums font-semibold text-gray-800">{p.value}</span>
                            <span className="block text-[10px] tabular-nums text-gray-500">{ymd(p.at)}</span>
                          </>
                        ) : "—"}
                      </td>
                    )}
                    <td className="px-3" style={cell()}>
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
    </div>
  );
}
