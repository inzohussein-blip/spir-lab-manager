"use client";

/**
 * Local, offline-first store for the standalone Lab Station. Everything lives in
 * this browser's localStorage — no database, no network. Designed for a single
 * machine (the lab-room computer). Each read/write is guarded so a private
 * window or blocked storage never throws.
 */

import { clearOldDefault } from "@/lib/local/util";

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
const K_CATALOG_VER = "station.catalogVersion.v1";
/** One-time fix: the urine test's built-in range text became English ("Normal"). */
const K_FIX_GUE = "station.fixGueNormal.v1";
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
  /** Look of the printed results table (see ./tableStyle). Missing → the default look. */
  reportTable?: Partial<import("./tableStyle").TableStyle>;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
/** Returns false when the browser refused the write (storage full or blocked). */
function write<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
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
    return seed;
  }
  if (!read<boolean>(K_FIX_GUE, false)) {
    const fixed = t.map((x) => (x.code === "GUE" && x.normal.kind === "text" && x.normal.text === "طبيعي" ? { ...x, normal: { kind: "text" as const, text: "Normal" } } : x));
    write(K_TESTS, fixed);
    write(K_FIX_GUE, true);
    t.splice(0, t.length, ...fixed);
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
  return write(K_VISITS, getVisits().map((x) => (x.id === v.id ? v : x)));
}
export function deleteVisits(ids: string[]): void {
  const set = new Set(ids);
  write(K_VISITS, getVisits().filter((v) => !set.has(v.id)));
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

/** Approximate size (bytes) this station uses in localStorage, and a rough
 *  percentage of the typical ~5MB per-origin browser budget. */
export function storageUsage(): { bytes: number; pct: number; visits: number } {
  let bytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith("station.")) continue;
      const v = localStorage.getItem(k) ?? "";
      bytes += (k.length + v.length) * 2; // UTF-16 ≈ 2 bytes/char
    }
  } catch { /* ignore */ }
  const BUDGET = 5 * 1024 * 1024;
  return { bytes, pct: Math.min(100, Math.round((bytes / BUDGET) * 100)), visits: getVisits().length };
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
export function deletePatients(ids: string[]): void {
  const set = new Set(ids);
  savePatients(getPatients().filter((p) => !set.has(p.id)));
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

// ── Sample-number counter (LAB-YYYYMMDD-NNN) ─────────────────────────────────
export function nextAccession(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const c = read<{ day: string; n: number }>(K_COUNTER, { day: "", n: 0 });
  const n = c.day === ymd ? c.n + 1 : 1;
  write(K_COUNTER, { day: ymd, n });
  return `LAB-${ymd}-${String(n).padStart(3, "0")}`;
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
}

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

// ── Default catalog — includes sex-specific and qualitative ranges ───────────
type DefaultTest = StationTest & {
  /** Older built-in names this entry replaces (avoids duplicates on merge). */
  aliases?: string[];
  /** Previous built-in range — replaced only if the user never edited it. */
  legacy?: NormalRange;
};

function DEFAULT_TESTS(): DefaultTest[] {
  const num = (low: number | null, high: number | null, note?: string): NormalRange =>
    note ? { kind: "numeric", low, high, note } : { kind: "numeric", low, high };
  const sex = (m: [number | null, number | null], f: [number | null, number | null], note?: string): NormalRange => ({
    kind: "sex", male: { low: m[0], high: m[1] }, female: { low: f[0], high: f[1] }, ...(note ? { note } : {}),
  });
  const neg = (text = "Negative", cutoff?: number): NormalRange =>
    cutoff != null ? { kind: "qual", text, cutoff } : { kind: "qual", text };

  let cat = "";
  let sample = "دم";
  const list: DefaultTest[] = [];
  const add = (code: string, name_ar: string, name_en: string, unit: string, normal: NormalRange, extra: Partial<DefaultTest> = {}) =>
    list.push({ id: uid(), code, name_ar, name_en, category: cat, sample_type: extra.sample_type ?? sample, unit, normal, ...extra });

  cat = "أمراض الدم";
  add("HB", "الهيموغلوبين (Hb)", "Hemoglobin", "g/dL", sex([13, 17], [12, 15]));
  add("HCT", "الهيماتوكريت (HCT)", "Hematocrit", "%", sex([40, 54], [36, 48]));
  add("WBC", "كريات الدم البيضاء (WBC)", "White Blood Cells", "10^3/µL", num(4, 11));
  add("PLT", "الصفائح الدموية (PLT)", "Platelets", "10^3/µL", num(150, 450));

  cat = "وظائف الكلى";
  add("UREA", "اليوريا (Urea)", "Urea", "mg/dL", num(15, 45));
  add("CREA", "الكرياتينين (Creatinine)", "Creatinine", "mg/dL", num(0.6, 1.2, "Adults"), {
    aliases: ["الكرياتينين"], legacy: sex([0.7, 1.3], [0.6, 1.1]),
  });
  add("UA", "حمض اليوريك (Uric Acid)", "Uric Acid", "mg/dL", sex([3.4, 7.0], [2.4, 6.0]));
  add("BUN", "نيتروجين يوريا الدم (BUN)", "Blood Urea Nitrogen", "mg/dL", num(7, 20));
  add("EGFR", "معدل الترشيح الكبيبي (eGFR)", "Estimated GFR", "mL/min/1.73m²", num(90, null));
  add("NA", "الصوديوم (Na+)", "Sodium", "mEq/L", num(135, 145));
  add("K", "البوتاسيوم (K+)", "Potassium", "mEq/L", num(3.5, 5.1));
  add("CL", "الكلورايد (Cl-)", "Chloride", "mEq/L", num(96, 106));

  cat = "وظائف الكبد";
  add("ALT", "إنزيم ALT (SGPT)", "ALT (SGPT)", "U/L", sex([null, 41], [null, 33]));
  add("AST", "إنزيم AST (SGOT)", "AST (SGOT)", "U/L", num(null, 40));
  add("ALP", "الفوسفاتيز القلوي (ALP)", "Alkaline Phosphatase", "U/L", num(40, 129, "Adults"));
  add("TSB", "البيليروبين الكلي (TSB)", "Total Bilirubin", "mg/dL", num(0.2, 1.2));
  add("DBIL", "البيليروبين المباشر (Direct)", "Direct Bilirubin", "mg/dL", num(0.0, 0.3));
  add("IBIL", "البيليروبين غير المباشر (Indirect)", "Indirect Bilirubin", "mg/dL", num(0.2, 0.8));
  add("GGT", "إنزيم GGT", "Gamma-Glutamyl Transferase", "U/L", sex([8, 61], [5, 36]));
  add("TP", "البروتين الكلي (Total Protein)", "Total Protein", "g/dL", num(6.0, 8.3));
  add("ALB", "الألبومين (Albumin)", "Albumin", "g/dL", num(3.5, 5.2));
  add("GLOB", "الغلوبيولين (Globulin)", "Globulin", "g/dL", num(2.0, 3.5));

  cat = "السكري";
  add("FBS", "سكر صائم (FBS)", "Fasting Blood Sugar", "mg/dL", num(70, 99), { legacy: num(70, 110) });
  add("RBS", "سكر عشوائي (RBS)", "Random Blood Sugar", "mg/dL", num(70, 140));
  add("PPG2", "سكر بعد الأكل بساعتين (2h PPG)", "2-Hour Postprandial Glucose", "mg/dL", num(null, 140));
  add("HBA1C", "السكر التراكمي (HbA1c)", "Glycated Hemoglobin", "%", num(null, 5.7, "5.7 – 6.4 Prediabetes"));
  add("INS", "الأنسولين الصائم (Insulin)", "Fasting Insulin", "µIU/mL", num(2.6, 24.9));
  add("HOMA", "مقاومة الأنسولين (HOMA-IR)", "HOMA-IR", "", num(null, 1.9, "Optimal"));
  add("GTT", "اختبار تحمّل السكر (GTT)", "Glucose Tolerance Test", "mg/dL",
    { kind: "text", text: "Fasting < 95, 1h < 180, 2h < 155, 3h < 140 mg/dL" });

  cat = "الدهون";
  add("CHOL", "الكوليسترول الكلي (Cholesterol)", "Total Cholesterol", "mg/dL", num(null, 200));
  add("TG", "الدهون الثلاثية (TG)", "Triglycerides", "mg/dL", num(null, 150));
  add("HDL", "الكوليسترول الجيد (HDL)", "HDL Cholesterol", "mg/dL", sex([40, null], [50, null]));
  add("LDL", "الكوليسترول الضار (LDL)", "LDL Cholesterol", "mg/dL", num(null, 100));
  add("VLDL", "الكوليسترول (VLDL)", "VLDL", "mg/dL", num(5, 40));

  cat = "الهرمونات";
  add("TSH", "هرمون TSH", "Thyroid Stimulating Hormone", "µIU/mL", num(0.27, 4.2));
  add("TT3", "T3 الكلي (Total T3)", "Total T3", "ng/mL", num(0.8, 2.0));
  add("TT4", "T4 الكلي (Total T4)", "Total T4", "µg/dL", num(5.1, 14.1));
  add("FT3", "T3 الحر (FT3)", "Free T3", "pg/mL", num(2.0, 4.4));
  add("FT4", "T4 الحر (FT4)", "Free T4", "ng/dL", num(0.93, 1.7));
  add("FSH", "هرمون FSH", "Follicle-Stimulating Hormone", "mIU/mL", num(1.5, 12.4, "Follicular Phase"));
  add("LH", "هرمون LH", "Luteinizing Hormone", "mIU/mL", num(2.4, 12.6, "Follicular Phase"));
  add("PRL", "هرمون الحليب (Prolactin)", "Prolactin", "ng/mL", sex([4.0, 15.2], [4.0, 23.3], "Female: non-pregnant"));
  add("TESTO", "التستوستيرون الكلي (Total Testosterone)", "Total Testosterone", "ng/dL", sex([240, 870], [15, 70]));
  add("FTESTO", "التستوستيرون الحر (Free Testosterone)", "Free Testosterone", "pg/mL", sex([4.5, 25.0], [null, null]));
  add("BHCG", "هرمون الحمل الكمي (β-HCG)", "Beta-HCG (Quantitative)", "mIU/mL", neg("Negative (< 5 mIU/mL)", 5));
  add("HCGB", "هرمون الحمل في الدم (نوعي)", "HCG in Blood (Qualitative)", "", neg());
  add("HCGU", "هرمون الحمل في الإدرار", "HCG in Urine", "", neg(), { sample_type: "إدرار" });
  add("AMH", "هرمون AMH", "Anti-Müllerian Hormone", "ng/mL", num(1.0, 4.0));
  add("PROG", "البروجستيرون (Progesterone)", "Progesterone", "ng/mL", num(1.8, 24.0, "Luteal Phase"));
  add("E2", "الإستراديول (E2)", "Estradiol", "pg/mL", num(12.5, 166.0, "Follicular Phase"));
  add("CORT", "الكورتيزول الصباحي (Cortisol AM)", "Cortisol (AM)", "nmol/L", num(77, 317, "6.2 – 19.4 µg/dL"));

  cat = "الفيتامينات والحديد";
  add("VITD", "فيتامين D3 (25-OH)", "Vitamin D3 (25-OH Vitamin D)", "ng/mL", num(30, 100, "Sufficient"));
  add("B12", "فيتامين B12", "Vitamin B12", "pg/mL", num(211, 911));
  add("FERR", "مخزون الحديد (Ferritin)", "Serum Ferritin", "ng/mL", sex([30, 400], [13, 150]));
  add("FE", "الحديد في الدم (Serum Iron)", "Serum Iron", "µg/dL", sex([65, 175], [50, 170]));
  add("TIBC", "سعة ربط الحديد (TIBC)", "Total Iron Binding Capacity", "µg/dL", num(250, 450));
  add("ZN", "الزنك (Zinc)", "Zinc (Serum)", "µg/dL", num(70, 120));
  add("FOL", "حمض الفوليك (Folic Acid)", "Folic Acid (Vitamin B9)", "ng/mL", num(4.6, 18.7));

  cat = "العظام والمعادن";
  add("CA", "الكالسيوم الكلي (Total Ca)", "Total Calcium", "mg/dL", num(8.6, 10.2));
  add("ICA", "الكالسيوم المتأيّن (Ionized Ca)", "Ionized Calcium", "mg/dL", num(4.5, 5.6));
  add("PHOS", "الفسفور (Phosphorus)", "Inorganic Phosphorus", "mg/dL", num(2.5, 4.5));
  add("MG", "المغنيسيوم (Mg)", "Magnesium", "mg/dL", num(1.7, 2.2));
  add("PTH", "هرمون الجار درقية (PTH)", "Parathyroid Hormone", "pg/mL", num(15, 65));

  cat = "المصليات والمناعة";
  add("CRP", "البروتين التفاعلي (CRP)", "C-Reactive Protein", "mg/L", neg("Negative (< 6 mg/L)", 6));
  add("RF", "عامل الروماتيزم (RF)", "Rheumatoid Factor", "IU/mL", neg("Negative (< 8 IU/mL)", 8));
  add("ASO", "أضداد الستربتوليسين (ASO)", "Anti-Streptolysin O", "IU/mL", neg("Negative (< 200 IU/mL)", 200));
  add("ROSE", "الحمى المالطية (Rose Bengal)", "Rose Bengal (Brucella)", "", neg());
  add("WIDAL", "فحص التيفوئيد (Widal)", "Widal Test", "", neg("Negative (< 1:80)", 80));
  add("HPAG", "جرثومة المعدة - مستضد (H. Pylori Ag)", "H. Pylori Antigen (Stool)", "", neg(), { sample_type: "براز" });
  add("HPAB", "جرثومة المعدة - أضداد (H. Pylori Ab)", "H. Pylori Antibody (IgG / IgM)", "", neg());
  add("ANA", "الأضداد النووية (ANA)", "Antinuclear Antibodies", "", neg("Negative (< 1:40)", 40));
  add("DSDNA", "أضداد Anti-dsDNA", "Anti-dsDNA", "IU/mL", neg("Negative (< 10 IU/mL)", 10));

  cat = "حساسية الحنطة";
  add("TTGA", "أضداد tTG-IgA", "Anti-Tissue Transglutaminase IgA", "U/mL", neg("Negative (< 10 U/mL)", 10));
  add("TTGG", "أضداد tTG-IgG", "Anti-Tissue Transglutaminase IgG", "U/mL", neg("Negative (< 10 U/mL)", 10));
  add("AGA", "أضداد الغليادين (IgA / IgG)", "Anti-Gliadin Antibodies", "U/mL", neg("Negative (< 12 U/mL)", 12));
  add("IGA", "IgA الكلي (Total IgA)", "Total Serum IgA", "mg/dL", num(70, 400));

  cat = "فحوصات TORCH";
  add("TOXOG", "داء المقوّسات (Toxo) IgG", "Toxoplasma gondii IgG", "", neg());
  add("TOXOM", "داء المقوّسات (Toxo) IgM", "Toxoplasma gondii IgM", "", neg());
  add("RUBG", "الحصبة الألمانية (Rubella) IgG", "Rubella IgG", "", neg());
  add("RUBM", "الحصبة الألمانية (Rubella) IgM", "Rubella IgM", "", neg());
  add("CMVG", "الفيروس المضخّم (CMV) IgG", "Cytomegalovirus IgG", "", neg());
  add("CMVM", "الفيروس المضخّم (CMV) IgM", "Cytomegalovirus IgM", "", neg());
  add("HSVG", "فيروس الهربس (HSV 1&2) IgG", "Herpes Simplex IgG", "", neg());
  add("HSVM", "فيروس الهربس (HSV 1&2) IgM", "Herpes Simplex IgM", "", neg());

  cat = "الفيروسات";
  add("HBSAG", "التهاب الكبد B (HBsAg)", "Hepatitis B Surface Antigen", "", neg());
  add("HCV", "التهاب الكبد C (HCV Ab)", "Hepatitis C Antibody", "", neg());
  add("HIV", "فيروس نقص المناعة (HIV 1/2)", "HIV 1/2 Ab/Ag", "", neg());
  add("VDRL", "الزهري (VDRL / RPR)", "Syphilis Screen", "", neg("Non-Reactive (Negative)"));

  cat = "أدرار";
  sample = "إدرار";
  add("GUE", "تحليل البول العام", "General Urine Examination", "", { kind: "text", text: "Normal" });

  return list;
}
