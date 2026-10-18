"use client";

import { useId } from "react";

/**
 * Small hand-made SVG charts for the lab station's «لوحة التحكم» and «التحليلات» (from
 * spir-supply-manager's new look). One series each, in the station's own colour — the brand variables
 * exist in both looks, so the pages work in the classic look too and follow the new look's colour.
 * Every bar, point and square says its value on hover.
 */
const BRAND = "var(--color-brand)";
const BRAND_DARK = "var(--color-brand-dark)";
const BRAND_MID = "color-mix(in oklab, var(--color-brand) 70%, white)";
const BRAND_SOFT = "color-mix(in oklab, var(--color-brand) 38%, white)";
/** The previous period's line: a muted grey, dashed (same measure, earlier time). */
const BEFORE = "#8a9a92";

const smooth = (pts: [number, number][]) => {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], cx = (x0 + x1) / 2;
    d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  return d;
};
const scale = (vals: number[], w: number, h: number, pad: number, max?: number): [number, number][] => {
  const hi = max ?? Math.max(1, ...vals), n = Math.max(1, vals.length - 1);
  return vals.map((v, i) => [pad + (i / n) * (w - pad * 2), h - pad - (Math.max(0, v) / hi) * (h - pad * 2)]);
};

/** A thin trend line with a soft fade underneath (the figures at the top). */
export function Sparkline({ values, className = "" }: { values: number[]; className?: string }) {
  const id = useId(); const w = 240, h = 48;
  const pts = scale(values.length > 1 ? values : [0, 0], w, h, 3);
  const line = smooth(pts);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={`h-10 w-full ${className}`} style={{ color: BRAND_MID }} aria-hidden>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".22" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
      <path d={`${line} L${pts[pts.length - 1][0]},${h} L${pts[0][0]},${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
    </svg>
  );
}

/** Area chart of one measure, with the previous period dashed and horizontal guides. Hovering a day
 *  shows both values (`tip`). */
export function AreaChart({ now, before, labels, tip, height = 260 }: {
  now: number[]; before?: number[]; labels: string[]; tip?: (i: number) => string; height?: number;
}) {
  const id = useId(); const w = 720, h = height, pad = 28;
  const hi = Math.max(1, ...now, ...(before ?? []));
  const nice = Math.ceil(hi / 4) * 4 || 4;
  const mp = scale(now, w, h, pad, nice);
  const step = (w - pad * 2) / Math.max(1, now.length - 1);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="رسم بياني" data-testid="area-chart">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: BRAND_MID, stopOpacity: 0.35 }} /><stop offset="1" style={{ stopColor: BRAND_MID, stopOpacity: 0 }} /></linearGradient></defs>
      {[0, 1, 2, 3, 4].map((i) => { const y = pad + (i / 4) * (h - pad * 2); return <g key={i}><line x1={pad} x2={w - pad} y1={y} y2={y} className="stroke-line" strokeDasharray="3 5" /><text x={pad - 6} y={y + 3} textAnchor="end" className="fill-muted" fontSize="10">{Math.round(nice * (1 - i / 4))}</text></g>; })}
      {labels.map((l, i) => { const x = pad + (i / Math.max(1, labels.length - 1)) * (w - pad * 2); return l ? <text key={i} x={x} y={h - 6} textAnchor="middle" className="fill-muted" fontSize="10">{l}</text> : null; })}
      <path d={`${smooth(mp)} L${mp[mp.length - 1][0]},${h - pad} L${mp[0][0]},${h - pad} Z`} fill={`url(#${id})`} />
      {before && <path d={smooth(scale(before, w, h, pad, nice))} fill="none" style={{ stroke: BEFORE }} strokeWidth={1.5} strokeDasharray="4 4" strokeLinecap="round" />}
      <path d={smooth(mp)} fill="none" style={{ stroke: BRAND_DARK }} strokeWidth={2.2} strokeLinecap="round" />
      {/* The hover layer: one tall strip per day (wider than the mark), with its values. */}
      {tip && mp.map(([x], i) => (
        <g key={i} className="group">
          <rect x={x - step / 2} y={pad} width={step} height={h - pad * 2} fill="transparent"><title>{tip(i)}</title></rect>
          <circle cx={x} cy={mp[i][1]} r="4.5" className="opacity-0 group-hover:opacity-100" style={{ fill: BRAND_DARK, stroke: "var(--color-surface, #fff)", strokeWidth: 2 }} pointerEvents="none" />
        </g>
      ))}
    </svg>
  );
}

/** Rounded vertical pills: the highlighted ones filled, the rest hatched; each says its value. */
export function PillBars({ items }: { items: { label: string; value: number; tone?: "dark" | "mid" | "soft" | "hatch"; note?: string; tip?: string }[] }) {
  const id = useId();
  return (
    <div className="flex items-end justify-between gap-2" dir="ltr" data-testid="pill-bars">
      <svg width="0" height="0" aria-hidden><defs><pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#eef2ef" /><line x1="0" y1="0" x2="0" y2="6" stroke="#b8c2bc" strokeWidth="1.2" /></pattern></defs></svg>
      {items.map((it, i) => {
        const hgt = Math.max(14, Math.min(100, it.value));
        const bg = it.tone === "dark" ? BRAND_DARK : it.tone === "mid" ? BRAND_MID : it.tone === "soft" ? BRAND_SOFT : `url(#${id})`;
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-2" title={it.tip ?? it.note}>
            <div className="relative flex h-40 w-full max-w-14 items-end"><div className="relative w-full rounded-full border border-line/60" style={{ height: `${hgt}%`, background: bg }}>
              {it.note && <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-surface px-1.5 text-[10px] font-semibold tabular-nums shadow-[var(--shadow-card)]">{it.note}</span>}</div></div>
            <span className="text-xs text-muted" dir="rtl">{it.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Half-ring gauge. */
export function Gauge({ percent, label }: { percent: number; label?: string }) {
  const p = Math.max(0, Math.min(100, percent)); const r = 80, c = Math.PI * r;
  return (
    <div className="relative mx-auto w-56" title={`${Math.round(p)}%${label ? ` ${label}` : ""}`}>
      <svg viewBox="0 0 200 110" className="w-full" aria-hidden>
        <path d="M20,100 A80,80 0 0 1 180,100" fill="none" className="stroke-line" strokeWidth="26" strokeLinecap="round" />
        <path d="M20,100 A80,80 0 0 1 180,100" fill="none" style={{ stroke: BRAND_DARK }} strokeWidth="26" strokeLinecap="round" strokeDasharray={`${(p / 100) * c} ${c}`} />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center"><div className="text-3xl font-extrabold tabular-nums">{Math.round(p)}%</div>{label && <div className="text-[11px] text-muted">{label}</div>}</div>
    </div>
  );
}

/** The heat map's steps, lightest to darkest (one hue, light → dark), for its legend. */
export const HEAT_STEPS = ["var(--color-line)", BRAND_SOFT, BRAND_MID, BRAND, BRAND_DARK];
/** Days as small squares, darker for more (the last weeks, columns of 7 days). */
export function Heatmap({ days, label = (d) => d.date }: { days: { date: string; value: number }[]; label?: (d: { date: string; value: number }) => string }) {
  const hi = Math.max(1, ...days.map((d) => d.value));
  const tone = (v: number) => HEAT_STEPS[v <= 0 ? 0 : v / hi > 0.75 ? 4 : v / hi > 0.5 ? 3 : v / hi > 0.25 ? 2 : 1];
  const cols: { date: string; value: number }[][] = [];
  for (let i = 0; i < days.length; i += 7) cols.push(days.slice(i, i + 7));
  return (
    <div className="flex gap-1 overflow-x-auto pb-1" dir="ltr" data-testid="heatmap">
      {cols.map((c, i) => (
        <div key={i} className="flex flex-col gap-1">
          {c.map((d) => <span key={d.date} title={label(d)} className="size-3.5 rounded-[4px]" style={{ background: tone(d.value) }} />)}
        </div>
      ))}
    </div>
  );
}

/** A horizontal bar list (names with their count): the station's colour, the longest full. */
export function BarList({ rows, testid }: { rows: { name: string; n: number; hint?: string }[]; testid?: string }) {
  const top = Math.max(1, ...rows.map((r) => r.n));
  if (!rows.length) return <p className="py-4 text-center text-sm text-muted">لا شيء في هذه الفترة</p>;
  return (
    <ul className="flex flex-col gap-2.5" data-testid={testid}>
      {rows.map((r) => (
        <li key={r.name} title={`${r.name}: ${r.n}${r.hint ? ` ${r.hint}` : ""}`}>
          <div className="flex items-center justify-between gap-2 text-sm"><span className="truncate font-medium">{r.name}</span><span className="tabular-nums text-muted">{r.n.toLocaleString("en-US")}</span></div>
          <div className="mt-1 h-1.5 rounded-full bg-line"><div className="h-full rounded-full" style={{ width: `${Math.round((r.n / top) * 100)}%`, background: BRAND_MID }} /></div>
        </li>
      ))}
    </ul>
  );
}

const AV = ["bg-rose-100 text-rose-700", "bg-emerald-100 text-emerald-700", "bg-sky-100 text-sky-700", "bg-amber-100 text-amber-700", "bg-violet-100 text-violet-700", "bg-teal-100 text-teal-700"];
/** A round badge with the first letters of a name (a patient, a doctor), its colour fixed by the name. */
export function Avatar({ name, className = "size-9" }: { name: string; className?: string }) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const parts = (words.length > 1 && /^(د\.?|دكتور|الطبيب)$/.test(words[0]) ? words.slice(1) : words).map((w) => w.replace(/^ال(?=..)/, ""));
  const ini = (parts.length > 1 && words.length === parts.length ? parts[0][0] + parts[1][0] : (parts[0] ?? "؟")[0]).toUpperCase();
  const k = [...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AV.length;
  return <span className={`grid shrink-0 place-items-center rounded-full text-xs font-bold ${AV[k]} ${className}`} aria-hidden>{ini}</span>;
}
