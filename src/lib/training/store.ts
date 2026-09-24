"use client";

/**
 * Local store for the standalone Training & Information station — a knowledge
 * base of lab tests (procedures, samples, tubes, tools, interpretation,
 * correlations). Text lives in localStorage under "training.*"; images live in
 * IndexedDB (see ./media). Fully separate: nothing here reads or writes the
 * Lab Station, Purchasing, or the admin panel.
 */

import { clearOldDefault } from "@/lib/local/util";
import { exportImages, importImages, exportImagesByIds, importImageIfMissing, type MediaExport } from "./media";

export interface TStep { id: string; text: string; imageId?: string; warn?: boolean }
export interface TGalleryItem { id: string; imageId: string; caption: string }
export interface TLink { id: string; note?: string }
export interface TNormal { label: string; value: string }
/** Troubleshooting row: problem → likely cause → fix. */
export interface TTrouble { id: string; problem: string; cause: string; fix: string }
export interface TRevision { version: number; at: number; note?: string }

export interface TrainingTest {
  id: string;
  name_ar: string;
  name_en?: string;
  abbr?: string;
  category?: string;
  coverImageId?: string;
  /** Why the doctor orders it. */
  purpose?: string;
  /** Short summary / principle of the method. */
  summary?: string;
  sampleType?: string;
  volume?: string;
  patientPrep?: string;
  /** Stability, storage and transport. */
  storage?: string;
  tubeIds: string[];
  toolIds: string[];
  steps: TStep[];
  /** "Golden notes" — practical experience, common errors, tricks. */
  tips: string[];
  safety?: string;
  normals: TNormal[];
  high?: string;
  low?: string;
  /** How the sample / result looks, interferences (hemolysis, lipemia…). */
  resultNotes?: string;
  gallery: TGalleryItem[];
  links: TLink[];
  troubles?: TTrouble[];
  /** Document control (SOP): version bumps automatically when content changes. */
  version?: number;
  reviewedBy?: string;
  reviewedAt?: string; // YYYY-MM-DD
  nextReview?: string; // YYYY-MM-DD
  history?: TRevision[];
  updated_at: number;
}

export interface Tube {
  id: string;
  name: string;
  color: string; // cap colour (hex)
  additive?: string;
  uses?: string;
  notes?: string;
  imageId?: string;
}

export interface Tool {
  id: string;
  name: string;
  kind: string; // أداة / جهاز / كاشف / مستهلكات
  description?: string;
  imageId?: string;
}

export interface TrainingSettings {
  title: string;
  subtitle: string;
  footer?: string;
  logoImageId?: string;
  /** Printed in the SOP safety box when a test has none of its own. */
  defaultSafety: string;
  preparedBy?: string;
  /** Default months until an SOP's next review (document control). */
  reviewMonths?: number;
  /** Optional read-only mode: editing needs a PIN (off by default). */
  lockEnabled?: boolean;
  pinHash?: string;
}

/** Competency levels: 1 observed · 2 performed under supervision · 3 independent. */
export type CompLevel = 1 | 2 | 3;
export const COMP_LEVELS: { level: CompLevel; label: string }[] = [
  { level: 1, label: "شاهد" },
  { level: 2, label: "تحت إشراف" },
  { level: 3, label: "مستقل" },
];
export interface QuizAttempt { at: number; score: number; total: number; category?: string }
export interface Trainee {
  id: string;
  name: string;
  start?: string;
  notes?: string;
  comp: Record<string, { level: CompLevel; date: string; by?: string }>;
  quiz: QuizAttempt[];
}

const K_TESTS = "training.tests.v1";
const K_TUBES = "training.tubes.v1";
const K_TOOLS = "training.tools.v1";
const K_SETTINGS = "training.settings.v1";
const K_SEEDED = "training.seeded.v1";
const K_FAVS = "training.favs.v1";
const K_RECENT = "training.recent.v1";
const K_TRAINEES = "training.trainees.v1";
const K_QUIZ = "training.quiz.v1";

