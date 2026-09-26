"use client";

import type { CSSProperties } from "react";
import {
  templateOf, cultureOf, formTitle, printValue, isSub, isAbnormal, sfaDiagnosis, cultureGrowth, astValue, AST_SCALE,
  type FormCode, type FormValues, type FormOptions, type TRow,
} from "@/lib/station/templates";
import { tableColors, DENSITY_PAD, type TableStyle } from "@/lib/station/tableStyle";

const exact = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as CSSProperties;

/** With «hide empty rows»: keep answered fields, and a sub-heading only when something under it is answered. */
function visibleRows(rows: TRow[], values: FormValues, hideEmpty: boolean): TRow[] {
  if (!hideEmpty) return rows;
  return rows.filter((r, i) => {
    if (!isSub(r)) return !!values[r.k]?.trim();
    for (let j = i + 1; j < rows.length && !isSub(rows[j]); j++) { const f = rows[j]; if (!isSub(f) && values[f.k]?.trim()) return true; }
    return false;
  });
}

/** Printed structured report (English, left to right), styled like the results table. */
export function FormReport({ code, values, ts, opts }: { code: FormCode; values: FormValues; ts: TableStyle; opts: FormOptions }) {
  const c = tableColors(ts.intensity);
  const py = DENSITY_PAD[ts.density].screen;
  const small = (ts.fontSize * 12) / 14;
  const line = ts.layout === "plain" ? "transparent" : c.line;
  const dx = code === "SFA" && opts.diagnosis ? values.dx?.trim() || sfaDiagnosis(values) : "";
  const sections = code === "CS" ? [] : templateOf(code).sections
    .map((s) => ({ ...s, rows: visibleRows(s.rows, values, opts.hideEmpty) }))
    .filter((s) => s.rows.some((r) => !isSub(r)));

  return (
    <div dir="ltr" className="form-top mt-5 text-left">
      <div className="form-title text-center text-lg font-extrabold tracking-wide" style={{ color: c.header }}>{formTitle(code)}</div>
      {code === "CS" && <div className="text-center text-xs font-bold tracking-wider" style={{ color: c.muted }}>MICROBIOLOGY DEPARTMENT</div>}
      <div className="mb-3 mt-1.5 h-0.5 w-full" style={{ background: c.border, ...exact }} />

      {code === "CS" ? <Culture values={values} c={c} fontSize={ts.fontSize} py={py} testedOnly={opts.testedOnly} /> : sections.map((s, si) => (
        <div key={si} className="form-sec mb-4 overflow-hidden rounded-lg border last:mb-0" style={{ borderColor: c.border, ...exact }}>
          <div className="form-sec-title px-3 py-1.5 text-sm font-bold" style={{ background: c.groupBg, color: c.groupText, ...exact }}>{s.title}</div>
          <table className="form-table w-full border-collapse" style={{ fontSize: ts.fontSize * 0.86, lineHeight: 1.25 }}>
            <thead>
              <tr className="text-white" style={{ background: c.header, fontSize: small, ...exact }}>
                <th className="w-[40%] px-3 text-left font-semibold" style={{ paddingTop: py, paddingBottom: py }}>Parameter</th>
                <th className="w-[30%] px-3 text-left font-semibold" style={{ paddingTop: py, paddingBottom: py }}>Result</th>
                <th className="px-3 text-left font-semibold" style={{ paddingTop: py, paddingBottom: py }}>{s.col}</th>
              </tr>
            </thead>
            <tbody>
              {s.rows.map((r, i) => isSub(r) ? (
                <tr key={i} className="report-group">
                  <td colSpan={3} className="px-3 text-[0.85em] font-bold uppercase tracking-wide" style={{ paddingTop: py - 2, paddingBottom: py - 2, background: c.stripe, color: c.muted, borderTop: `1px solid ${line}`, ...exact }}>{r.sub}</td>
                </tr>
              ) : (
                <tr key={r.k} style={{ background: ts.layout === "striped" && i % 2 ? c.stripe : "#fff", ...exact }}>
                  <td className="px-3" style={{ paddingTop: py - 2, paddingBottom: py - 2, borderTop: `1px solid ${line}`, fontWeight: r.indent ? 400 : 600, paddingLeft: r.indent ? 24 : undefined }}>
                    {r.indent ? "• " : ""}{r.label}
                  </td>
                  <td className="px-3" style={{ paddingTop: py - 2, paddingBottom: py - 2, borderTop: `1px solid ${line}`, fontWeight: !opts.boldAbnormal ? 600 : isAbnormal(r, values[r.k]) ? 700 : 400 }}>
                    {printValue(values[r.k])}
                  </td>
                  <td className="px-3" style={{ paddingTop: py - 2, paddingBottom: py - 2, borderTop: `1px solid ${line}`, color: c.muted }}>{r.ref ?? r.unit ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {code !== "CS" && (dx || values.notes?.trim()) && (
        <div className="cs-box mt-3 rounded-lg border px-4 py-2" style={{ borderColor: c.line, background: c.stripe, fontSize: ts.fontSize * 0.9, ...exact }}>
          {dx && <div className="flex gap-3 py-0.5"><span className="w-28 shrink-0 font-bold" style={{ color: c.header }}>Conclusion:</span><span className="font-bold">{dx}</span></div>}
          {values.notes?.trim() && <div className="flex gap-3 py-0.5"><span className="w-28 shrink-0 font-bold" style={{ color: c.header }}>Remarks:</span><span className="font-semibold">{values.notes}</span></div>}
        </div>
      )}
    </div>
  );
}

const AST_COLOR: Record<string, string> = { "H.S": "#15803d", "M.S": "#b45309", R: "#dc2626" };

function Culture({ values, c, fontSize, py, testedOnly }: { values: FormValues; c: ReturnType<typeof tableColors>; fontSize: number; py: number; testedOnly: boolean }) {
  const growth = cultureGrowth(values);
  const noGrowth = (values.growth ?? "").toLowerCase().startsWith("no growth");
  const org1 = values.organism?.trim() ?? "";
  const org2 = values.organism2?.trim() ?? "";
  const res = (p: string, ab?: string) => (ab ? astValue(values[`${p}${ab}`]) : "");
  // The whole antibiotic list in the lab's order (as on the paper report), then any saved ones no longer listed.
  const listed = cultureOf().antibiotics.flatMap((g) => g.items);
  const saved = Object.keys(values).filter((k) => /^ab2?:/.test(k)).map((k) => k.slice(k.indexOf(":") + 1));
  let all = [...listed, ...saved.filter((ab, i) => !listed.includes(ab) && saved.indexOf(ab) === i)];
  const two = !!org2 && all.some((ab) => res("ab2:", ab));
  if (testedOnly) all = all.filter((ab) => res("ab:", ab) || res("ab2:", ab));
  const tested = all.some((ab) => res("ab:", ab) || res("ab2:", ab));
  const half = Math.ceil(all.length / 2);
  const growthOf = `Growth of ${org1}${org2 ? ` and ${org2}` : ""}`;
  const culture = growth && org1 ? (growthOf.endsWith(".") ? growthOf : `${growthOf}.`) : values.growth;
  const Line = ({ k, v, color }: { k: string; v?: string; color?: string }) => (
    <div className="flex gap-3 py-1"><span className="w-36 shrink-0 font-bold" style={{ color: c.header }}>{k}</span><span className="font-semibold" style={color ? { color } : undefined}>{v || "—"}</span></div>
  );
  const cell = { paddingTop: py - 3, paddingBottom: py - 3, borderTop: `1px solid ${c.line}` };
  const Res = ({ r }: { r: string }) => <td className="px-2 text-center font-bold" style={{ ...cell, color: AST_COLOR[r] }}>{r}</td>;
  const Pair = ({ ab, first }: { ab?: string; first?: boolean }) => (
    <>
      <td className="px-3" style={{ ...cell, borderLeft: first ? undefined : `1px solid ${c.line}` }}>{ab ?? ""}</td>
      <Res r={res("ab:", ab)} />
      {two && <Res r={res("ab2:", ab)} />}
    </>
  );
  const head = (
    <>
      <th className={`${two ? "w-[26%]" : "w-[32%]"} px-3 py-1.5 font-semibold`}>Types of antibiotics</th>
      {two ? (
        <><th className="w-[12%] px-2 py-1.5 text-center font-semibold">(1)</th><th className="w-[12%] px-2 py-1.5 text-center font-semibold">(2)</th></>
      ) : <th className="w-[18%] px-3 py-1.5 text-center font-semibold">Sensitive to</th>}
    </>
  );
  return (
    <div style={{ fontSize }}>
      <div className="cs-box rounded-lg border px-4 py-3" style={{ borderColor: c.line, background: c.stripe, ...exact }}>
        <Line k="Specimen:" v={values.specimen ? `${values.specimen.replace(/\.$/, "")}.` : ""} />
        <Line k="Culture:" v={culture} color={noGrowth ? "#15803d" : growth ? "#b91c1c" : undefined} />
        {growth && values.colony && <Line k={org2 ? "Colony Count (1):" : "Colony Count:"} v={values.colony} />}
        {growth && org2 && values.colony2 && <Line k="Colony Count (2):" v={values.colony2} />}
      </div>

      {!noGrowth && tested && (
        <div className="form-sec cs-ast mt-4 overflow-hidden rounded-lg border" style={{ borderColor: c.border, ...exact }}>
          <div className="cs-ast-title px-3 py-1.5 text-sm font-bold" style={{ background: c.groupBg, color: c.groupText, ...exact }}>Antibiotic Sensitivity Test (AST)</div>
          <table className="form-table w-full border-collapse" style={{ fontSize: fontSize * 0.86, lineHeight: 1.25 }}>
            <thead>
              <tr className="text-left text-white" style={{ background: c.header, ...exact }}>{head}{half > 0 && all.length > 1 && head}</tr>
            </thead>
            <tbody>
              {Array.from({ length: all.length > 1 ? half : all.length }, (_, i) => (
                <tr key={i}>
                  <Pair ab={all[i]} first />
                  {all.length > 1 && <Pair ab={all[i + half]} />}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap gap-x-5 px-3 py-1.5 text-[0.8em] font-semibold" style={{ borderTop: `1px solid ${c.line}` }}>
            {two && <span style={{ color: c.header }}>(1) {org1} &nbsp; (2) {org2}</span>}
            {AST_SCALE.map((x) => <span key={x.v} style={{ color: AST_COLOR[x.v] }}>({x.v}) = {x.name}</span>)}
          </div>
        </div>
      )}

      {values.notes && <div className="mt-3"><Line k="Remarks:" v={values.notes} /></div>}
    </div>
  );
}
