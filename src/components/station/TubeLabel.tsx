"use client";

import { useEffect, useState } from "react";

/**
 * Tube labels (optional — enabled in Settings): patient name, sample number as a
 * Code128 barcode + text, and the date. Each label is its own print page sized to
 * the label, which is how thermal label printers feed one sticker per page.
 */
// Smaller than 50 mm wide is too tight for the sample-number barcode on a 203-dpi
// label printer (it stops scanning reliably), so no smaller size is offered.
export type LabelSize = "50x25" | "60x30";
export const LABEL_SIZES: Record<LabelSize, { w: number; h: number; label: string }> = {
  "50x25": { w: 50, h: 25, label: "50 × 25 مم (الأكثر شيوعاً)" },
  "60x30": { w: 60, h: 30, label: "60 × 30 مم" },
};

export function TubeLabels({ name, accession, date, size = "50x25", copies = 1, onReady }: {
  name: string; accession: string; date: string; size?: LabelSize; copies?: number; onReady: () => void;
}) {
  const { w, h } = LABEL_SIZES[size] ?? LABEL_SIZES["50x25"];
  const [svg, setSvg] = useState<string | null>(null);

  // Barcode first, then tell the page it can print (never wait forever for it).
  useEffect(() => {
    let alive = true;
    const done = (s: string) => { if (alive) setSvg(s); };
    const fallback = setTimeout(() => done(""), 2500);
    (async () => {
      try {
        const mod = (await import("bwip-js")) as unknown as { default?: { toSVG: (o: object) => string }; toSVG?: (o: object) => string };
        const gen = mod.default ?? mod;
        const out = gen.toSVG!({ bcid: "code128", text: accession, scale: 2, height: 10, includetext: false, paddingwidth: 10, paddingheight: 0 }); // 10-module quiet zone each side for scanners
        done(out.replace("<svg ", '<svg preserveAspectRatio="none" style="width:100%;height:100%" '));
      } catch {
        done(""); // the number is printed as text anyway
      } finally {
        clearTimeout(fallback);
      }
    })();
    return () => { alive = false; clearTimeout(fallback); };
  }, [accession]);

  useEffect(() => { if (svg !== null) onReady(); }, [svg]); // eslint-disable-line react-hooks/exhaustive-deps

  const small = h <= 20;
  return (
    <>
      <style>{`@media print { @page { size: ${w}mm ${h}mm; margin: 0; } html, body { background: #fff !important; } }`}</style>
      <div className="hidden print:block">
        {Array.from({ length: Math.max(1, copies) }, (_, i) => (
          <div
            key={i}
            style={{
              width: `${w}mm`, height: `${h}mm`, boxSizing: "border-box", padding: small ? "1mm 1.5mm" : "1.5mm 2mm",
              display: "flex", flexDirection: "column", gap: "0.6mm", overflow: "hidden", background: "#fff", color: "#000",
              breakAfter: i < copies - 1 ? "page" : "auto", pageBreakAfter: i < copies - 1 ? "always" : "auto",
            }}
          >
            <div dir="rtl" style={{ fontWeight: 700, fontSize: small ? "8pt" : "9.5pt", lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {name}
            </div>
            <div style={{ flex: 1, minHeight: 0 }} dangerouslySetInnerHTML={{ __html: svg ?? "" }} />
            <div dir="ltr" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: small ? "6.5pt" : "7.5pt", lineHeight: 1 }}>
              <b style={{ fontFamily: "ui-monospace, monospace" }}>{accession}</b>
              <span>{date}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
