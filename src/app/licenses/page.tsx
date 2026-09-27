"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyRound, LogOut, Plus, Copy, Check, Ban, Play, MonitorSmartphone, RefreshCw, Trash2, Pencil, ShieldAlert,
  FlaskConical, Download, ChevronDown, MessageSquare, History, Wallet, MessageSquareText, Database, Upload, ShieldCheck, Smartphone, Phone,
  Server, Menu, X, ChevronLeft, HardDrive, Settings, Search, Bug, FileSpreadsheet, Lock, type LucideIcon,
} from "lucide-react";
import { LICENSE_MODULES, DEFAULT_MODULES, moduleLabel, type LicenseModule } from "@/lib/license/modules";
import { STATION_SYNC, SUPABASE_SQL } from "@/lib/sync/protocol";
import { SYNC_ERRORS } from "@/components/local/SyncPanel";
import { adminDbError } from "@/lib/db/labErrors";
import { PROVIDERS, providerById, providerOf, type ProviderId } from "@/lib/db/providers";
import { ConnInput, ProviderGuide, ProviderMark, ProviderPicker } from "@/components/DbProviders";

/** «إدارة الرموز» — the owner's page: one code per lab, bound to one device, with a period and stations. */

interface Row {
  id: string; lab_name: string; note: string; code_hint: string; duration_days: number; modules: LicenseModule[];
  status: "active" | "stopped"; device_id: string | null; device_label: string | null;
  activated_at: number | null; expires_at: number | null; last_seen_at: number | null; created_at: number;
  price: string; paid: boolean; paid_at: number | null; message: string; device_name: string; is_trial: boolean;
  app_version: string;
  /** The lab's own database (no secrets). */
  sync: { kind: "supabase" | "postgres"; host: string; by: "owner" | "device"; at: number } | null;
  /** The device's last report about its sync. */
  sync_last_at: number | null; sync_pending: number; sync_error: string; sync_reported_at: number | null;
  /** The full admin panel's own database (no secrets). */
  admin_db: { host: string; by: "owner" | "lab"; at: number; provider?: ProviderId } | null;
  admin_db_check: { at: number; ok: boolean; error: string } | null;
  /** Devices allowed on the code, and the ones beyond the first (with «حساب واحد بعدة أجهزة»). */
  max_devices: number;
  devices: { device_id: string; label: string; activated_at: number; last_seen_at: number | null; app_version: string }[];
  /** "signup": registered by the lab itself. */
  source: string;
}
interface Ev { license_id: string; at: number; kind: string; detail: string }
interface Storage { source: "license-db" | "app-db" | "embedded"; ok: boolean; codes?: number; roundTripMs?: number; error?: string; keySealed?: boolean }
interface SignIn { at: number; ok: boolean; ip: string; agent: string }
interface TwoFactor { enabled: boolean; broken: boolean; forcedOff: boolean; canSetup: boolean }
type Prefs = {
  defaultDays: number; defaultModules: LicenseModule[]; trialDays: number; soonDays: number; adminNeedsOwnDb: boolean;
  multiDevice: boolean; selfSignup: boolean; errorLog: boolean; dataExport: boolean;
};
const DEFAULT_PREFS: Prefs = {
  defaultDays: 365, defaultModules: [...DEFAULT_MODULES], trialDays: 7, soonDays: 14, adminNeedsOwnDb: true,
  multiDevice: false, selfSignup: false, errorLog: false, dataExport: false,
};
type Data = { enabled: boolean; owner: boolean; needsDb?: boolean; storage?: Storage; licenses?: Row[]; events?: Ev[]; signIns?: SignIn[]; twoFactor?: TwoFactor; contact?: string; prefs?: Prefs; version?: string; now?: number };
const agentLabel = (ua: string) => {
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return [os, br].filter(Boolean).join(" · ") || "—";
};
const SOURCE: Record<Storage["source"], string> = {
  "license-db": "قاعدة الرموز المنفصلة (Neon)",
  "app-db": "قاعدة بيانات الموقع (DATABASE_URL)",
  embedded: "القاعدة المدمجة المؤقتة (للتجربة المحلية فقط)",
};

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
const small = "inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs hover:bg-canvas";
const DAY = 86_400_000;
const OWNER_PHONE = "07803993585";
const PERIODS = [{ d: 30, l: "شهر" }, { d: 90, l: "3 أشهر" }, { d: 180, l: "6 أشهر" }, { d: 365, l: "سنة" }];
const fmt = (ms: number | null) => (ms ? new Date(ms).toLocaleDateString("en-CA") : "—");
const fmtTime = (ms: number | null) => (ms ? new Date(ms).toLocaleString("ar-IQ-u-nu-latn") : "—");
const deviceOf = (r: Row) => r.device_name || r.device_label || (r.device_id ? "مربوط" : "");
/** Where a code's full admin panel keeps its data (see lib/db/lab.ts). */
type Place = "own" | "site" | "waiting" | "none";
const placeOf = (r: Row, needsOwn: boolean): Place =>
  r.admin_db ? "own" : !r.modules.includes("admin") ? "none" : needsOwn && !r.is_trial ? "waiting" : "site";
const PLACE_LABEL: Record<Place, string> = { own: "قاعدة خاصة", site: "قسم مستقل في قاعدة الموقع", waiting: "بانتظار قاعدة خاصة", none: "" };
const amount = (p: string) => { const n = Number(p.replace(/[^\d.]/g, "")); return p.trim() && Number.isFinite(n) ? n : 0; };

const EVENT_LABEL: Record<string, string> = {
  created: "إنشاء الرمز", activated: "تفعيل على جهاز", moved: "تفعيل على جهاز جديد", extended: "تمديد", stopped: "إيقاف",
  resumed: "إعادة تفعيل", device_reset: "فك ربط الجهاز", modules: "تغيير المحطات", renamed: "تعديل الاسم",
  paid: "تسجيل الدفع", unpaid: "إلغاء الدفع", message: "رسالة للمختبر", new_code: "رمز جديد", sync: "قاعدة بيانات المختبر",
  admin_db: "قاعدة لوحة الإدارة", device_added: "جهاز إضافي", device_removed: "إزالة جهاز", max_devices: "عدد الأجهزة",
  data_export: "تصدير البيانات",
};
const eventDetail = (e: Ev) => (e.kind === "modules" ? e.detail.split(",").filter(Boolean).map(moduleLabel).join("، ") || "لا شيء" : e.detail);

