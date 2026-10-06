/**
 * GS1 barcodes on kit boxes (GS1-128 / DataMatrix), as a scanner types them: with the group
 * separator (FNC1, \x1d) or with the application identifiers in brackets — «(01)…(17)…(10)…».
 * Read: (01) the product code (GTIN), (17) expiry YYMMDD, (10) the lot, (21) serial, (11) made.
 */
export interface Gs1 { gtin?: string; expiry?: string; lot?: string; serial?: string }

const FIXED: Record<string, number> = { "00": 18, "01": 14, "02": 14, "11": 6, "12": 6, "13": 6, "15": 6, "16": 6, "17": 6 };
const GS = "\x1d";

/** YYMMDD → YYYY-MM-DD (a day of 00 is the month's last day, as GS1 says). */
function ymd(s: string): string | undefined {
  if (!/^\d{6}$/.test(s)) return undefined;
  const y = 2000 + Number(s.slice(0, 2)), m = Number(s.slice(2, 4));
  let d = Number(s.slice(4, 6));
  if (m < 1 || m > 12) return undefined;
  if (d === 0) d = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function parseGs1(raw: string): Gs1 | null {
  let s = String(raw ?? "").trim().replace(/^\][A-Za-z]\d/, ""); // a symbology prefix (]d2, ]C1)
  if (!s) return null;
  const out: Gs1 = {};
  const set = (ai: string, v: string) => {
    if (ai === "01" || ai === "02") out.gtin = v;
    else if (ai === "17") out.expiry = ymd(v);
    else if (ai === "10") out.lot = v;
    else if (ai === "21") out.serial = v;
  };
  if (s.includes("(")) {
    for (const m of s.matchAll(/\((\d{2,4})\)([^(]*)/g)) set(m[1], m[2].replace(new RegExp(GS, "g"), "").trim());
  } else {
    // Some scanners type the separator as «|» or as a space-less run; accept «|» too.
    s = s.replace(/\|/g, GS);
    let i = 0;
    while (i < s.length) {
      if (s[i] === GS) { i++; continue; }
      const ai = s.slice(i, i + 2);
      if (!/^\d{2}$/.test(ai)) break;
      i += 2;
      const len = FIXED[ai];
      let v: string;
      if (len) { v = s.slice(i, i + len); i += len; }
      else { const end = s.indexOf(GS, i); v = end < 0 ? s.slice(i) : s.slice(i, end); i = end < 0 ? s.length : end + 1; }
      set(ai, v);
    }
  }
  if (!out.gtin && !out.lot && !out.expiry) {
    // A plain product barcode (EAN-13 / UPC): just the code.
    return /^\d{8,14}$/.test(s) ? { gtin: s } : null;
  }
  return out;
}
