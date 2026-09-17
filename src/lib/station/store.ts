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
  patient: { name: string; gender: Gender; age?: string; phone?: string };
  referrer?: string;
  results: { testId: string; name_ar: string; value: string; unit?: string }[];
}

export interface StationPage {
  id: string;
  title: string;
  content: string;
}

const K_TESTS = "station.tests.v1";
const K_VISITS = "station.visits.v1";
const K_PAGES = "station.pages.v1";
const K_SETTINGS = "station.settings.v1";

export interface StationSettings {
  labName: string;
  labSubtitle: string;
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
    labName: "مختبر المجمع الطبي",
    labSubtitle: "تقرير نتائج الفحوصات المخبرية",
  });
}
export function saveSettings(s: StationSettings): void {
  write(K_SETTINGS, s);
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