type Section = "codes" | "new" | "databases" | "settings" | "errors" | "security" | "backup" | "system";
const SECTIONS: { title: string; items: { id: Section; label: string; hint: string; icon: LucideIcon }[] }[] = [
  { title: "الرموز", items: [
    { id: "codes", label: "الرموز", hint: "المختبرات وأجهزتها", icon: KeyRound },
    { id: "new", label: "رمز جديد", hint: "إنشاء رمز أو رمز تجريبي", icon: Plus },
    { id: "databases", label: "قواعد البيانات", hint: "قاعدة لوحة الإدارة لكل عميل", icon: HardDrive },
  ] },
  { title: "الإعدادات", items: [
    { id: "settings", label: "الإعدادات العامة", hint: "المدد والمحطات الافتراضية والتواصل", icon: Settings },
    { id: "errors", label: "سجل الأخطاء", hint: "أخطاء الموقع والمحطات", icon: Bug },
    { id: "security", label: "الأمان", hint: "التحقق بخطوتين وسجل الدخول", icon: ShieldCheck },
    { id: "backup", label: "النسخ الاحتياطي", hint: "تنزيل واسترجاع الرموز", icon: Database },
    { id: "system", label: "حالة النظام", hint: "التخزين والمفتاح والإصدار", icon: Server },
  ] },
];
const sectionOf = (hash: string): Section => {
  const h = hash.replace(/^#/, "");
  if (h === "contact") return "settings"; // the contact line moved into the general settings
  return SECTIONS.some((g) => g.items.some((i) => i.id === h)) ? (h as Section) : "codes";
};

type Filter = "all" | "active" | "soon" | "expired" | "unused" | "stopped" | "unpaid" | "trial" | "outdated";
type Sort = "expiry" | "newest" | "name" | "seen";

async function post(body: unknown) {
  const r = await fetch("/api/license/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return r.json().catch(() => ({ ok: false }));
}

function kindOf(r: Row, now: number, soonMs = 14 * DAY): Exclude<Filter, "all" | "unpaid" | "trial" | "soon" | "outdated"> | "soon" {
  if (r.status === "stopped") return "stopped";
  if (!r.activated_at) return "unused";
  if (r.expires_at != null && r.expires_at <= now) return "expired";
  return (r.expires_at ?? now) - now <= soonMs ? "soon" : "active";
}
/** State of a code: its pill, the stripe on the card's edge and the colour of its time bar. */
function status(r: Row, now: number, soonMs?: number) {
  const k = kindOf(r, now, soonMs);
  if (k === "stopped") return { t: "موقوف", c: "bg-red-50 text-red-700", stripe: "border-s-red-500", bar: "bg-red-400" };
  if (k === "unused") return { t: "غير مستخدم", c: "bg-slate-100 text-slate-600", stripe: "border-s-slate-300", bar: "bg-slate-300" };
  if (k === "expired") return { t: "منتهٍ", c: "bg-red-50 text-red-700", stripe: "border-s-red-500", bar: "bg-red-400" };
  if (k === "soon") return { t: "فعّال — ينتهي قريباً", c: "bg-amber-50 text-amber-700", stripe: "border-s-amber-500", bar: "bg-amber-500" };
  return { t: "فعّال", c: "bg-teal-50 text-teal-800", stripe: "border-s-teal-500", bar: "bg-teal-500" };
}
/** Each station in the colour it has on the welcome page. */
const MOD_TONE: Record<LicenseModule, string> = {
  station: "border-teal-300 bg-teal-50 text-teal-800",
  purchasing: "border-amber-300 bg-amber-50 text-amber-800",
  training: "border-indigo-300 bg-indigo-50 text-indigo-700",
  qc: "border-rose-300 bg-rose-50 text-rose-700",
  roster: "border-sky-300 bg-sky-50 text-sky-700",
  admin: "border-violet-300 bg-violet-50 text-violet-700",
};
/** Filter tiles: a dot in their colour, filled with it when chosen. */
const TILE_TONE: Record<Filter, { dot: string; on: string }> = {
  all: { dot: "bg-slate-400", on: "bg-slate-700 text-white border-slate-700" },
  active: { dot: "bg-teal-500", on: "bg-teal-600 text-white border-teal-600" },
  soon: { dot: "bg-amber-500", on: "bg-amber-500 text-white border-amber-500" },
  expired: { dot: "bg-red-500", on: "bg-red-600 text-white border-red-600" },
  unused: { dot: "bg-slate-300", on: "bg-slate-500 text-white border-slate-500" },
  stopped: { dot: "bg-red-400", on: "bg-red-500 text-white border-red-500" },
  unpaid: { dot: "bg-orange-500", on: "bg-orange-500 text-white border-orange-500" },
  trial: { dot: "bg-violet-500", on: "bg-violet-600 text-white border-violet-600" },
  outdated: { dot: "bg-yellow-500", on: "bg-yellow-500 text-white border-yellow-500" },
};
const fmtShort = (ms: number | null) => {
  if (!ms) return "—";
  const d = new Date(ms);
  return `${d.toLocaleDateString("en-CA")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

function activationMessage(r: Row, code: string, origin: string) {
  return [
    "رمز تفعيل منظومة مختبر التحليلات المرضية",
    `المختبر: ${r.lab_name}`,
    `الرمز: ${code}`,
    `المدة: ${r.duration_days} يوم تبدأ من يوم التفعيل${r.is_trial ? " (تجريبي)" : ""}`,
    `المحطات: ${r.modules.map(moduleLabel).join("، ")}`,
    "",
    "طريقة التفعيل:",
    `1. افتح ${origin}/welcome على حاسوب المختبر مع اتصال بالإنترنت.`,
    "2. اكتب الرمز في نافذة «تفعيل المحطات» واضغط «تفعيل».",
    "الرمز يعمل على جهاز واحد فقط، والتفعيل يحتاج الإنترنت مرة واحدة.",
    "",
    `للدعم: ${OWNER_PHONE}`,
  ].join("\n");
}
function statusMessage(r: Row, now: number) {
  const left = r.expires_at ? Math.ceil((r.expires_at - now) / DAY) : null;
  return [
    `اشتراك ${r.lab_name} — منظومة مختبر التحليلات المرضية`,
    r.activated_at ? `فعّال من ${fmt(r.activated_at)} حتى ${fmt(r.expires_at)}${left != null ? (left > 0 ? ` (باقٍ ${left} يوم)` : " (منتهٍ)") : ""}` : `لم يُفعّل بعد — المدة ${r.duration_days} يوم تبدأ من التفعيل`,
    `المحطات: ${r.modules.map(moduleLabel).join("، ")}`,
    `للتجديد والدعم: ${OWNER_PHONE}`,
  ].join("\n");
}

function copyText(t: string, done: () => void) { navigator.clipboard?.writeText(t).then(done).catch(() => window.prompt("انسخ النص:", t)); }

function exportCsv(rows: Row[], now: number, soonMs?: number, needsOwn = true) {
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["المختبر", "ملاحظة", "آخر 4 خانات", "الحالة", "تجريبي", "المدة (يوم)", "التفعيل", "الانتهاء", "الجهاز", "آخر اتصال", "الإصدار", "المحطات", "المبلغ", "مدفوع", "تاريخ الدفع", "رسالة للمختبر", "أُنشئ", "قاعدة لوحة الإدارة", ...(STATION_SYNC ? ["قاعدة المزامنة", "آخر مزامنة"] : [])];
  const lines = [head.map(cell).join(",")];
  for (const r of rows) {
    lines.push([r.lab_name, r.note, r.code_hint, status(r, now, soonMs).t, r.is_trial ? "نعم" : "", r.duration_days, fmt(r.activated_at), fmt(r.expires_at), deviceOf(r),
      fmtTime(r.last_seen_at), r.app_version, r.modules.map(moduleLabel).join("، "), r.price, r.paid ? "نعم" : "لا", fmt(r.paid_at), r.message, fmt(r.created_at),
      r.admin_db ? r.admin_db.host : PLACE_LABEL[placeOf(r, needsOwn)],
      ...(STATION_SYNC ? [r.sync ? `${r.sync.kind === "postgres" ? "PostgreSQL" : "Supabase"} — ${r.sync.host}` : "", fmtTime(r.sync_last_at)] : [])].map(cell).join(","));
  }
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `lab-codes-${new Date().toLocaleDateString("en-CA")}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function LicensesPage() {
  const [data, setData] = useState<Data | null>(null);
  const [pw, setPw] = useState("");
  const [code, setCode] = useState("");
  const [needCode, setNeedCode] = useState(false);
  const [err, setErr] = useState("");
  const [shown, setShown] = useState<{ row: Row; code: string } | null>(null);
  const [copied, setCopied] = useState("");
  const [f, setF] = useState({ lab: "", days: 365, custom: "", note: "", modules: [...DEFAULT_MODULES] as LicenseModule[], maxDevices: 1 });
  const [contact, setContact] = useState("");
  const prefsSeen = useRef(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("expiry");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [test, setTest] = useState<Storage | null>(null);
  const [backupMsg, setBackupMsg] = useState("");
  const [testing, setTesting] = useState(false);
  const [dbFor, setDbFor] = useState<Row | null>(null);
  const [adminDbFor, setAdminDbFor] = useState<{ row: Row; provider?: ProviderId } | null>(null);
  const [resetFor, setResetFor] = useState<Row | null>(null);
  const [exportFor, setExportFor] = useState<Row | null>(null);
  // The page's sections (like the lab station's pages), kept in the address (#codes, #new…) so a reload stays.
  const [section, setSection] = useState<Section>(() => (typeof window !== "undefined" ? sectionOf(window.location.hash) : "codes"));
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    const onHash = () => setSection(sectionOf(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const go = (to: Section) => {
    setSection(to); setMenu(false);
    try { history.replaceState(null, "", `#${to}`); } catch { /* ignore */ }
    window.scrollTo({ top: 0 });
  };

  const load = useCallback(async () => {
    const r = await fetch("/api/license/admin", { cache: "no-store" });
    const d = (await r.json()) as Data;
    setData(d);
    if (d.contact != null) setContact(d.contact);
    if (d.prefs && !prefsSeen.current) {
      // A new code starts from the owner's defaults (once, so a half-filled form is kept).
      prefsSeen.current = true;
      setF((x) => ({ ...x, days: d.prefs!.defaultDays, modules: [...d.prefs!.defaultModules] }));
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  const flash = (k: string) => { setCopied(k); setTimeout(() => setCopied(""), 1500); };

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const d = await post({ op: "login", password: pw, code: needCode ? code : undefined });
    if (d.ok) { setPw(""); setCode(""); setNeedCode(false); load(); return; }
    if (d.error === "need_code") { setNeedCode(true); return; }
    setCode("");
    setErr(d.error === "too_many" ? "محاولات كثيرة — حاول بعد قليل." : d.error === "wrong_code" ? "رمز التحقق غير صحيح أو مستعمل — اكتب الرمز الظاهر الآن." : "كلمة المرور غير صحيحة.");
  }
  async function create(trial: boolean) {
    const days = trial ? prefs.trialDays : f.days === -1 ? Number(f.custom) : f.days;
    if (!f.lab.trim() || !days || days < 1) { setErr(f.lab.trim() ? "حدّد المدة." : "اكتب اسم المختبر."); return; }
    setErr("");
    const d = await post({ op: "create", lab: f.lab, days, note: f.note, modules: f.modules, trial, maxDevices: prefs.multiDevice ? f.maxDevices : 1 });
    if (d.ok) { setShown({ row: d.row, code: d.code }); setF({ lab: "", days: prefs.defaultDays, custom: "", note: "", modules: [...prefs.defaultModules], maxDevices: 1 }); load(); }
  }
  async function change(r: Row, c: Record<string, unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    const d = await post({ op: "update", id: r.id, change: c });
    if (d.code && d.row) setShown({ row: d.row, code: d.code });
    load();
  }

  const now = data?.now ?? Date.now();
  const prefs = data?.prefs ?? DEFAULT_PREFS;
  const soonMs = prefs.soonDays * DAY;
  const all = useMemo(() => data?.licenses ?? [], [data]);
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: all.length, active: 0, soon: 0, expired: 0, unused: 0, stopped: 0, unpaid: 0, trial: 0, outdated: 0 };
    for (const r of all) {
      const k = kindOf(r, now, soonMs);
      c[k] += 1;
      if (k === "soon") c.active += 1; // "active" counts every working code
      if (!r.paid) c.unpaid += 1;
      if (r.is_trial) c.trial += 1;
      if (isOutdated(r, data?.version)) c.outdated += 1;
    }
    return c;
  }, [all, now, soonMs, data?.version]);
  const money = useMemo(() => ({
    paid: all.filter((r) => r.paid).reduce((n, r) => n + amount(r.price), 0),
    due: all.filter((r) => !r.paid).reduce((n, r) => n + amount(r.price), 0),
  }), [all]);
  const rows = useMemo(() => {
    const t = q.trim();
    const list = all.filter((r) => {
      if (t && !(r.lab_name.includes(t) || r.note.includes(t) || r.code_hint.includes(t.toUpperCase()) || deviceOf(r).includes(t))) return false;
      const k = kindOf(r, now, soonMs);
      if (filter === "active") return k === "active" || k === "soon";
      if (filter === "unpaid") return !r.paid;
      if (filter === "trial") return r.is_trial;
      if (filter === "outdated") return isOutdated(r, data?.version);
      return filter === "all" || k === filter;
    });
    const exp = (r: Row) => (r.expires_at ?? Number.MAX_SAFE_INTEGER - (r.activated_at ? 0 : 1));
    return list.sort((a, b) =>
      sort === "expiry" ? exp(a) - exp(b) : sort === "name" ? a.lab_name.localeCompare(b.lab_name, "ar")
      : sort === "seen" ? (b.last_seen_at ?? 0) - (a.last_seen_at ?? 0) : b.created_at - a.created_at);
  }, [all, q, filter, sort, now, soonMs, data?.version]);
  const eventsOf = useMemo(() => {
    const m = new Map<string, Ev[]>();
    for (const e of data?.events ?? []) (m.get(e.license_id) ?? m.set(e.license_id, []).get(e.license_id)!).push(e);
    return m;
  }, [data]);

  if (!data) return <div className="p-8 text-center text-sm text-muted">جارٍ التحميل…</div>;

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-5xl px-4 py-8">{children}</div>
    </div>
  );

  if (!data.enabled) return shell(
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-line bg-surface p-6 text-center shadow-[var(--shadow-card)]">
      <ShieldAlert className="mx-auto size-8 text-amber-600" />
      <div className="mt-2 text-lg font-bold">منظومة الرموز غير مفعّلة</div>
      {data.needsDb ? (
        <p className="mt-2 text-sm text-muted">كلمة المرور مضبوطة، لكن لا توجد قاعدة بيانات دائمة لحفظ الرموز. في Vercel افتح Storage ← Create Database ← Neon واربطها بالمشروع بالبادئة <b dir="ltr">LICENSE</b>، ثم أعد النشر. (بقيت المنظومة مطفأة حتى لا تُقفل أجهزة المختبرات.)</p>
      ) : (
        <p className="mt-2 text-sm text-muted">لتفعيلها أضف المتغير <b dir="ltr">LICENSE_ADMIN_PASSWORD</b> (كلمة مرور هذه الصفحة) في إعدادات Vercel ثم أعد النشر.</p>
      )}
    </div>,
  );

  if (!data.owner) return shell(
    <form onSubmit={login} className="mx-auto mt-16 max-w-sm rounded-2xl border border-line bg-surface p-6 text-center shadow-[var(--shadow-card)]">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-light text-brand-dark"><KeyRound className="size-6" /></span>
      <div className="mt-3 text-lg font-bold">إدارة الرموز</div>
      <div className="mb-4" />
      <input type="password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} placeholder="كلمة المرور" autoFocus={!needCode} readOnly={needCode} aria-label="كلمة المرور" className={`${inp} text-center`} />
      {needCode && (
        <div className="mt-3">
          <label className="mb-1 flex items-center justify-center gap-1 text-xs text-muted"><Smartphone className="size-3.5" /> رمز التحقق من تطبيق الهاتف (6 أرقام)</label>
          <input value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setErr(""); }} inputMode="numeric" autoComplete="one-time-code" autoFocus
            dir="ltr" placeholder="000000" aria-label="رمز التحقق" className={`${inp} text-center font-mono text-lg tracking-[0.4em]`} />
        </div>
      )}
      <button className="mt-3 w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">دخول</button>
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
    </form>,
  );

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const TILES: { k: Filter; l: string; tone?: string }[] = [
    { k: "all", l: "الكل" }, { k: "active", l: "فعّال" }, { k: "soon", l: `ينتهي خلال ${prefs.soonDays} يوماً`, tone: "text-amber-700" },
    { k: "expired", l: "منتهٍ", tone: "text-red-700" }, { k: "unused", l: "غير مستخدم" }, { k: "stopped", l: "موقوف", tone: "text-red-700" },
    { k: "unpaid", l: "غير مدفوع", tone: "text-amber-700" }, { k: "trial", l: "تجريبي" },
    { k: "outdated", l: "نسخة قديمة", tone: "text-amber-700" },
  ];

  const soon = counts.soon;
  const main = (
    <>
      {shown && (
        <div className="my-5 rounded-2xl border-2 border-brand bg-brand-light/40 p-5 text-center">
          <div className="text-sm font-semibold">رمز «{shown.row.lab_name}»{shown.row.is_trial ? " — تجريبي" : ""}</div>
          <div className="mt-2 font-mono text-3xl font-extrabold tracking-widest text-brand-dark" dir="ltr">{shown.code}</div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <button onClick={() => copyText(shown.code, () => flash("code"))} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
              {copied === "code" ? <Check className="size-4" /> : <Copy className="size-4" />} {copied === "code" ? "نُسخ" : "نسخ الرمز"}
            </button>
            <button onClick={() => copyText(activationMessage(shown.row, shown.code, origin), () => flash("msg"))} className="inline-flex items-center gap-1.5 rounded-lg border border-brand bg-surface px-4 py-2 text-sm font-semibold text-brand-dark hover:bg-brand-light">
              {copied === "msg" ? <Check className="size-4" /> : <MessageSquareText className="size-4" />} {copied === "msg" ? "نُسخت الرسالة" : "نسخ رسالة التفعيل"}
            </button>
            <button onClick={() => setShown(null)} className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-surface">تم</button>
          </div>
          <p className="mt-2 text-xs text-amber-700">احفظه الآن وأرسله للمختبر — لا يُعرض مرة أخرى (يُحفظ مشفّراً). إن ضاع أنشئ «رمزاً جديداً» لنفس المختبر.</p>
        </div>
      )}


      {section === "codes" && (
        <>
          <SectionTitle icon={<KeyRound className="size-6" />} title="إدارة الرموز" desc="رمز لكل مختبر، يعمل على جهاز واحد، وتبدأ مدته من يوم التفعيل." />
          {data.storage && !data.storage.ok && (
            <button onClick={() => go("system")} className="mb-4 w-full rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-right text-sm text-red-800">
              قاعدة الرموز غير متصلة — افتح «حالة النظام» للتفاصيل.
            </button>
          )}
      {/* Summary tiles = filters */}
      <div className="mb-2 grid grid-cols-3 gap-2">
        {TILES.map((t) => (
          <button key={t.k} onClick={() => setFilter(t.k)} aria-pressed={filter === t.k}
            className={`rounded-xl border px-2.5 py-2 text-right shadow-[var(--shadow-card)] transition-colors sm:px-3.5 sm:py-2.5 ${filter === t.k ? TILE_TONE[t.k].on : "border-line bg-surface hover:border-slate-300"}`}>
            <div className={`font-mono text-2xl font-extrabold leading-tight tabular-nums ${filter === t.k ? "" : t.tone ?? ""}`}>{counts[t.k]}</div>
            <div className={`mt-0.5 flex items-center gap-1.5 text-xs ${filter === t.k ? "text-white/85" : "text-muted"}`}>
              <span className={`size-2 shrink-0 rounded-full ${filter === t.k ? "bg-white/80" : TILE_TONE[t.k].dot}`} />{t.l}
            </div>
          </button>
        ))}
      </div>
      {(money.paid > 0 || money.due > 0) && (
        <p className="mb-5 flex flex-wrap gap-x-4 text-xs text-muted">
          <span><Wallet className="me-1 inline size-3.5" />المدفوع: <b className="tabular-nums text-brand-dark">{money.paid.toLocaleString("en-US")}</b></span>
          <span>غير المدفوع: <b className="tabular-nums text-amber-700">{money.due.toLocaleString("en-US")}</b></span>
        </p>
      )}

      {/* Codes toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث باسم المختبر أو الملاحظة أو الجهاز أو آخر 4 خانات…" aria-label="بحث" className={`${inp} min-w-56 flex-1`} />
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="الترتيب" className="rounded-lg border border-line bg-surface px-2 py-2 text-sm">
          <option value="expiry">الأقرب انتهاءً</option>
          <option value="newest">الأحدث إنشاءً</option>
          <option value="seen">آخر اتصال</option>
          <option value="name">الاسم</option>
        </select>
        <button onClick={() => exportCsv(rows, now, soonMs, prefs.adminNeedsOwnDb)} disabled={!rows.length} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-surface disabled:opacity-50">
          <Download className="size-4" /> تصدير CSV
        </button>
        <button onClick={load} title="تحديث" className="grid size-9 shrink-0 place-items-center rounded-lg border border-line hover:bg-surface"><RefreshCw className="size-4" /></button>
      </div>
      <div className="mb-2 text-xs text-muted">المعروض: {rows.length} من {all.length}</div>

      <div className="flex flex-col gap-3">
        {rows.length === 0 && <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">{all.length ? "لا رموز مطابقة." : "لا رموز بعد."}</p>}
        {rows.map((r) => {
          const st = status(r, now, soonMs);
          const isOpen = open.has(r.id);
          const evs = eventsOf.get(r.id) ?? [];
          return (
            <div key={r.id} className={`rounded-2xl border border-s-4 border-line bg-surface p-4 shadow-[var(--shadow-card)] ${st.stripe}`} data-lab={r.lab_name}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-bold">{r.lab_name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.c}`}>{st.t}</span>
                    {r.is_trial && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">تجريبي</span>}
                    {r.source === "signup" && <span data-testid="signup-badge" className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">تسجيل ذاتي</span>}
                    {r.price.trim() && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.paid ? "bg-teal-50 text-brand-dark" : "bg-amber-50 text-amber-700"}`}>{r.paid ? "مدفوع" : "غير مدفوع"} · <span className="tabular-nums">{r.price}</span></span>}
                    {r.message && <span title={r.message} className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700"><MessageSquare className="size-3" /> رسالة</span>}
                  </div>
                  {r.note && <div className="mt-0.5 text-xs text-muted">{r.note}</div>}
                </div>
                <div className="flex flex-wrap gap-1">
                  <select defaultValue="" onChange={(e) => { const d = Number(e.target.value); e.target.value = ""; if (d) change(r, { action: "extend", days: d }); }}
                    aria-label="تمديد" className="rounded-lg border border-line bg-surface px-2 py-1 text-xs">
                    <option value="" disabled>+ تمديد</option>
                    {PERIODS.map((p) => <option key={p.d} value={p.d}>+ {p.l}</option>)}
                  </select>
                  <button onClick={() => copyText(statusMessage(r, now), () => flash(r.id))} title="نسخ رسالة الحالة (المدة والمحطات) لإرسالها للمختبر" className={small}>
                    {copied === r.id ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} رسالة الحالة
                  </button>
                  {/* Less frequent actions: one size of square icon buttons, named by their tooltip */}
                  {r.device_id && <IconBtn label="نقل لجهاز جديد" onClick={() => change(r, { action: "reset_device" }, "فك ربط الجهاز؟ يستطيع المختبر بعدها إدخال نفس الرمز على جهاز جديد، والمدة تستمر كما هي.")}><MonitorSmartphone className="size-4" /></IconBtn>}
                  {STATION_SYNC && <IconBtn label="قاعدة بيانات المختبر" onClick={() => setDbFor(r)}><Database className="size-4" /></IconBtn>}
                  <IconBtn label="رمز جديد" onClick={() => change(r, { action: "new_code" }, "إنشاء رمز جديد لهذا المختبر؟ الرمز القديم لا يعمل بعدها لتفعيل جهاز، والجهاز الحالي يستمر.")}><KeyRound className="size-4" /></IconBtn>
                  <IconBtn label="تعديل الاسم" onClick={() => { const lab = window.prompt("اسم المختبر:", r.lab_name); if (lab == null) return; const note = window.prompt("ملاحظة:", r.note) ?? r.note; change(r, { action: "rename", lab, note }); }}><Pencil className="size-4" /></IconBtn>
                  {r.status === "active"
                    ? <IconBtn label="إيقاف" danger onClick={() => change(r, { action: "stop" }, `إيقاف رمز «${r.lab_name}»؟ تُقفل محطاته عند أول اتصال بالإنترنت.`)}><Ban className="size-4" /></IconBtn>
                    : <IconBtn label="إعادة تفعيل" onClick={() => change(r, { action: "resume" })}><Play className="size-4" /></IconBtn>}
                  <IconBtn label="حذف" danger onClick={() => change(r, { action: "delete" }, `حذف رمز «${r.lab_name}» نهائياً؟ تُقفل محطاته عند أول اتصال بالإنترنت.`)}><Trash2 className="size-4" /></IconBtn>
                </div>
              </div>
              <TimeLeft r={r} now={now} bar={st.bar} />
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-3 text-xs sm:grid-cols-3 lg:grid-cols-6">
                <Info k="الجهاز" v={deviceOf(r) || "لم يُربط بعد"} />
                {prefs.multiDevice && <Info k="الأجهزة" v={`${(r.device_id ? 1 : 0) + r.devices.length} / ${r.max_devices}`} mono />}
                <Info k="آخر اتصال" v={fmtShort(r.last_seen_at)} mono />
                <VersionInfo r={r} current={data.version} />
                <Info k="الرمز" v={`…${r.code_hint}`} mono />
                <Info k="أُنشئ" v={fmt(r.created_at)} mono />
                {STATION_SYNC && <div data-testid="lab-db" className="min-w-0">
                  <div className="text-[10px] text-muted">مزامنة المحطة</div>
                  <button onClick={() => setDbFor(r)} className="block max-w-full truncate text-start font-medium hover:underline" title={r.sync ? r.sync.host : "غير مربوط — البيانات على الجهاز فقط"}>
                    {r.sync ? <>{r.sync.kind === "postgres" ? "PostgreSQL" : "Supabase"}{r.sync.by === "device" ? " (من الجهاز)" : ""}</> : <span className="text-muted">على الجهاز فقط</span>}
                  </button>
                  {r.sync && <SyncHealth r={r} now={now} />}
                </div>}
                {(r.modules.includes("admin") || r.admin_db) && (
                  <div data-testid="admin-db" className="min-w-0">
                    <div className="text-[10px] text-muted">قاعدة البيانات</div>
                    <button onClick={() => setAdminDbFor({ row: r })} aria-label="قاعدة لوحة الإدارة" className="block max-w-full truncate text-start font-medium hover:underline" title={r.admin_db ? r.admin_db.host : PLACE_LABEL[placeOf(r, prefs.adminNeedsOwnDb)]}>
                      {r.admin_db ? <>قاعدة خاصة{r.admin_db.by === "lab" ? " (من المختبر)" : ""}</>
                        : placeOf(r, prefs.adminNeedsOwnDb) === "waiting" ? <span className="text-amber-700">بانتظار قاعدة خاصة</span>
                        : <span className="text-muted">قسم في قاعدة الموقع</span>}
                    </button>
                  </div>
                )}
              </div>
              <div className="mt-3 text-xs text-muted">المحطات — التغيير يصل للجهاز عند اتصاله بالإنترنت:</div>
              <ModuleChips value={r.modules} onChange={(m) => change(r, { action: "modules", modules: m })} />

              <button onClick={() => setOpen((s) => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })}
                aria-expanded={isOpen} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-dark hover:underline">
                <ChevronDown className={`size-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} /> الدفع والجهاز والرسالة والسجل ({evs.length})
              </button>
              {isOpen && <Details r={r} evs={evs} multi={prefs.multiDevice} onChange={(c) => change(r, c)} />}
            </div>
          );
        })}
      </div>

        </>
      )}

      {section === "new" && (
        <>
          <SectionTitle icon={<Plus className="size-6" />} title="رمز جديد" desc="اسم المختبر والمدة والمحطات المفعّلة. يظهر الرمز مرة واحدة بعد الإنشاء لتنسخه وترسله للمختبر." />
      <form onSubmit={(e) => { e.preventDefault(); create(false); }} className="mb-5 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Plus className="size-4" /> رمز جديد</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">اسم المختبر *<input value={f.lab} onChange={(e) => { setF({ ...f, lab: e.target.value }); setErr(""); }} className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium">المدة (تبدأ من يوم التفعيل)
            <div className="mt-1 flex gap-2">
              <select value={f.days} onChange={(e) => setF({ ...f, days: Number(e.target.value) })} className={inp}>
                {PERIODS.map((p) => <option key={p.d} value={p.d}>{p.l}</option>)}
                <option value={-1}>عدد أيام آخر…</option>
              </select>
              {f.days === -1 && <input type="number" min={1} value={f.custom} onChange={(e) => setF({ ...f, custom: e.target.value })} placeholder="أيام" aria-label="عدد الأيام" className={`${inp} w-28`} />}
            </div>
          </label>
          {prefs.multiDevice && (
            <label className="text-sm font-medium">عدد الأجهزة
              <input type="number" min={1} max={50} value={f.maxDevices} onChange={(e) => setF({ ...f, maxDevices: Math.max(1, Number(e.target.value) || 1) })} aria-label="عدد الأجهزة" className={`mt-1 ${inp}`} />
            </label>
          )}
          <label className="text-sm font-medium sm:col-span-2">ملاحظة (اختياري)<input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="المدينة، اسم المسؤول، رقم الهاتف…" className={`mt-1 ${inp}`} /></label>
        </div>
        <div className="mt-3 text-sm font-medium">المحطات المفعّلة</div>
        <ModuleChips value={f.modules} onChange={(m) => setF({ ...f, modules: m })} />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"><KeyRound className="size-4" /> إنشاء الرمز</button>
          <button type="button" onClick={() => create(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-100">
            <FlaskConical className="size-4" /> رمز تجريبي {prefs.trialDays} {prefs.trialDays <= 10 ? "أيام" : "يوماً"}
          </button>
          {err && <span className="text-xs text-red-600">{err}</span>}
        </div>
      </form>

        </>
      )}

      {section === "security" && (
        <>
          <SectionTitle icon={<ShieldCheck className="size-6" />} title="الأمان" desc="التحقق بخطوتين عند الدخول، وسجل محاولات الدخول لهذه الصفحة." />
          <TwoFactorCard tf={data.twoFactor} reload={load} />
      {/* Owner sign-in log */}
      <Panel tone="teal" icon={<ShieldCheck className="size-5" />} title="سجل الدخول لهذه الصفحة"
        desc="آخر محاولات الدخول الناجحة والفاشلة. بعد 8 محاولات خاطئة من نفس العنوان يُمنع الدخول 10 دقائق.">
        {(data.signIns ?? []).length === 0 ? <p className="text-xs text-muted">لا شيء بعد.</p> : (
          <ul className="max-h-64 overflow-y-auto rounded-lg border border-line text-xs">
            {data.signIns!.map((x, i) => (
              <li key={i} className={`flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-1.5 last:border-0 ${x.ok ? "" : "bg-red-50/60"}`}>
                <span className={`font-semibold ${x.ok ? "text-brand-dark" : "text-red-700"}`}>{x.ok ? "✓ دخول ناجح" : "✗ محاولة فاشلة"}</span>
                <span className="text-muted" dir="ltr">{x.ip}</span>
                <span className="text-muted">{agentLabel(x.agent)}</span>
                <span className="font-mono tabular-nums text-muted" dir="ltr">{fmtShort(x.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

        </>
      )}

      {section === "backup" && (
        <>
          <SectionTitle icon={<Database className="size-6" />} title="النسخ الاحتياطي" desc="نسخة من كل الرموز وسجلها تُحفظ عندك، وتُسترجع عند الحاجة." />
      {/* Backup of the codes */}
      <Panel tone="sky" icon={<Database className="size-5" />} title="نسخة احتياطية للرموز"
        desc="ملف يحفظ كل الرموز (مشفّرة كما هي في القاعدة — لا تظهر فيه الرموز نفسها) وسجلها وسطر التواصل. الاسترجاع يضيف ويحدّث ولا يحذف شيئاً. احفظ الملف في مكان آمن ولا تشاركه.">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={async () => {
            const d = await post({ op: "backup" });
            if (!d.ok) { setBackupMsg("تعذّر التصدير."); return; }
            const blob = new Blob([JSON.stringify(d.backup, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = `lab-codes-backup-${new Date().toLocaleDateString("en-CA")}.json`;
            document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
            setBackupMsg(`نُزّلت النسخة: ${d.backup.licenses.length} رمز و${d.backup.events.length} حدث.`);
          }} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">
            <Download className="size-4" /> تنزيل نسخة احتياطية
          </button>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">
            <Upload className="size-4" /> استرجاع نسخة
            <input type="file" accept="application/json,.json" aria-label="ملف النسخة" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0]; e.target.value = "";
              if (!file) return;
              let backup: unknown;
              try { backup = JSON.parse(await file.text()); } catch { setBackupMsg("الملف غير صالح."); return; }
              if (!window.confirm("استرجاع هذه النسخة؟ تُضاف الرموز غير الموجودة وتُحدَّث الموجودة إلى ما في الملف.")) return;
              const d = await post({ op: "restore", backup });
              setBackupMsg(d.ok ? `تم الاسترجاع: ${d.licenses} رمز و${d.events} حدث.` : "الملف ليس نسخة رموز صالحة.");
              load();
            }} />
          </label>
          {backupMsg && <span className="text-xs text-brand-dark">{backupMsg}</span>}
        </div>
      </Panel>

        </>
      )}

      {section === "databases" && (
        <>
          <SectionTitle icon={<HardDrive className="size-6" />} title="قواعد البيانات"
            desc="قاعدة لوحة الإدارة الكاملة لكل عميل: اربطها أو غيّرها أو افحصها من هنا. المحطات تعمل على أجهزتها ولا تحتاج قاعدة." />
          <Databases rows={all} now={now} needsOwn={prefs.adminNeedsOwnDb} onExport={prefs.dataExport ? setExportFor : undefined} onOpen={(row, provider) => setAdminDbFor({ row, provider })} onReset={setResetFor} onChecked={load} />
        </>
      )}

      {section === "settings" && (
        <>
          <SectionTitle icon={<Settings className="size-6" />} title="الإعدادات العامة" desc="القيم التي يبدأ بها كل رمز جديد، والتنبيه قبل الانتهاء، وسطر التواصل الذي تراه المختبرات." />
          <PrefsCard prefs={prefs} onSaved={load} />
      {/* Contact line */}
      <Panel tone="amber" icon={<Phone className="size-5" />} title="سطر التواصل"
        desc={<>يظهر في نافذة التفعيل وشاشة القفل. إذا تُرك فارغاً يظهر رقمك: <span className="font-mono" dir="ltr">{OWNER_PHONE}</span>.</>}>
        <div className="flex gap-2">
          <input value={contact} onChange={(e) => setContact(e.target.value)} className={inp} placeholder="للتفعيل أو التجديد تواصل مع: …" aria-label="سطر التواصل" />
          <button onClick={async () => { await post({ op: "contact", contact }); load(); flash("contact"); }} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">{copied === "contact" ? "حُفظ" : "حفظ"}</button>
        </div>
      </Panel>
        </>
      )}

      {section === "errors" && (
        <>
          <SectionTitle icon={<Bug className="size-6" />} title="سجل الأخطاء" desc="الأخطاء التي ظهرت في الموقع والمحطات ولوحة الإدارة، مع المختبر والصفحة. يُحفظ آخر 2000 خطأ فقط أثناء تشغيل الخاصية." />
          <ErrorsLog on={prefs.errorLog} />
        </>
      )}

      {section === "system" && (
        <>
          <SectionTitle icon={<Server className="size-6" />} title="حالة النظام" desc="أين تُحفظ الرموز، ومفتاح التوقيع، وإصدار الموقع." />
          {data.storage && <SystemStatus storage={data.storage} version={data.version} test={test} testing={testing}
            onTest={async () => { setTesting(true); const d = await post({ op: "selftest" }); setTest(d.storage ?? { source: data.storage!.source, ok: false, error: "no reply" }); setTesting(false); }} />}
        </>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-canvas md:flex">
      <OwnerNav section={section} go={go} total={counts.all} soon={soon} soonDays={prefs.soonDays}
        dbDown={all.filter((r) => r.admin_db && r.admin_db_check && !r.admin_db_check.ok).length} showErrors={prefs.errorLog} open={menu} setOpen={setMenu}
        onLogout={async () => { await post({ op: "logout" }); load(); }} />
      <main className="min-w-0 flex-1 p-4 md:p-7">
        <div className="mx-auto max-w-5xl">{main}</div>
      </main>
      {dbFor && <DbModal row={dbFor} rows={all} onClose={() => setDbFor(null)} onSaved={() => { setDbFor(null); load(); }} />}
      {adminDbFor && <AdminDbModal row={adminDbFor.row} provider={adminDbFor.provider} needsOwn={prefs.adminNeedsOwnDb} rows={all} onClose={() => setAdminDbFor(null)} onSaved={() => { setAdminDbFor(null); load(); }} />}
      {resetFor && <ResetAdminModal row={resetFor} onClose={() => setResetFor(null)} />}
      {exportFor && <ExportModal row={exportFor} needCode={!!data.twoFactor?.enabled} onClose={() => setExportFor(null)} />}
    </div>
  );
}

/** Payment, device name, message to the lab and the code's history. */
function Details({ r, evs, multi, onChange }: { r: Row; evs: Ev[]; multi: boolean; onChange: (c: Record<string, unknown>) => void }) {
  const [maxDev, setMaxDev] = useState(r.max_devices);
  const [price, setPrice] = useState(r.price);
  const [paid, setPaid] = useState(r.paid);
  const [dev, setDev] = useState(r.device_name);
  const [msg, setMsg] = useState(r.message);
  useEffect(() => { setPrice(r.price); setPaid(r.paid); setDev(r.device_name); setMsg(r.message); }, [r.price, r.paid, r.device_name, r.message]);
  return (
    <div className="mt-3 grid gap-3 rounded-xl bg-canvas p-3 md:grid-cols-2">
      <div>
        <div className="mb-1 flex items-center gap-1 text-xs font-semibold"><Wallet className="size-3.5" /> المبلغ والدفع</div>
        <div className="flex flex-wrap items-center gap-2">
          <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="المبلغ، مثلاً 150,000" aria-label="المبلغ" className={`${inp} max-w-44`} dir="ltr" />
          <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} aria-label="مدفوع" /> مدفوع</label>
          <button onClick={() => onChange({ action: "payment", price, paid })} disabled={price === r.price && paid === r.paid} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-40">حفظ</button>
        </div>
        {r.paid && r.paid_at && <div className="mt-1 text-[11px] text-muted">سُجّل الدفع: {fmt(r.paid_at)}</div>}
      </div>
      <div>
        <div className="mb-1 flex items-center gap-1 text-xs font-semibold"><MonitorSmartphone className="size-3.5" /> اسم الجهاز</div>
        {r.device_id ? (
          <div className="flex gap-2">
            <input value={dev} onChange={(e) => setDev(e.target.value)} placeholder={r.device_label || "مثلاً: حاسوب الاستقبال"} aria-label="اسم الجهاز" className={inp} />
            <button onClick={() => onChange({ action: "device_name", name: dev })} disabled={dev === r.device_name} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-40">حفظ</button>
          </div>
        ) : <p className="text-xs text-muted">لم يُربط بجهاز بعد.</p>}
        {r.device_label && <div className="mt-1 text-[11px] text-muted">النوع: {r.device_label}</div>}
      </div>
      {multi && (
        <div className="md:col-span-2" data-testid="devices">
          <div className="mb-1 flex items-center gap-1 text-xs font-semibold"><MonitorSmartphone className="size-3.5" /> أجهزة المختبر على هذا الرمز</div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span>عدد الأجهزة المسموحة</span>
            <input type="number" min={1} max={50} value={maxDev} onChange={(e) => setMaxDev(Math.max(1, Number(e.target.value) || 1))} aria-label="عدد الأجهزة المسموحة" className={`${inp} w-20`} />
            <button onClick={() => onChange({ action: "max_devices", n: maxDev })} disabled={maxDev === r.max_devices} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-40">حفظ</button>
          </div>
          {r.devices.length > 0 ? (
            <ul className="mt-2 rounded-lg border border-line bg-surface text-xs">
              {r.devices.map((d) => (
                <li key={d.device_id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-1.5 last:border-0">
                  <span>{d.label || "جهاز"} <span className="text-muted">— آخر اتصال {fmtShort(d.last_seen_at)}</span></span>
                  <button onClick={() => { if (window.confirm("إزالة هذا الجهاز من الرمز؟ يُقفل عند اتصاله التالي.")) onChange({ action: "remove_device", device: d.device_id }); }} className="text-red-700 hover:underline">إزالة</button>
                </li>
              ))}
            </ul>
          ) : <p className="mt-1 text-[11px] text-muted">لا أجهزة إضافية بعد — تُضاف عند إدخال الرمز نفسه على جهاز آخر للمختبر.</p>}
        </div>
      )}
      <div className="md:col-span-2">
        <div className="mb-1 flex items-center gap-1 text-xs font-semibold"><MessageSquare className="size-3.5" /> رسالة للمختبر</div>
        <p className="mb-1 text-[11px] text-muted">تظهر على محطاته عند أول اتصال بالإنترنت، حتى يضغط «تم». الرسالة الجديدة تظهر من جديد.</p>
        <div className="flex gap-2">
          <input value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={300} placeholder="مثلاً: يرجى تجديد الاشتراك قبل نهاية الشهر" aria-label="رسالة للمختبر" className={inp} />
          <button onClick={() => onChange({ action: "message", text: msg })} disabled={msg === r.message} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-40">إرسال</button>
          {r.message && <button onClick={() => onChange({ action: "message", text: "" })} className="rounded-lg border border-line px-3 py-1.5 text-xs hover:bg-surface">إزالة</button>}
        </div>
      </div>
      <div className="md:col-span-2">
        <div className="mb-1 flex items-center gap-1 text-xs font-semibold"><History className="size-3.5" /> السجل</div>
        {evs.length === 0 ? <p className="text-xs text-muted">لا أحداث بعد.</p> : (
          <ul className="max-h-56 overflow-y-auto rounded-lg border border-line bg-surface text-xs">
            {evs.map((e, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-3 py-1.5 last:border-0">
                <span><b>{EVENT_LABEL[e.kind] ?? e.kind}</b>{eventDetail(e) ? <span className="text-muted"> — {eventDetail(e)}</span> : null}</span>
                <span className="tabular-nums text-muted">{fmtTime(e.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** How the device's sync goes, from its last report: an error, a stale sync, or when it last synced. */
const SYNC_SHORT: Record<string, string> = {
  auth: "فشل الدخول إلى القاعدة", no_table: "الجدول غير موجود في القاعدة", unreachable: "القاعدة لا ترد", tls: "مشكلة شهادة TLS",
  needs_join: "بانتظار اختيار طريقة الربط على الجهاز", no_code: "الجهاز بلا رمز صالح", private_host: "عنوان داخلي مرفوض", db: "خطأ في القاعدة",
};
const SYNC_STALE = DAY;
function SyncHealth({ r, now }: { r: Row; now: number }) {
  if (!r.device_id) return <div className="text-[11px] text-muted">يبدأ بعد التفعيل</div>;
  if (!r.sync_reported_at) return <div className="text-[11px] text-muted" data-testid="sync-health">لم يُبلّغ الجهاز بعد</div>;
  if (r.sync_error && r.sync_error !== "offline") {
    return <div className="truncate text-[11px] text-red-700" data-testid="sync-health" title={fmtShort(r.sync_reported_at)}>⚠️ {SYNC_SHORT[r.sync_error] ?? SYNC_SHORT.db}</div>;
  }
  const stale = !r.sync_last_at || now - r.sync_last_at > SYNC_STALE;
  return (
    <div className={`truncate text-[11px] ${stale ? "text-amber-700" : "text-teal-700"}`} data-testid="sync-health">
      {stale ? "⚠️ " : "✓ "}آخر مزامنة <span dir="ltr" className="font-mono tabular-nums">{fmtShort(r.sync_last_at)}</span>
      {r.sync_pending > 0 && <> · ينتظر <span className="tabular-nums">{r.sync_pending}</span></>}
    </div>
  );
}

/** A bound device whose app is not the current version (or too old to say which it is). */
function isOutdated(r: Row, current?: string): boolean {
  return !!r.device_id && r.status === "active" && !!current && r.app_version !== current;
}
function VersionInfo({ r, current }: { r: Row; current?: string }) {
  const v = r.app_version;
  const tone = !r.device_id ? "" : !v || (current && v !== current) ? "text-amber-700" : "text-teal-700";
  const text = !r.device_id ? "—" : !v ? "⚠️ قديمة (قبل هذا التحديث)" : current && v !== current ? `⚠️ ${v} — أقدم` : `✓ ${v}`;
  return (
    <div data-testid="app-version" title={current ? `أحدث إصدار: ${current}` : undefined}>
      <div className="text-[10px] text-muted">الإصدار</div><div className={`text-right font-mono font-medium tabular-nums ${tone}`} dir="ltr">{text}</div>
    </div>
  );
}

function Info({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] text-muted">{k}</div>
      <div className={`truncate font-medium ${mono ? "text-right font-mono tabular-nums" : ""}`} dir={mono ? "ltr" : undefined} title={v}>{v}</div>
    </div>
  );
}

/** How much of the period is left, as words, dates and a bar. */
function TimeLeft({ r, now, bar }: { r: Row; now: number; bar: string }) {
  if (!r.activated_at || !r.expires_at) {
    return <div className="mt-3 text-xs text-muted" data-testid="time-left">المدة <b className="font-mono tabular-nums text-ink">{r.duration_days}</b> يوم — تبدأ عند التفعيل</div>;
  }
  const total = Math.max(1, r.expires_at - r.activated_at);
  const left = r.expires_at - now;
  const days = Math.ceil(left / DAY);
  const pct = Math.max(0, Math.min(100, (left / total) * 100));
  return (
    <div className="mt-3" data-testid="time-left">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted">
        <span>{days > 0 ? <>باقٍ <b className="font-mono text-sm tabular-nums text-ink">{days}</b> يوماً</> : <>انتهت المدة</>}</span>
        <span className="font-mono tabular-nums" dir="ltr">{fmt(r.activated_at)} → {fmt(r.expires_at)}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200/70" role="progressbar" aria-label="المدة المتبقية" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <span className={`block h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** A square icon button (one size for every less-used action), named by its tooltip. */
function IconBtn({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={label} aria-label={label}
      className={`grid size-8 place-items-center rounded-lg border border-line bg-surface transition-colors ${danger ? "text-red-600 hover:border-red-200 hover:bg-red-50" : "text-slate-600 hover:bg-canvas hover:text-ink"}`}>
      {children}
    </button>
  );
}

function ModuleChips({ value, onChange }: { value: LicenseModule[]; onChange: (m: LicenseModule[]) => void }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {LICENSE_MODULES.map((m) => {
        const on = value.includes(m.id);
        return (
          <button key={m.id} type="button" aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== m.id) : [...value, m.id])}
            className={`rounded-full border px-2.5 py-1 text-xs ${on ? `${MOD_TONE[m.id]} font-semibold` : "border-line text-muted line-through hover:bg-canvas"}`}>
            {on ? "✓ " : ""}{m.label}
          </button>
        );
      })}
    </div>
  );
}

/** A settings card: a large coloured icon, a clear title and what the card is for. */
const PANEL_TONE = {
  sky: "bg-sky-100 text-sky-700",
  violet: "bg-violet-100 text-violet-700",
  teal: "bg-teal-100 text-teal-700",
  amber: "bg-amber-100 text-amber-700",
} as const;
function Panel({ tone, icon, title, desc, testid, children }: {
  tone: keyof typeof PANEL_TONE; icon: React.ReactNode; title: string; desc: React.ReactNode; testid?: string; children: React.ReactNode;
}) {
  return (
    <div className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]" data-testid={testid}>
      <div className="mb-4 flex items-start gap-3">
        <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${PANEL_TONE[tone]}`}>{icon}</span>
        <div className="min-w-0">
          <h2 className="text-base font-bold">{title}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">{desc}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

/** «التحقق بخطوتين»: a 6-digit code from an authenticator app on the owner's phone, with the password. */
function TwoFactorCard({ tf, reload }: { tf?: TwoFactor; reload: () => void }) {
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  if (!tf) return null;
  const codeInput = (
    <input value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setMsg(""); }} inputMode="numeric" autoComplete="one-time-code"
      dir="ltr" placeholder="000000" aria-label="رمز التحقق" className="w-36 rounded-lg border border-line bg-surface px-3 py-2 text-center font-mono text-sm tracking-[0.3em] outline-none focus:border-brand" />
  );
  async function run(op: string, ok: string) {
    setBusy(true);
    const d = await post({ op, code });
    setBusy(false); setCode("");
    if (d.ok) { setSetup(null); setMsg(ok); reload(); } else setMsg("الرمز غير صحيح أو مستعمل — اكتب الرمز الظاهر الآن في التطبيق.");
  }
  async function begin() {
    setBusy(true); setMsg("");
    const d = await post({ op: "totp_setup" });
    setBusy(false);
    if (d.ok) setSetup({ secret: d.secret, qr: d.qr }); else setMsg("يحتاج المتغير AUTH_SECRET في Vercel.");
  }
  return (
    <Panel tone="violet" icon={<Smartphone className="size-5" />} title="التحقق بخطوتين" testid="two-factor"
      desc="مع كلمة المرور يُطلب رمز من 6 أرقام يتغيّر كل 30 ثانية في تطبيق على هاتفك (Google Authenticator أو Microsoft Authenticator). لو تسرّبت كلمة المرور لا يدخل أحد بدون هاتفك.">
      {tf.forcedOff && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">التحقق بخطوتين موقوف الآن من Vercel (المتغير <b dir="ltr">LICENSE_2FA_OFF</b>). فعّله من جديد بهاتفك، ثم احذف المتغير وأعد النشر.</p>
      )}
      {tf.broken && !setup && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">تغيّر AUTH_SECRET بعد التفعيل فلم يعد الرمز القديم يعمل — التحقق متوقف الآن. فعّله من جديد.</p>
      )}
      {tf.enabled && !tf.forcedOff ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-brand-dark">✓ مفعّل — يُطلب رمز الهاتف عند كل دخول.</p>
          <div className="flex flex-wrap items-center gap-2">
            {codeInput}
            <button disabled={busy || code.length !== 6} onClick={() => { if (window.confirm("إيقاف التحقق بخطوتين؟ سيكفي بعدها كلمة المرور وحدها.")) run("totp_disable", "أُوقف التحقق بخطوتين."); }}
              className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50">إيقاف</button>
          </div>
          <p className="text-xs text-muted">إذا فقدت هاتفك: أضف في Vercel المتغير <b dir="ltr">LICENSE_2FA_OFF</b> بقيمة <b dir="ltr">1</b> وأعد النشر، ادخل بكلمة المرور وفعّله بالهاتف الجديد، ثم احذف المتغير.</p>
        </div>
      ) : setup ? (
        <div className="flex flex-wrap items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qr} alt="رمز QR لتطبيق التحقق" className="size-44 rounded-lg border border-line bg-white p-1" />
          <ol className="min-w-0 flex-1 list-decimal space-y-2 ps-5 text-sm">
            <li>ثبّت على هاتفك <b>Google Authenticator</b> أو <b>Microsoft Authenticator</b>.</li>
            <li>في التطبيق اختر «إضافة» ← «مسح رمز QR» وامسح الرمز. أو اكتب هذا المفتاح يدوياً:
              <div data-testid="totp-secret" dir="ltr" className="mt-1 select-all break-all rounded-md bg-canvas px-2 py-1 font-mono text-xs">{setup.secret.match(/.{1,4}/g)!.join(" ")}</div>
            </li>
            <li>اكتب الرمز الظاهر في التطبيق:
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {codeInput}
                <button disabled={busy || code.length !== 6} onClick={() => run("totp_enable", "✓ فُعّل التحقق بخطوتين.")}
                  className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">تأكيد التفعيل</button>
                <button onClick={() => { setSetup(null); setCode(""); setMsg(""); }} className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">إلغاء</button>
              </div>
            </li>
          </ol>
        </div>
      ) : tf.canSetup ? (
        <button disabled={busy} onClick={begin} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
          <Smartphone className="size-4" /> تفعيل التحقق بخطوتين
        </button>
      ) : (
        <p className="text-xs text-amber-700">يحتاج المتغير AUTH_SECRET في Vercel أولاً.</p>
      )}
      {msg && <p className="mt-2 text-xs text-brand-dark">{msg}</p>}
    </Panel>
  );
}

/** «قاعدة بيانات المختبر» for one code: the lab's own Supabase or PostgreSQL, sent to its device. */
function DbModal({ row, rows, onClose, onSaved }: { row: Row; rows: Row[]; onClose: () => void; onSaved: () => void }) {
  const [kind, setKind] = useState<"none" | "supabase" | "postgres">(row.sync?.kind ?? "none");
  const [f, setF] = useState({ url: "", anonKey: "", email: "", password: "", conn: "" });
  const [savedHost, setSavedHost] = useState(row.sync?.kind === "postgres" ? row.sync.host : "");
  const [hasSaved, setHasSaved] = useState(!!row.sync);
  /** Which kind is saved: an empty password / connection string keeps that one only. */
  const [savedKind, setSavedKind] = useState(row.sync?.kind ?? "");
  const [from, setFrom] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    post({ op: "sync_get", id: row.id }).then((d) => {
      const c = d?.config;
      if (!c) { setHasSaved(false); setSavedKind(""); return; }
      setHasSaved(true); setSavedKind(c.kind);
      if (c.kind === "supabase") setF((x) => ({ ...x, url: c.url ?? "", anonKey: c.anonKey ?? "", email: c.email ?? "" }));
      else setSavedHost(c.host ?? "");
    });
  }, [row.id]);
  const others = rows.filter((r) => r.id !== row.id && r.sync);
  const config = () => kind === "supabase"
    ? { kind, url: f.url.trim(), anonKey: f.anonKey.trim(), email: f.email.trim(), password: f.password }
    : { kind, conn: f.conn.trim() };
  async function go(op: "sync_test" | "sync_set" | "unlink" | "copy") {
    setBusy(true); setMsg(null);
    const d = op === "unlink" ? await post({ op: "sync_set", id: row.id, config: null })
      : op === "copy" ? await post({ op: "sync_copy", id: row.id, from })
      : await post({ op, id: row.id, config: config() });
    setBusy(false);
    if (!d.ok) { setMsg({ ok: false, text: SYNC_ERRORS[d.error] ?? SYNC_ERRORS.db }); return; }
    if (op === "sync_test") { setMsg({ ok: true, text: `✓ الاتصال يعمل — في القاعدة ${d.records ?? 0} سجلاً.` }); return; }
    onSaved();
  }
  const canTry = kind === "supabase" ? f.url && f.anonKey && f.email && (f.password || savedKind === "supabase") : kind === "postgres" && (f.conn.trim() || (savedKind === "postgres" && savedHost));
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={onClose}>
      <div role="dialog" aria-label="قاعدة بيانات المختبر" data-testid="db-modal" onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-pop)]">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Database className="size-5 text-brand" /> قاعدة بيانات المختبر — {row.lab_name}</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          يبقى جهاز المختبر يعمل ويحفظ على نفسه حتى بدون إنترنت، ويزامن بياناته مع قاعدة بيانات خاصة بالمختبر.
          اربط كل رموز المختبر الواحد (كل أجهزته) بالقاعدة نفسها لتتشارك الزيارات والمراجعين. يصل الربط للجهاز عند اتصاله بالإنترنت.
          تُزامَن النصوص فقط (الصور تبقى على كل جهاز). تُحفظ بيانات الاتصال مشفّرة بـ AUTH_SECRET.
        </p>
        <div className="mt-3 inline-flex rounded-lg border border-line p-0.5 text-xs">
          {([["none", "بدون (على الجهاز فقط)"], ["supabase", "Supabase"], ["postgres", "PostgreSQL"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => { setKind(k); setMsg(null); }} className={`rounded-md px-3 py-1 ${kind === k ? "bg-brand text-white" : "hover:bg-canvas"}`}>{l}</button>
          ))}
        </div>
        {kind === "supabase" && (
          <div className="mt-3 space-y-2">
            <ol className="list-inside list-decimal space-y-0.5 text-xs text-muted">
              <li>مشروع Supabase خاص بالمختبر ← SQL Editor ← الصق سكربت الإعداد ونفّذه.</li>
              <li>Authentication ← Users ← أضف مستخدماً للمختبر (بريد وكلمة مرور).</li>
              <li>Project Settings ← API: Project URL و anon key.</li>
            </ol>
            <button type="button" onClick={() => copyText(SUPABASE_SQL, () => { setCopied(true); setTimeout(() => setCopied(false), 2000); })} className={small}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} نسخ سكربت الإعداد (SQL)
            </button>
            <div className="grid gap-2 sm:grid-cols-2">
              <input dir="ltr" aria-label="Project URL" placeholder="https://xxxx.supabase.co" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} className={inp} />
              <input dir="ltr" aria-label="anon key" placeholder="anon key" value={f.anonKey} onChange={(e) => setF({ ...f, anonKey: e.target.value })} className={inp} />
              <input dir="ltr" aria-label="بريد مستخدم المختبر" placeholder="lab@example.com" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={inp} />
              <input dir="ltr" type="password" aria-label="كلمة مرور مستخدم المختبر" placeholder={savedKind === "supabase" ? "(محفوظة — اتركها فارغة للإبقاء)" : "كلمة المرور"} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className={inp} />
            </div>
          </div>
        )}
        {kind === "postgres" && (
          <div className="mt-3 space-y-2">
            <input dir="ltr" aria-label="رابط الاتصال" placeholder={savedKind === "postgres" && savedHost ? `(محفوظ: ${savedHost} — اتركه فارغاً للإبقاء)` : "postgresql://user:password@host:5432/db"} value={f.conn} onChange={(e) => setF({ ...f, conn: e.target.value })} className={inp} />
            <p className="text-[11px] text-muted">أي PostgreSQL: Neon أو Supabase (Connection string) أو Railway أو خادم خاص. يتصل الخادم بالقاعدة وينشئ الجدول بنفسه، ولا يصل الرابط إلى الجهاز.</p>
          </div>
        )}
        {kind === "none" && <p className="mt-3 text-sm text-muted">{hasSaved ? "الحفظ يلغي ربط هذا الرمز بقاعدته — تبقى البيانات على الجهاز وفي القاعدة كما هي." : "بيانات هذا المختبر على جهازه فقط."}</p>}

        {others.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-xs">
            <span className="text-muted">أو استخدم قاعدة رمز آخر (جهاز آخر للمختبر نفسه):</span>
            <select value={from} onChange={(e) => setFrom(e.target.value)} aria-label="نسخ من رمز" className="rounded-lg border border-line bg-surface px-2 py-1">
              <option value="">— اختر —</option>
              {others.map((o) => <option key={o.id} value={o.id}>{o.lab_name}{o.device_name ? ` — ${o.device_name}` : ""} ({o.sync!.kind === "postgres" ? "PostgreSQL" : "Supabase"})</option>)}
            </select>
            <button disabled={busy || !from} onClick={() => go("copy")} className={`${small} disabled:opacity-50`}><Copy className="size-3.5" /> ربط بها</button>
          </div>
        )}

        {msg && <p className={`mt-3 text-sm ${msg.ok ? "text-teal-700" : "text-red-700"}`} data-testid="db-msg">{msg.text}</p>}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-canvas">إغلاق</button>
          {kind === "none" ? (
            hasSaved && <button disabled={busy} onClick={() => go("unlink")} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">إلغاء الربط</button>
          ) : (
            <>
              <button disabled={busy || !canTry} onClick={() => go("sync_test")} className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-canvas disabled:opacity-50">اختبار الاتصال</button>
              <button disabled={busy || !canTry} onClick={() => go("sync_set")} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">حفظ وربط</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** «قواعد البيانات»: every client with the full admin panel, where its panel keeps its data — one
 *  tab per provider (Neon, Supabase, Railway, any other PostgreSQL) with its own steps to link. */
type DbTab = "all" | ProviderId;
const providerOfRow = (r: Row): ProviderId | null => (r.admin_db ? r.admin_db.provider ?? providerOf(r.admin_db.host) : null);
/** A saved database is checked again when the owner opens the list and its last check is older than this. */
const RECHECK_MS = 30 * 60_000;

function Databases({ rows, now, needsOwn, onOpen, onReset, onChecked, onExport }: {
  rows: Row[]; now: number; needsOwn: boolean; onOpen: (r: Row, p?: ProviderId) => void; onReset: (r: Row) => void; onChecked: () => void;
  /** The hidden data export, when switched on. */
  onExport?: (r: Row) => void;
}) {
  const [tab, setTab] = useState<DbTab>("all");
  const [q, setQ] = useState("");
  const [pick, setPick] = useState("");
  const [checks, setChecks] = useState<Record<string, { busy?: boolean; ok?: boolean; text?: string }>>({});
  const [checkingAll, setCheckingAll] = useState(false);
  const clients = useMemo(() => rows.filter((r) => r.modules.includes("admin") || r.admin_db), [rows]);
  const count = (t: DbTab) => (t === "all" ? clients.length : clients.filter((r) => providerOfRow(r) === t).length);
  const list = useMemo(() => {
    const t = q.trim();
    return clients
      .filter((r) => tab === "all" || providerOfRow(r) === tab)
      .filter((r) => !t || r.lab_name.includes(t) || r.note.includes(t) || deviceOf(r).includes(t) || (r.admin_db?.host ?? "").includes(t))
      .sort((a, b) => Number(!!b.admin_db) - Number(!!a.admin_db) || a.lab_name.localeCompare(b.lab_name, "ar"));
  }, [clients, tab, q]);
  const own = clients.filter((r) => r.admin_db);
  const down = own.filter((r) => r.admin_db_check && !r.admin_db_check.ok);

  const check = useCallback(async (r: Row) => {
    setChecks((c) => ({ ...c, [r.id]: { busy: true } }));
    const d = await post({ op: "admin_db_test", id: r.id });
    setChecks((c) => ({ ...c, [r.id]: d.ok ? { ok: true, text: `✓ تعمل — ${d.users} مستخدم` } : { ok: false, text: adminDbError(d.error) } }));
  }, []);
  const checkMany = useCallback(async (targets: Row[]) => {
    if (!targets.length) return;
    setCheckingAll(true);
    for (const r of targets) await check(r);
    setCheckingAll(false);
    onChecked();
  }, [check, onChecked]);
  // Opening the list checks the databases not checked for a while (the result is kept for next time).
  const stale = own.filter((r) => !r.admin_db_check || now - r.admin_db_check.at > RECHECK_MS).map((r) => r.id).join(",");
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current || !stale) return;
    autoRan.current = true;
    const ids = new Set(stale.split(","));
    void checkMany(rows.filter((r) => ids.has(r.id)));
  }, [stale, rows, checkMany]);

  const lastCheck = (r: Row) => {
    const c = checks[r.id];
    if (c?.busy) return <span className="text-muted">جارٍ الفحص…</span>;
    if (c?.text) return <span className={c.ok ? "text-teal-700" : "text-red-700"}>{c.text}</span>;
    const s = r.admin_db_check;
    if (!s) return <span className="text-muted">لم تُفحص بعد</span>;
    return s.ok
      ? <span className="text-teal-700">✓ تعمل — آخر فحص {fmtShort(s.at)}</span>
      : <span className="text-red-700">✗ لا تستجيب ({adminDbError(s.error)}) — {fmtShort(s.at)}</span>;
  };
  async function importShared(r: Row) {
    if (!window.confirm(`نقل بيانات لوحة الإدارة القديمة المشتركة (من قبل فصل المختبرات) إلى «${r.lab_name}»؟\nاستخدمه للمختبر الذي كان يعمل عليها فقط — تُنسخ كلها، والسجلات الموجودة تبقى كما هي.`)) return;
    setChecks((c) => ({ ...c, [r.id]: { busy: true } }));
    const d = await post({ op: "admin_db_import_shared", id: r.id });
    setChecks((c) => ({ ...c, [r.id]: d.ok ? { ok: true, text: `✓ نُقلت البيانات القديمة: ${d.copied?.rows ?? 0} سجلاً` } : { ok: false, text: adminDbError(d.error) } }));
  }
  const tabs: [DbTab, string][] = [["all", "الكل"], ...PROVIDERS.map((p) => [p.id, p.name] as [DbTab, string])];
  const candidates = clients.filter((r) => r.modules.includes("admin"));

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {([["عملاء بلوحة الإدارة", candidates.length, ""], ["بقاعدة خاصة", own.length, ""],
          ["أقسام في قاعدة الموقع", candidates.filter((r) => placeOf(r, needsOwn) === "site").length, ""],
          ["بانتظار قاعدة", candidates.filter((r) => placeOf(r, needsOwn) === "waiting").length, candidates.some((r) => placeOf(r, needsOwn) === "waiting") ? "text-amber-700" : ""],
          ["لا تستجيب", down.length, down.length ? "text-red-700" : ""]] as const).map(([k, v, tone]) => (
          <div key={k} className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
            <div className="text-xs text-muted">{k}</div>
            <div className={`mt-1 text-2xl font-bold tabular-nums ${tone}`} data-testid={k === "لا تستجيب" ? "db-down-count" : k === "بانتظار قاعدة" ? "db-waiting-count" : undefined}>{v}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1" role="tablist" aria-label="المزوّد">
        {tabs.map(([t, l]) => (
          <button key={t} role="tab" aria-selected={tab === t} data-provider-tab={t} onClick={() => { setTab(t); setPick(""); }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${tab === t ? "bg-brand text-white" : "hover:bg-canvas"}`}>
            {t !== "all" && <ProviderMark id={t} size="size-5" />} {l} <span className="text-xs opacity-70 tabular-nums">{count(t)}</span>
          </button>
        ))}
      </div>

      {tab !== "all" && (
        <div data-testid="provider-panel" className="mb-4 space-y-3 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
          <ProviderGuide id={tab} />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">ربط عميل بـ {providerById(tab).name}:</span>
            <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="العميل" className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm">
              <option value="">— اختر العميل —</option>
              {candidates.map((r) => <option key={r.id} value={r.id}>{r.lab_name}{deviceOf(r) ? ` — ${deviceOf(r)}` : ""}{r.admin_db ? " (له قاعدة)" : ""}</option>)}
            </select>
            <button disabled={!pick} onClick={() => { const r = rows.find((x) => x.id === pick); if (r) onOpen(r, tab); }}
              className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">متابعة الربط</button>
          </div>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث باسم المختبر أو الجهاز أو الخادم" aria-label="بحث في قواعد البيانات" className={`${inp} ps-9`} />
        </div>
        <button disabled={checkingAll || !own.length} onClick={() => checkMany(own)} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm hover:bg-canvas disabled:opacity-50">
          <RefreshCw className={`size-4 ${checkingAll ? "animate-spin" : ""}`} /> فحص كل القواعد
        </button>
      </div>
      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">
          {q.trim() ? "لا نتائج." : tab !== "all" ? `لا عملاء على ${providerById(tab).name} بعد — اختر عميلاً أعلاه واربطه.` : "لا عملاء بلوحة الإدارة الكاملة بعد — فعّل «لوحة الإدارة الكاملة» في رمز المختبر ثم اربط قاعدته هنا."}
        </div>
      ) : (
        <ul data-testid="db-list" className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
          {list.map((r) => {
            const p = providerOfRow(r);
            const bad = r.admin_db_check && !r.admin_db_check.ok && !checks[r.id]?.ok;
            return (
              <li key={r.id} data-db-lab={r.lab_name} className={`flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-0 ${bad ? "bg-red-50/40" : ""}`}>
                {p ? <ProviderMark id={p} size="size-10" /> : <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-canvas text-muted"><HardDrive className="size-5" /></span>}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{r.lab_name}</span>
                    {deviceOf(r) && <span className="text-xs text-muted">— {deviceOf(r)}</span>}
                    {!r.modules.includes("admin") && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">لوحة الإدارة غير مفعّلة في رمزه</span>}
                  </div>
                  <div className="mt-0.5 text-xs text-muted" data-testid="db-state">
                    {r.admin_db && p
                      ? <>{providerById(p).name}: <span dir="ltr" className="font-mono">{r.admin_db.host}</span> · {r.admin_db.by === "lab" ? "ضبطها المختبر" : "ضبطتها أنت"} · {fmt(r.admin_db.at)}</>
                      : placeOf(r, needsOwn) === "waiting"
                        ? <span className="text-amber-700">بانتظار قاعدة خاصة — لوحة الإدارة مقفلة حتى الربط</span>
                        : <>قسم مستقل في قاعدة الموقع{r.is_trial ? " (رمز تجريبي)" : ""} — لا يرى بيانات غيره</>}
                  </div>
                  {(r.admin_db || checks[r.id]) && <div data-testid="db-check" className="mt-1 text-xs">{lastCheck(r)}</div>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {r.admin_db && (
                    <button disabled={checks[r.id]?.busy} onClick={() => check(r).then(onChecked)} className={`${small} disabled:opacity-50`}>
                      {checks[r.id]?.busy ? <RefreshCw className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} فحص
                    </button>
                  )}
                  {placeOf(r, needsOwn) !== "waiting" && placeOf(r, needsOwn) !== "none" && (
                    <>
                      <button onClick={() => onReset(r)} className={small}><KeyRound className="size-3.5" /> كلمة مرور المدير</button>
                      <button onClick={() => importShared(r)} className={small} title="بيانات لوحة الإدارة المشتركة من قبل فصل المختبرات"><Download className="size-3.5" /> البيانات القديمة</button>
                      {onExport && <button onClick={() => onExport(r)} className={small} data-testid="export-btn"><FileSpreadsheet className="size-3.5" /> تصدير Excel</button>}
                    </>
                  )}
                  <button onClick={() => onOpen(r, tab === "all" ? undefined : tab)} className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1 text-xs font-semibold text-white hover:bg-brand-dark">
                    {r.admin_db ? "تغيير" : "ربط قاعدة"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/** A new password for an admin of the lab, set in the lab's own database (the owner's way back in). */
function ResetAdminModal({ row, onClose }: { row: Row; onClose: () => void }) {
  const [a, setA] = useState({ username: "admin", password: "", again: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function save() {
    if (a.password !== a.again) { setMsg({ ok: false, text: "كلمتا المرور غير متطابقتين." }); return; }
    setBusy(true); setMsg(null);
    const d = await post({ op: "admin_db_reset", id: row.id, account: { username: a.username.trim(), password: a.password } });
    setBusy(false);
    setMsg(d.ok
      ? { ok: true, text: `✓ ${d.created ? "أُنشئ حساب مدير جديد" : "تغيّرت كلمة المرور"} — يدخل المختبر باسم «${a.username.trim()}» وكلمة المرور الجديدة.` }
      : { ok: false, text: adminDbError(d.error) });
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={onClose}>
      <div role="dialog" aria-label="كلمة مرور مدير المختبر" data-testid="reset-admin-modal" onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-pop)]">
        <h2 className="flex items-center gap-2 text-lg font-bold"><KeyRound className="size-5 text-brand" /> كلمة مرور مدير المختبر — {row.lab_name}</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          تُكتب مباشرة في قاعدة هذا المختبر ({row.admin_db?.host}). إن كان اسم المستخدم موجوداً تتغيّر كلمة مروره ويُفعَّل كمدير، وإن لم يكن يُنشأ حساب مدير جديد.
        </p>
        <div className="mt-3 grid gap-2">
          <input dir="ltr" aria-label="اسم مستخدم المدير" value={a.username} onChange={(e) => setA({ ...a, username: e.target.value })} className={inp} />
          <input dir="ltr" type="password" aria-label="كلمة المرور الجديدة" placeholder="6 أحرف على الأقل" value={a.password} onChange={(e) => setA({ ...a, password: e.target.value })} className={inp} />
          <input dir="ltr" type="password" aria-label="تأكيد كلمة المرور" placeholder="أعد كتابتها" value={a.again} onChange={(e) => setA({ ...a, again: e.target.value })} className={inp} />
        </div>
        {msg && <p data-testid="reset-admin-msg" className={`mt-3 text-sm ${msg.ok ? "text-teal-700" : "text-red-700"}`}>{msg.text}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-canvas">إغلاق</button>
          <button disabled={busy || !a.username.trim() || a.password.length < 6} onClick={save} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">حفظ كلمة المرور</button>
        </div>
      </div>
    </div>
  );
}

/** «الإعدادات العامة»: what a new code starts with, and when a code counts as ending soon. */
function PrefsCard({ prefs, onSaved }: { prefs: Prefs; onSaved: () => void }) {
  const preset = PERIODS.some((p) => p.d === prefs.defaultDays);
  const [p, setP] = useState({ ...prefs, custom: preset ? "" : String(prefs.defaultDays), days: preset ? prefs.defaultDays : -1 });
  const [msg, setMsg] = useState("");
  async function save() {
    const defaultDays = p.days === -1 ? Number(p.custom) : p.days;
    if (!defaultDays || defaultDays < 1) { setMsg("حدّد المدة."); return; }
    const d = await post({ op: "prefs", prefs: {
      defaultDays, defaultModules: p.defaultModules, trialDays: p.trialDays, soonDays: p.soonDays, adminNeedsOwnDb: p.adminNeedsOwnDb,
      multiDevice: p.multiDevice, selfSignup: p.selfSignup, errorLog: p.errorLog, dataExport: p.dataExport,
    } });
    setMsg(d.ok ? "✓ حُفظت الإعدادات" : "تعذّر الحفظ.");
    if (d.ok) onSaved();
  }
  return (
    <Panel tone="sky" icon={<Settings className="size-5" />} title="القيم الافتراضية" desc="يبدأ بها نموذج «رمز جديد» — تستطيع تغييرها لكل رمز عند إنشائه." testid="prefs-card">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-medium">مدة الرمز الجديد
          <div className="mt-1 flex gap-2">
            <select value={p.days} onChange={(e) => setP({ ...p, days: Number(e.target.value) })} aria-label="مدة الرمز الافتراضية" className={inp}>
              {PERIODS.map((x) => <option key={x.d} value={x.d}>{x.l}</option>)}
              <option value={-1}>عدد أيام آخر…</option>
            </select>
            {p.days === -1 && <input type="number" min={1} value={p.custom} onChange={(e) => setP({ ...p, custom: e.target.value })} aria-label="أيام الرمز الافتراضية" className={`${inp} w-24`} />}
          </div>
        </label>
        <label className="text-sm font-medium">مدة الرمز التجريبي (أيام)
          <input type="number" min={1} max={60} value={p.trialDays} onChange={(e) => setP({ ...p, trialDays: Number(e.target.value) })} aria-label="أيام الرمز التجريبي" className={`mt-1 ${inp}`} />
        </label>
        <label className="text-sm font-medium">تنبيه «قارب على الانتهاء» قبل (أيام)
          <input type="number" min={1} max={90} value={p.soonDays} onChange={(e) => setP({ ...p, soonDays: Number(e.target.value) })} aria-label="أيام التنبيه قبل الانتهاء" className={`mt-1 ${inp}`} />
        </label>
      </div>
      <div className="mt-3 text-sm font-medium">المحطات المفعّلة في الرمز الجديد</div>
      <ModuleChips value={p.defaultModules} onChange={(m) => setP({ ...p, defaultModules: m })} />
      <label data-testid="needs-own-db" className="mt-4 flex items-start gap-2 rounded-lg border border-line p-3 text-sm">
        <input type="checkbox" checked={p.adminNeedsOwnDb} onChange={(e) => setP({ ...p, adminNeedsOwnDb: e.target.checked })} aria-label="لوحة الإدارة تحتاج قاعدة خاصة" className="mt-1" />
        <span>
          <b>لوحة الإدارة الكاملة تحتاج قاعدة بيانات خاصة لكل مختبر</b>
          <span className="mt-0.5 block text-xs text-muted">
            لا تُفتح لوحة الإدارة لرمز مدفوع حتى تُربط قاعدته (منك في «قواعد البيانات» أو من المختبر نفسه). الرموز التجريبية تعمل في قسم مستقل من قاعدة الموقع.
            عند الإيقاف يعمل كل مختبر بلا قاعدة خاصة في قسمه المستقل من قاعدة الموقع. في الحالتين لا يرى مختبر بيانات غيره.
          </span>
        </span>
      </label>

      <div className="mt-4 rounded-lg border border-line p-3" data-testid="extra-features">
        <div className="text-sm font-semibold">خصائص إضافية <span className="text-xs font-normal text-muted">— موقوفة افتراضياً</span></div>
        <div className="mt-2 grid gap-2">
          {([
            ["multiDevice", "حساب واحد بعدة أجهزة", "يُدخل المختبر الرمز نفسه على أكثر من جهاز حتى العدد الذي تحدّده لكل رمز (في «رمز جديد» وفي تفاصيل الرمز)."],
            ["selfSignup", "التسجيل الذاتي", "صفحة /signup يسجّل فيها المختبر اسمه ورقمه ويحصل فوراً على رمز تجريبي، ويظهر عندك بشارة «تسجيل ذاتي». يظهر رابطها في نافذة التفعيل."],
            ["errorLog", "سجل الأخطاء", "تُحفظ أخطاء الموقع والمحطات ولوحة الإدارة مع اسم المختبر والصفحة، وتظهر في قسم «سجل الأخطاء»."],
          ] as const).map(([k, title, desc]) => (
            <label key={k} className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.checked })} aria-label={title} className="mt-1" />
              <span><b>{title}</b><span className="block text-xs text-muted">{desc}</span></span>
            </label>
          ))}
        </div>
      </div>

      <details className="mt-3 rounded-lg border border-dashed border-line p-3" data-testid="secret-features">
        <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-semibold"><Lock className="size-3.5" /> خاصية سرية</summary>
        <label className="mt-2 flex items-start gap-2 text-sm">
          <input type="checkbox" checked={p.dataExport} onChange={(e) => setP({ ...p, dataExport: e.target.checked })} aria-label="تصدير بيانات المختبر" className="mt-1" />
          <span>
            <b>تصدير بيانات المختبر (Excel)</b>
            <span className="block text-xs text-muted">
              يظهر زر «تصدير Excel» لكل عميل في «قواعد البيانات»: ملف بكل بيانات لوحة إدارته، ورقة لكل جدول (دون كلمات المرور).
              يطلب كلمة مرورك في كل مرة، ولا يظهر للمختبر ولا يُسجَّل في سجل تدقيقه — فقط في سجل الرمز عندك.
            </span>
          </span>
        </label>
      </details>
      <div className="mt-4 flex items-center gap-3">
        <button onClick={save} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">حفظ الإعدادات</button>
        {msg && <span data-testid="prefs-msg" className="text-xs text-brand-dark">{msg}</span>}
      </div>
    </Panel>
  );
}

/** «قاعدة لوحة الإدارة» for one code: the full admin panel on the lab's own PostgreSQL, linked through
 *  the chosen provider's own interface (its steps, its connection string, advice before saving). */
function AdminDbModal({ row, rows, provider: initial, needsOwn, onClose, onSaved }: {
  row: Row; rows: Row[]; provider?: ProviderId; needsOwn: boolean; onClose: () => void; onSaved: () => void;
}) {
  const locksWithout = needsOwn && !row.is_trial;
  const savedProvider = row.admin_db ? row.admin_db.provider ?? providerOf(row.admin_db.host) : null;
  const [provider, setProvider] = useState<ProviderId>(initial ?? savedProvider ?? "neon");
  const [conn, setConn] = useState("");
  const [from, setFrom] = useState("");
  const [fromSync, setFromSync] = useState(false);
  const [copy, setCopy] = useState(false);
  const [first, setFirst] = useState({ username: "", password: "" });
  const [needsAdmin, setNeedsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const syncPg = STATION_SYNC && row.sync?.kind === "postgres" ? row.sync.host : "";
  const others = rows.filter((r) => r.id !== row.id && r.admin_db);
  const keepSaved = !conn.trim() && !from && !fromSync && !!row.admin_db && provider === savedProvider;
  const target = () => (from ? { from } : fromSync ? { fromSync: true } : { conn: conn.trim() });
  const ready = !!from || fromSync || !!conn.trim() || keepSaved;
  async function go(op: "test" | "set" | "unlink") {
    setBusy(true); setMsg(null);
    const d = op === "unlink" ? await post({ op: "admin_db_set", id: row.id, conn: null })
      : await post({ op: op === "test" ? "admin_db_test" : "admin_db_set", id: row.id, ...target(), ...(op === "set" && first.username ? { first } : {}), ...(op === "set" && copy ? { copy: true } : {}) });
    setBusy(false);
    if (!d.ok) {
      if (d.error === "no_admin") setNeedsAdmin(true);
      setMsg({ ok: false, text: adminDbError(d.error) }); return;
    }
    if (op === "test") {
      setNeedsAdmin(!d.users);
      setMsg({ ok: true, text: `✓ الاتصال يعمل والجداول جاهزة — المستخدمون: ${d.users ?? 0}${d.users ? "" : " (أدخل حساب المدير الأول، أو انسخ بيانات لوحته الحالية، قبل الحفظ)"}` });
      return;
    }
    if (d.copied) window.alert(`نُسخت البيانات: ${d.copied.rows} سجلاً من ${d.copied.tables} جدولاً.`);
    onSaved();
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={onClose}>
      <div role="dialog" aria-label="قاعدة لوحة الإدارة" data-testid="admin-db-modal" onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-pop)]">
        <h2 className="flex items-center gap-2 text-lg font-bold"><HardDrive className="size-5 text-brand" /> قاعدة بيانات المختبر — {row.lab_name}</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          تعمل لوحة الإدارة الكاملة لهذا المختبر على قاعدة PostgreSQL خاصة به: المرضى والطلبات والنتائج والفواتير والمستخدمون.
          تُنشأ الجداول تلقائياً عند أول اتصال. يُحفظ الرابط مشفّراً بـ AUTH_SECRET ولا يُعرض مرة أخرى.
        </p>
        <div className="mt-3 rounded-lg bg-canvas px-3 py-2 text-xs">
          الحالية: {row.admin_db ? <b dir="ltr">{row.admin_db.host}</b> : <b>{PLACE_LABEL[placeOf(row, needsOwn)] || "قسم مستقل في قاعدة الموقع"}</b>}
          {row.admin_db?.by === "lab" && <span className="text-muted"> — ضبطها المختبر</span>}
        </div>

        <div className="mt-4 text-sm font-semibold">1. اختر مزوّد القاعدة</div>
        <div className="mt-2"><ProviderPicker value={provider} onChange={(p) => { setProvider(p); setFrom(""); setFromSync(false); setMsg(null); }} /></div>

        <div className="mt-4 text-sm font-semibold">2. اتبع خطوات {providerById(provider).name}</div>
        <div className="mt-2"><ProviderGuide id={provider} /></div>

        <div className="mt-4 text-sm font-semibold">3. الصق رابط الاتصال</div>
        <div className={`mt-2 ${from || fromSync ? "pointer-events-none opacity-50" : ""}`}>
          <ConnInput provider={provider} value={conn} onChange={(v) => { setConn(v); setMsg(null); }} label="رابط قاعدة لوحة الإدارة"
            savedHost={row.admin_db && provider === savedProvider ? row.admin_db.host : undefined} />
        </div>
        {(others.length > 0 || syncPg) && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted">أو:</span>
            {others.length > 0 && (
              <select value={from} onChange={(e) => { setFrom(e.target.value); setFromSync(false); }} aria-label="قاعدة رمز آخر" className="rounded-lg border border-line bg-surface px-2 py-1">
                <option value="">استخدم قاعدة رمز آخر…</option>
                {others.map((o) => <option key={o.id} value={o.id}>{o.lab_name}{o.device_name ? ` — ${o.device_name}` : ""} ({o.admin_db!.host})</option>)}
              </select>
            )}
            {syncPg && <label className="inline-flex items-center gap-1"><input type="checkbox" checked={fromSync} onChange={(e) => { setFromSync(e.target.checked); setFrom(""); }} /> قاعدة المزامنة نفسها ({syncPg})</label>}
          </div>
        )}

        <div className="mt-4 text-sm font-semibold">4. البيانات والحساب الأول</div>
        <label data-testid="copy-site" className="mt-2 flex items-start gap-2 rounded-lg border border-line p-3 text-xs">
          <input type="checkbox" checked={copy} onChange={(e) => setCopy(e.target.checked)} aria-label="نسخ بيانات قاعدة الموقع" className="mt-0.5" />
          <span>
            <b className="text-sm">انسخ بيانات لوحته الحالية إليها</b> — من {row.admin_db ? <>قاعدته الحالية (<span dir="ltr">{row.admin_db.host}</span>)</> : "قسمه في قاعدة الموقع"}: المرضى والطلبات والنتائج والفواتير والمخزون والمستخدمون، ليكمل المختبر من حيث توقّف. السجلات الموجودة في القاعدة الجديدة لا تتغيّر.
          </span>
        </label>
        <div className={`mt-2 rounded-lg border p-3 ${needsAdmin ? "border-amber-300 bg-amber-50/50" : "border-line"}`}>
          <div className="text-xs font-semibold">حساب المدير الأول <span className="font-normal text-muted">— للقاعدة الجديدة فقط (تُترك فارغة إن كان فيها مستخدمون أو عند نسخ البيانات)</span></div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <input dir="ltr" aria-label="اسم مستخدم المدير" placeholder="admin" value={first.username} onChange={(e) => setFirst({ ...first, username: e.target.value })} className={inp} />
            <input dir="ltr" type="password" aria-label="كلمة مرور المدير" placeholder="6 أحرف على الأقل" value={first.password} onChange={(e) => setFirst({ ...first, password: e.target.value })} className={inp} />
          </div>
        </div>
        {msg && <p className={`mt-3 text-sm ${msg.ok ? "text-teal-700" : "text-red-700"}`} data-testid="admin-db-msg">{msg.text}</p>}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-canvas">إغلاق</button>
          {row.admin_db && <button disabled={busy} onClick={() => { if (confirm(locksWithout ? "إلغاء ربط قاعدة هذا المختبر؟ تُقفل لوحة الإدارة عنده حتى تُربط قاعدة أخرى، وتبقى بيانات قاعدته كما هي." : "إرجاع لوحة هذا المختبر إلى قسمه في قاعدة الموقع؟ تبقى بيانات قاعدته كما هي.")) go("unlink"); }} className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50">{locksWithout ? "إلغاء ربط القاعدة" : "إرجاع لقسمه في قاعدة الموقع"}</button>}
          <button disabled={busy || !ready} onClick={() => go("test")} className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-canvas disabled:opacity-50">اختبار الاتصال</button>
          <button disabled={busy || !ready} onClick={() => go("set")} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">{busy ? "جارٍ…" : "حفظ"}</button>
        </div>
      </div>
    </div>
  );
}

/** «سجل الأخطاء»: what went wrong where (only kept while the owner has it on). */
function ErrorsLog({ on }: { on: boolean }) {
  const [list, setList] = useState<{ id: string; at: number; lab: string; kind: string; path: string; message: string; digest: string }[] | null>(null);
  const [tick, setTick] = useState(0);
  const load = () => setTick((t) => t + 1);
  useEffect(() => {
    let alive = true;
    post({ op: "errors" }).then((d) => { if (alive) setList(d.ok ? d.errors : []); });
    return () => { alive = false; };
  }, [tick]);
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
      {!on && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">الخاصية موقوفة — شغّلها من «الإعدادات العامة» لتُحفظ الأخطاء الجديدة.</p>}
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm text-muted">{list ? `${list.length} خطأ` : "جارٍ التحميل…"}</span>
        <div className="flex gap-2">
          <button onClick={load} className={small}><RefreshCw className="size-3.5" /> تحديث</button>
          {!!list?.length && <button onClick={async () => { if (!window.confirm("مسح سجل الأخطاء كله؟")) return; await post({ op: "errors_clear" }); load(); }} className={`${small} text-red-700`}><Trash2 className="size-3.5" /> مسح السجل</button>}
        </div>
      </div>
      {list && list.length === 0 ? <p className="text-center text-sm text-muted">لا أخطاء مسجّلة.</p> : (
        <ul data-testid="errors-list" className="divide-y divide-line text-xs">
          {(list ?? []).map((e) => (
            <li key={e.id} className="grid gap-0.5 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 font-semibold ${e.kind === "server" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{e.kind === "server" ? "الخادم" : "المتصفح"}</span>
                <b>{e.lab || "بلا رمز"}</b>
                <span className="font-mono text-muted" dir="ltr">{e.path}</span>
                <span className="ms-auto tabular-nums text-muted">{fmtTime(e.at)}</span>
              </div>
              <div className="break-words font-mono text-[11px]" dir="ltr">{e.message}{e.digest ? ` (${e.digest})` : ""}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The hidden export: the owner's password again (and the phone code with two-step sign-in). */
function ExportModal({ row, needCode, onClose }: { row: Row; needCode: boolean; onClose: () => void }) {
  const [pw, setPw] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function go() {
    setBusy(true); setMsg(null);
    const d = await post({ op: "export", id: row.id, password: pw, code });
    setBusy(false);
    if (!d.ok) {
      setMsg({ ok: false, text: d.error === "wrong" ? "كلمة المرور أو رمز التحقق غير صحيح." : d.error === "too_many" ? "محاولات كثيرة — حاول بعد قليل." : adminDbError(d.error) });
      return;
    }
    const bin = Uint8Array.from(atob(d.file), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bin], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = document.createElement("a");
    a.href = url; a.download = d.name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    setPw(""); setCode("");
    setMsg({ ok: true, text: `✓ نُزّل الملف: ${d.tables} جدولاً و${d.rows} سجلاً.` });
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={onClose}>
      <div role="dialog" aria-label="تصدير بيانات المختبر" data-testid="export-modal" onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-pop)]">
        <h2 className="flex items-center gap-2 text-lg font-bold"><FileSpreadsheet className="size-5 text-brand" /> تصدير بيانات — {row.lab_name}</h2>
        <p className="mt-1 text-xs text-muted">ملف Excel بكل بيانات لوحة إدارة هذا المختبر (ورقة لكل جدول، دون كلمات المرور). أدخل كلمة مرورك للتأكيد.</p>
        <div className="mt-3 grid gap-2">
          <input type="password" dir="ltr" value={pw} onChange={(e) => setPw(e.target.value)} aria-label="كلمة مرور المالك" placeholder="كلمة المرور" className={inp} />
          {needCode && <input dir="ltr" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} aria-label="رمز التحقق" placeholder="رمز التحقق من الهاتف" className={inp} />}
        </div>
        {msg && <p data-testid="export-msg" className={`mt-3 text-sm ${msg.ok ? "text-teal-700" : "text-red-700"}`}>{msg.text}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-canvas">إغلاق</button>
          <button disabled={busy || !pw} onClick={go} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">{busy ? "جارٍ التصدير…" : "تصدير"}</button>
        </div>
      </div>
    </div>
  );
}

/** The page's side menu, like the lab station's (a drawer on phones). */
function OwnerNav({ section, go, total, soon, soonDays, dbDown, showErrors, open, setOpen, onLogout }: {
  section: Section; go: (s: Section) => void; total: number; soon: number; soonDays: number; dbDown: number; showErrors: boolean; open: boolean; setOpen: (v: boolean) => void; onLogout: () => void;
}) {
  const current = SECTIONS.flatMap((g) => g.items).find((i) => i.id === section)?.label ?? "إدارة الرموز";
  return (
    <>
      {/* Phone top bar */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface/90 px-4 py-2.5 backdrop-blur md:hidden">
        <button onClick={() => setOpen(true)} aria-label="فتح القائمة" className="grid size-10 place-items-center rounded-xl border border-line bg-surface hover:bg-canvas"><Menu className="size-5" /></button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">{current}</div>
          <div className="text-[11px] text-muted">إدارة الرموز</div>
        </div>
        <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-white"><KeyRound className="size-[18px]" /></span>
      </div>
      <div onClick={() => setOpen(false)} className={`fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] transition-opacity md:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} />

      <aside className={`fixed inset-y-0 start-0 z-50 flex h-screen w-72 shrink-0 flex-col border-e border-line bg-surface shadow-[var(--shadow-pop)] transition-transform duration-200 md:sticky md:top-0 md:z-auto md:translate-x-0 md:shadow-none ${open ? "translate-x-0" : "translate-x-full"}`}>
        <div className="px-4 pb-4 pt-5">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-dark text-white shadow-[0_6px_16px_-4px_color-mix(in_oklab,var(--color-brand)_60%,transparent)]"><KeyRound className="size-[22px]" /></span>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[15px] font-bold">إدارة الرموز</div>
              <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-medium text-brand-dark">منظومة رموز المختبرات</div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="إغلاق القائمة" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink md:hidden"><X className="size-4" /></button>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 pb-3">
          {SECTIONS.map((g) => (
            <div key={g.title}>
              <div className="mb-1.5 px-2.5 text-[11px] font-semibold text-muted">{g.title}</div>
              <div className="flex flex-col gap-0.5">
                {g.items.filter((it) => it.id !== "errors" || showErrors).map((it) => {
                  const active = section === it.id;
                  const badge = it.id === "codes" ? (soon || total) : it.id === "databases" ? dbDown : 0;
                  const warn = it.id === "codes" ? !!soon : it.id === "databases";
                  return (
                    <button key={it.id} data-section={it.id} onClick={() => go(it.id)} aria-current={active ? "page" : undefined}
                      className={`group relative flex items-center gap-3 rounded-xl px-2.5 py-2 text-right text-sm ${active ? "bg-brand-light text-brand-dark shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-brand)_22%,transparent)]" : "text-ink hover:bg-canvas"}`}>
                      {active && <span className="absolute inset-y-2 -start-3 w-1 rounded-e-full bg-brand" />}
                      <span className={`grid size-9 shrink-0 place-items-center rounded-lg transition-colors ${active ? "bg-gradient-to-br from-brand to-brand-dark text-white" : "bg-canvas text-muted ring-1 ring-line group-hover:bg-brand-light group-hover:text-brand group-hover:ring-transparent"}`}>
                        <it.icon className="size-[18px]" strokeWidth={active ? 2.2 : 1.9} />
                      </span>
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className={`block truncate ${active ? "font-semibold" : ""}`}>{it.label}</span>
                        <span className={`block truncate text-[11px] ${active ? "text-brand-dark/70" : "text-muted"}`}>{it.hint}</span>
                      </span>
                      {badge ? (
                        <span data-testid={`badge-${it.id}`} title={it.id === "databases" ? "قواعد لا تستجيب" : soon ? `تنتهي خلال ${soonDays} يوماً` : undefined}
                          className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold leading-none tabular-nums text-white ${it.id === "databases" ? "bg-red-600" : warn ? "bg-amber-500" : "bg-brand"}`}>{badge}</span>
                      ) : (
                        <ChevronLeft className={`size-4 shrink-0 transition-all ${active ? "text-brand opacity-100" : "text-muted opacity-0 group-hover:opacity-60"}`} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-line p-3">
          <button onClick={onLogout} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm hover:bg-canvas"><LogOut className="size-4" /> خروج</button>
        </div>
      </aside>
    </>
  );
}

/** A section's heading, as on the lab station's pages. */
function SectionTitle({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="mb-5">
      <h1 className="flex items-center gap-2 text-2xl font-bold"><span className="text-brand">{icon}</span> {title}</h1>
      <p className="mt-1 text-sm text-muted">{desc}</p>
    </div>
  );
}

/** Where the codes live, the signing key and the site version, with a save test. */
function SystemStatus({ storage, version, test, testing, onTest }: { storage: Storage; version?: string; test: Storage | null; testing: boolean; onTest: () => void }) {
  return (
    <div className="rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
      <ul>
        <StatusItem ok={storage.ok}>
          <b>مكان حفظ الرموز:</b> {SOURCE[storage.source]} — {storage.ok ? <>متصلة · <b className="font-mono tabular-nums">{storage.codes ?? 0}</b> رمز</> : <>غير متصلة {storage.error ?? ""}</>}
        </StatusItem>
        {storage.ok && storage.keySealed !== undefined && (
          <StatusItem ok={storage.keySealed} warn testid="key-sealed">
            {storage.keySealed ? "مفتاح التوقيع مشفّر بـ AUTH_SECRET ✓" : "مفتاح التوقيع غير مشفّر — أضف AUTH_SECRET في Vercel ثم أعد النشر"}
          </StatusItem>
        )}
        {version && <StatusItem ok testid="site-version"><b>إصدار الموقع:</b> <b className="font-mono tabular-nums" dir="ltr">{version}</b></StatusItem>}
      </ul>
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
        <button onClick={onTest} disabled={testing} className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold hover:bg-canvas disabled:opacity-60">
          {testing ? "جارٍ الاختبار…" : "اختبار الحفظ"}
        </button>
        {test && <span className={`text-sm ${test.ok ? "text-emerald-700" : "text-red-700"}`}>{test.ok ? `اختبار الحفظ نجح — كتابة وقراءة وحذف في ${test.roundTripMs} ملّي ثانية.` : `اختبار الحفظ فشل: ${test.error ?? ""}`}</span>}
      </div>
    </div>
  );
}
function StatusItem({ ok, warn, children, testid }: { ok: boolean; warn?: boolean; children: React.ReactNode; testid?: string }) {
  return (
    <li data-testid={testid} className="flex items-start gap-3 border-b border-line px-4 py-3 text-sm last:border-0">
      <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${ok ? "bg-emerald-500" : warn ? "bg-amber-500" : "bg-red-500"}`} />
      <span className="min-w-0 flex-1">{children}</span>
    </li>
  );
}
