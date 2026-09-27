"use client";

/**
 * Local, offline-first store for the standalone Lab Station. Everything lives in
 * this browser's storage (IndexedDB via lib/local/kv) — no database, no network. Designed for a single
 * machine (the lab-room computer). Each read/write is guarded so a private
 * window or blocked storage never throws.
 */

import { kvGet, kvSet, kvBytes, kvLarge, storageQuota } from "@/lib/local/kv";
import { clearOldDefault } from "@/lib/local/util";
import { DEFAULT_TESTS } from "./defaultTests";

export type Gender = "male" | "female" | "";

/** A test's fixed reference range — entered once in the catalog.
 *  `note` is an optional qualifier shown after the range (e.g. "Follicular Phase").
 *  `qual` = qualitative test whose normal is Negative: results like "+", "+++",
 *  "Positive" flag H; a numeric/titer result ≥ `cutoff` also flags H. */
export type NormalRange =
  | { kind: "none" }
  | { kind: "text"; text: string }
  | { kind: "qual"; text: string; cutoff?: number | null }
  | { kind: "numeric"; low: number | null; high: number | null; note?: string; ages?: AgeBand[] }
  | {
      kind: "sex";
      male: { low: number | null; high: number | null };
      female: { low: number | null; high: number | null };
      note?: string;
      ages?: AgeBand[];
    };

/** Optional age-specific range (e.g. children). `from` ≤ age < `to` (to = null → no upper
 *  limit), both in `unit`. When the patient's age falls in a band, it replaces the
 *  default range for both sexes. */
export type AgeUnit = "d" | "m" | "y";
export interface AgeBand { from: number; to: number | null; unit: AgeUnit; low: number | null; high: number | null }
export const AGE_UNIT_LABEL: Record<AgeUnit, string> = { d: "يوم", m: "شهر", y: "سنة" };
const DAYS: Record<AgeUnit, number> = { d: 1, m: 30.4375, y: 365.25 };

/** Patient age in days from the free-text age field: "35", "35 سنة", "6 أشهر", "10 أيام",
 *  "2 أسبوع", "6m", "10d". A bare number means years. null when it cannot be read. */
export function ageInDays(raw?: string): number | null {
  const s = (raw ?? "").trim().toLowerCase().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  const m = /^(\d+(?:[.,]\d+)?)\s*(.*)$/.exec(s);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  const u = m[2].trim();
  if (!u || /^(y|yr|yrs|year|years|سن|سنة|سنه|سنوات|سنين|عام|أعوام|اعوام)$/.test(u)) return n * DAYS.y;
  if (/^(m|mo|month|months|شهر|شهور|أشهر|اشهر)$/.test(u)) return n * DAYS.m;
  if (/^(w|wk|week|weeks|أسبوع|اسبوع|أسابيع|اسابيع)$/.test(u)) return n * 7;
  if (/^(d|day|days|يوم|أيام|ايام)$/.test(u)) return n;
  return null;
}
const bandLabel = (b: AgeBand) => `${b.from}${b.to != null ? `–${b.to}` : "+"} ${b.unit}`;

export interface StationTest {
  id: string;
  /** Stable key for built-in tests (used to add new defaults without duplicates). */
  code?: string;
  name_ar: string;
  name_en?: string;
  category?: string;
  sample_type?: string;
  unit?: string;
  normal: NormalRange;
}

export interface StationVisit {
  id: string;
  created_at: number;
  accession?: string;
  patientId?: string; // links to a saved patient record
  patient: { name: string; gender: Gender; age?: string; phone?: string };
  referrer?: string;
  results: { testId: string; name_ar: string; value: string; unit?: string }[];
  /** When the results were handed to the patient (Settings → «حالة التسليم»). */
  delivered_at?: number;
}

export interface NoteEntry { ts: number; text: string; }

/** A recurring patient — accumulates notes and links to their visits. */
export interface StationPatient {
  id: string;
  name: string;
  gender: Gender;
  age?: string;
  phone?: string;
  notes: NoteEntry[];
}

/** A referring doctor (managed list for the entry screen). */
export interface StationDoctor {
  id: string;
  name: string;
  clinic?: string;
}

/** A stock (reagent/kit) item; one unit is deducted per linked test ordered. */
export interface StockItem {
  id: string;
  name: string;
  qty: number;
  minQty?: number;
  expiry?: string; // YYYY-MM-DD
  linkedTestId?: string;
}

