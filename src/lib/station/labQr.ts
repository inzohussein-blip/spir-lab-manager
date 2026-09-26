/**
 * The QR code printed at the bottom of the report (Settings → «رمز QR أسفل التقرير»).
 *
 * One code carries the lab's details as plain lines, with no labels — the phone shows them as
 * they are, and most phones make the link line tappable:
 *   lab name / phone number(s) / address / website or map link
 */
import { normalizeUrl, type StationSettings } from "./store";

export interface LabQrCode { content: string; title: string; hint: string }

export const QR_TITLE_DEFAULT = "معلومات المختبر";
export const QR_HINT_DEFAULT = "امسح الرمز بكاميرا الهاتف";

/** The text inside the code: name, phones, address, link — one per line, empty ones skipped. */
export function labQrContent(s: StationSettings): string {
  const phones = (s.labPhone ?? "").split(/[,،/|\n]+/).map((x) => x.trim()).filter(Boolean).join(" - ");
  return [s.labName?.trim() || "مختبر", phones, s.labAddress?.trim(), normalizeUrl(s.labUrl)].filter(Boolean).join("\n");
}

/** The code to print, or null when switched off. */
export function labQrCode(s: StationSettings): LabQrCode | null {
  if (s.labQr === false) return null;
  return { content: labQrContent(s), title: s.labQrTitle?.trim() || QR_TITLE_DEFAULT, hint: s.labQrHint?.trim() || QR_HINT_DEFAULT };
}
