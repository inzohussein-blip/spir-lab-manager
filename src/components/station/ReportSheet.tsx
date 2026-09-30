"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { flagFor, rangeLabel, type Gender, type PrevResult, type StationSettings, type StationTest } from "@/lib/station/store";
import { tableStyleOf, reportColors, PURPLE, GOLD, DENSITY_PAD, GAP_PX, type TableStyle } from "@/lib/station/tableStyle";
import { Barcode, loadBarcode } from "@/components/station/Barcode";
import { QrCode } from "@/components/station/QrCode";
import { labQrCode, type LabQrCode } from "@/lib/station/labQr";
import { FormReport } from "@/components/station/FormReport";
import { isFormCode, decodeForm, formOptionsOf, type FormCode } from "@/lib/station/templates";
import { reportExtrasOf, LOGO_PX, WM_SIZE } from "@/lib/station/reportExtras";
import { CATEGORY_EN } from "@/lib/categoryEn";
import { NO_FILL, fillSteps, smartFill, headZoom, tableHeight, type Fill } from "@/lib/station/fillPage";
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

/** The printed page's margins: kept clear of the edge, where many printers cannot print (a footer
 *  8 mm from the edge was cut off); pre-printed paper keeps its own letterhead and footer space. */
function pageMargin(paper: "A4" | "A5", pre?: { top: number; bottom: number } | null): string {
  const side = paper === "A5" ? 8 : 12;
  if (pre) return `${pre.top}mm ${side}mm ${pre.bottom}mm`;
  return paper === "A5" ? "7mm 8mm 9mm" : "10mm 12mm 12mm";
}

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

  // Group rows by catalog category, keeping first-appearance order.
  const groups: { cat: string; rows: ReportRow[] }[] = [];
  for (const r of regular) {
    const ar = r.test?.category?.trim() || "فحوصات أخرى";
    const cat = CATEGORY_EN[ar] ?? ar;
    const g = groups.find((x) => x.cat === cat);
    if (g) g.rows.push(r);
    else groups.push({ cat, rows: [r] });
  }

  // Extra options (pre-printed paper, logo placement and watermark, font) — see lib/station/reportExtras.
  const x = reportExtrasOf(settings);

  // Few tests (Settings → «ملء الصفحة»): larger text and taller rows, so the results table reaches
  // further down the page. The section's other ways are all off unless chosen (lib/station/fillPage).
  const fillOn = settings.reportFill === true;
  const opt = (v?: boolean) => fillOn && v === true;
  const level = fillOn ? settings.fillLevel : undefined;
  const cardMode = opt(settings.fillCard) && formRows.length === 0 && regular.length > 0 && regular.length <= 2;
  const smart = opt(settings.fillSmart) && !cardMode;
  const notesOn = opt(settings.fillNotes) && regular.length > 0 && regular.length <= 12;
  // «ملء ذكي»: the height of everything but the table, measured on the sheet (see the effect below).
  const sheetRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState({ other: 0, wrap: 1 });
  const fill: Fill = !fillOn || cardMode ? NO_FILL
    : smart && measured.other > 0 ? smartFill(baseTs, paper, regular.length, groups.length, measured.other, measured.wrap, x.pre ?? undefined, level)
    : fillSteps(regular.length, paper, opt(settings.fillPaper), level);
  const ts = fill.font === 1 ? baseTs : { ...baseTs, fontSize: Math.round(baseTs.fontSize * fill.font * 10) / 10 };
  const pad = { a4: Math.round(DENSITY_PAD[ts.density].a4 * fill.pad), a5: Math.round(DENSITY_PAD[ts.density].a5 * fill.pad) };
  const hz = opt(settings.fillHead) ? (cardMode ? 1.3 : headZoom(fill)) : 1;
  // The bottom group (signature, QR code, footer bar): fixed at the bottom of every printed page, so
  // its height is measured and kept free there under the results (the frame's footer row).
  // Measured from its parts as they print: the signature row and the footer bar with its gap (the
  // row's screen-only top margin left out). It must stay under a quarter of the page, or the browser
  // stops keeping that space free on each page.
  const [bottomPx, setBottomPx] = useState(0);
  useEffect(() => {
    const el = sheetRef.current?.querySelector<HTMLElement>(".report-bottom");
    if (!el) return;
    const measure = () => {
      const sign = el.querySelector<HTMLElement>(".report-sign");
      const foot = el.querySelector<HTMLElement>(".report-footer");
      setBottomPx(Math.ceil((sign?.offsetHeight ?? 0) + (foot ? foot.offsetHeight + (paper === "A5" ? 8 : 16) : 0)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [paper]);
  // «النتيجة السابقة عند وجود مساحة»: previous results printed when the tests are few.
  const showPrev = printPrev || (opt(settings.fillPrev) && regular.length <= 10 && regular.some((r) => prev[r.key]));

  // Measured after every render (the name, logo or doctor can change the letterhead's height); the
  // counter stops a back-and-forth once the measure settles.
  const measures = useRef({ key: "", n: 0 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!smart) return;
    const el = sheetRef.current;
    const head = el?.querySelector<HTMLElement>("[data-fill-head]");
    const table = el?.querySelector<HTMLElement>("[data-results]");
    if (!el || !head || !table) return;
    // In print the signature, QR code and footer bar are fixed at the bottom of every page, with the
    // same height kept free under the results (`bottomPx`).
    const mm = 96 / 25.4;
    const px = Math.round(head.offsetHeight + bottomPx + (notesOn ? 24 * mm + 16 : 0));
    // The table on screen against one line per row: how much its long names and ranges wrap.
    const wrap = Math.round(((table.offsetHeight + GAP_PX[baseTs.gap]) / tableHeight(baseTs, "screen", regular.length, groups.length, fill)) * 100) / 100;
    const key = `${paper}|${regular.length}|${notesOn}`;
    if (measures.current.key !== key) measures.current = { key, n: 0 };
    if ((Math.abs(px - measured.other) > 6 || Math.abs(wrap - measured.wrap) > 0.03) && measures.current.n < 6) {
      measures.current.n++;
      setMeasured({ other: px, wrap });
    }
  });

  // QR code at the bottom (Settings → «رمز QR أسفل التقرير», see lib/station/labQr).
  const qrCode = labQrCode(settings);
  const qrLogo = settings.labQrLogo !== false ? settings.logo : undefined;

  const logoPx = LOGO_PX[x.head.logoSize];
  const logoImg = settings.logo && (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={settings.logo} alt="" className="shrink-0 object-contain" style={{ width: logoPx, height: logoPx }} data-testid="report-logo" />
  );
  const nameBlock = (
    <div className={x.head.logo === "center" ? "text-center" : ""} style={hz !== 1 ? { zoom: hz } : undefined}>
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

        <div className="report-keep mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-lg border-2 p-3 text-sm sm:grid-cols-3" style={{ borderColor: c.border, ...(hz !== 1 ? { zoom: hz } : {}) }} data-testid="report-patient">
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
        @page { size: ${paper}; margin: ${pageMargin(paper, x.pre)}; }
        #report-sheet { padding: 0 !important; max-width: none; }
        #report-sheet thead { display: table-header-group; }
        #report-sheet tr, #report-sheet .report-keep { break-inside: avoid; }
        /* The page frame: its header (letterhead, sample barcode, patient) repeats on every page, and
           its footer row keeps the bottom group's height free; the body flows over the pages. */
        #report-sheet table.report-frame { font-size: inherit !important; }
        #report-sheet table.report-frame > * > tr > td { padding: 0 !important; border: 0 !important; }
        #report-sheet table.report-frame > tbody > tr { break-inside: auto; }
        #report-sheet table.report-frame > tfoot { display: table-footer-group; }
        #report-sheet .report-spacer { height: calc(${bottomPx}px + 4mm); }
        #report-sheet .report-bottom { position: fixed; left: 0; right: 0; bottom: 0; margin: 0; padding-top: 2mm; background: #fff; }
        #report-sheet .report-group { break-after: avoid; }
        #report-sheet .report-page { break-before: page; }
        #report-sheet .form-table td, #report-sheet .form-table th { padding-top: 2px !important; padding-bottom: 2px !important; }
        #report-sheet .report-watermark { position: fixed; }
        #report-sheet .report-sign { margin-top: 0; }
        #report-sheet .report-qr { padding: 2px 5px !important; }
        #report-sheet .report-qr img { width: 19mm !important; height: 19mm !important; }
        #report-sheet td, #report-sheet th { padding-top: ${pad.a4}px !important; padding-bottom: ${pad.a4}px !important; }
        ${paper === "A5" ? `
        #report-sheet table { font-size: ${(ts.fontSize * 10 / 14).toFixed(1)}px !important; }
        #report-sheet td, #report-sheet th { padding: ${pad.a5}px 4px !important; }
        #report-sheet .form-table td, #report-sheet .form-table th { padding: 0.5px 4px !important; }
        #report-sheet .form-sec { margin-bottom: 2.5mm; }
        #report-sheet .cs-box { padding: 5px 12px !important; font-size: ${(ts.fontSize * 10 / 14).toFixed(1)}px !important; }
        #report-sheet .cs-box > div { padding-top: 1px; padding-bottom: 1px; }
        #report-sheet .cs-ast { margin-top: 3mm; }
        #report-sheet .cs-ast-title { display: none; }
        #report-sheet .report-pbc > span { width: 36mm !important; height: 8mm !important; }
        #report-sheet [data-fill-head] h2 { font-size: 18px; }
        #report-sheet [data-testid="report-patient"] { margin-top: 2.5mm; padding: 5px 8px; font-size: 11px; row-gap: 2px; }
        #report-sheet .report-pbc > div { font-size: 9.5px !important; }
        #report-sheet .report-qr img { width: 16mm !important; height: 16mm !important; }
        #report-sheet .form-top { margin-top: 2.5mm; }
        #report-sheet .form-title { font-size: 15px; }
        #report-sheet .form-sec-title { padding-top: 2px; padding-bottom: 2px; font-size: 12px; }
        #report-sheet .report-sign .mb-6 { margin-bottom: 4mm; }
        #report-sheet .form-sec:last-child { margin-bottom: 0; }
        #report-sheet table.form-table { font-size: ${(ts.fontSize * 9 / 14).toFixed(1)}px !important; line-height: 1.2 !important; }
        #report-sheet .report-footer { margin-top: 2mm; padding: 4px 8px; font-size: 9px; }
        ` : ""}
      }`}</style>}

      <div id="report-sheet" ref={sheetRef} data-pre={x.pre ? "1" : undefined} data-fill={fillOn ? `${fill.font}` : undefined}
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

        <table className="report-frame w-full border-collapse" role="presentation">
          <thead><tr><td className="p-0 align-top"><div data-fill-head>{header}</div></td></tr></thead>
          <tfoot className="hidden print:table-footer-group" aria-hidden><tr><td className="p-0"><div className="report-spacer" /></td></tr></tfoot>
          <tbody><tr><td className="p-0 align-top">

        {/* Results — printed in English, left to right (the entry screen stays Arabic). */}
        {cardMode ? (
          <ResultCards ts={ts} rows={regular} gender={gender} age={patient.age} prev={showPrev ? prev : {}} />
        ) : (regular.length > 0 || formRows.length === 0) && (
          <ResultsTable
            ts={ts} groups={groups} empty={rows.length === 0} emptyText={emptyText}
            gender={gender} age={patient.age} prev={prev} printPrev={showPrev} paper={paper} padScale={fill.pad}
          />
        )}

        {formRows.map((r, i) => {
          const first = i === 0 && regular.length === 0;
          return (
            <div key={r.key} className={first ? "" : "report-page mt-10 border-t-2 border-dashed border-gray-300 pt-8 print:mt-0 print:border-0 print:pt-0"}>
              <FormReport code={r.test!.code as FormCode} values={decodeForm(r.value)} ts={ts} opts={formOptionsOf(settings)} />
            </div>
          );
        })}

        {/* «مربع ملاحظات في الفراغ»: lined space for handwriting between the results and the signature */}
        {notesOn && (
          <div className="report-keep mt-4 flex min-h-[24mm] flex-1 flex-col rounded-lg border-2 border-dashed p-3" style={{ borderColor: c.border }} data-testid="report-notes">
            <div className="text-xs font-bold" style={{ color: c.title }}>ملاحظات / Notes</div>
            <div className="mt-2 flex-1" style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 27px, #d1d5db 27px 28px)", ...exact }} />
          </div>
        )}
          </td></tr></tbody>
        </table>

        {/* Bottom group — signature, QR code and footer bar: at the bottom of the sheet on screen, and
            at the bottom of every printed page. */}
        <div className="report-bottom report-keep mt-auto">
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

/** «عرض البطاقة»: one or two tests, each result large in its own card (the ranges and flag under it). */
function ResultCards({ ts, rows, gender, age, prev }: { ts: TableStyle; rows: ReportRow[]; gender: Gender; age?: string; prev: Record<string, PrevResult> }) {
  const c = reportColors(ts);
  return (
    <div dir="ltr" className="mt-6 flex flex-col gap-5" data-testid="report-cards">
      {rows.map((r) => {
        const t = r.test;
        const qual = t?.normal.kind === "qual";
        const f = t ? flagFor(r.value, t.normal, gender, age) : null;
        const color = f === "H" ? "#b91c1c" : f === "L" ? "#1d4ed8" : "#111827";
        const p = prev[r.key];
        const ar = t?.category?.trim();
        return (
          <div key={r.key} className="report-keep overflow-hidden rounded-xl border-2" style={{ borderColor: c.border, background: r.hl ? HL_ROW : "#fff", ...exact }} data-card={r.key}>
            <div className="flex items-center justify-between px-6 py-3 text-white" style={{ background: c.header, ...exact }}>
              <span className="text-2xl font-bold">{t?.name_en?.trim() || r.name}</span>
              {ar && <span className="text-sm opacity-90">{CATEGORY_EN[ar] ?? ar}</span>}
            </div>
            <div className="flex flex-wrap items-end justify-center gap-x-6 gap-y-2 px-6 py-10">
              <span className="text-8xl font-extrabold tabular-nums leading-none" style={{ color }}>
                {r.hl && r.value ? <mark className="rounded px-1" style={{ background: HL_MARK, color: "inherit", ...exact }}>{r.value}</mark> : r.value || "—"}
              </span>
              {r.unit && <span className="pb-2 text-3xl text-gray-500">{r.unit}</span>}
              {!qual && (f === "H" || f === "L" || f === "N") && (
                <span className="mb-2 inline-grid size-12 place-items-center rounded-full text-xl font-bold" data-flag
                  style={f === "N" ? { background: "#e7f6ef", color: "#127a4f", ...exact } : { background: color, color: "#fff", ...exact }}>{f}</span>
              )}
            </div>
            {(!qual || p) && (
              <div className="flex flex-wrap justify-between gap-3 border-t px-6 py-4 text-lg text-gray-600" style={{ borderColor: c.line }}>
                {!qual && <span data-range>Reference Range: <b className="text-gray-800">{t ? rangeLabel(t.normal, gender, t.unit, age) : "—"}</b></span>}
                {p && <span>Previous: <b className="tabular-nums text-gray-800">{p.value}</b> <span className="text-sm">({ymd(p.at)})</span></span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
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
    <div dir="ltr" style={{ marginTop: GAP_PX[ts.gap], ...inset }} data-results>
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
