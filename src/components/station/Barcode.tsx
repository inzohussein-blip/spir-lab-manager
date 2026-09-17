"use client";

import { useEffect, useState } from "react";

/** Client-side Code128 barcode for the sample number on printed reports.
 *  Falls back to nothing if bwip-js can't run — the number is shown anyway. */
export function Barcode({ text, className }: { text: string; className?: string }) {
  const [svg, setSvg] = useState("");

  useEffect(() => {
    let alive = true;
    if (!text) return;
    (async () => {
      try {
        const mod: any = await import("bwip-js");
        const gen = mod.default ?? mod;
        const out = gen.toSVG({
          bcid: "code128",
          text,
          scale: 2,
          height: 8,
          includetext: false,
          paddingwidth: 0,
          paddingheight: 0,
        }) as string;
        if (alive) setSvg(out);
      } catch {
        /* ignore — number still prints below */
      }
    })();
    return () => {
      alive = false;
    };
  }, [text]);

  if (!svg) return null;
  return <span className={className} dangerouslySetInnerHTML={{ __html: svg }} />;
}
