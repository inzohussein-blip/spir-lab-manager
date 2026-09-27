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
