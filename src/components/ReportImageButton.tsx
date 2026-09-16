"use client";

import { useState } from "react";
import { ImageDown } from "lucide-react";
import { toPng } from "html-to-image";

/**
 * Export the on-screen report sheet as a PNG (section 5: an easy-to-view image
 * to share on WhatsApp). Captures the DOM node client-side — Arabic/RTL text
 * renders exactly as shown.
 */
export function ReportImageButton({
  targetId,
  fileName,
}: {
  targetId: string;
  fileName: string;
}) {
  const [busy, setBusy] = useState(false);

  async function save() {
    const node = document.getElementById(targetId);
    if (!node) return;
    setBusy(true);
    try {
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${fileName}.png`;
      a.click();
    } catch {
      // ignore — user can still print/PDF
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={save}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3.5 py-2 text-sm font-semibold text-ink hover:bg-canvas disabled:opacity-60"
    >
      <ImageDown className="size-4" />
      {busy ? "جارٍ التصدير…" : "تنزيل كصورة PNG"}
    </button>
  );
}
