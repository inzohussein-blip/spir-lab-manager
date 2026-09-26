"use client";

import type { CSSProperties } from "react";
import {
  templateOf, cultureOf, formTitle, printValue, isSub, isGrowth,
  type FormCode, type FormValues,
} from "@/lib/station/templates";
import { tableColors, DENSITY_PAD, type TableStyle } from "@/lib/station/tableStyle";

const exact = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as CSSProperties;

/** Printed structured report (English, left to right), styled like the results table. */
export function FormReport({ code, values, ts }: { code: FormCode; values: FormValues; ts: TableStyle }) {
  const c = tableColors(ts.intensity);
  const py = DENSITY_PAD[ts.density].screen;
  const small = (ts.fontSize * 12) / 14;
  const line = ts.layout === "plain" ? "transparent" : c.line;

  return (
    <div dir="ltr" className="mt-5 text-left">
      <div className="text-center text-lg font-extrabold tracking-wide" style={{ color: c.header }}>{formTitle(code)}</div>
      {code === "CS" && <div className="text-center text-xs font-bold tracking-wider" style={{ color: c.muted }}>MICROBIOLOGY DEPARTMENT</div>}
      <div className="mb-3 mt-1.5 h-0.5 w-full" style={{ background: c.border, ...exact }} />

      {code === "CS" ? <Culture values={values} c={c} fontSize={ts.fontSize} /> : templateOf(code).sections.map((s, si) => (
        <div key={si} className="form-sec mb-4 overflow-hidden rounded-lg border last:mb-0" style={{ borderColor: c.border, ...exact }}>
          <div className="px-3 py-1.5 text-sm font-bold" style={{ background: c.groupBg, color: c.groupText, ...exact }}>{s.title}</div>
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
                  <td className="px-3 font-semibold" style={{ paddingTop: py - 2, paddingBottom: py - 2, borderTop: `1px solid ${line}` }}>{printValue(values[r.k])}</td>
                  <td className="px-3" style={{ paddingTop: py - 2, paddingBottom: py - 2, borderTop: `1px solid ${line}`, color: c.muted }}>{r.ref ?? r.unit ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function Culture({ values, c, fontSize }: { values: FormValues; c: ReturnType<typeof tableColors>; fontSize: number }) {
  const growth = isGrowth(values.growth);
  const noGrowth = (values.growth ?? "").toLowerCase().startsWith("no growth");
  // Antibiotics in the lab's list order, then any saved ones no longer on the list.
  const listed = cultureOf().antibiotics.flatMap((g) => g.items);
  const all = [...listed, ...Object.keys(values).filter((k) => k.startsWith("ab:")).map((k) => k.slice(3)).filter((ab) => !listed.includes(ab))];
  const byResult = (x: "S" | "I" | "R") => all.filter((ab) => values[`ab:${ab}`] === x);
  const S = byResult("S"), I = byResult("I"), R = byResult("R");
  const rows = Math.max(S.length, I.length, R.length);
  const Line = ({ k, v, color }: { k: string; v?: string; color?: string }) => (
    <div className="flex gap-3 py-1"><span className="w-36 shrink-0 font-bold" style={{ color: c.header }}>{k}</span><span className="font-semibold" style={color ? { color } : undefined}>{v || "—"}</span></div>
  );
  return (
    <div style={{ fontSize }}>
      <div className="rounded-lg border px-4 py-3" style={{ borderColor: c.line, background: c.stripe, ...exact }}>
        <Line k="Specimen:" v={values.specimen ? `${values.specimen}.` : ""} />
        <Line k="Culture:" v={values.growth} color={noGrowth ? "#15803d" : growth ? "#b91c1c" : undefined} />
        {growth && <Line k="Isolated Organism:" v={values.organism} />}
        {growth && <Line k="Colony Count:" v={values.colony} />}
      </div>

      {growth && rows > 0 && (
        <div className="mt-4 overflow-hidden rounded-lg border" style={{ borderColor: c.border, ...exact }}>
          <div className="px-3 py-1.5 text-sm font-bold" style={{ background: c.groupBg, color: c.groupText, ...exact }}>Antibiotic Sensitivity Test (AST)</div>
          <table className="w-full border-collapse" style={{ fontSize: fontSize * 0.93 }}>
            <thead>
              <tr className="text-left text-white" style={{ background: c.header, ...exact }}>
                <th className="w-1/3 px-3 py-2 font-semibold">Sensitive (S)</th>
                <th className="w-1/3 px-3 py-2 font-semibold">Intermediate (I)</th>
                <th className="w-1/3 px-3 py-2 font-semibold">Resistant (R)</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rows }, (_, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${c.line}` }}>
                  <td className="px-3 py-1.5 font-semibold text-green-700">{S[i] ?? ""}</td>
                  <td className="px-3 py-1.5 font-semibold text-amber-700">{I[i] ?? ""}</td>
                  <td className="px-3 py-1.5 font-semibold text-red-700">{R[i] ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {values.notes && <div className="mt-3"><Line k="Remarks:" v={values.notes} /></div>}
    </div>
  );
}
