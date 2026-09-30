"use client";

import { useEffect, type CSSProperties } from "react";
import { flagFor, rangeLabel, type Gender, type PrevResult, type StationSettings, type StationTest } from "@/lib/station/store";
import { tableStyleOf, reportColors, PURPLE, GOLD, DENSITY_PAD, GAP_PX, type TableStyle } from "@/lib/station/tableStyle";
import { Barcode, loadBarcode } from "@/components/station/Barcode";
import { QrCode } from "@/components/station/QrCode";
import { labQrCode, type LabQrCode } from "@/lib/station/labQr";
import { FormReport } from "@/components/station/FormReport";
import { isFormCode, decodeForm, formOptionsOf, type FormCode } from "@/lib/station/templates";
import { reportExtrasOf, LOGO_PX, WM_SIZE } from "@/lib/station/reportExtras";
import { CATEGORY_EN } from "@/lib/categoryEn";
// The report fonts one can choose (Settings → «خيارات إضافية للتقرير المطبوع»); bundled with the
// app so they print offline too. The browser only downloads a font when it is used.
import "@fontsource/cairo/arabic-400.css";
import "@fontsource/cairo/arabic-700.css";
import "@fontsource/cairo/latin-400.css";
import "@fontsource/cairo/latin-700.css";
import "@fontsource/tajawal/arabic-400.css";
import "@fontsource/tajawal/arabic-700.css";
import "@fontsource/tajawal/latin-400.css";
import "@fontsource/tajawal/latin-700.css";
import "@fontsource/noto-naskh-arabic/arabic-400.css";
import "@fontsource/noto-naskh-arabic/arabic-700.css";
import "@fontsource/noto-naskh-arabic/latin-400.css";
import "@fontsource/noto-naskh-arabic/latin-700.css";
import "@fontsource/amiri/arabic-400.css";
import "@fontsource/amiri/arabic-700.css";
import "@fontsource/amiri/latin-400.css";
import "@fontsource/amiri/latin-700.css";

const exact = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as CSSProperties;

export interface ReportRow {
  key: string;
  name: string;
  value: string;
  unit?: string;
  /** Catalog entry — supplies range, flag and category (may be gone for old visits). */
  test?: StationTest;
  /** Highlighted by the «تمييز» tick on the entry screen. */
  hl?: boolean;
}

/** Highlighter colours for a ticked result (row tint + marker behind the value). */
const HL_ROW = "#fefce8", HL_MARK = "#fde047";

