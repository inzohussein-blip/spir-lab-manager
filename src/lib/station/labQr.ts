/**
 * The QR code printed at the bottom of the report (Settings → «رمز QR أسفل التقرير»).
 *
 * One code carries everything as a contact card (vCard): the lab's name, phones, address and the
 * location / website link. The phone camera shows it as a contact — tap a number to call, tap the
 * link to open the map, or save the lab to the contacts.
 */
import { normalizeUrl, type StationSettings } from "./store";

export interface LabQrCode { content: string; title: string; hint: string }

export const QR_TITLE_DEFAULT = "معلومات المختبر";
export const QR_HINT_DEFAULT = "امسح الرمز بكاميرا الهاتف";

const esc = (v: string) => v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

/** vCard 3.0 — read natively by iPhone and Android cameras. */
export function labVCard(s: StationSettings): string {
  const name = s.labName?.trim() || "مختبر";
  const phones = (s.labPhone ?? "").split(/[,،/|\n]+/).map((x) => x.trim()).filter(Boolean);
  const url = normalizeUrl(s.labUrl);
  // Kept short (Arabic takes 2 bytes a letter): a lighter code prints bigger modules and scans easier.
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `N:${esc(name)};;;;`, `FN:${esc(name)}`];
  phones.forEach((p) => lines.push(`TEL;TYPE=WORK:${p.replace(/[^\d+]/g, "")}`));
  if (s.labAddress?.trim()) lines.push(`ADR;TYPE=WORK:;;${esc(s.labAddress.trim())};;;;`);
  if (url) lines.push(`URL:${url}`);
  const note = s.labSubtitle?.trim() || (!phones.length && !s.labAddress?.trim() ? s.footer?.trim() : "");
  if (note) lines.push(`NOTE:${esc(note)}`);
  lines.push("END:VCARD");
  return lines.join("\n");
}

/** The code to print, or null when switched off. */
export function labQrCode(s: StationSettings): LabQrCode | null {
  if (s.labQr === false) return null;
  return { content: labVCard(s), title: s.labQrTitle?.trim() || QR_TITLE_DEFAULT, hint: s.labQrHint?.trim() || QR_HINT_DEFAULT };
}
