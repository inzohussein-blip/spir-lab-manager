"use client";

/**
 * Local, offline-first store for the standalone Lab Station. Everything lives in
 * this browser's localStorage — no database, no network. Designed for a single
 * machine (the lab-room computer). Each read/write is guarded so a private
 * window or blocked storage never throws.
 */

export type Gender = "male" | "female" | "";

/** A test's fixed reference range — entered once in the catalog. */
export type NormalRange =
  | { kind: "none" }
  | { kind: "text"; text: string }
  | { kind: "numeric"; low: number | null; high: number | null }
  | {
      kind: "sex";
      male: { low: number | null; high: number | null };
      female: { low: number | null; high: number | null };
    };

export interface StationTest {
  id: string;
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

export interface StationSettings {
  labName: string;
  labSubtitle: string;
  footer?: string; // address / phone line
  logo?: string; // data URL, or a static path like /lab-logo.png
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — ignore */
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
    const seed = DEFAULT_TESTS();
    write(K_TESTS, seed);
    return seed;
  }
  return t;
}
export function saveTests(tests: StationTest[]): void {
  write(K_TESTS, tests);
}

// ── Visits ───────────────────────────────────────────────────────────────────
export function getVisits(): StationVisit[] {
  return read<StationVisit[]>(K_VISITS, []);
}
export function addVisit(v: StationVisit): void {
  const all = getVisits();
  write(K_VISITS, [v, ...all].slice(0, 500));
}
export function saveVisitsRaw(visits: StationVisit[]): void {
  write(K_VISITS, visits);
}
export function getVisit(id: string): StationVisit | null {
  return getVisits().find((v) => v.id === id) ?? null;
}
/** Replace an existing visit (used when re-saving after an edit). */
export function updateVisit(v: StationVisit): void {
  write(K_VISITS, getVisits().map((x) => (x.id === v.id ? v : x)));
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
  return read<StationSettings>(K_SETTINGS, {
    labName: "مختبر التحليلات المرضية",
    labSubtitle: "دبلوم تحليلات مرضية / بكالوريوس علوم حياة",
    footer: "النجف الأشرف - حي ميسان - مقابل بريد ميسان / 0789038080",
    logo: "/lab-logo.png",
  });
}
export function saveSettings(s: StationSettings): void {
  write(K_SETTINGS, s);
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
/** Days until expiry (negative = expired), or null when no expiry set. */
export function daysToExpiry(expiry?: string): number | null {
  if (!expiry) return null;
  const d = new Date(expiry + "T00:00:00").getTime();
  return Math.floor((d - Date.now()) / 86400000);
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
    if (b.tests) write(K_TESTS, b.tests);
    if (b.visits) write(K_VISITS, b.visits);
    if (b.pages) write(K_PAGES, b.pages);
    if (b.panels) write(K_PANELS, b.panels);
    if (b.settings) write(K_SETTINGS, b.settings);
    if (b.patients) write(K_PATIENTS, b.patients);
    if (b.stock) write(K_STOCK, b.stock);
    if (b.doctors) write(K_DOCTORS, b.doctors);
    return true;
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

/** Resolve a test's reference range for a patient of a given sex. */
export function resolveRange(n: NormalRange, gender: Gender): ResolvedRange {
  if (n.kind === "numeric") return { low: n.low, high: n.high, text: null };
  if (n.kind === "text") return { low: null, high: null, text: n.text };
  if (n.kind === "sex") {
    const r = gender === "female" ? n.female : n.male; // default to male range
    return { low: r.low, high: r.high, text: null };
  }
  return { low: null, high: null, text: null };
}

export function rangeLabel(n: NormalRange, gender: Gender, unit?: string): string {
  const r = resolveRange(n, gender);
  if (r.text) return r.text;
  if (r.low == null && r.high == null) return "—";
  const u = unit ? ` ${unit}` : "";
  return `${r.low ?? ""}${r.low != null || r.high != null ? " – " : ""}${r.high ?? ""}${u}`;
}

/** H / L / N flag for a numeric result vs the (sex-resolved) range. */
export function flagFor(value: string, n: NormalRange, gender: Gender): "H" | "L" | "N" | null {
  if (value == null || String(value).trim() === "") return null;
  const v = Number(value);
  if (Number.isNaN(v)) return null;
  const r = resolveRange(n, gender);
  if (r.low == null && r.high == null) return null;
  if (r.low != null && v < r.low) return "L";
  if (r.high != null && v > r.high) return "H";
  return "N";
}

// ── Default catalog (first run) — includes sex-specific ranges ───────────────
function DEFAULT_TESTS(): StationTest[] {
  const mk = (
    name_ar: string,
    category: string,
    unit: string,
    normal: NormalRange,
    sample = "دم"
  ): StationTest => ({
    id: uid(),
    name_ar,
    category,
    unit,
    sample_type: sample,
    normal,
  });
  return [
    mk("الهيموغلوبين (Hb)", "أمراض الدم", "g/dL", {
      kind: "sex",
      male: { low: 13, high: 17 },
      female: { low: 12, high: 15 },
    }),
    mk("الهيماتوكريت (HCT)", "أمراض الدم", "%", {
      kind: "sex",
      male: { low: 40, high: 54 },
      female: { low: 36, high: 48 },
    }),
    mk("كريات الدم البيضاء (WBC)", "أمراض الدم", "10^3/µL", {
      kind: "numeric",
      low: 4,
      high: 11,
    }),
    mk("الصفائح الدموية (PLT)", "أمراض الدم", "10^3/µL", {
      kind: "numeric",
      low: 150,
      high: 450,
    }),
    mk("سكر صائم (FBS)", "الكيمياء الحيوية", "mg/dL", {
      kind: "numeric",
      low: 70,
      high: 110,
    }),
    mk("الكرياتينين", "الكيمياء الحيوية", "mg/dL", {
      kind: "sex",
      male: { low: 0.7, high: 1.3 },
      female: { low: 0.6, high: 1.1 },
    }),
    mk("تحليل البول العام", "أدرار", "", { kind: "text", text: "طبيعي" }, "إدرار"),
  ];
}