export const today = () => new Date().toLocaleDateString("en-CA");
/** YYYY-MM-DD `months` from now. */
export function addMonths(months: number, from = new Date()): string {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString("en-CA");
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
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

/** First run: load the starter library (tubes, tools, example tests). */
function ensureSeed(): void {
  if (read<boolean>(K_SEEDED, false)) return;
  const s = seedData();
  write(K_TUBES, s.tubes);
  write(K_TOOLS, s.tools);
  const next = addMonths(12);
  write(K_TESTS, s.tests.map((t) => ({ ...t, version: 1, history: [{ version: 1, at: Date.now(), note: "إصدار أول" }], nextReview: next })));
  write(K_SEEDED, true);
}

// ── Tests ────────────────────────────────────────────────────────────────────
export function getTests(): TrainingTest[] { ensureSeed(); return read<TrainingTest[]>(K_TESTS, []); }
export function getTest(id: string): TrainingTest | null { return getTests().find((t) => t.id === id) ?? null; }
/** Content fingerprint — ignores bookkeeping fields, so only real edits bump the version. */
function contentKey(t: TrainingTest): string {
  const { updated_at: _u, version: _v, history: _h, ...rest } = t;
  return JSON.stringify(rest);
}
/** Save a test. A new test starts at v1; a changed one gets version + 1 and a history entry. */
export function saveTest(t: TrainingTest, changeNote?: string): TrainingTest {
  const all = getTests();
  const prev = all.find((x) => x.id === t.id);
  const now = Date.now();
  let rec: TrainingTest;
  if (!prev) {
    rec = {
      ...t, version: 1, updated_at: now,
      history: [{ version: 1, at: now, note: changeNote?.trim() || "إصدار أول" }],
      nextReview: t.nextReview || addMonths(getSettings().reviewMonths ?? 12),
    };
  } else if (contentKey(prev) !== contentKey(t)) {
    const v = (prev.version ?? 1) + 1;
    rec = { ...t, version: v, updated_at: now, history: [...(prev.history ?? []), { version: v, at: now, ...(changeNote?.trim() ? { note: changeNote.trim() } : {}) }] };
  } else {
    rec = prev;
  }
  write(K_TESTS, prev ? all.map((x) => (x.id === t.id ? rec : x)) : [...all, rec]);
  return rec;
}
/** Full-text match inside a test's content (not its name). Returns the first
 *  matching field with a short snippet around the hit, or null. */
export function contentMatch(t: TrainingTest, term: string): { field: string; before: string; hit: string; after: string } | null {
  const q = term.trim().toLowerCase();
  if (!q) return null;
  const fields: [string, string | undefined][] = [
    ["الغرض", t.purpose], ["الملخّص", t.summary], ["العينة", t.sampleType], ["تحضير المريض", t.patientPrep], ["الحفظ", t.storage],
    ...t.steps.map((s, i) => [`الخطوة ${i + 1}`, s.text] as [string, string]),
    ...t.tips.map((x) => ["ملاحظة", x] as [string, string]),
    ...(t.troubles ?? []).map((r) => ["حل المشاكل", `${r.problem} — ${r.cause} — ${r.fix}`] as [string, string]),
    ["القيم الطبيعية", t.normals.map((n) => `${n.label} ${n.value}`).join(" · ")],
    ["الارتفاع", t.high], ["الانخفاض", t.low], ["شكل العينة", t.resultNotes], ["السلامة", t.safety],
    ...t.gallery.map((g) => ["صورة", g.caption] as [string, string]),
  ];
  for (const [field, raw] of fields) {
    const text = (raw ?? "").replace(/\*\*|==/g, "");
    const i = text.toLowerCase().indexOf(q);
    if (i === -1) continue;
    const start = Math.max(0, i - 40), end = Math.min(text.length, i + q.length + 60);
    return {
      field,
      before: (start > 0 ? "…" : "") + text.slice(start, i),
      hit: text.slice(i, i + q.length),
      after: text.slice(i + q.length, end) + (end < text.length ? "…" : ""),
    };
  }
  return null;
}

/** Review status from the next-review date: overdue, due within 30 days, or fine. */
export function reviewStatus(t: TrainingTest): "overdue" | "soon" | "ok" | null {
  if (!t.nextReview) return null;
  const now = new Date();
  const days = Math.round((new Date(t.nextReview + "T00:00:00").getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
  return days < 0 ? "overdue" : days <= 30 ? "soon" : "ok";
}
/** Create empty test cards from pasted lines: "الاسم | English | ABBR | التصنيف". Skips existing names. */
export function bulkCreate(text: string): number {
  const all = getTests();
  const names = new Set(all.map((t) => t.name_ar.trim().toLowerCase()));
  const months = getSettings().reviewMonths ?? 12;
  const now = Date.now();
  const created: TrainingTest[] = [];
  for (const line of text.split("\n")) {
    const [ar, en, abbr, cat] = line.split(/[|،,\t]/).map((x) => x?.trim() ?? "");
    if (!ar || names.has(ar.toLowerCase())) continue;
    names.add(ar.toLowerCase());
    created.push({
      ...blankTest(), name_ar: ar, name_en: en || undefined, abbr: abbr || undefined, category: cat || undefined,
      version: 1, history: [{ version: 1, at: now, note: "إنشاء سريع" }], nextReview: addMonths(months),
    });
  }
  if (created.length) write(K_TESTS, [...all, ...created]);
  return created.length;
}
/** Delete a test and remove every link that points to it. */
export function deleteTest(id: string): void {
  write(K_TESTS, getTests().filter((t) => t.id !== id).map((t) => ({ ...t, links: t.links.filter((l) => l.id !== id) })));
  write(K_FAVS, getFavs().filter((x) => x !== id));
  write(K_RECENT, getRecent().filter((x) => x !== id));
  write(K_TRAINEES, getTrainees().map((tr) => { const { [id]: _gone, ...comp } = tr.comp; return { ...tr, comp }; }));
}

// ── Favourites & recently viewed ─────────────────────────────────────────────
export function getFavs(): string[] { return read<string[]>(K_FAVS, []); }
export function toggleFav(id: string): boolean {
  const f = getFavs();
  const on = !f.includes(id);
  write(K_FAVS, on ? [id, ...f] : f.filter((x) => x !== id));
  return on;
}
export function getRecent(): string[] { return read<string[]>(K_RECENT, []); }
export function pushRecent(id: string): void { write(K_RECENT, [id, ...getRecent().filter((x) => x !== id)].slice(0, 8)); }

// ── Trainees (competency record) & quiz history ──────────────────────────────
export function getTrainees(): Trainee[] { return read<Trainee[]>(K_TRAINEES, []); }
export function saveTrainees(list: Trainee[]): void { write(K_TRAINEES, list); }
/** Set (or clear with 0) a trainee's competency level for a test — dated today. */
export function setCompetency(traineeId: string, testId: string, level: CompLevel | 0, by?: string): void {
  saveTrainees(getTrainees().map((tr) => {
    if (tr.id !== traineeId) return tr;
    const comp = { ...tr.comp };
    if (level === 0) delete comp[testId];
    else comp[testId] = { level, date: today(), ...(by?.trim() ? { by: by.trim() } : {}) };
    return { ...tr, comp };
  }));
}
export function getQuizHistory(): QuizAttempt[] { return read<QuizAttempt[]>(K_QUIZ, []); }
/** Record a quiz result (globally, and on the trainee when one was chosen). */
export function addQuizAttempt(a: QuizAttempt, traineeId?: string): void {
  write(K_QUIZ, [a, ...getQuizHistory()].slice(0, 50));
  if (traineeId) saveTrainees(getTrainees().map((tr) => (tr.id === traineeId ? { ...tr, quiz: [a, ...tr.quiz].slice(0, 50) } : tr)));
}
export function blankTest(): TrainingTest {
  return {
    id: uid(), name_ar: "", tubeIds: [], toolIds: [], steps: [], tips: [], normals: [],
    gallery: [], links: [], updated_at: Date.now(),
  };
}
/** Tests that link TO this one (reverse side of the correlation network). */
export function backlinks(id: string): { test: TrainingTest; note?: string }[] {
  const out: { test: TrainingTest; note?: string }[] = [];
  for (const t of getTests()) {
    const l = t.links.find((x) => x.id === id);
    if (l && t.id !== id) out.push({ test: t, note: l.note });
  }
  return out;
}

/** Remove a deleted tube/tool from every test that referenced it. */
export function unlinkFromTests(field: "tubeIds" | "toolIds", id: string): void {
  write(K_TESTS, getTests().map((t) => ({ ...t, [field]: t[field].filter((x) => x !== id) })));
}
/** Number of tests using a tube/tool. */
export function usageCount(field: "tubeIds" | "toolIds", id: string): number {
  return getTests().filter((t) => t[field].includes(id)).length;
}

/** Where an image is used (tests, tubes, tools, logo) — shown before deleting. */
export function imageUsage(imageId: string): string[] {
  const out: string[] = [];
  for (const t of getTests()) {
    if (t.coverImageId === imageId || t.steps.some((s) => s.imageId === imageId) || t.gallery.some((g) => g.imageId === imageId)) out.push(t.name_ar);
  }
  for (const t of getTubes()) if (t.imageId === imageId) out.push(t.name);
  for (const t of getTools()) if (t.imageId === imageId) out.push(t.name);
  if (getSettings().logoImageId === imageId) out.push("شعار الطباعة");
  return out;
}
/** Drop every reference to a deleted image. */
export function removeImageRefs(imageId: string): void {
  write(K_TESTS, getTests().map((t) => ({
    ...t,
    coverImageId: t.coverImageId === imageId ? undefined : t.coverImageId,
    steps: t.steps.map((s) => (s.imageId === imageId ? { ...s, imageId: undefined } : s)),
    gallery: t.gallery.filter((g) => g.imageId !== imageId),
  })));
  write(K_TUBES, getTubes().map((t) => (t.imageId === imageId ? { ...t, imageId: undefined } : t)));
  write(K_TOOLS, getTools().map((t) => (t.imageId === imageId ? { ...t, imageId: undefined } : t)));
  const st = getSettings();
  if (st.logoImageId === imageId) write(K_SETTINGS, { ...st, logoImageId: undefined });
}

// ── Tubes & tools ────────────────────────────────────────────────────────────
export function getTubes(): Tube[] { ensureSeed(); return read<Tube[]>(K_TUBES, []); }
export function saveTubes(list: Tube[]): void { write(K_TUBES, list); }
export function getTools(): Tool[] { ensureSeed(); return read<Tool[]>(K_TOOLS, []); }
export function saveTools(list: Tool[]): void { write(K_TOOLS, list); }

// ── Settings ─────────────────────────────────────────────────────────────────
export function getSettings(): TrainingSettings {
  const s = read<TrainingSettings>(K_SETTINGS, {
    title: "مختبر التحليلات المرضية",
    subtitle: "دليل العمل والتدريب",
    footer: "",
    defaultSafety:
      "ارتدِ القفازات والصدرية ونظارات الوقاية.\nتعامل مع كل عينة على أنها معدية محتملة.\nتخلّص من الإبر في حاوية الأدوات الحادة فوراً ومن النفايات في الأكياس الصفراء.\nشغّل عينة سيطرة (QC) قبل عينات المرضى ودوّن نتيجتها.\nعقّم سطح العمل بعد الانتهاء.",
  });
  return { ...s, footer: clearOldDefault(s.footer) }; // address/phone is typed by the lab
}
export function saveSettings(s: TrainingSettings): void { write(K_SETTINGS, s); }

/** Text storage used in localStorage (bytes, approx.). */
export function textUsage(): number {
  let bytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("training.")) bytes += (k.length + (localStorage.getItem(k) ?? "").length) * 2;
    }
  } catch { /* ignore */ }
  return bytes;
}