export interface StationPage {
  id: string;
  title: string;
  content: string;
}

/** A named group of tests selected together in one click (e.g. CBC panel). */
export interface StationPanel {
  id: string;
  name: string;
  testIds: string[];
}

const K_TESTS = "station.tests.v1";
const K_VISITS = "station.visits.v1";
const K_PAGES = "station.pages.v1";
const K_SETTINGS = "station.settings.v1";
const K_PANELS = "station.panels.v1";
const K_COUNTER = "station.counter.v1";
const K_PATIENTS = "station.patients.v1";
const K_STOCK = "station.stock.v1";
const K_DOCTORS = "station.doctors.v1";
const K_BACKUP_AT = "station.backupAt.v1";
/** Deleted visits and patients, kept 30 days (shared with the lab's other devices when synced). */
const K_TRASH = "station.trash.v1";
/** This device's letter in its sample numbers (kept on the device, never synced). */
const K_DEVICE_TAG = "station.deviceTag.v1";
const K_CATALOG_VER = "station.catalogVersion.v1";
/** One-time fix: the urine test's built-in range text became English ("Normal"). */
const K_FIX_GUE = "station.fixGueNormal.v1";
/** One-time addition of the structured-form tests (stool, semen, culture) to existing catalogs. */
const K_ADD_FORMS = "station.addFormTests.v1";
/** Bump when DEFAULT_TESTS gains tests, so existing installs receive them. */
const CATALOG_VERSION = 2;

