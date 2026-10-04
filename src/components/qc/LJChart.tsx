"use client";

import type { QcLevel, QcResult, Evaluation } from "@/lib/qc/store";

/** Levey-Jennings chart of one control level (shared by «محطة الجودة» and the admin panel's quality page). */
const W = 760, H = 250, PL = 70, PR = 14, PT = 12, PB = 26;
const zToY = (z: number) => PT + ((4 - Math.max(-4, Math.min(4, z))) / 8) * (H - PT - PB);

export function LJChart({ level, points }: { level: QcLevel; points: { r: QcResult; e?: Evaluation }[] }) {
  const n = points.length;
  const x = (i: number) => PL + (n <= 1 ? (W - PL - PR) / 2 : (i * (W - PL - PR)) / (n - 1));
  const lines = [3, 2, 1, 0, -1, -2, -3];
  return (
    <div dir="ltr"><svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {lines.map((z) => (
        <g key={z}>
          <line x1={PL} x2={W - PR} y1={zToY(z)} y2={zToY(z)}
            stroke={z === 0 ? "#16a34a" : Math.abs(z) === 3 ? "#dc2626" : Math.abs(z) === 2 ? "#f59e0b" : "#cbd5e1"}
            strokeWidth={z === 0 ? 1.6 : 1} strokeDasharray={z === 0 ? "" : "4 4"} />
          <text x={PL - 6} y={zToY(z) + 3.5} textAnchor="end" fontSize={10} fill="#64748b">
            {z === 0 ? "x̄" : `${z > 0 ? "+" : ""}${z}SD`} {+(level.mean + z * level.sd).toFixed(2)}
          </text>
        </g>
      ))}
      {n > 1 && <polyline fill="none" stroke="#475569" strokeWidth={1.3} points={points.map((p, i) => `${x(i)},${zToY(p.e?.z ?? 0)}`).join(" ")} />}
      {points.map((p, i) => (
        <g key={p.r.id}>
          <circle cx={x(i)} cy={zToY(p.e?.z ?? 0)} r={4.5} fill={p.e?.status === "reject" ? "#dc2626" : p.e?.status === "warn" ? "#f59e0b" : "#2563eb"} stroke="white" strokeWidth={1.5}>
            <title>{`${p.r.date}: ${p.r.value}${p.e?.rules.length ? " — " + p.e.rules.join(", ") : ""}`}</title>
          </circle>
          {(n <= 16 || i % Math.ceil(n / 16) === 0) && <text x={x(i)} y={H - 8} textAnchor="middle" fontSize={9} fill="#64748b">{p.r.date.slice(8)}</text>}
        </g>
      ))}
      {n === 0 && <text x={(W + PL) / 2} y={H / 2} textAnchor="middle" fontSize={13} fill="#94a3b8">لا توجد قيم في هذه الفترة</text>}
    </svg></div>
  );
}


/** The level's actual statistics over the shown values. */
export function qcStats(values: number[], level: QcLevel) {
  const n = values.length;
  if (!n) return null;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const sd = n > 1 ? Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)) : 0;
  return { n, mean, sd, cv: mean ? (sd / mean) * 100 : 0, bias: level.mean ? ((mean - level.mean) / level.mean) * 100 : 0 };
}