const ymd = (ms: number) => new Date(ms).toLocaleDateString("en-CA");

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
  // Ready before «طباعة» assigns a sample number, so its barcode is on the first print too.
  useEffect(() => { void loadBarcode(); }, []);
  const gender = patient.gender;
  const baseTs = tableStyleOf(settings.reportTable);
  // The lab's colours (Settings → «التقرير المطبوع»; purple + gold unless changed).
  const c = reportColors(baseTs);

  // Structured reports (urine / stool / semen / culture) print on their own page.
  const formRows = rows.filter((r) => isFormCode(r.test?.code));
  const regular = rows.filter((r) => !isFormCode(r.test?.code));

  // Few tests (Settings → «ملء الصفحة عند قلة الفحوصات»): larger text and taller rows, so the
  // results table reaches further down the page.
  const fill = settings.reportFill === true ? fillScale(regular.length) : { font: 1, pad: 1 };
  const ts = fill.font === 1 ? baseTs : { ...baseTs, fontSize: Math.round(baseTs.fontSize * fill.font * 10) / 10 };
  const pad = { a4: Math.round(DENSITY_PAD[ts.density].a4 * fill.pad), a5: Math.round(DENSITY_PAD[ts.density].a5 * fill.pad) };

  // Group rows by catalog category, keeping first-appearance order.
  const groups: { cat: string; rows: ReportRow[] }[] = [];
  for (const r of regular) {
    const ar = r.test?.category?.trim() || "فحوصات أخرى";
    const cat = CATEGORY_EN[ar] ?? ar;
    const g = groups.find((x) => x.cat === cat);
    if (g) g.rows.push(r);
    else groups.push({ cat, rows: [r] });
  }

  // QR code at the bottom (Settings → «رمز QR أسفل التقرير», see lib/station/labQr).
  const qrCode = labQrCode(settings);
  const qrLogo = settings.labQrLogo !== false ? settings.logo : undefined;

  // Extra options (pre-printed paper, logo placement and watermark, font) — see lib/station/reportExtras.
  const x = reportExtrasOf(settings);
  const logoPx = LOGO_PX[x.head.logoSize];
  const logoImg = settings.logo && (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={settings.logo} alt="" className="shrink-0 object-contain" style={{ width: logoPx, height: logoPx }} data-testid="report-logo" />
  );
  const nameBlock = (
    <div className={x.head.logo === "center" ? "text-center" : ""}>
      <h2 className="text-2xl font-extrabold leading-tight" style={{ color: c.title }}>{settings.labName}</h2>
      {settings.labSubtitle && <p className="text-sm font-medium" style={{ color: c.subtitle }}>{settings.labSubtitle}</p>}
    </div>
  );
  // Date, then the patient's sample barcode and number under it
  const dateBlock = (
    <div className="flex flex-col items-end text-xs text-gray-600">
      <div>التاريخ: {date}</div>
      {accession && (
        <div className="report-pbc mt-1 flex flex-col items-end">
          {settings.reportBarcode !== false && <Barcode text={accession} className="block h-9 w-44 [&>svg]:h-full [&>svg]:w-full" />}
          <div className="font-mono text-[11px] font-bold" style={{ color: c.title }} dir="ltr">{accession}</div>
        </div>
      )}
    </div>
  );

  const header = (
    <>
        {/* Letterhead in the lab's colours — none on pre-printed paper (it has its own) */}
        {x.pre ? (
          <div className="flex justify-end pb-3" data-testid="report-head-pre">{dateBlock}</div>
        ) : x.head.logo === "center" ? (
          <div className="pb-3" data-testid="report-head" data-logo="center">
            <div className="flex flex-col items-center gap-1">{logoImg}{nameBlock}</div>
            <div className="mt-2 flex justify-end">{dateBlock}</div>
          </div>
        ) : x.head.logo === "end" ? (
          <div className="flex items-center justify-between gap-4 pb-3" data-testid="report-head" data-logo="end">
            {nameBlock}{dateBlock}{logoImg}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4 pb-3" data-testid="report-head" data-logo="start">
            <div className="flex items-center gap-3">{logoImg}{nameBlock}</div>
            {dateBlock}
          </div>
        )}
        {/* Accent rule with a main-colour center */}
        {!x.pre && <div className="h-1 w-full rounded" style={{ background: `linear-gradient(90deg, ${c.border} 0%, ${c.title} 50%, ${c.border} 100%)`, ...exact }} />}

        <div className="report-keep mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-lg border-2 p-3 text-sm sm:grid-cols-3" style={{ borderColor: c.border }}>
          <div><span style={{ color: c.title }} className="font-semibold">المريض:</span> <b>{patient.name || "—"}</b></div>
          <div><span style={{ color: c.title }} className="font-semibold">الجنس:</span> {gender === "male" ? "ذكر" : gender === "female" ? "أنثى" : "—"}</div>
          <div><span style={{ color: c.title }} className="font-semibold">العمر:</span> {patient.age || "—"}</div>
          <div><span style={{ color: c.title }} className="font-semibold">الهاتف:</span> {patient.phone || "—"}</div>
          {referrer && <div><span style={{ color: c.title }} className="font-semibold">الطبيب المُحيل:</span> {referrer}</div>}
        </div>
    </>
  );

  return (
    <>
      {printable && <style>{`@media print {
        @page { size: ${paper}; margin: 0; }
        #report-sheet {
          min-height: ${paper === "A5" ? "208mm" : "295mm"};
          padding: ${x.pre ? `${x.pre.top}mm 12mm ${x.pre.bottom}mm` : "12mm 12mm 22mm"} !important;
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
        #report-sheet .report-sign { margin-top: 5mm; }
        #report-sheet .report-qr { padding: 2px 5px !important; }
        #report-sheet .report-qr img { width: 19mm !important; height: 19mm !important; }
        #report-sheet td, #report-sheet th { padding-top: ${pad.a4}px !important; padding-bottom: ${pad.a4}px !important; }
        ${paper === "A5" ? `
        #report-sheet { padding: ${x.pre ? `${x.pre.top}mm 8mm ${x.pre.bottom}mm` : "8mm 8mm 18mm"} !important; }
        #report-sheet table { font-size: ${(ts.fontSize * 10 / 14).toFixed(1)}px !important; }
        #report-sheet td, #report-sheet th { padding: ${pad.a5}px 4px !important; }
        #report-sheet .form-table td, #report-sheet .form-table th { padding: 0.5px 4px !important; }
        #report-sheet .form-sec { margin-bottom: 2.5mm; }
        #report-sheet .cs-box { padding: 5px 12px !important; font-size: ${(ts.fontSize * 10 / 14).toFixed(1)}px !important; }
        #report-sheet .cs-box > div { padding-top: 1px; padding-bottom: 1px; }
        #report-sheet .cs-ast { margin-top: 3mm; }
        #report-sheet .cs-ast-title { display: none; }
        #report-sheet .report-pbc > span { width: 36mm !important; height: 8mm !important; }
        #report-sheet .report-pbc > div { font-size: 9.5px !important; }
        #report-sheet .report-qr img { width: 16mm !important; height: 16mm !important; }
        #report-sheet .form-top { margin-top: 2.5mm; }
        #report-sheet .form-title { font-size: 15px; }
        #report-sheet .form-sec-title { padding-top: 2px; padding-bottom: 2px; font-size: 12px; }
        #report-sheet .report-sign { margin-top: 2mm; }
        #report-sheet .report-sign .mb-6 { margin-bottom: 4mm; }
        #report-sheet .form-sec:last-child { margin-bottom: 0; }
        #report-sheet table.form-table { font-size: ${(ts.fontSize * 9 / 14).toFixed(1)}px !important; line-height: 1.2 !important; }
        #report-sheet .report-footer { left: 8mm; right: 8mm; bottom: 5mm; padding: 4px 8px; font-size: 9px; }
        ` : ""}
      }`}</style>}

      <div id="report-sheet" data-pre={x.pre ? "1" : undefined}
        className={`relative isolate mx-auto flex max-w-[210mm] flex-col bg-white p-8 text-black shadow-sm print:mt-0 print:shadow-none ${printable ? "" : "print:hidden"} ${className}`}
        style={{ ...(x.font ? { fontFamily: x.font } : {}), ...(x.pre ? { paddingTop: `${x.pre.top}mm`, paddingBottom: `${x.pre.bottom}mm` } : {}) }}>
        {/* Pre-printed paper: where its own letterhead and footer are (on screen only) */}
        {x.pre && (
          <>
            <div aria-hidden className="pointer-events-none absolute inset-x-3 top-2 grid place-items-center rounded border border-dashed border-gray-300 text-[11px] text-gray-400 print:hidden" style={{ height: `calc(${x.pre.top}mm - 12px)` }}>رأس الورق المطبوع</div>
            <div aria-hidden className="pointer-events-none absolute inset-x-3 bottom-2 grid place-items-center rounded border border-dashed border-gray-300 text-[11px] text-gray-400 print:hidden" style={{ height: `calc(${x.pre.bottom}mm - 12px)` }}>تذييل الورق المطبوع</div>
          </>
        )}
        {/* Faint centred logo watermark (fixed in print → centred on every page) */}
        {settings.logo && !x.pre && x.head.watermark && (
          <div aria-hidden className="report-watermark pointer-events-none absolute inset-0 -z-10 flex items-center justify-center" data-testid="report-watermark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={settings.logo} alt="" style={{ width: `${WM_SIZE[x.head.wmSize].pct}%`, maxWidth: `${WM_SIZE[x.head.wmSize].maxMm}mm`, opacity: x.head.wmOpacity / 100, ...exact }} />
          </div>
        )}

        {header}

        {/* Results — printed in English, left to right (the entry screen stays Arabic). */}
        {(regular.length > 0 || formRows.length === 0) && (
          <ResultsTable
            ts={ts} groups={groups} empty={rows.length === 0} emptyText={emptyText}
            gender={gender} age={patient.age} prev={prev} printPrev={printPrev} paper={paper} padScale={fill.pad}
          />
        )}

        {formRows.map((r, i) => {
          const first = i === 0 && regular.length === 0;
          return (
            <div key={r.key} className={first ? "" : "report-page mt-10 border-t-2 border-dashed border-gray-300 pt-8 print:mt-0 print:border-0 print:pt-0"}>
              {!first && header}
              <FormReport code={r.test!.code as FormCode} values={decodeForm(r.value)} ts={ts} opts={formOptionsOf(settings)} />
            </div>
          );
        })}

        {/* Bottom group — signature sits at the bottom of the last page */}
        <div className="report-keep mt-auto">
          <div className="report-sign mt-10 flex items-end justify-between text-xs text-gray-600">
            {settings.signatureOn ? (
              // Settings → «التوقيع والختم على التقرير»: the analyst's signature (and name), and the lab's stamp.
              <div className="flex items-end gap-3" data-testid="report-signature">
                <div className="text-center">
                  <div className="mb-1 text-start">اعتمد النتائج:</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {settings.signatureImage ? <img src={encodeURI(settings.signatureImage)} alt="التوقيع" className="mx-auto h-14 max-w-48 object-contain" /> : <div className="h-8" />}
                  <div className="w-48 border-t pt-1 font-semibold text-gray-700" style={{ borderColor: c.border }}>{settings.signatureName?.trim() || "التوقيع"}</div>
                  {settings.signatureTitle?.trim() && <div className="text-[10px] text-gray-500">{settings.signatureTitle}</div>}
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {settings.stampImage && <img src={encodeURI(settings.stampImage)} alt="الختم" className="size-24 object-contain opacity-90" />}
              </div>
            ) : (
              <div>
                <div className="mb-6">اعتمد النتائج:</div>
                <div className="w-48 border-t pt-1 text-center text-gray-500" style={{ borderColor: c.border }}>التوقيع / الختم</div>
              </div>
            )}
            {qrCode && <LabQrCard q={qrCode} logo={qrLogo} colors={c} />}
          </div>

          {settings.footer && !x.pre && (
            <div className="report-footer mt-4 rounded-md px-4 py-2 text-center text-xs font-medium text-white" style={{ background: c.bar, ...exact }}>
              {settings.footer}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

type Group = { cat: string; rows: ReportRow[] };

/** How much larger the results table gets when only a few tests are on the sheet. */
export function fillScale(n: number): { font: number; pad: number } {
  if (n <= 3) return { font: 1.45, pad: 3 };
  if (n <= 6) return { font: 1.3, pad: 2.3 };
  if (n <= 10) return { font: 1.15, pad: 1.6 };
  if (n <= 14) return { font: 1.05, pad: 1.25 };
  return { font: 1, pad: 1 };
}

/** The results table alone — used by the printed sheet and by the Settings preview. */
export function ResultsTable({ ts, groups, empty = false, emptyText = "No tests selected", gender, age, prev = {}, printPrev = false, padScale = 1 }: {
  ts: TableStyle; groups: Group[]; empty?: boolean; emptyText?: string; gender: Gender; age?: string;
  prev?: Record<string, PrevResult>; printPrev?: boolean; paper?: "A4" | "A5";
  /** Taller rows (the «ملء الصفحة» option). */
  padScale?: number;
}) {
  const c = reportColors(ts);
  const cols = printPrev ? 6 : 5;
  const py = Math.round(DENSITY_PAD[ts.density].screen * padScale);
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
        <table className="w-full border-collapse" data-font={ts.fontSize} style={{ fontSize: ts.fontSize, lineHeight: 1.4286 }}>
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
                // Positive / negative tests: the answer says it all — no reference range and no flag.
                const qual = t?.normal.kind === "qual";
                const f = t ? flagFor(r.value, t.normal, gender, age) : null;
                const abn = f === "H" || f === "L";
                const p = prev[r.key];
                const bg = r.hl ? HL_ROW : ts.layout === "striped" && idx % 2 ? c.stripe : "#ffffff";
                return (
                  <tr key={r.key} className="align-top" data-hl={r.hl ? "1" : undefined} style={{ background: bg, ...exact }}>
                    <td className="px-3" style={cell({ fontWeight: r.hl ? 700 : nameW })}>{t?.name_en?.trim() || r.name}</td>
                    <td className="px-3 tabular-nums" style={cell({ fontWeight: abn || r.hl ? 700 : 600, ...(abn ? { color: f === "H" ? "#b91c1c" : "#1d4ed8" } : {}) })}>
                      {r.hl && r.value ? <mark className="rounded px-1" style={{ background: HL_MARK, color: "inherit", ...exact }}>{r.value}</mark> : r.value || "—"}
                    </td>
                    <td className="px-3" style={cell({ color: c.muted })}>{r.unit || "—"}</td>
                    <td className="px-3" style={cell({ color: c.muted })} data-range>{qual ? "" : t ? rangeLabel(t.normal, gender, t.unit, age) : "—"}</td>
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
                    <td className="px-3" style={cell()} data-flag>
                      {qual ? null : f === "H" ? <span className="inline-grid size-6 place-items-center rounded-full text-xs font-bold text-white" style={{ background: "#b91c1c", ...exact }}>H</span>
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

/** The printed QR code (left) with its caption (title + hint, right), in a small card edged in the accent colour. */
export function LabQrCard({ q, logo, colors = { border: GOLD, title: PURPLE } }: { q: LabQrCode; logo?: string; colors?: { border: string; title: string } }) {
  return (
    <div dir="ltr" className="report-qr flex items-center gap-2 rounded-lg border px-2 py-1.5" style={{ borderColor: colors.border }}>
      <QrCode text={q.content} logo={logo} className="block size-[22mm]" />
      <div dir="rtl" className="max-w-[34mm] text-right leading-snug">
        <div className="text-[11px] font-bold" style={{ color: colors.title }}>{q.title}</div>
        <div className="mt-0.5 text-[9.5px] text-gray-500">{q.hint}</div>
      </div>
    </div>
  );
}
