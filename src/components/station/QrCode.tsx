"use client";

import { useEffect, useState } from "react";

/** Client-side QR code — holds Arabic text, read by any phone camera. Drawn as a sharp PNG
 *  (an SVG of thin strokes prints faded at small sizes). Renders nothing until ready. */
export function QrCode({ text, className }: { text: string; className?: string }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let alive = true;
    if (!text.trim()) { setSrc(""); return; }
    (async () => {
      try {
        const QR = await import("qrcode");
        const out = await QR.toDataURL(text, { margin: 0, width: 360, errorCorrectionLevel: "M" });
        if (alive) setSrc(out);
      } catch {
        /* ignore — the lab details still print in the footer */
      }
    })();
    return () => {
      alive = false;
    };
  }, [text]);

  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="QR" className={className} style={{ imageRendering: "pixelated" }} />;
}
