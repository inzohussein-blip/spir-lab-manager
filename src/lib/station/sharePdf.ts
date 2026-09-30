"use client";

/**
 * «مشاركة واتساب»: the printed report as a PDF file, sent through the device's share sheet
 * (WhatsApp among the choices) — or, where a browser cannot share files, saved and WhatsApp opened
 * on the patient's number to attach it. Made on the device (no server, works offline): the sheet
 * is drawn to an image and cut into A4 / A5 pages of a small PDF.
 */

const PAGE_PT = { A4: [595.28, 841.89], A5: [419.53, 595.28] } as const;

/** A PDF of JPEG pages (each fills its page). */
export function jpegPagesToPdf(pages: { bytes: Uint8Array; w: number; h: number }[], paper: "A4" | "A5"): Blob {
  const [pw, ph] = PAGE_PT[paper];
  const enc = new TextEncoder();
  const parts: (Uint8Array | string)[] = [];
  const offsets: number[] = [];
  let size = 0;
  const push = (x: Uint8Array | string) => { parts.push(x); size += typeof x === "string" ? enc.encode(x).length : x.length; };
  const obj = (n: number, body: () => void) => { offsets[n] = size; push(`${n} 0 obj\n`); body(); push("\nendobj\n"); };

  push("%PDF-1.4\n%âãÏÓ\n");
  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(" ");
  obj(1, () => push("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () => push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`));
  pages.forEach((p, i) => {
    const page = 3 + i * 3, content = page + 1, img = page + 2;
    obj(page, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 ${img} 0 R >> >> /Contents ${content} 0 R >>`));
    const draw = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
    obj(content, () => push(`<< /Length ${enc.encode(draw).length} >>\nstream\n${draw}\nendstream`));
    obj(img, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.bytes.length} >>\nstream\n`);
      push(p.bytes);
      push("\nendstream");
    });
  });
  const xref = size;
  const count = 3 + pages.length * 3;
  let table = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let n = 1; n < count; n++) table += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  push(table);
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts as BlobPart[], { type: "application/pdf" });
}

const dataUrlBytes = (u: string) => Uint8Array.from(atob(u.slice(u.indexOf(",") + 1)), (c) => c.charCodeAt(0));

/** The report sheet on screen, as a PDF of A4 / A5 pages. */
export async function sheetPdf(el: HTMLElement, paper: "A4" | "A5"): Promise<Blob> {
  const { toCanvas } = await import("html-to-image");
  const canvas = await toCanvas(el, { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: true });
  const [pw, ph] = PAGE_PT[paper];
  const pageH = Math.round(canvas.width * (ph / pw));
  const pages: { bytes: Uint8Array; w: number; h: number }[] = [];
  for (let y = 0; y < canvas.height; y += pageH) {
    const slice = document.createElement("canvas");
    slice.width = canvas.width; slice.height = pageH;
    const ctx = slice.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, y, canvas.width, Math.min(pageH, canvas.height - y), 0, 0, canvas.width, Math.min(pageH, canvas.height - y));
    pages.push({ bytes: dataUrlBytes(slice.toDataURL("image/jpeg", 0.88)), w: slice.width, h: slice.height });
    // A last sliver of blank space is not worth a page.
    if (canvas.height - (y + pageH) < pageH * 0.04) break;
  }
  return jpegPagesToPdf(pages, paper);
}

/** An Iraqi mobile written locally (07…) in the international form WhatsApp wants (9647…). */
export function waNumber(phone?: string): string {
  const d = (phone ?? "").replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) return d.slice(2);
  if (d.startsWith("0")) return "964" + d.slice(1);
  return d;
}

/** Share the PDF (WhatsApp among the device's choices); otherwise save it and open WhatsApp. */
export async function sharePdf(pdf: Blob, fileName: string, opts: { phone?: string; text: string }): Promise<"shared" | "saved"> {
  const file = new File([pdf], fileName, { type: "application/pdf" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title: fileName, text: opts.text }); return "shared"; }
    catch (e) { if ((e as DOMException)?.name === "AbortError") return "shared"; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(pdf); a.download = fileName; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  const n = waNumber(opts.phone);
  window.open(`https://wa.me/${n}?text=${encodeURIComponent(opts.text)}`, "_blank", "noopener");
  return "saved";
}
