"use client";

import type { CSSProperties, ReactNode } from "react";

/** Shared print building blocks for the standalone local stations. */
export const exact = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as CSSProperties;

/** Page setup: margin 0 (no browser URL header), padding cloned per page, fixed footer, unsplit blocks. */
export function PrintStyle({ landscape = false }: { landscape?: boolean }) {
  return (
    <style>{`@media print {
      @page { size: A4${landscape ? " landscape" : ""}; margin: 0; }
      .print-doc { padding: 11mm 12mm 19mm; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
      .print-doc .keep, .print-doc tr { break-inside: avoid; }
      .print-doc .print-footer { position: fixed; left: 12mm; right: 12mm; bottom: 7mm; }
      .print-doc .page-break { break-before: page; }
    }`}</style>
  );
}

export function Letterhead({ title, subtitle, right, color }: { title: string; subtitle?: string; right?: ReactNode; color: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b-2 pb-3" style={{ borderColor: color }}>
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/lab-logo.png" alt="" className="size-14 object-contain" />
        <div>
          <div className="text-lg font-extrabold" style={{ color }}>{title}</div>
          {subtitle && <div className="text-xs text-gray-600">{subtitle}</div>}
        </div>
      </div>
      {right && <div className="text-left text-[11px] text-gray-600">{right}</div>}
    </div>
  );
}

export function PrintFooter({ text, color }: { text?: string; color: string }) {
  if (!text) return null;
  return <div className="print-footer mt-4 rounded-md px-3 py-1.5 text-center text-[10px] text-white" style={{ background: color, ...exact }}>{text}</div>;
}

/** Sign-off row with labelled lines. */
export function SignRow({ labels }: { labels: string[] }) {
  return (
    <div className="keep mt-8 grid gap-6 text-center text-[11px] text-gray-600" style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }}>
      {labels.map((l) => <div key={l}><div className="h-7" /><div className="border-t border-gray-400 pt-1">{l}</div></div>)}
    </div>
  );
}
