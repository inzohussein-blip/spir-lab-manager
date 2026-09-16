/**
 * Pure-SVG single-hue bar chart (magnitude). Server-renderable; responsive via
 * viewBox. Single series => no legend (the title names it). Native <title>
 * tooltips give a hover layer without client JS. Adapted in spirit from the
 * DiagLab/AURA dependency-free charts.
 */

type Datum = { label: string; value: number };

const WIDTH = 720;
const HEIGHT = 260;
const PAD = { top: 16, right: 16, bottom: 46, left: 52 };

function niceCeil(n: number): number {
  if (n <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(n)));
  const step = mag / 2;
  return Math.ceil(n / step) * step;
}

export function BarChart({
  data,
  formatValue = (v) => String(Math.round(v)),
  ariaLabel,
  color = "var(--color-brand)",
}: {
  data: Datum[];
  formatValue?: (v: number) => string;
  ariaLabel?: string;
  color?: string;
}) {
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const max = niceCeil(Math.max(1, ...data.map((d) => d.value)));
  const n = data.length || 1;
  const band = plotW / n;
  const barW = Math.min(46, band * 0.6);
  const ticks = 4;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width="100%"
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* y grid + ticks (recessive) */}
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const v = (max * i) / ticks;
        const y = PAD.top + plotH - (plotH * i) / ticks;
        return (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y}
              y2={y}
              stroke="var(--color-line)"
              strokeWidth={1}
            />
            <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="var(--color-muted)">
              {formatValue(v)}
            </text>
          </g>
        );
      })}

      {data.map((d, i) => {
        const h = (d.value / max) * plotH;
        const x = PAD.left + band * i + (band - barW) / 2;
        const y = PAD.top + plotH - h;
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={barW} height={Math.max(0, h)} rx={4} fill={color}>
              <title>{`${d.label}: ${formatValue(d.value)}`}</title>
            </rect>
            {d.value > 0 && (
              <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize="11" fill="var(--color-ink)">
                {formatValue(d.value)}
              </text>
            )}
            <text
              x={PAD.left + band * i + band / 2}
              y={HEIGHT - PAD.bottom + 16}
              textAnchor="middle"
              fontSize="11"
              fill="var(--color-muted)"
            >
              {d.label.length > 10 ? d.label.slice(0, 9) + "…" : d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
