import type { CSSProperties } from "react";
import { tint } from "@/lib/station/tableStyle";

/**
 * «الموجة» — the decorations of the report's wave design: soft waves across the top with a faint
 * medical cross and a heartbeat line running into hexagons, and waves rising across the bottom.
 * Drawn in the lab's own report colours (light tints of them), as SVG so they print sharp on any
 * printer and need no image file. In print they are fixed to the page, so every page carries them.
 * No `opacity` here: Chrome leaves out layers of a fixed element on the pages after the first, so the
 * see-through is in the colours themselves (fill-opacity / stroke-opacity).
 */

const exact = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as CSSProperties;

/** A flat-topped hexagon's points around (cx, cy). */
function hex(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
}

export function WaveTop({ primary, accent }: { primary: string; accent: string }) {
  const a = tint(accent, 0.55), aSoft = tint(accent, 0.8), p = tint(primary, 0.65);
  return (
    <svg viewBox="0 0 210 40" className="block h-auto w-full" aria-hidden style={exact}>
      <defs>
        <linearGradient id="rw-top-a" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={a} stopOpacity="0.95" />
          <stop offset="0.7" stopColor={a} stopOpacity="0.35" />
          <stop offset="1" stopColor={a} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="rw-top-p" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={p} stopOpacity="0.9" />
          <stop offset="1" stopColor={p} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* The waves in the top corner */}
      <path d="M0 0 H128 C100 4 74 9 50 16 C30 22 14 28 0 33 Z" fill={aSoft} fillOpacity="0.7" />
      <path d="M0 9 C24 4 52 2 82 4 C98 5 112 7 126 9 C98 9 70 14 46 22 C28 28 13 34 0 38 Z" fill="url(#rw-top-a)" fillOpacity="0.75" />
      <path d="M0 26 C22 15 52 8 92 7 C108 7 120 8 132 10 C104 11 74 16 48 25 C30 31 15 36 2 40 H0 Z" fill="url(#rw-top-p)" fillOpacity="0.55" />
      <path d="M0 31 C26 19 62 11 116 12" stroke={a} strokeWidth="0.35" fill="none" strokeOpacity="0.9" />
      {/* A faint medical cross */}
      <g fill="#ffffff" fillOpacity="0.55">
        <rect x="9.5" y="3" width="7" height="20" rx="1.4" />
        <rect x="3" y="9.5" width="20" height="7" rx="1.4" />
      </g>
      {/* The line with its heartbeat, into the hexagons */}
      <path d="M58 14.5 H160 l1.6 -2.6 l1.4 3.6 l1.6 -10 l1.8 14 l1.6 -7 l1.2 2 H184" stroke={a} strokeWidth="0.45" fill="none" strokeLinejoin="round" />
      <polygon points={hex(191, 12, 5.2)} fill="none" stroke={a} strokeWidth="0.4" />
      <polygon points={hex(200, 7, 4.4)} fill={aSoft} fillOpacity="0.9" />
      <polygon points={hex(200.5, 17.5, 4.6)} fill={a} fillOpacity="0.45" />
      <path d="M186 22 L210 34" stroke={aSoft} strokeWidth="0.4" />
    </svg>
  );
}

export function WaveBottom({ primary, accent }: { primary: string; accent: string }) {
  const a = tint(accent, 0.55), aSoft = tint(accent, 0.8), p = tint(primary, 0.65);
  return (
    <svg viewBox="0 0 210 34" className="block h-auto w-full" aria-hidden style={exact}>
      <defs>
        <linearGradient id="rw-bot-a" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor={a} stopOpacity="0.95" />
          <stop offset="0.6" stopColor={a} stopOpacity="0.4" />
          <stop offset="1" stopColor={a} stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id="rw-bot-p" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor={p} stopOpacity="0.85" />
          <stop offset="1" stopColor={p} stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <path d="M0 22 C40 30 92 31 142 25 C170 21 192 13 210 6 V34 H0 Z" fill={aSoft} fillOpacity="0.75" />
      <path d="M0 26 C46 33 104 33 152 27 C176 24 195 18 210 12 V34 H0 Z" fill="url(#rw-bot-a)" fillOpacity="0.6" />
      <path d="M0 29 C52 34 116 34 166 29 C184 27 198 23 210 19 V34 H0 Z" fill="url(#rw-bot-p)" fillOpacity="0.45" />
      <path d="M0 18 C30 26 70 29 112 28" stroke={a} strokeWidth="0.35" fill="none" strokeOpacity="0.8" />
      <path d="M22 30.5 H188" stroke={a} strokeWidth="0.35" strokeOpacity="0.9" />
      {/* The hexagons in the corner */}
      <polygon points={hex(188, 21, 4.6)} fill="none" stroke="#ffffff" strokeWidth="0.45" />
      <polygon points={hex(196, 15, 3.8)} fill={a} fillOpacity="0.5" />
      <polygon points={hex(202, 22.5, 4.2)} fill={aSoft} fillOpacity="0.95" />
      <polygon points={hex(194.5, 27.5, 3.6)} fill="none" stroke="#ffffff" strokeWidth="0.45" />
    </svg>
  );
}
