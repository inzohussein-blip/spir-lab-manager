"use client";

/**
 * «رموز الأطباء» on the lab's computer (lib/local/kv under "doctors.*", never synced: the keys stay
 * on the computer that made them, and that computer uploads). For each doctor: the key and name
 * from the code (the code itself is shown once), the period the lab chose, and what to leave out.
 * Every few minutes while a station is open, the doctor's visits in the period are sealed and left
 * on the server (replacing the previous copy).
 */
import { readLS, writeLS, newId } from "@/lib/local/util";
import { getVisits, getTests, getSettings, rangeLabel, flagFor, type StationVisit } from "@/lib/station/store";
import { licenseProof } from "@/lib/license/client";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import {
  newDoctorCode, doctorKeys, sealSnapshot, WINDOW_DAYS, type DoctorWindow, type DoctorSnapshot, type DoctorVisit,
} from "./code";

export interface DoctorShare {
  id: string;
  /** The doctor's name as the lab writes it on visits; `aliases`: other spellings found on visits. */
  doctor: string;
  aliases: string[];
  tag: string; key: string;
  window: DoctorWindow;
  hidePhone: boolean;
  /** Only visits whose every test has a result. */
  completeOnly: boolean;
  /** Normal ranges and H / L beside the results. */
  ranges: boolean;
  createdAt: number;
  lastAt?: number; lastCount?: number; lastError?: string; lastHash?: string;
}
const K = "doctors.shares.v1";
export const DOCTORS_EVENT = "doctors-change";
const changed = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event(DOCTORS_EVENT)); };
const DAY = 86_400_000;
const MAX_VISITS = 3000;

export const shares = (): DoctorShare[] => readLS<DoctorShare[]>(K, []);
const save = (list: DoctorShare[]) => { writeLS(K, list); changed(); };

/** «د. أحمد»، «الدكتور احمد»، «Dr Ahmed»… read as one name (hamza forms, taa marbuta, spaces). */
export function nameKey(s: string): string {
  return s.trim().toLowerCase()
    .replace(/^(?:ال)?(?:دكتور|دكتورة)\s+/u, "").replace(/^د\s*\.\s*|^د\s+/u, "").replace(/^dr\.?\s*/u, "")
    .replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/\s+/g, " ").trim();
}
const matches = (s: DoctorShare, referrer?: string) => {
  if (!referrer?.trim()) return false;
  const k = nameKey(referrer);
  return k === nameKey(s.doctor) || s.aliases.some((a) => nameKey(a) === k);
};

// ── Codes ────────────────────────────────────────────────────────────────────
/** A new doctor code: returns the code (shown once) with the share. */
export function createShare(doctor: string, window: DoctorWindow): { share: DoctorShare; code: string } {
  const code = newDoctorCode();
  const share: DoctorShare = { id: newId(), doctor: doctor.trim(), aliases: [], ...doctorKeys(code), window, hidePhone: true, completeOnly: false, ranges: true, createdAt: Date.now() };
  save([...shares(), share]);
  void publishAll(true);
  return { share, code };
}
export function updateShare(id: string, patch: Partial<Pick<DoctorShare, "doctor" | "aliases" | "window" | "hidePhone" | "completeOnly" | "ranges">>) {
  save(shares().map((s) => (s.id === id ? { ...s, ...patch, lastHash: undefined } : s)));
  void publishAll(true);
}
/** A new code for the same doctor: the old one stops at once (its copy must leave the server
 *  first — offline, nothing changes and null is returned). */
export async function renewShare(id: string): Promise<string | null> {
  const s = shares().find((x) => x.id === id);
  if (!s) return null;
  if (!(await call({ op: "revoke", tag: s.tag })).ok) return null;
  const code = newDoctorCode();
  save(shares().map((x) => (x.id === id ? { ...x, ...doctorKeys(code), lastAt: undefined, lastHash: undefined, lastCount: undefined, lastError: undefined } : x)));
  void publishAll(true);
  return code;
}
/** Stop a code: its copy leaves the server, and the doctor's window shows nothing more. */
export async function removeShare(id: string): Promise<boolean> {
  const s = shares().find((x) => x.id === id);
  if (!s) return true;
  if (!(await call({ op: "revoke", tag: s.tag })).ok) return false;
  save(shares().filter((x) => x.id !== id));
  return true;
}

