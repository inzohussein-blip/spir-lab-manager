"use client";

import { useEffect, useState } from "react";

/** Load an image for drawing on a canvas (null if it can't be read). */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

/**
 * Client-side QR code — holds Arabic text and links, read by any phone camera.
 * Drawn as a sharp PNG (an SVG of thin strokes prints faded at small sizes). With `logo`, the lab
 * logo sits in the middle on a white tile covering ~4% of the code, well within the "Q" error
 * correction (~25% may be covered) the code then uses. Renders nothing until ready.
 */
export function QrCode({ text, className, logo }: { text: string; className?: string; logo?: string }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let alive = true;
    if (!text.trim()) { setSrc(""); return; }
    (async () => {
      try {
        const QR = await import("qrcode");
        const size = 480;
        const plain = await QR.toDataURL(text, { margin: 0, width: size, errorCorrectionLevel: logo ? "Q" : "M" });
        let out = plain;
        const mark = logo ? await loadImage(logo) : null;
        if (mark) {
          const base = await loadImage(plain);
          const cv = document.createElement("canvas");
          cv.width = cv.height = size;
          const g = cv.getContext("2d");
          if (base && g) {
            g.imageSmoothingEnabled = false;
            g.drawImage(base, 0, 0, size, size);
            const tile = Math.round(size * 0.2), x = (size - tile) / 2, r = tile * 0.18;
            g.fillStyle = "#fff";
            g.beginPath(); g.roundRect(x, x, tile, tile, r); g.fill();
            g.imageSmoothingEnabled = true;
            const pad = tile * 0.1, box = tile - pad * 2;
            const k = Math.min(box / mark.width, box / mark.height);
            const w = mark.width * k, h = mark.height * k;
            g.drawImage(mark, (size - w) / 2, (size - h) / 2, w, h);
            out = cv.toDataURL("image/png");
          }
        }
        if (alive) setSrc(out);
      } catch {
        /* ignore — the lab details still print in the footer */
      }
    })();
    return () => {
      alive = false;
    };
  }, [text, logo]);

  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="QR" className={className} />;
}
