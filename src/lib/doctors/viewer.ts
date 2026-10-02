"use client";

/**
 * «نافذة الأطباء» on the doctor's own device (lib/local/kv under "doctor.*", never synced): the
 * labs whose codes the doctor added (the key and name from each code, not the code itself), the
 * last copy each lab left, and which results the doctor has already opened.
 */
import { useEffect, useState } from "react";
import { readLS, writeLS, newId } from "@/lib/local/util";
import { doctorKeys, validDoctorCode, openSnapshot, type DoctorSnapshot, type DoctorVisit } from "./code";

export interface DoctorLab {
  id: string;
  tag: string; key: string;
  /** The lab's name from its last copy. */
  name: string;
  addedAt: number;
  snap?: DoctorSnapshot;
  fetchedAt?: number;
  error?: string;
}
const K = { labs: "doctor.labs.v1", seen: "doctor.seen.v1" };
export const DOCTOR_EVENT = "doctor-change";
const changed = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event(DOCTOR_EVENT)); };

export const labs = (): DoctorLab[] => readLS<DoctorLab[]>(K.labs, []);
const saveLabs = (list: DoctorLab[]) => { writeLS(K.labs, list); changed(); };

export type FetchError = "not_found" | "off" | "too_many" | "offline" | "unreachable" | "bad_copy";
async function fetchCopy(tag: string, key: string): Promise<{ ok: true; snap: DoctorSnapshot } | { ok: false; error: FetchError }> {
  let r: { ok?: boolean; box?: string; error?: string } | null = null;
  try {
    const res = await fetch("/api/doctors", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "fetch", tag }), cache: "no-store" });
    r = await res.json().catch(() => null);
  } catch { return { ok: false, error: "offline" }; }
  if (!r) return { ok: false, error: "unreachable" };
  if (!r.ok || !r.box) return { ok: false, error: (["not_found", "off", "too_many"].includes(r.error ?? "") ? r.error : "unreachable") as FetchError };
  const snap = openSnapshot(key, r.box);
  return snap ? { ok: true, snap } : { ok: false, error: "bad_copy" };
}

/** Add a lab by the code it gave the doctor: kept only when its copy opens with the code. */
export async function addLab(code: string): Promise<{ ok: true; lab: DoctorLab } | { ok: false; error: FetchError | "bad_code" | "exists" }> {
  if (!validDoctorCode(code)) return { ok: false, error: "bad_code" };
  const k = doctorKeys(code);
  if (labs().some((l) => l.tag === k.tag)) return { ok: false, error: "exists" };
  const r = await fetchCopy(k.tag, k.key);
  if (!r.ok) return r;
  const lab: DoctorLab = { id: newId(), ...k, name: r.snap.lab.name || "مختبر", addedAt: Date.now(), snap: r.snap, fetchedAt: Date.now() };
  saveLabs([...labs(), lab]);
  return { ok: true, lab };
}
export function removeLab(id: string) {
  saveLabs(labs().filter((l) => l.id !== id));
  const seen = readLS<Record<string, number>>(K.seen, {});
  writeLS(K.seen, Object.fromEntries(Object.entries(seen).filter(([k]) => !k.startsWith(`${id}:`))));
}
export function renameLab(id: string, name: string) {
  saveLabs(labs().map((l) => (l.id === id ? { ...l, name: name.trim() || l.name } : l)));
}

let running: Promise<void> | null = null;
/** Fetch every lab's latest copy. A code the lab stopped («not found») keeps nothing to show. */
export function refreshAll(): Promise<void> {
  running ??= (async () => {
    for (const l of labs()) {
      const r = await fetchCopy(l.tag, l.key);
      const cur = labs();
      saveLabs(cur.map((x) => (x.id !== l.id ? x : r.ok
        ? { ...x, snap: r.snap, name: r.snap.lab.name || x.name, fetchedAt: Date.now(), error: undefined }
        : { ...x, error: r.error, ...(r.error === "not_found" ? { snap: undefined } : {}) })));
    }
  })().finally(() => { running = null; });
  return running;
}
let started = false;
/** On open, then every few minutes while the window is shown. */
export function startDoctorRefresh() {
  if (started || typeof window === "undefined") return;
  started = true;
  const tick = () => { if (labs().length && document.visibilityState === "visible" && navigator.onLine !== false) void refreshAll(); };
  tick();
  setInterval(tick, 5 * 60_000);
  window.addEventListener("online", tick);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") tick(); });
}

// ── The results, from every lab ──────────────────────────────────────────────
export interface Row { lab: DoctorLab; visit: DoctorVisit; key: string }
export function allRows(): Row[] {
  return labs().flatMap((lab) => (lab.snap?.visits ?? []).map((visit) => ({ lab, visit, key: `${lab.id}:${visit.id}` })))
    .sort((a, b) => b.visit.at - a.visit.at);
}
/** «جديد»: a visit not opened yet, or one with more results since it was opened. */
export function isNew(r: Row): boolean {
  const seen = readLS<Record<string, number>>(K.seen, {});
  return (seen[r.key] ?? -1) < r.visit.results.length;
}
export function markSeen(r: Row) {
  const seen = readLS<Record<string, number>>(K.seen, {});
  if ((seen[r.key] ?? -1) >= r.visit.results.length) return;
  // Only the visits still shown are kept.
  const live = new Set(allRows().map((x) => x.key));
  writeLS(K.seen, { ...Object.fromEntries(Object.entries(seen).filter(([k]) => live.has(k))), [r.key]: r.visit.results.length });
  changed();
}
export const newCount = () => allRows().filter(isNew).length;

/** «خروج»: everything «نافذة الأطباء» keeps on this device. */
export function forgetAll() {
  writeLS(K.labs, []); writeLS(K.seen, {});
  changed();
}

export const FETCH_ERRORS: Record<string, string> = {
  bad_code: "الرمز 12 حرفاً ورقماً كما أعطاك المختبر (مثل ABCD-EFGH-JKMN).",
  exists: "هذا المختبر مضاف مسبقاً.",
  not_found: "لا نتائج لهذا الرمز: تأكد منه، أو أن المختبر أوقفه أو لم يرفع النتائج بعد.",
  off: "نافذة الأطباء غير متاحة حالياً.",
  too_many: "محاولات كثيرة — انتظر قليلاً ثم أعد المحاولة.",
  offline: "لا اتصال بالإنترنت — تُعرض آخر نتائج محفوظة.",
  unreachable: "الخادم لا يرد — أعد المحاولة بعد قليل.",
  bad_copy: "تعذّر فتح النتائج بهذا الرمز.",
};

export function useDoctor(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const up = () => setN((x) => x + 1);
    window.addEventListener(DOCTOR_EVENT, up);
    return () => window.removeEventListener(DOCTOR_EVENT, up);
  }, []);
  return n;
}