// ── Backup (text + images in one file) ───────────────────────────────────────
export interface TrainingBackup {
  app: "spir-training";
  version: 1;
  exported_at: string;
  tests: TrainingTest[];
  tubes: Tube[];
  tools: Tool[];
  settings: TrainingSettings;
  trainees?: Trainee[];
  quiz?: QuizAttempt[];
  favs?: string[];
  images: MediaExport[];
}
export async function exportBackup(): Promise<TrainingBackup> {
  return {
    app: "spir-training", version: 1, exported_at: new Date().toISOString(),
    tests: getTests(), tubes: getTubes(), tools: getTools(), settings: getSettings(),
    trainees: getTrainees(), quiz: getQuizHistory(), favs: getFavs(),
    images: await exportImages(),
  };
}
export async function importBackup(data: unknown): Promise<boolean> {
  const b = data as Partial<TrainingBackup>;
  if (!b || b.app !== "spir-training" || !Array.isArray(b.tests)) return false;
  write(K_TESTS, b.tests);
  if (b.tubes) write(K_TUBES, b.tubes);
  if (b.tools) write(K_TOOLS, b.tools);
  if (b.settings) write(K_SETTINGS, b.settings);
  if (b.trainees) write(K_TRAINEES, b.trainees);
  if (b.quiz) write(K_QUIZ, b.quiz);
  if (b.favs) write(K_FAVS, b.favs);
  write(K_SEEDED, true);
  if (Array.isArray(b.images)) await importImages(b.images);
  return true;
}