// ── What the doctor sees ─────────────────────────────────────────────────────
export function visitsFor(s: DoctorShare, now = Date.now()): StationVisit[] {
  const since = now - WINDOW_DAYS[s.window] * DAY;
  return getVisits()
    .filter((v) => v.created_at >= since && matches(s, v.referrer))
    .filter((v) => v.results.some((r) => String(r.value ?? "").trim()))
    .filter((v) => !s.completeOnly || v.results.every((r) => String(r.value ?? "").trim()))
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, MAX_VISITS);
}
export function snapshotFor(s: DoctorShare, now = Date.now()): DoctorSnapshot {
  const tests = new Map(getTests().map((t) => [t.id, t]));
  const st = getSettings();
  const visits: DoctorVisit[] = visitsFor(s, now).map((v) => ({
    id: v.id, at: v.created_at, ...(v.accession ? { acc: v.accession } : {}),
    patient: { name: v.patient.name, gender: v.patient.gender, ...(v.patient.age ? { age: v.patient.age } : {}), ...(!s.hidePhone && v.patient.phone ? { phone: v.patient.phone } : {}) },
    results: v.results.filter((r) => String(r.value ?? "").trim()).map((r) => {
      const t = tests.get(r.testId);
      const unit = r.unit || t?.unit || undefined;
      return {
        name: r.name_ar, value: String(r.value), ...(unit ? { unit } : {}), ...(r.hl ? { hl: true } : {}),
        ...(s.ranges && t ? { range: rangeLabel(t.normal, v.patient.gender, unit, v.patient.age) || undefined, flag: flagFor(String(r.value), t.normal, v.patient.gender, v.patient.age) } : {}),
      };
    }),
    ...(v.delivered_at ? { delivered: v.delivered_at } : {}),
  }));
  return { v: 1, lab: { name: st.labName, ...(st.labSubtitle ? { sub: st.labSubtitle } : {}), ...(st.footer ? { footer: st.footer } : {}) }, doctor: s.doctor, window: s.window, at: now, visits };
}

/** The referring names on the lab's visits (the last year), with the doctor code each goes to. */
export function referrerNames(): { name: string; count: number; shareId?: string }[] {
  const since = Date.now() - 366 * DAY;
  const by = new Map<string, { name: string; count: number }>();
  for (const v of getVisits()) {
    if (v.created_at < since || !v.referrer?.trim()) continue;
    const k = nameKey(v.referrer);
    const cur = by.get(k) ?? { name: v.referrer.trim(), count: 0 };
    cur.count++; by.set(k, cur);
  }
  const list = shares();
  return [...by.values()].sort((a, b) => b.count - a.count).map((x) => ({ ...x, shareId: list.find((s) => matches(s, x.name))?.id }));
}

// ── Uploading ────────────────────────────────────────────────────────────────
async function call(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; at?: number }> {
  try {
    const p = await licenseProof();
    const r = await fetch("/api/doctors", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, ...(p ? { token: p.token, device: p.device } : {}) }) });
    return (await r.json().catch(() => null)) ?? { ok: false, error: "unreachable" };
  } catch { return { ok: false, error: "offline" }; }
}
let running: Promise<void> | null = null;
/** Upload each doctor's copy (only what changed, and at least every half hour). */
export function publishAll(force = false): Promise<void> {
  running ??= (async () => {
    for (const s of shares()) {
      const snap = snapshotFor(s);
      const hash = bytesToHex(sha256(utf8ToBytes(JSON.stringify({ ...snap, at: 0 })))).slice(0, 32);
      if (!force && hash === s.lastHash && s.lastAt && Date.now() - s.lastAt < 30 * 60_000) continue;
      const r = await call({ op: "publish", tag: s.tag, box: sealSnapshot(s.key, snap) });
      const cur = shares();
      save(cur.map((x) => (x.id !== s.id ? x : r.ok
        ? { ...x, lastAt: Date.now(), lastCount: snap.visits.length, lastHash: hash, lastError: undefined }
        : { ...x, lastError: r.error ?? "unreachable" })));
    }
  })().finally(() => { running = null; });
  return running;
}
let started = false;
/** Started by the lab station and the sync station (only on the computer that holds codes). */
export function startDoctorPublisher() {
  if (started || typeof window === "undefined") return;
  started = true;
  const tick = () => { if (shares().length && document.visibilityState === "visible" && navigator.onLine !== false) void publishAll(); };
  setTimeout(tick, 3000);
  setInterval(tick, 3 * 60_000);
  window.addEventListener("online", tick);
}
export const DOCTOR_ERRORS: Record<string, string> = {
  off: "أوقف المزوّد نافذة الأطباء.",
  offline: "لا اتصال — يُرفع عند عودة الإنترنت.",
  unreachable: "الخادم لا يرد — تُعاد المحاولة.",
  too_big: "نتائج هذا الطبيب كبيرة جداً — اختر مدة أقصر.",
  too_many_codes: "بلغ المختبر الحد الأقصى لرموز الأطباء (300) — أوقف رموزاً لا تُستعمل.",
  bad_token: "رمز المختبر على هذا الحاسوب غير صالح.",
  expired: "انتهى اشتراك المختبر.", stopped: "رمز المختبر موقوف.",
};