export interface StationSettings {
  labName: string;
  labSubtitle: string;
  footer?: string; // address / phone line
  logo?: string; // data URL, or a static path like /lab-logo.png
  /** Show each test's previous result on the entry screen (default on). */
  showPrevious?: boolean;
  /** Also print the previous result on the report sheet (default off). */
  printPrevious?: boolean;
  /** Fold the test picker's category groups under their titles (default off). */
  collapseGroups?: boolean;
  /** Auto-calculate derived tests (LDL, VLDL, Globulin…) — off by default. */
  autoDerived?: boolean;
  /** Under autoDerived: eGFR by CKD-EPI 2021 — off by default. */
  derivedEgfr?: boolean;
  /** Under autoDerived: LDL by Sampson when TG 400–800 — off by default. */
  derivedSampson?: boolean;
  /** Tube label printing from the entry screen — off (and hidden) by default. */
  tubeLabel?: boolean;
  labelSize?: "50x25" | "60x30";
  labelCopies?: number;
  /** Report forms (see ./templates formOptionsOf): semen conclusion (on), semen auto-calculation (on),
   *  hide empty rows (off), culture: print tested antibiotics only (off), bold abnormal answers (on). */
  sfaDiagnosis?: boolean;
  /** QR code with the lab's details at the bottom of the report — on by default. */
  labQr?: boolean;
  /** The lab's website / map link. */
  labUrl?: string;
  /** Contact-card details carried by the report QR code (see ./labQr). */
  labPhone?: string;
  labAddress?: string;
  /** Lab logo in the middle of the QR code — on by default. */
  labQrLogo?: boolean;
  /** Printed captions next to the code (empty → defaults). */
  labQrTitle?: string;
  labQrHint?: string;
  /** Delivery status on saved visits — off by default. */
  deliveryStatus?: boolean;
  /** Year / month / day selector next to the age field — off by default. */
  ageUnit?: boolean;
  /** Form editor: extra answers that also count as normal — off by default. */
  formExtraNormals?: boolean;
  sfaAutoCalc?: boolean;
  formHideEmpty?: boolean;
  csTestedOnly?: boolean;
  formBoldAbnormal?: boolean;
  /** Signature and stamp on the report — off by default. Images from the project's library
   *  (public/lab-images), so they are the same on every device. */
  signatureOn?: boolean;
  signatureImage?: string;
  stampImage?: string;
  signatureName?: string;
  signatureTitle?: string;
  /** Look of the printed results table (see ./tableStyle). Missing → the default look. */
  reportTable?: Partial<import("./tableStyle").TableStyle>;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = kvGet(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
/** Returns false when the browser refused the write (storage full or blocked). */
function write<T>(key: string, value: T): boolean {
  try {
    return kvSet(key, JSON.stringify(value));
  } catch {
    return false;
  }
}

export function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// ── Tests ────────────────────────────────────────────────────────────────────
export function getTests(): StationTest[] {
  const t = read<StationTest[]>(K_TESTS, []);
  if (t.length === 0) {
    const seed = DEFAULT_TESTS().map(({ aliases: _a, legacy: _l, ...x }) => x);
    write(K_TESTS, seed);
    write(K_CATALOG_VER, CATALOG_VERSION);
    write(K_ADD_FORMS, true);
    return seed;
  }
  if (!read<boolean>(K_FIX_GUE, false)) {
    const fixed = t.map((x) => (x.code === "GUE" && x.normal.kind === "text" && x.normal.text === "طبيعي" ? { ...x, normal: { kind: "text" as const, text: "Normal" } } : x));
    write(K_TESTS, fixed);
    write(K_FIX_GUE, true);
    t.splice(0, t.length, ...fixed);
  }
  if (!read<boolean>(K_ADD_FORMS, false)) {
    const have = new Set(t.map((x) => x.code));
    const add = DEFAULT_TESTS().filter((d) => ["GSE", "SFA", "CS"].includes(d.code ?? "") && !have.has(d.code)).map(({ aliases: _a, legacy: _l, ...x }) => x);
    if (add.length) { t.push(...add); write(K_TESTS, t); }
    write(K_ADD_FORMS, true);
  }
  if (read<number>(K_CATALOG_VER, 1) < CATALOG_VERSION) {
    const merged = mergeDefaultTests(t);
    write(K_TESTS, merged);
    write(K_CATALOG_VER, CATALOG_VERSION);
    return merged;
  }
  return t;
}

/** Add built-in tests missing from an existing catalog, never touching the
 *  user's own edits. A built-in still carrying an old untouched default range
 *  is updated to the new reference value. */
function mergeDefaultTests(current: StationTest[]): StationTest[] {
  const norm = (x?: string) => (x ?? "").trim().toLowerCase();
  const out = [...current];
  for (const d of DEFAULT_TESTS()) {
    const { aliases = [], legacy, ...def } = d;
    const i = out.findIndex((t) =>
      (t.code && t.code === def.code) ||
      norm(t.name_ar) === norm(def.name_ar) ||
      aliases.some((a) => norm(a) === norm(t.name_ar)) ||
      (!!t.name_en && norm(t.name_en) === norm(def.name_en))
    );
    if (i === -1) { out.push(def); continue; }
    const t = out[i];
    const untouched = legacy && JSON.stringify(t.normal) === JSON.stringify(legacy);
    out[i] = { ...t, code: t.code ?? def.code, name_en: t.name_en ?? def.name_en, ...(untouched ? { normal: def.normal } : {}) };
  }
  return out;
}
export function saveTests(tests: StationTest[]): void {
  write(K_TESTS, tests);
}

// ── Restoring the defaults (Settings) ─────────────────────────────────────────
// Built-in tests are matched by their code and keep their ids, so saved visits and previous
// results still point to them.
const defaultTests = () => DEFAULT_TESTS().map(({ aliases: _a, legacy: _l, ...x }) => x);
/** The built-in tests back to their default names, units and ranges; the lab's own tests stay,
 *  and built-ins that were deleted come back. Returns how many were reset or added. */
export function resetBuiltinTests(): number {
  const defs = defaultTests();
  const byCode = new Map(defs.map((d) => [d.code, d]));
  const cur = getTests();
  const seen = new Set<string>();
  const out = cur.map((t) => {
    const d = t.code ? byCode.get(t.code) : undefined;
    if (!d) return t;
    seen.add(d.code!);
    return { ...d, id: t.id };
  });
  const added = defs.filter((d) => !seen.has(d.code!));
  write(K_TESTS, [...out, ...added]);
  return seen.size + added.length;
}
/** The whole default list, as on a new installation: the lab's own tests are removed. */
export function restoreDefaultTests(): number {
  const ids = new Map(getTests().filter((t) => t.code).map((t) => [t.code!, t.id]));
  const list = defaultTests().map((d) => ({ ...d, id: ids.get(d.code!) ?? d.id }));
  write(K_TESTS, list);
  write(K_CATALOG_VER, CATALOG_VERSION);
  write(K_ADD_FORMS, true);
  write(K_FIX_GUE, true);
  return list.length;
}

// ── Visits ───────────────────────────────────────────────────────────────────
export function getVisits(): StationVisit[] {
  return read<StationVisit[]>(K_VISITS, []);
}
/** Returns false if the visit could not be stored (browser storage full). */
export function addVisit(v: StationVisit): boolean {
  // No cap — local storage stays open and growable (backed up as a file).
  return write(K_VISITS, [v, ...getVisits()]);
}
export function saveVisitsRaw(visits: StationVisit[]): void {
  write(K_VISITS, visits);
}
export function getVisit(id: string): StationVisit | null {
  return getVisits().find((v) => v.id === id) ?? null;
}
/** Replace an existing visit (used when re-saving after an edit). */
export function updateVisit(v: StationVisit): boolean {
  // An edit from the entry screen keeps the delivery mark.
  return write(K_VISITS, getVisits().map((x) => (x.id === v.id ? { ...v, ...(x.delivered_at && !v.delivered_at ? { delivered_at: x.delivered_at } : {}) } : x)));
}
/** Mark visits as handed to the patient (or back to not delivered). */
export function setDelivered(ids: string[], delivered: boolean): boolean {
  const set = new Set(ids);
  const at = Date.now();
  return write(K_VISITS, getVisits().map((v) => {
    if (!set.has(v.id)) return v;
    const { delivered_at: _d, ...rest } = v;
    return delivered ? { ...rest, delivered_at: v.delivered_at ?? at } : rest;
  }));
}
/** Delete = move to the recycle bin (restorable for 30 days). */
export function deleteVisits(ids: string[]): void {
  const set = new Set(ids);
  const all = getVisits();
  toTrash(all.filter((v) => set.has(v.id)).map((item) => ({ kind: "visit" as const, item })));
  write(K_VISITS, all.filter((v) => !set.has(v.id)));
}

// ── Recycle bin («سلة المحذوفات») ─────────────────────────────────────────────
export const TRASH_DAYS = 30;
export type TrashItem =
  | { id: string; kind: "visit"; deleted_at: number; item: StationVisit }
  | { id: string; kind: "patient"; deleted_at: number; item: StationPatient };
function toTrash(items: ({ kind: "visit"; item: StationVisit } | { kind: "patient"; item: StationPatient })[]) {
  if (!items.length) return;
  const at = Date.now();
  const added = items.map((x) => ({ ...x, id: x.item.id, deleted_at: at }) as TrashItem);
  const ids = new Set(added.map((x) => x.id));
  write(K_TRASH, [...added, ...getTrash().filter((x) => !ids.has(x.id))]);
}
/** What is in the bin (newest first); anything older than 30 days is removed for good. */
export function getTrash(): TrashItem[] {
  const all = read<TrashItem[]>(K_TRASH, []);
  const limit = Date.now() - TRASH_DAYS * 86_400_000;
  const kept = all.filter((x) => x && x.deleted_at > limit);
  if (kept.length !== all.length) write(K_TRASH, kept);
  return kept.sort((a, b) => b.deleted_at - a.deleted_at);
}
/** Put items back where they were (visits in date order); what is back leaves the bin. */
export function restoreTrash(ids: string[]): number {
  const set = new Set(ids);
  const bin = getTrash();
  const back = bin.filter((x) => set.has(x.id));
  const visits = back.filter((x) => x.kind === "visit").map((x) => x.item as StationVisit);
  const patients = back.filter((x) => x.kind === "patient").map((x) => x.item as StationPatient);
  if (visits.length) {
    const have = new Set(getVisits().map((v) => v.id));
    write(K_VISITS, [...getVisits(), ...visits.filter((v) => !have.has(v.id))].sort((a, b) => b.created_at - a.created_at));
  }
  if (patients.length) {
    const have = new Set(getPatients().map((p) => p.id));
    savePatients([...patients.filter((p) => !have.has(p.id)), ...getPatients()]);
  }
  write(K_TRASH, bin.filter((x) => !set.has(x.id)));
  return back.length;
}
/** Delete for good (from the bin). */
export function purgeTrash(ids?: string[]): void {
  if (!ids) { write(K_TRASH, []); return; }
  const set = new Set(ids);
  write(K_TRASH, getTrash().filter((x) => !set.has(x.id)));
}

// ── Custom pages ─────────────────────────────────────────────────────────────
export function getPages(): StationPage[] {
  return read<StationPage[]>(K_PAGES, []);
}
export function savePages(pages: StationPage[]): void {
  write(K_PAGES, pages);
}

// ── Settings ─────────────────────────────────────────────────────────────────
export function getSettings(): StationSettings {
  const s = read<StationSettings>(K_SETTINGS, {
    labName: "مختبر التحليلات المرضية",
    labSubtitle: "",
    footer: "",
    logo: "/lab-logo.png",
  });
  // Subtitle and address/phone are entered by the lab in Settings (no built-in text).
  return { ...s, labSubtitle: clearOldDefault(s.labSubtitle) ?? "", footer: clearOldDefault(s.footer) };
}
export function saveSettings(s: StationSettings): void {
  write(K_SETTINGS, s);
}

// ── Backup reminder (track when the last export happened) ────────────────────
export function getLastBackup(): number | null {
  return read<number | null>(K_BACKUP_AT, null);
}
export function markBackupNow(): void {
  write(K_BACKUP_AT, Date.now());
}
/** Whole days since the last backup, or null if never backed up. */
export function daysSinceBackup(): number | null {
  const t = getLastBackup();
  if (!t) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

/** A patient's most recent earlier result per test.
 *  Matches visits by patientId, or by name+phone (same key the patient
 *  records use — also covers visits saved before patient records existed). `before` limits to visits older than that time
 *  (used when editing/reprinting an existing visit). */
export interface PrevResult { value: string; at: number }
export function previousResults(
  who: { patientId?: string | null; name: string; phone?: string },
  opts: { before?: number; excludeId?: string | null } = {},
): Record<string, PrevResult> {
  const key = who.name.trim().toLowerCase() + "|" + (who.phone ?? "").trim();
  const out: Record<string, PrevResult> = {};
  if (!who.patientId && !who.name.trim()) return out;
  const mine = getVisits()
    .filter((v) => v.id !== opts.excludeId && (opts.before == null || v.created_at < opts.before))
    .filter((v) =>
      (who.patientId && v.patientId === who.patientId) ||
      v.patient.name.trim().toLowerCase() + "|" + (v.patient.phone ?? "").trim() === key
    )
    .sort((a, b) => b.created_at - a.created_at);
  for (const v of mine) {
    for (const r of v.results) {
      if (!out[r.testId] && r.value.trim()) out[r.testId] = { value: r.value.trim(), at: v.created_at };
    }
  }
  return out;
}

/** Numeric change from previous to current, or null if either isn't a number. */
export function resultDelta(current: string, previous: string): number | null {
  const a = Number(current.trim()), b = Number(previous.trim());
  if (!current.trim() || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((a - b) * 100) / 100;
}

export interface StorageUsage { bytes: number; pct: number; visits: number; used: number; quota: number; large: boolean }
/** Space this station uses, and how full the browser's allowance for this site is (percent).
 *  In IndexedDB the allowance is the browser's quota; still on localStorage it is ~5 MB. */
export async function storageUsage(): Promise<StorageUsage> {
  const bytes = kvBytes("station.");
  const visits = getVisits().length;
  const q = kvLarge() ? await storageQuota() : null;
  const used = q ? q.usage : kvBytes(""), quota = q ? q.quota : 5 * 1024 * 1024;
  return { bytes, visits, used, quota, large: kvLarge(), pct: Math.min(100, Math.round((used / quota) * 1000) / 10) };
}

/** Ask the browser to keep this origin's storage permanently, so it is never
 *  evicted automatically under disk pressure. Resolves to the current state
 *  (true = persistent). Unsupported browsers resolve false. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

// ── Panels ───────────────────────────────────────────────────────────────────
export function getPanels(): StationPanel[] {
  return read<StationPanel[]>(K_PANELS, []);
}
export function savePanels(panels: StationPanel[]): void {
  write(K_PANELS, panels);
}

// ── Patients (recurring visitors + notes history) ────────────────────────────
export function getPatients(): StationPatient[] {
  return read<StationPatient[]>(K_PATIENTS, []);
}
export function savePatients(list: StationPatient[]): void {
  write(K_PATIENTS, list);
}
export function getPatient(id: string): StationPatient | null {
  return getPatients().find((p) => p.id === id) ?? null;
}
const pkey = (name: string, phone?: string) =>
  `${name.trim().toLowerCase()}|${(phone ?? "").trim()}`;

/** Find or create the patient record matching this visit's identity, updating
 *  basic fields. Returns the patient id. */
export function upsertPatient(fields: { id?: string; name: string; gender: Gender; age?: string; phone?: string }): string {
  const list = getPatients();
  let p = fields.id ? list.find((x) => x.id === fields.id) : undefined;
  if (!p) p = list.find((x) => pkey(x.name, x.phone) === pkey(fields.name, fields.phone));
  if (p) {
    p.name = fields.name; p.gender = fields.gender; p.age = fields.age; p.phone = fields.phone;
    savePatients(list);
    return p.id;
  }
  const np: StationPatient = { id: uid(), name: fields.name, gender: fields.gender, age: fields.age, phone: fields.phone, notes: [] };
  savePatients([np, ...list]);
  return np.id;
}
export function addPatientNote(patientId: string, text: string): void {
  const t = text.trim();
  if (!t) return;
  savePatients(getPatients().map((p) => (p.id === patientId ? { ...p, notes: [{ ts: Date.now(), text: t }, ...p.notes] } : p)));
}
/** Delete = move to the recycle bin (restorable for 30 days). */
export function deletePatients(ids: string[]): void {
  const set = new Set(ids);
  const all = getPatients();
  toTrash(all.filter((p) => set.has(p.id)).map((item) => ({ kind: "patient" as const, item })));
  savePatients(all.filter((p) => !set.has(p.id)));
}

// ── Referring doctors ────────────────────────────────────────────────────────
export function getDoctors(): StationDoctor[] {
  return read<StationDoctor[]>(K_DOCTORS, []);
}
export function saveDoctors(list: StationDoctor[]): void {
  write(K_DOCTORS, list);
}
/** Add a doctor (deduping by name); returns the doctor. */
export function addDoctor(name: string, clinic?: string): StationDoctor {
  const list = getDoctors();
  const found = list.find((d) => d.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (found) return found;
  const d: StationDoctor = { id: uid(), name: name.trim(), clinic: clinic?.trim() || undefined };
  saveDoctors([...list, d]);
  return d;
}

// ── Stock room (reagents/kits) ───────────────────────────────────────────────
export function getStock(): StockItem[] {
  return read<StockItem[]>(K_STOCK, []);
}
export function saveStock(list: StockItem[]): void {
  write(K_STOCK, list);
}
/** Deduct one unit from each stock item linked to one of these tests. */
export function deductStockForTests(testIds: string[]): void {
  if (testIds.length === 0) return;
  const set = new Set(testIds);
  const next = getStock().map((s) =>
    s.linkedTestId && set.has(s.linkedTestId) ? { ...s, qty: Math.max(0, Number(s.qty) - 1) } : s
  );
  saveStock(next);
}
/** Clear the link on any stock item that pointed at a now-deleted test. */
export function unlinkTestFromStock(testId: string): void {
  const list = getStock();
  if (!list.some((s) => s.linkedTestId === testId)) return;
  saveStock(list.map((s) => (s.linkedTestId === testId ? { ...s, linkedTestId: undefined } : s)));
}
/** Calendar days until expiry (0 = expires today, negative = expired), or null when no expiry set. */
export function daysToExpiry(expiry?: string): number | null {
  if (!expiry) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((new Date(expiry + "T00:00:00").getTime() - today) / 86400000);
}

/** Local calendar date YYYY-MM-DD (not UTC — avoids yesterday's date after midnight). */
export function localYmd(ms: number = Date.now()): string {
  return new Date(ms).toLocaleDateString("en-CA");
}

// ── Sample-number counter (LAB-YYYYMMDD-NNN, or LAB-YYYYMMDD-A001 with a device letter) ──
/** One or two letters/digits for this device (empty: none). With several devices working
 *  without internet at the same time, each its own letter keeps their numbers apart. */
export function getDeviceTag(): string {
  const t = read<string>(K_DEVICE_TAG, "");
  return typeof t === "string" && /^[A-Z0-9]{1,2}$/.test(t) ? t : "";
}
export function setDeviceTag(tag: string): void {
  const t = tag.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 2);
  write(K_DEVICE_TAG, t);
}
export function nextAccession(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const tag = getDeviceTag();
  const c = read<{ day: string; n: number; tag?: string }>(K_COUNTER, { day: "", n: 0 });
  // The counter is this device's; with the lab's devices synced, today's visits from the others
  // count too, so a number already given elsewhere is not handed out again.
  const prefix = `LAB-${ymd}-${tag}`;
  const seen = getVisits().reduce((m, v) => {
    const rest = v.accession?.startsWith(prefix) ? v.accession.slice(prefix.length) : "";
    return /^\d+$/.test(rest) ? Math.max(m, Number(rest)) : m;
  }, 0);
  const n = Math.max(c.day === ymd && (c.tag ?? "") === tag ? c.n : 0, seen) + 1;
  write(K_COUNTER, { day: ymd, n, tag });
  return `${prefix}${String(n).padStart(3, "0")}`;
}

// ── Backup: export / import the whole station ────────────────────────────────
export interface StationBackup {
  app: "spir-lab-station";
  version: 1;
  exported_at: string;
  tests: StationTest[];
  visits: StationVisit[];
  pages: StationPage[];
  panels: StationPanel[];
  settings: StationSettings;
  patients?: StationPatient[];
  stock?: StockItem[];
  doctors?: StationDoctor[];
  /** The lab's own edits of the report forms (Tests management → «الاستمارة»). */
  forms?: unknown;
}
const K_FORMS = "station.formTemplates.v1";

export function exportBackup(): StationBackup {
  return {
    app: "spir-lab-station",
    version: 1,
    exported_at: new Date().toISOString(),
    tests: getTests(),
    visits: getVisits(),
    pages: getPages(),
    panels: getPanels(),
    settings: getSettings(),
    patients: getPatients(),
    stock: getStock(),
    doctors: getDoctors(),
    forms: read<unknown>(K_FORMS, null) ?? undefined,
  };
}

/** Restore a backup. Returns true on success. Replaces current data. */
export function importBackup(data: unknown): boolean {
  try {
    const b = data as Partial<StationBackup>;
    if (!b || b.app !== "spir-lab-station" || !Array.isArray(b.tests)) return false;
    let ok = write(K_TESTS, b.tests);
    if (b.visits) ok = write(K_VISITS, b.visits) && ok;
    if (b.pages) ok = write(K_PAGES, b.pages) && ok;
    if (b.panels) ok = write(K_PANELS, b.panels) && ok;
    if (b.settings) ok = write(K_SETTINGS, b.settings) && ok;
    if (b.patients) ok = write(K_PATIENTS, b.patients) && ok;
    if (b.stock) ok = write(K_STOCK, b.stock) && ok;
    if (b.doctors) ok = write(K_DOCTORS, b.doctors) && ok;
    if (b.forms && typeof b.forms === "object") ok = write(K_FORMS, b.forms) && ok;
    return ok;
  } catch {
    return false;
  }
}

// ── Reference-range resolution + flagging ────────────────────────────────────
export interface ResolvedRange {
  low: number | null;
  high: number | null;
  text: string | null;
}

/** The age band that applies to this patient, if any. */
export function ageBandFor(n: NormalRange, age?: string): AgeBand | null {
  if ((n.kind !== "numeric" && n.kind !== "sex") || !n.ages?.length) return null;
  const days = ageInDays(age);
  if (days == null) return null;
  return n.ages.find((b) => days >= b.from * DAYS[b.unit] && (b.to == null || days < b.to * DAYS[b.unit])) ?? null;
}

/** Resolve a test's reference range for a patient of a given sex (and age, when the
 *  test has age-specific ranges). */
export function resolveRange(n: NormalRange, gender: Gender, age?: string): ResolvedRange {
  const band = ageBandFor(n, age);
  if (band) return { low: band.low, high: band.high, text: null };
  if (n.kind === "numeric") return { low: n.low, high: n.high, text: null };
  if (n.kind === "text" || n.kind === "qual") return { low: null, high: null, text: n.text };
  if (n.kind === "sex") {
    const r = gender === "female" ? n.female : n.male; // default to male range
    return { low: r.low, high: r.high, text: null };
  }
  return { low: null, high: null, text: null };
}

export function rangeLabel(n: NormalRange, gender: Gender, unit?: string, age?: string): string {
  const r = resolveRange(n, gender, age);
  if (r.text) return r.text;
  if (r.low == null && r.high == null) return "—";
  const u = unit ? ` ${unit}` : "";
  const band = ageBandFor(n, age);
  const note = band ? ` (${bandLabel(band)})` : (n.kind === "numeric" || n.kind === "sex") && n.note ? ` (${n.note})` : "";
  const body =
    r.low != null && r.high != null ? `${r.low} – ${r.high}`
    : r.high != null ? `< ${r.high}`
    : `> ${r.low}`;
  return `${body}${u}${note}`;
}

// Qualitative result words (English / Arabic) — matched case-insensitively.
const NEG_RE = /^(neg(ative)?|-ve|nil|non[\s-]?reactive|not\s+detected|absent|normal|-|—|سالب|سلبي|لا يوجد|غير موجود|طبيعي)$/i;
const POS_RE = /^(\+{1,4}|[1-4]\s*\+|\+ve|pos(itive)?|reactive|detected|present|trace|موجب|ايجابي|إيجابي|آثار)$/i;

/** Classify a free-text result: "pos" (+, +++, Positive…), "neg" (Negative, Nil…) or null. */
export function qualitativeOf(value: string): "pos" | "neg" | null {
  const v = value.trim();
  if (POS_RE.test(v)) return "pos";
  if (NEG_RE.test(v)) return "neg";
  return null;
}

/** Number from a plain number or a titer like "1:160" (→ 160). */
function numberOrTiter(value: string): number | null {
  const v = value.trim();
  const t = /^1\s*[:/]\s*(\d+(?:\.\d+)?)$/.exec(v);
  if (t) return Number(t[1]);
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** H / L / N flag for a result vs the (sex-resolved) range.
 *  Understands "+", "++", "+++", "Positive" / "Negative" and titers. */
export function flagFor(value: string, n: NormalRange, gender: Gender, age?: string): "H" | "L" | "N" | null {
  if (value == null || String(value).trim() === "") return null;
  if (n.kind === "none") return null;
  const q = qualitativeOf(String(value));
  if (q === "pos") return "H"; // + … ++++ / Positive is always abnormal
  if (n.kind === "qual" || n.kind === "text") {
    if (q === "neg") return "N";
    if (n.kind === "qual" && n.cutoff != null) {
      const v = numberOrTiter(String(value));
      if (v != null) return v >= n.cutoff ? "H" : "N";
    }
    return null;
  }
  const v = Number(value);
  if (Number.isNaN(v)) return null;
  const r = resolveRange(n, gender, age);
  if (r.low == null && r.high == null) return null;
  if (r.low != null && v < r.low) return "L";
  if (r.high != null && v > r.high) return "H";
  return "N";
}


// ── Age with a unit (Settings → «وحدة العمر») ─────────────────────────────────
export type AgeUnitPick = "y" | "m" | "d";
/** Split a stored age ("35", "6 أشهر", "10 أيام") into number + unit. */
export function splitAge(age?: string): { n: string; unit: AgeUnitPick } {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*(.*)$/.exec(age ?? "");
  if (!m) return { n: (age ?? "").trim(), unit: "y" };
  const days = ageInDays(age);
  const n = Number(m[1].replace(",", "."));
  const unit: AgeUnitPick = days == null || !m[2].trim() ? "y" : Math.abs(days - n) < 1e-9 ? "d" : Math.abs(days - n * DAYS.m) < 1e-6 ? "m" : "y";
  return { n: m[1], unit };
}
/** Age text saved and printed: years stay a plain number; months / days carry an Arabic unit the age bands understand. */
export function joinAge(n: string, unit: AgeUnitPick): string {
  const t = n.trim();
  if (!t || unit === "y") return t;
  const k = Number(t.replace(",", "."));
  const few = k >= 3 && k <= 10;
  return unit === "m" ? `${t} ${few ? "أشهر" : "شهر"}` : `${t} ${few ? "أيام" : "يوم"}`;
}

/** A link typed by the lab, made openable ("lab.com" → "https://lab.com"). Empty when it isn't a link. */
export function normalizeUrl(raw?: string): string {
  const t = (raw ?? "").trim();
  if (!t || /\s/.test(t)) return "";
  const u = /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`;
  try { const x = new URL(u); return x.hostname.includes(".") ? x.toString() : ""; } catch { return ""; }
}