// ── Share a single test (with its tubes, tools and images) ───────────────────
export interface TestPackage {
  app: "spir-training-test";
  version: 1;
  exported_at: string;
  test: TrainingTest;
  tubes: Tube[];
  tools: Tool[];
  /** Linked tests by name, so links can be re-attached on another device. */
  linkNames: { id: string; name_ar: string }[];
  images: MediaExport[];
}
export async function exportTestPackage(id: string): Promise<TestPackage | null> {
  const t = getTest(id);
  if (!t) return null;
  const tubes = getTubes().filter((x) => t.tubeIds.includes(x.id));
  const tools = getTools().filter((x) => t.toolIds.includes(x.id));
  const imageIds = [
    t.coverImageId, ...t.steps.map((s) => s.imageId), ...t.gallery.map((g) => g.imageId),
    ...tubes.map((x) => x.imageId), ...tools.map((x) => x.imageId),
  ].filter(Boolean) as string[];
  const all = getTests();
  return {
    app: "spir-training-test", version: 1, exported_at: new Date().toISOString(),
    test: t, tubes, tools,
    linkNames: t.links.map((l) => ({ id: l.id, name_ar: all.find((x) => x.id === l.id)?.name_ar ?? "" })),
    images: await exportImagesByIds(imageIds),
  };
}
/** Find a local test matching a shared one (same id, else same Arabic name). */
export function findExisting(pkg: TestPackage): TrainingTest | null {
  const all = getTests();
  const n = pkg.test.name_ar.trim().toLowerCase();
  return all.find((x) => x.id === pkg.test.id) ?? all.find((x) => x.name_ar.trim().toLowerCase() === n) ?? null;
}
export function isTestPackage(d: unknown): d is TestPackage {
  const p = d as Partial<TestPackage>;
  return !!p && p.app === "spir-training-test" && !!p.test && typeof p.test.name_ar === "string";
}
/** Import a shared test. mode "replace" overwrites the matching local test; "copy" adds it alongside. */
export async function importTestPackage(pkg: TestPackage, mode: "replace" | "copy" | "new"): Promise<{ id: string; addedTubes: number; addedTools: number; droppedLinks: number }> {
  const norm = (s: string) => s.trim().toLowerCase();
  // Tubes / tools: reuse local ones with the same id or name, add the rest.
  const mapRefs = <T extends { id: string; name: string }>(incoming: T[], local: T[]) => {
    const map = new Map<string, string>();
    const added: T[] = [];
    for (const x of incoming) {
      const hit = local.find((l) => l.id === x.id) ?? local.find((l) => norm(l.name) === norm(x.name));
      if (hit) map.set(x.id, hit.id);
      else { const nx = { ...x, id: local.some((l) => l.id === x.id) ? uid() : x.id }; added.push(nx); map.set(x.id, nx.id); }
    }
    return { map, added };
  };
  const tb = mapRefs(pkg.tubes, getTubes());
  const tl = mapRefs(pkg.tools, getTools());
  if (tb.added.length) saveTubes([...getTubes(), ...tb.added]);
  if (tl.added.length) saveTools([...getTools(), ...tl.added]);
  for (const img of pkg.images) await importImageIfMissing(img);

  // Links: keep those whose target exists here (by id or by name).
  const all = getTests();
  let dropped = 0;
  const links: TLink[] = [];
  for (const l of pkg.test.links) {
    const name = pkg.linkNames.find((x) => x.id === l.id)?.name_ar ?? "";
    const hit = all.find((x) => x.id === l.id) ?? (name ? all.find((x) => norm(x.name_ar) === norm(name)) : undefined);
    if (hit) links.push({ ...l, id: hit.id }); else dropped++;
  }

  const existing = findExisting(pkg);
  const base: TrainingTest = {
    ...pkg.test,
    tubeIds: pkg.test.tubeIds.map((id) => tb.map.get(id) ?? id).filter((id) => getTubes().some((x) => x.id === id)),
    toolIds: pkg.test.toolIds.map((id) => tl.map.get(id) ?? id).filter((id) => getTools().some((x) => x.id === id)),
    links,
  };
  let rec: TrainingTest;
  if (mode === "replace" && existing) {
    rec = saveTest({ ...base, id: existing.id, version: existing.version, history: existing.history }, "استيراد نسخة مشتركة");
  } else {
    const id = mode === "copy" || all.some((x) => x.id === base.id) ? uid() : base.id;
    const name = mode === "copy" ? `${base.name_ar} (نسخة مستوردة)` : base.name_ar;
    const now = Date.now();
    rec = { ...base, id, name_ar: name, version: 1, history: [{ version: 1, at: now, note: "استيراد" }], updated_at: now };
    write(K_TESTS, [...getTests(), rec]);
  }
  return { id: rec.id, addedTubes: tb.added.length, addedTools: tl.added.length, droppedLinks: dropped };
}

