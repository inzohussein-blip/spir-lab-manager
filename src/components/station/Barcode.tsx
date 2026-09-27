"use client";

import { useEffect, useMemo, useState } from "react";

/** Client-side Code128 barcode for the sample number on printed reports.
 *  Falls back to nothing if bwip-js can't run — the number is shown anyway.
 *
 *  The library is loaded once, when a report sheet first shows (loadBarcode), and the
 *  barcode is then drawn in the same render as the sample number — so printing right
 *  after «طباعة» assigns a new number never catches the sheet without its barcode. */
type Gen = { toSVG: (o: object) => string };
let gen: Gen | null = null;
let loading: Promise<boolean> | null = null;

/** Load the barcode library (once). Resolves true when it is ready. */
export function loadBarcode(): Promise<boolean> {
  if (gen) return Promise.resolve(true);
  loading ??= import("bwip-js")
    .then((m) => {
      const mod = m as unknown as Gen & { default?: Gen };
      gen = mod.default ?? mod;
      return true;
    })
    .catch(() => {
      loading = null; // try again next time (e.g. back online)
      return false;
    });
  return loading;
}

function draw(text: string): string {
  if (!gen || !text) return "";
  try {
    return gen.toSVG({ bcid: "code128", text, scale: 2, height: 8, includetext: false, paddingwidth: 0, paddingheight: 0 });
  } catch {
    return "";
  }
}

export function Barcode({ text, className }: { text: string; className?: string }) {
  const [ready, setReady] = useState(gen !== null);
  useEffect(() => {
    if (ready) return;
    let alive = true;
    loadBarcode().then((ok) => { if (alive && ok) setReady(true); });
    return () => { alive = false; };
  }, [ready]);
  const svg = useMemo(() => (ready ? draw(text) : ""), [ready, text]);
  if (!svg) return null;
  return <span className={className} dangerouslySetInnerHTML={{ __html: svg }} />;
}
