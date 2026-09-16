/**
 * Pure-SVG single-series area+line chart (change over time). Server-renderable;
 * responsive via viewBox. One series => the title names it, no legend. Native
 * <title> markers give a hover layer without client JS.
 */

type Point = { label: string; value: number };

const WIDTH = 720;
const HEIGHT = 260;
const PAD = { top: 16, right: 18, bottom: 40, left: 56 };

function niceCeil(n: number): number {
  if (n <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(n)));
  const step = mag / 2;
  return Math.ceil(n / step) * step;
}

export function LineChart({
  data,
  formatValue = (v) => String(Math.round(v)),
  ariaLabel,
  color = "var(--color-brand)",
}: {
  data: Point[];
  formatValue?: (v: number) => string;
  ariaLabel?: string;
  color?: string;
}) {
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const max = niceCeil(Math.max(1, ...data.map((d) => d.value)));
  const n = data.length;
  const ticks = 4;

  const x = (i: number) =>
    PAD.left + (n <= 1 ? plotW / 2 : (plotW * i) / (n - 1));
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.value)}`).join(" ");
  const area =
    `M${x(0)},${PAD.top + plotH} ` +
    data.map((d, i) => `L${x(i)},${y(d.value)}`).join(" ") +
    ` L${x(n - 1)},${PAD.top + plotH} Z`;

  // Show at most ~8 x labels to avoid collisions.
  const labelStep = Math.ceil(n / 8);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width="100%"
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="lc-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.24" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {Array.from({ length: ticks + 1 }, (_, i) => {
        const v = (max * i) / ticks;
        const yy = PAD.top + plotH - (plotH * i) / ticks;
        return (
          <g key={i}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={yy} y2={yy} stroke="var(--color-line)" strokeWidth={1} />
            <text x={PAD.left - 8} y={yy + 4} textAnchor="end" fontSize="11" fill="var(--color-muted)">
              {formatValue(v)}
            </text>
          </g>
        );
      })}

      {n > 0 && <path d={area} fill="url(#lc-fill)" />}
      {n > 0 && <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}

      {data.map((d, i) => (
        <g key={d.label + i}>
          <circle cx={x(i)} cy={y(d.value)} r={4} fill={color} stroke="var(--color-surface)" strokeWidth={2}>
            <title>{`${d.label}: ${formatValue(d.value)}`}</title>
          </circle>
          {i % labelStep === 0 && (
            <text x={x(i)} y={HEIGHT - PAD.bottom + 18} textAnchor="middle" fontSize="10" fill="var(--color-muted)">
              {d.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