// ── Starter library (editable/deletable by the user) ─────────────────────────
function seedData(): { tubes: Tube[]; tools: Tool[]; tests: TrainingTest[] } {
  const tube = (id: string, name: string, color: string, additive: string, uses: string, notes = ""): Tube =>
    ({ id, name, color, additive, uses, notes });
  const tubes: Tube[] = [
    tube("t-citrate", "تيوب السترات (أزرق فاتح)", "#38bdf8", "سترات الصوديوم 3.2% (نسبة 1:9)", "PT ، APTT ، INR ، فحوصات التخثر",
      "يجب ملؤه حتى الخط تماماً — النقص يغيّر نسبة المانع للدم ويعطي نتائج تخثر خاطئة. يُقلب 3–4 مرات بلطف."),
    tube("t-plain", "تيوب عادي (أحمر)", "#dc2626", "بدون مادة مضافة / منشّط تخثر", "الكيمياء ، المصليات ، الهرمونات",
      "اترك العينة 20–30 دقيقة حتى تتخثر كاملاً قبل الطرد المركزي."),
    tube("t-gel", "تيوب الجل (أصفر / ذهبي)", "#eab308", "منشّط تخثر + جل فاصل (SST)", "الكيمياء ، الهرمونات ، المصليات ، الفيتامينات",
      "يُقلب 5 مرات ويُترك 30 دقيقة ثم يُطرد. الجل يفصل المصل عن الخلايا فيحافظ على ثبات العينة."),
    tube("t-heparin", "تيوب الهيبارين (أخضر)", "#16a34a", "هيبارين الليثيوم", "كيمياء البلازما ، الأملاح ، الغازات",
      "لا يُستعمل لقياس الليثيوم. يُقلب 8–10 مرات."),
    tube("t-edta", "تيوب EDTA (بنفسجي)", "#7c3aed", "K2 / K3 EDTA", "CBC ، فصيلة الدم ، HbA1c ، الشريحة الدموية",
      "يُقلب 8–10 مرات بلطف فور السحب لمنع التجلط. لا تهزّه بقوة (يسبب تكسّر الكريات)."),
    tube("t-fluoride", "تيوب الفلورايد (رمادي)", "#6b7280", "فلوريد الصوديوم + أوكزالات البوتاسيوم", "السكر ، اللاكتيت",
      "الفلورايد يوقف استهلاك الخلايا للسكر، فيبقى السكر ثابتاً لساعات."),
    tube("t-esr", "تيوب ESR (أسود)", "#111827", "سترات الصوديوم 3.8% (نسبة 1:4)", "سرعة الترسيب ESR (ويسترغرين)",
      "يُملأ حتى الخط ويُقرأ بعد ساعة تماماً والأنبوب عمودي بعيداً عن الاهتزاز والشمس."),
    tube("t-urine", "حاوية الإدرار المعقّمة", "#fcd34d", "معقّمة بغطاء محكم", "فحص الإدرار العام ، الزرع ، هرمون الحمل",
      "العينة الوسطى من أول إدرار صباحي أفضل. تُفحص خلال ساعة إلى ساعتين."),
    tube("t-stool", "حاوية البراز", "#92400e", "نظيفة بملعقة", "فحص البراز العام ، مستضد جرثومة المعدة ، الدم الخفي",
      "كمية بحجم حبة البندق تكفي. تُفحص طازجة خصوصاً للطفيليات المتحركة."),
  ];
  const tool = (id: string, name: string, kind: string, description: string): Tool => ({ id, name, kind, description });
  const tools: Tool[] = [
    tool("o-centrifuge", "جهاز الطرد المركزي (Centrifuge)", "جهاز", "لفصل المصل/البلازما عن الخلايا — عادة 3000 دورة/دقيقة لمدة 10 دقائق. وازن الأنابيب دائماً قبل التشغيل."),
    tool("o-micropipette", "الماصات الدقيقة (Micropipettes)", "أداة", "لسحب حجوم دقيقة (10–1000 µL). اضغط للتوقف الأول عند السحب وللثاني عند التفريغ، وغيّر الرأس لكل عينة."),
    tool("o-tips", "رؤوس الماصات (Tips)", "مستهلكات", "أصفر للحجوم الصغيرة وأزرق للكبيرة. رأس جديد لكل عينة وكاشف."),
    tool("o-spectro", "جهاز المطياف الضوئي / محلل الكيمياء", "جهاز", "يقيس امتصاص الضوء عند طول موجي محدد لحساب التركيز. يُصفَّر على البلانك قبل القراءة."),
    tool("o-hema", "جهاز تحليل الدم (Hematology Analyzer)", "جهاز", "يعدّ الكريات ويحسب مؤشراتها (CBC). شغّل الـ QC يومياً وراجع الإنذارات (Flags)."),
    tool("o-microscope", "المجهر الضوئي", "جهاز", "ابدأ بالعدسة 10x ثم 40x. عدسة 100x تحتاج زيت الغمر."),
    tool("o-incubator", "الحمّام المائي / الحاضنة 37°م", "جهاز", "لحضن التفاعلات عند 37°م. تحقّق من الحرارة يومياً بمحرار."),
    tool("o-slides", "الشرائح والأغطية الزجاجية", "مستهلكات", "للفحص المجهري للإدرار والشرائح الدموية."),
    tool("o-dipstick", "شريط تحليل الإدرار (Dipstick)", "كاشف", "يُغمس 1–2 ثانية ويُقرأ في الوقت المحدد لكل مربع حسب الشركة."),
    tool("o-glucose", "كاشف السكر (GOD-POD)", "كاشف", "طريقة إنزيمية لونية تُقرأ عند 500–546 نانومتر."),
    tool("o-altreagent", "كاشف ALT / AST (Kinetic)", "كاشف", "طريقة حركية تُقرأ عند 340 نانومتر بقياس تغيّر الامتصاص في الدقيقة."),
    tool("o-phlebotomy", "أدوات السحب (رباط ، إبرة ، حامل)", "أداة", "لا يُترك الرباط أكثر من دقيقة واحدة. عقّم الموضع واتركه يجف قبل الوخز."),
    tool("o-timer", "المؤقّت (Timer)", "أداة", "لضبط أوقات الحضن والقراءة بدقة."),
  ];

  const step = (text: string, warn = false): TStep => ({ id: uid(), text, ...(warn ? { warn } : {}) });
  const now = Date.now();
  const base = { gallery: [] as TGalleryItem[], updated_at: now };

  const tests: TrainingTest[] = [
    {
      ...base, id: "x-fbs", name_ar: "سكر الدم الصائم", name_en: "Fasting Blood Sugar", abbr: "FBS", category: "الكيمياء السريرية",
      purpose: "تشخيص داء السكري ومتابعته، والكشف عن انخفاض السكر.",
      summary: "طريقة إنزيمية لونية (GOD-POD): يتأكسد الغلوكوز بإنزيم الغلوكوز أوكسيديز ويتكوّن لون تتناسب شدته مع تركيز السكر.",
      sampleType: "مصل أو بلازما", volume: "2–3 مل دم", patientPrep: "صيام 8–12 ساعة (الماء مسموح).",
      storage: "يُفصل المصل خلال 30–60 دقيقة. في تيوب الفلورايد يبقى ثابتاً حتى 24 ساعة.",
      tubeIds: ["t-fluoride", "t-gel"], toolIds: ["o-centrifuge", "o-micropipette", "o-glucose", "o-incubator", "o-spectro", "o-timer"],
      steps: [
        step("تأكّد من اسم المريض ومدة الصيام قبل السحب."),
        step("اطرد العينة 10 دقائق عند 3000 دورة/دقيقة وافصل المصل خلال ساعة من السحب."),
        step("أوصل الكاشف والعيارية (Standard) إلى حرارة الغرفة."),
        step("حضّر 3 أنابيب: بلانك (1000 µL كاشف) — عيارية (1000 µL كاشف + 10 µL Standard) — عينة (1000 µL كاشف + 10 µL مصل)."),
        step("امزج واحضن 10 دقائق عند 37°م (أو 20 دقيقة بحرارة الغرفة)."),
        step("صفّر الجهاز على البلانك واقرأ الامتصاص عند 500–546 نانومتر خلال 60 دقيقة."),
        step("الحساب: (امتصاص العينة ÷ امتصاص العيارية) × تركيز العيارية."),
      ],
      tips: [
        "ترك الدم دون فصل يُنقص السكر حوالي 5–7% كل ساعة لأن الخلايا تستهلكه — افصل بسرعة أو استعمل تيوب الفلورايد.",
        "العينة المتحللة (Hemolyzed) أو الدهنية (Lipemic) تشوّش القراءة اللونية.",
        "لا تسحب من الذراع التي فيها مغذّي (Drip) لأن المحلول يرفع السكر زوراً.",
      ],
      normals: [{ label: "صائم", value: "70 – 99 mg/dL" }, { label: "ما قبل السكري", value: "100 – 125 mg/dL" }, { label: "سكري", value: "≥ 126 mg/dL (مرتين)" }],
      high: "داء السكري ، الإجهاد ، الكورتيزون ، التهاب البنكرياس ، عدم الصيام.",
      low: "جرعة إنسولين أو حبوب زائدة ، صيام طويل ، ورم الإنسولين ، تأخر فصل العينة.",
      resultNotes: "المصل الطبيعي أصفر شفاف. الأحمر = متحلل ، الحليبي = دهني — دوّن ذلك مع النتيجة.",
      links: [{ id: "x-gue", note: "عند تجاوز السكر ~180 mg/dL يظهر السكر في الإدرار." }],
      troubles: [
        { id: uid(), problem: "نتيجة منخفضة بشكل غير متوقع", cause: "تأخّر فصل المصل فاستهلكت الخلايا السكر", fix: "افصل خلال ساعة أو استعمل تيوب الفلورايد، وأعد السحب إن لزم" },
        { id: uid(), problem: "عينة السيطرة (QC) خارج الحدود", cause: "كاشف منتهي أو ملوّث، أو حرارة حضن غير صحيحة", fix: "تحقّق من صلاحية الكاشف وحرارة الحاضنة، أعد العيارية ثم أعد الـ QC قبل عينات المرضى" },
      ],
    },
    {
      ...base, id: "x-cbc", name_ar: "صورة الدم الكاملة", name_en: "Complete Blood Count", abbr: "CBC", category: "أمراض الدم",
      purpose: "تقييم فقر الدم والالتهابات واضطرابات الصفائح.",
      summary: "عدّ آلي للكريات الحمر والبيض والصفائح وقياس الهيموغلوبين وحساب المؤشرات (MCV ، MCH ، MCHC).",
      sampleType: "دم كامل", volume: "2 مل (حتى خط التيوب)", patientPrep: "لا يحتاج صياماً.",
      storage: "يُفحص خلال 6 ساعات بحرارة الغرفة، أو حتى 24 ساعة في الثلاجة (2–8°م).",
      tubeIds: ["t-edta"], toolIds: ["o-hema", "o-microscope", "o-slides"],
      steps: [
        step("اقلب التيوب 8–10 مرات بلطف فور السحب."),
        step("افحص العينة بصرياً: لا تجلط ولا نقص في الحجم.", true),
        step("شغّل عينة السيطرة (QC) وتأكّد أنها ضمن الحدود."),
        step("امزج العينة مجدداً قبل التحليل مباشرة ثم حلّلها."),
        step("راجع الإنذارات (Flags) والرسوم البيانية."),
        step("عند وجود إنذار أو نتيجة غير طبيعية حضّر شريحة دموية وافحصها بالمجهر."),
      ],
      tips: [
        "وجود جلطة صغيرة يُنقص الصفائح زوراً — افحص العينة بعيدان خشبي عند الشك.",
        "التيوب الناقص يزيد تركيز EDTA فتنكمش الكريات ويقل الـ HCT.",
        "الأجسام الباردة (Cold agglutinins): MCHC عالٍ جداً و RBC منخفض — دفّئ العينة 37°م وأعد التحليل.",
      ],
      normals: [
        { label: "Hb ذكور", value: "13 – 17 g/dL" }, { label: "Hb إناث", value: "12 – 15 g/dL" },
        { label: "WBC", value: "4 – 11 ×10³/µL" }, { label: "PLT", value: "150 – 450 ×10³/µL" },
      ],
      high: "WBC: التهاب بكتيري ، لوكيميا. PLT: نزف ، التهاب ، نقص حديد.",
      low: "Hb: فقر الدم. WBC: عدوى فيروسية ، أدوية. PLT: عدوى فيروسية ، ITP ، جلطة في العينة.",
      resultNotes: "",
      links: [],
      troubles: [
        { id: uid(), problem: "صفائح منخفضة مع إنذار تكتّل (PLT clumps)", cause: "تجلّط جزئي أو تكتّل الصفائح بسبب EDTA", fix: "افحص العينة والشريحة، وأعد السحب بتيوب سترات إن تكرّر" },
        { id: uid(), problem: "MCHC أعلى من 37 g/dL", cause: "أجسام باردة (Cold agglutinins) أو دهون عالية", fix: "دفّئ العينة 37°م لمدة 15 دقيقة وأعد التحليل" },
      ],
    },
    {
      ...base, id: "x-gue", name_ar: "فحص الإدرار العام", name_en: "General Urine Examination", abbr: "GUE", category: "الإدرار",
      purpose: "الكشف عن التهابات المجاري البولية وأمراض الكلى والسكري.",
      summary: "فحص فيزيائي (اللون ، الصفاء) + كيميائي بالشريط + مجهري للراسب.",
      sampleType: "إدرار", volume: "10–20 مل", patientPrep: "العينة الوسطى (Midstream) من أول إدرار صباحي، بعد تنظيف المنطقة.",
      storage: "يُفحص خلال ساعة إلى ساعتين. يمكن حفظه في الثلاجة حتى 24 ساعة.",
      tubeIds: ["t-urine"], toolIds: ["o-dipstick", "o-centrifuge", "o-slides", "o-microscope"],
      steps: [
        step("سجّل اللون والصفاء (Clear / Turbid)."),
        step("اغمس الشريط 1–2 ثانية، أزل الزيادة على ورق نشاف، واقرأ كل مربع في وقته المحدد."),
        step("ضع 10 مل في أنبوب واطرده 5 دقائق عند 1500–2000 دورة/دقيقة."),
        step("اسكب الرائق واترك حوالي 0.5 مل، ثم أعد تعليق الراسب بالنقر الخفيف."),
        step("ضع قطرة على شريحة وغطّها، وافحص بالعدسة 10x ثم 40x."),
        step("سجّل عدد RBC و WBC لكل حقل (HPF)، والخلايا الظهارية والأسطوانات والبلورات والبكتريا."),
      ],
      tips: [
        "الإدرار القديم: تتكاثر البكتريا، ويصبح قلوياً، وتذوب الأسطوانات — افحصه طازجاً.",
        "كثرة الخلايا الظهارية الحرشفية تعني تلوّث العينة — اطلب عينة وسطى نظيفة.",
        "لا تقرأ الشريط بعد وقته المحدد لأن الألوان تستمر بالتغيّر.",
      ],
      normals: [
        { label: "اللون", value: "أصفر فاتح ، صافٍ" }, { label: "pH", value: "4.5 – 8" }, { label: "SG", value: "1.005 – 1.030" },
        { label: "Glucose / Protein / Ketones", value: "Negative" }, { label: "RBC", value: "0 – 2 /HPF" }, { label: "WBC", value: "0 – 5 /HPF" },
      ],
      high: "Pus cells: التهاب. RBC: حصى ، التهاب ، دورة شهرية. Glucose: سكري. Protein: أمراض الكلى.",
      low: "",
      resultNotes: "بلورات أوكزالات الكالسيوم تشبه الظرف البريدي. بلورات حمض اليوريك صفراء بأشكال متعددة في الإدرار الحامضي.",
      links: [{ id: "x-fbs", note: "السكر في الإدرار يستوجب قياس سكر الدم." }],
      troubles: [
        { id: uid(), problem: "بكتريا كثيرة بدون كريات بيض", cause: "عينة قديمة أو ملوّثة", fix: "اطلب عينة وسطى طازجة وافحصها خلال ساعة" },
      ],
    },
    {
      ...base, id: "x-alt", name_ar: "إنزيم ALT (GPT)", name_en: "Alanine Aminotransferase", abbr: "ALT", category: "وظائف الكبد",
      purpose: "الكشف عن تضرّر خلايا الكبد (الأكثر خصوصية للكبد).",
      summary: "طريقة حركية (Kinetic UV): يُقاس تناقص امتصاص NADH عند 340 نانومتر في الدقيقة، وهو يتناسب مع نشاط الإنزيم.",
      sampleType: "مصل", volume: "2–3 مل دم", patientPrep: "لا يحتاج صياماً. يُفضّل تجنّب الرياضة العنيفة قبله.",
      storage: "ثابت 3 أيام في الثلاجة.",
      tubeIds: ["t-gel", "t-plain"], toolIds: ["o-centrifuge", "o-micropipette", "o-altreagent", "o-spectro", "o-timer"],
      steps: [
        step("افصل المصل وتأكّد أنه غير متحلل.", true),
        step("اخلط الكاشف حسب النشرة وأوصله إلى 37°م."),
        step("أضف 100 µL مصل إلى 1000 µL كاشف وامزج."),
        step("بعد دقيقة اقرأ الامتصاص عند 340 نانومتر، ثم كل دقيقة لمدة 3 دقائق."),
        step("احسب متوسط التغيّر في الدقيقة (ΔA/min) واضربه بالمعامل (Factor) المذكور في النشرة."),
      ],
      tips: [
        "إذا كان التغيّر في الدقيقة أكبر من الحد في النشرة، خفّف العينة 1:10 بمحلول ملحي وأعد الفحص ثم اضرب بـ 10.",
        "التحلل يرفع النتيجة قليلاً (وأكثر بكثير في AST).",
      ],
      normals: [{ label: "ذكور", value: "حتى 41 U/L" }, { label: "إناث", value: "حتى 33 U/L" }],
      high: "التهاب الكبد الفيروسي ، الكبد الدهني ، الأدوية (باراسيتامول ، أدوية السل) ، انسداد القنوات الصفراوية.",
      low: "غالباً بلا أهمية سريرية.",
      resultNotes: "",
      links: [{ id: "x-ast", note: "يُفسَّران معاً — نسبة AST/ALT تساعد في التفريق بين أسباب تضرّر الكبد." }],
      troubles: [
        { id: uid(), problem: "امتصاص البداية منخفض جداً", cause: "نشاط الإنزيم عالٍ جداً فاستهلك NADH قبل القراءة", fix: "خفّف العينة 1:10 بمحلول ملحي وأعد الفحص ثم اضرب النتيجة بـ 10" },
      ],
    },
    {
      ...base, id: "x-ast", name_ar: "إنزيم AST (GOT)", name_en: "Aspartate Aminotransferase", abbr: "AST", category: "وظائف الكبد",
      purpose: "تقييم تضرّر الكبد، ويوجد أيضاً في القلب والعضلات.",
      summary: "طريقة حركية (Kinetic UV) عند 340 نانومتر، مثل ALT.",
      sampleType: "مصل", volume: "2–3 مل دم", patientPrep: "لا يحتاج صياماً.",
      storage: "ثابت 3 أيام في الثلاجة.",
      tubeIds: ["t-gel", "t-plain"], toolIds: ["o-centrifuge", "o-micropipette", "o-altreagent", "o-spectro", "o-timer"],
      steps: [
        step("افصل المصل — العينة المتحللة مرفوضة لهذا الفحص.", true),
        step("اخلط الكاشف وأوصله إلى 37°م."),
        step("أضف 100 µL مصل إلى 1000 µL كاشف وامزج."),
        step("اقرأ الامتصاص عند 340 نانومتر كل دقيقة لمدة 3 دقائق."),
        step("احسب ΔA/min × المعامل."),
      ],
      tips: [
        "الكريات الحمر فيها AST بكمية كبيرة، لذلك أقل تحلل يرفع النتيجة بشكل واضح.",
        "نسبة AST/ALT أكبر من 2 توحي بضرر كبدي كحولي.",
      ],
      normals: [{ label: "بالغين", value: "حتى 40 U/L" }],
      high: "أمراض الكبد ، الجلطة القلبية ، إصابات العضلات ، الرياضة العنيفة ، تحلل العينة.",
      low: "غالباً بلا أهمية سريرية.",
      resultNotes: "",
      links: [{ id: "x-alt", note: "يُطلبان معاً ضمن وظائف الكبد." }],
    },
  ];
  return { tubes, tools, tests };
}
