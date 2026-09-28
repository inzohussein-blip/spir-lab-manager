import "server-only";
import { cache } from "react";
import { query } from "@/lib/db";

/**
 * The lab's own identity in its admin panel (Settings): its name and logo on the panel, the
 * reports and receipts, and the letterhead lines. Kept in the lab's own database (or its section of
 * the site's), so each lab shows its own.
 */
export interface LabIdentity {
  /** The lab's name ("" → the default name). */
  name: string;
  /** The logo as an image data URL ("" → the default logo). */
  logo: string;
  subtitle: string;
  footer: string;
}

export const DEFAULT_LAB_NAME = "مختبر التحليلات المرضية";
export const DEFAULT_LAB_LOGO = "/lab-logo.png";
/** A logo larger than this is refused (it is sent with every page of the panel). */
export const MAX_LOGO_BYTES = 300_000;
const LOGO_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
export const isLogoDataUrl = (v: string) => LOGO_RE.test(v) && v.length <= Math.ceil(MAX_LOGO_BYTES * 4 / 3) + 40;

/** What to show: the lab's own name and logo, or the defaults. */
export const labName = (i: LabIdentity) => i.name || DEFAULT_LAB_NAME;
export const labLogo = (i: LabIdentity) => i.logo || DEFAULT_LAB_LOGO;

// Created on first use as well as by migration 0014, so existing databases
// (hosted or embedded) pick it up without a manual migration step.
let ensured: Promise<unknown> | null = null;
function ensureTable() {
  ensured ??= query(
    `create table if not exists lab_settings (
       key text primary key, value text not null default '', updated_at timestamptz not null default now())`
  ).catch((e) => { ensured = null; throw e; });
  return ensured;
}

const KEYS = ["lab_name", "lab_logo", "lab_subtitle", "lab_footer"];

/** Once per request (the panel's layout, the page and the report all ask). */
export const getLabIdentity = cache(async (): Promise<LabIdentity> => {
  try {
    await ensureTable();
    const rows = await query<{ key: string; value: string }>(
      `select key, value from lab_settings where key = any($1)`, [KEYS]
    );
    const get = (k: string) => rows.find((r) => r.key === k)?.value?.trim() ?? "";
    const logo = get("lab_logo");
    return { name: get("lab_name"), logo: isLogoDataUrl(logo) ? logo : "", subtitle: get("lab_subtitle"), footer: get("lab_footer") };
  } catch {
    return { name: "", logo: "", subtitle: "", footer: "" }; // printing must never fail over optional letterhead text
  }
});

async function put(key: string, value: string) {
  await query(
    `insert into lab_settings (key, value, updated_at) values ($1, $2, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [key, value]
  );
}

export async function saveLabIdentity(v: { name: string; subtitle: string; footer: string }): Promise<void> {
  await ensureTable();
  await put("lab_name", v.name.trim().slice(0, 120));
  await put("lab_subtitle", v.subtitle.trim().slice(0, 300));
  await put("lab_footer", v.footer.trim().slice(0, 300));
}

/** Set the logo (an image data URL), or back to the default with "". */
export async function saveLabLogo(dataUrl: string): Promise<boolean> {
  if (dataUrl && !isLogoDataUrl(dataUrl)) return false;
  await ensureTable();
  await put("lab_logo", dataUrl);
  return true;
}

/**
 * The look of the panel's printed report (Settings → «شكل تقرير النتائج»): the lab's colours, the
 * signature and stamp, and the English report. Kept beside the identity, in the lab's own place.
 */
export interface ReportLook {
  primary: string;
  accent: string;
  /** Colour strength in % (100 = the colours as chosen). */
  intensity: number;
  signatureOn: boolean;
  signatureName: string;
  signatureTitle: string;
  /** Images as data URLs ("" → none). */
  signature: string;
  stamp: string;
  /** The language the report opens in (each print can switch). */
  lang: "ar" | "en";
  /** The letterhead in English ("" → the Arabic line). */
  nameEn: string;
  subtitleEn: string;
  footerEn: string;
}

export const DEFAULT_LOOK: ReportLook = {
  primary: "#5a2a82", accent: "#c9a227", intensity: 100, signatureOn: false, signatureName: "", signatureTitle: "",
  signature: "", stamp: "", lang: "ar", nameEn: "", subtitleEn: "", footerEn: "",
};

const HEX = /^#[0-9a-f]{6}$/i;
const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

/** A saved or sent look made safe (unknown fields dropped, bad values back to the defaults). */
export function cleanLook(v: Partial<Record<keyof ReportLook, unknown>>, base: ReportLook = DEFAULT_LOOK): ReportLook {
  const has = (k: keyof ReportLook) => v[k] !== undefined;
  const n = Number(v.intensity);
  return {
    primary: has("primary") && HEX.test(String(v.primary)) ? String(v.primary).toLowerCase() : base.primary,
    accent: has("accent") && HEX.test(String(v.accent)) ? String(v.accent).toLowerCase() : base.accent,
    intensity: has("intensity") && Number.isFinite(n) ? Math.max(70, Math.min(150, Math.round(n))) : base.intensity,
    signatureOn: has("signatureOn") ? v.signatureOn === true : base.signatureOn,
    signatureName: has("signatureName") ? text(v.signatureName, 80) : base.signatureName,
    signatureTitle: has("signatureTitle") ? text(v.signatureTitle, 120) : base.signatureTitle,
    signature: base.signature,
    stamp: base.stamp,
    lang: has("lang") ? (v.lang === "en" ? "en" : "ar") : base.lang,
    nameEn: has("nameEn") ? text(v.nameEn, 120) : base.nameEn,
    subtitleEn: has("subtitleEn") ? text(v.subtitleEn, 300) : base.subtitleEn,
    footerEn: has("footerEn") ? text(v.footerEn, 300) : base.footerEn,
  };
}

export const getReportLook = cache(async (): Promise<ReportLook> => {
  try {
    await ensureTable();
    const rows = await query<{ key: string; value: string }>(
      `select key, value from lab_settings where key = any($1)`, [["report_look", "report_signature", "report_stamp"]]
    );
    const get = (k: string) => rows.find((r) => r.key === k)?.value ?? "";
    let saved: Record<string, unknown> = {};
    try { saved = JSON.parse(get("report_look") || "{}"); } catch { /* the defaults */ }
    const img = (k: string) => { const x = get(k).trim(); return isLogoDataUrl(x) ? x : ""; };
    return { ...cleanLook(saved), signature: img("report_signature"), stamp: img("report_stamp") };
  } catch {
    return DEFAULT_LOOK; // printing must never fail over optional looks
  }
});

export async function saveReportLook(v: Partial<Record<keyof ReportLook, unknown>>): Promise<ReportLook> {
  const cur = await getReportLook();
  const next = cleanLook(v, cur);
  const { signature: _s, stamp: _t, ...store } = next;
  await ensureTable();
  await put("report_look", JSON.stringify(store));
  return next;
}

/** Set the signature or the stamp (an image data URL), or remove it with "". */
export async function saveReportImage(kind: "signature" | "stamp", dataUrl: string): Promise<boolean> {
  if (dataUrl && !isLogoDataUrl(dataUrl)) return false;
  await ensureTable();
  await put(kind === "signature" ? "report_signature" : "report_stamp", dataUrl);
  return true;
}
