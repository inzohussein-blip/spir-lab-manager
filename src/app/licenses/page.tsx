"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyRound, LogOut, Plus, Copy, Check, Ban, Play, MonitorSmartphone, RefreshCw, Trash2, Pencil, ShieldAlert,
  FlaskConical, Download, ChevronDown, MessageSquare, History, Wallet, MessageSquareText, Database,
} from "lucide-react";
import { LICENSE_MODULES, DEFAULT_MODULES, moduleLabel, type LicenseModule } from "@/lib/license/modules";

/** «إدارة الرموز» — the owner's page: one code per lab, bound to one device, with a period and stations. */

interface Row {
  id: string; lab_name: string; note: string; code_hint: string; duration_days: number; modules: LicenseModule[];
  status: "active" | "stopped"; device_id: string | null; device_label: string | null;
  activated_at: number | null; expires_at: number | null; last_seen_at: number | null; created_at: number;
  price: string; paid: boolean; paid_at: number | null; message: string; device_name: string; is_trial: boolean;
}
interface Ev { license_id: string; at: number; kind: string; detail: string }
interface Storage { source: "license-db" | "app-db" | "embedded"; ok: boolean; codes?: number; roundTripMs?: number; error?: string }
type Data = { enabled: boolean; owner: boolean; needsDb?: boolean; storage?: Storage; licenses?: Row[]; events?: Ev[]; contact?: string; now?: number };
const SOURCE: Record<Storage["source"], string> = {
  "license-db": "قاعدة الرموز المنفصلة (Neon)",
  "app-db": "قاعدة بيانات الموقع (DATABASE_URL)",
  embedded: "القاعدة المدمجة المؤقتة (للتجربة المحلية فقط)",
};

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
const small = "inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs hover:bg-canvas";
const DAY = 86_400_000;
const OWNER_PHONE = "07803993585";
const TRIAL_DAYS = 7;
const PERIODS = [{ d: 30, l: "شهر" }, { d: 90, l: "3 أشهر" }, { d: 180, l: "6 أشهر" }, { d: 365, l: "سنة" }];
const fmt = (ms: number | null) => (ms ? new Date(ms).toLocaleDateString("en-CA") : "—");
const fmtTime = (ms: number | null) => (ms ? new Date(ms).toLocaleString("ar-IQ-u-nu-latn") : "—");
const deviceOf = (r: Row) => r.device_name || r.device_label || (r.device_id ? "مربوط" : "");
const amount = (p: string) => { const n = Number(p.replace(/[^\d.]/g, "")); return p.trim() && Number.isFinite(n) ? n : 0; };

const EVENT_LABEL: Record<string, string> = {
  created: "إنشاء الرمز", activated: "تفعيل على جهاز", moved: "تفعيل على جهاز جديد", extended: "تمديد", stopped: "إيقاف",
  resumed: "إعادة تفعيل", device_reset: "فك ربط الجهاز", modules: "تغيير المحطات", renamed: "تعديل الاسم",
  paid: "تسجيل الدفع", unpaid: "إلغاء الدفع", message: "رسالة للمختبر", new_code: "رمز جديد",
};
const eventDetail = (e: Ev) => (e.kind === "modules" ? e.detail.split(",").filter(Boolean).map(moduleLabel).join("، ") || "لا شيء" : e.detail);

type Filter = "all" | "active" | "soon" | "expired" | "unused" | "stopped" | "unpaid" | "trial";
type Sort = "expiry" | "newest" | "name" | "seen";

async function post(body: unknown) {
  const r = await fetch("/api/license/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return r.json().catch(() => ({ ok: false }));
}

function kindOf(r: Row, now: number): Exclude<Filter, "all" | "unpaid" | "trial" | "soon"> | "soon" {
  if (r.status === "stopped") return "stopped";
  if (!r.activated_at) return "unused";
  if (r.expires_at != null && r.expires_at <= now) return "expired";
  return (r.expires_at ?? now) - now <= 14 * DAY ? "soon" : "active";
}
function status(r: Row, now: number) {
  const k = kindOf(r, now);
  if (k === "stopped") return { t: "موقوف", c: "bg-red-50 text-red-700" };
  if (k === "unused") return { t: "غير مستخدم", c: "bg-gray-100 text-gray-600" };
  if (k === "expired") return { t: "منتهٍ", c: "bg-red-50 text-red-700" };
  const left = Math.ceil(((r.expires_at ?? now) - now) / DAY);
  return { t: `فعّال — باقٍ ${left} يوم`, c: k === "soon" ? "bg-amber-50 text-amber-700" : "bg-teal-50 text-brand-dark" };
}

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

function exportCsv(rows: Row[], now: number) {
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["المختبر", "ملاحظة", "آخر 4 خانات", "الحالة", "تجريبي", "المدة (يوم)", "التفعيل", "الانتهاء", "الجهاز", "آخر اتصال", "المحطات", "المبلغ", "مدفوع", "تاريخ الدفع", "رسالة للمختبر", "أُنشئ"];
  const lines = [head.map(cell).join(",")];
  for (const r of rows) {
    lines.push([r.lab_name, r.note, r.code_hint, status(r, now).t, r.is_trial ? "نعم" : "", r.duration_days, fmt(r.activated_at), fmt(r.expires_at), deviceOf(r),
      fmtTime(r.last_seen_at), r.modules.map(moduleLabel).join("، "), r.price, r.paid ? "نعم" : "لا", fmt(r.paid_at), r.message, fmt(r.created_at)].map(cell).join(","));
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
  const [err, setErr] = useState("");
  const [shown, setShown] = useState<{ row: Row; code: string } | null>(null);
  const [copied, setCopied] = useState("");
  const [f, setF] = useState({ lab: "", days: 365, custom: "", note: "", modules: [...DEFAULT_MODULES] as LicenseModule[] });
  const [contact, setContact] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("expiry");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [test, setTest] = useState<Storage | null>(null);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/license/admin", { cache: "no-store" });
    const d = (await r.json()) as Data;
    setData(d);
    if (d.contact != null) setContact(d.contact);
  }, []);
  useEffect(() => { load(); }, [load]);
  const flash = (k: string) => { setCopied(k); setTimeout(() => setCopied(""), 1500); };

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const d = await post({ op: "login", password: pw });
    if (d.ok) { setPw(""); load(); } else setErr(d.error === "too_many" ? "محاولات كثيرة — حاول بعد قليل." : "كلمة المرور غير صحيحة.");
  }
  async function create(trial: boolean) {
    const days = trial ? TRIAL_DAYS : f.days === -1 ? Number(f.custom) : f.days;
    if (!f.lab.trim() || !days || days < 1) { setErr(f.lab.trim() ? "حدّد المدة." : "اكتب اسم المختبر."); return; }
    setErr("");
    const d = await post({ op: "create", lab: f.lab, days, note: f.note, modules: f.modules, trial });
    if (d.ok) { setShown({ row: d.row, code: d.code }); setF({ lab: "", days: 365, custom: "", note: "", modules: [...DEFAULT_MODULES] }); load(); }
  }
  async function change(r: Row, c: Record<string, unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    const d = await post({ op: "update", id: r.id, change: c });
    if (d.code && d.row) setShown({ row: d.row, code: d.code });
    load();
  }

  const now = data?.now ?? Date.now();
  const all = useMemo(() => data?.licenses ?? [], [data]);
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: all.length, active: 0, soon: 0, expired: 0, unused: 0, stopped: 0, unpaid: 0, trial: 0 };
    for (const r of all) {
      const k = kindOf(r, now);
      c[k] += 1;
      if (k === "soon") c.active += 1; // "active" counts every working code
      if (!r.paid) c.unpaid += 1;
      if (r.is_trial) c.trial += 1;
    }
    return c;
  }, [all, now]);
  const money = useMemo(() => ({
    paid: all.filter((r) => r.paid).reduce((n, r) => n + amount(r.price), 0),
    due: all.filter((r) => !r.paid).reduce((n, r) => n + amount(r.price), 0),
  }), [all]);
  const rows = useMemo(() => {
    const t = q.trim();
    const list = all.filter((r) => {
      if (t && !(r.lab_name.includes(t) || r.note.includes(t) || r.code_hint.includes(t.toUpperCase()) || deviceOf(r).includes(t))) return false;
      const k = kindOf(r, now);
      if (filter === "active") return k === "active" || k === "soon";
      if (filter === "unpaid") return !r.paid;
      if (filter === "trial") return r.is_trial;
      return filter === "all" || k === filter;
    });
    const exp = (r: Row) => (r.expires_at ?? Number.MAX_SAFE_INTEGER - (r.activated_at ? 0 : 1));
    return list.sort((a, b) =>
      sort === "expiry" ? exp(a) - exp(b) : sort === "name" ? a.lab_name.localeCompare(b.lab_name, "ar")
      : sort === "seen" ? (b.last_seen_at ?? 0) - (a.last_seen_at ?? 0) : b.created_at - a.created_at);
  }, [all, q, filter, sort, now]);
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
      <p className="mb-4 mt-1 text-sm text-muted">صفحة المالك فقط.</p>
      <input type="password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} placeholder="كلمة المرور" autoFocus aria-label="كلمة المرور" className={`${inp} text-center`} />
      <button className="mt-3 w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">دخول</button>
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
    </form>,
  );

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const TILES: { k: Filter; l: string; tone?: string }[] = [
    { k: "all", l: "الكل" }, { k: "active", l: "فعّال" }, { k: "soon", l: "ينتهي خلال 14 يوماً", tone: "text-amber-700" },
    { k: "expired", l: "منتهٍ", tone: "text-red-700" }, { k: "unused", l: "غير مستخدم" }, { k: "stopped", l: "موقوف", tone: "text-red-700" },
    { k: "unpaid", l: "غير مدفوع", tone: "text-amber-700" }, { k: "trial", l: "تجريبي" },
  ];

  return shell(
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><KeyRound className="size-6" /> إدارة الرموز</h1>
          <p className="mt-1 text-sm text-muted">رمز لكل مختبر، يعمل على جهاز واحد، وتبدأ مدته من يوم التفعيل.</p>
        </div>
        <button onClick={async () => { await post({ op: "logout" }); load(); }} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-surface">
          <LogOut className="size-4" /> خروج
        </button>
      </div>

      {/* Where the codes are stored + a save test */}
      {data.storage && (
        <div className={`mb-4 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm ${data.storage.ok ? "border-teal-200 bg-teal-50/60" : "border-red-300 bg-red-50"}`}>
          <Database className={`size-5 shrink-0 ${data.storage.ok ? "text-brand-dark" : "text-red-600"}`} />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">التخزين: {SOURCE[data.storage.source]}</div>
            <div className="text-xs text-muted">
              {data.storage.ok ? `متصلة ✓ — محفوظ فيها ${data.storage.codes ?? 0} رمز.` : `غير متصلة — ${data.storage.error ?? ""}`}
              {test && (test.ok ? ` · اختبار الحفظ نجح (كتابة وقراءة وحذف في ${test.roundTripMs} ملّي ثانية).` : ` · اختبار الحفظ فشل: ${test.error ?? ""}`)}
            </div>
          </div>
          <button onClick={async () => { setTesting(true); const d = await post({ op: "selftest" }); setTest(d.storage ?? { source: data.storage!.source, ok: false, error: "no reply" }); setTesting(false); }}
            disabled={testing} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold hover:bg-canvas disabled:opacity-60">
            {testing ? "جارٍ الاختبار…" : "اختبار الحفظ"}
          </button>
        </div>
      )}

      {/* Summary tiles = filters */}
      <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TILES.map((t) => (
          <button key={t.k} onClick={() => setFilter(t.k)} aria-pressed={filter === t.k}
            className={`rounded-xl border bg-surface px-3 py-2 text-right shadow-[var(--shadow-card)] ${filter === t.k ? "border-brand ring-1 ring-brand" : "border-line hover:border-brand/50"}`}>
            <div className={`text-xl font-extrabold tabular-nums ${t.tone ?? ""}`}>{counts[t.k]}</div>
            <div className="text-xs text-muted">{t.l}</div>
          </button>
        ))}
      </div>
      {(money.paid > 0 || money.due > 0) && (
        <p className="mb-5 flex flex-wrap gap-x-4 text-xs text-muted">
          <span><Wallet className="me-1 inline size-3.5" />المدفوع: <b className="tabular-nums text-brand-dark">{money.paid.toLocaleString("en-US")}</b></span>
          <span>غير المدفوع: <b className="tabular-nums text-amber-700">{money.due.toLocaleString("en-US")}</b></span>
        </p>
      )}

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

      {/* New code */}
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
          <label className="text-sm font-medium sm:col-span-2">ملاحظة (اختياري)<input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="المدينة، اسم المسؤول، رقم الهاتف…" className={`mt-1 ${inp}`} /></label>
        </div>
        <div className="mt-3 text-sm font-medium">المحطات المفعّلة</div>
        <ModuleChips value={f.modules} onChange={(m) => setF({ ...f, modules: m })} />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"><KeyRound className="size-4" /> إنشاء الرمز</button>
          <button type="button" onClick={() => create(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-100">
            <FlaskConical className="size-4" /> رمز تجريبي {TRIAL_DAYS} أيام
          </button>
          {err && <span className="text-xs text-red-600">{err}</span>}
        </div>
      </form>

      {/* Codes toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث باسم المختبر أو الملاحظة أو الجهاز أو آخر 4 خانات…" aria-label="بحث" className={`${inp} min-w-56 flex-1`} />
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="الترتيب" className="rounded-lg border border-line bg-surface px-2 py-2 text-sm">
          <option value="expiry">الأقرب انتهاءً</option>
          <option value="newest">الأحدث إنشاءً</option>
          <option value="seen">آخر اتصال</option>
          <option value="name">الاسم</option>
        </select>
        <button onClick={() => exportCsv(rows, now)} disabled={!rows.length} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-surface disabled:opacity-50">
          <Download className="size-4" /> تصدير CSV
        </button>
        <button onClick={load} title="تحديث" className="grid size-9 shrink-0 place-items-center rounded-lg border border-line hover:bg-surface"><RefreshCw className="size-4" /></button>
      </div>
      <div className="mb-2 text-xs text-muted">المعروض: {rows.length} من {all.length}</div>

      <div className="flex flex-col gap-3">
        {rows.length === 0 && <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">{all.length ? "لا رموز مطابقة." : "لا رموز بعد."}</p>}
        {rows.map((r) => {
          const st = status(r, now);
          const isOpen = open.has(r.id);
          const evs = eventsOf.get(r.id) ?? [];
          return (
            <div key={r.id} className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]" data-lab={r.lab_name}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold">{r.lab_name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.c}`}>{st.t}</span>
                    {r.is_trial && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">تجريبي</span>}
                    {r.price.trim() && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.paid ? "bg-teal-50 text-brand-dark" : "bg-amber-50 text-amber-700"}`}>{r.paid ? "مدفوع" : "غير مدفوع"} · <span className="tabular-nums">{r.price}</span></span>}
                    {r.message && <span title={r.message} className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700"><MessageSquare className="size-3" /> رسالة</span>}
                    <span className="font-mono text-xs text-muted" dir="ltr">…{r.code_hint}</span>
                  </div>
                  {r.note && <div className="mt-0.5 text-xs text-muted">{r.note}</div>}
                </div>
                <div className="flex flex-wrap gap-1">
                  <select defaultValue="" onChange={(e) => { const d = Number(e.target.value); e.target.value = ""; if (d) change(r, { action: "extend", days: d }); }}
                    aria-label="تمديد" className="rounded-lg border border-line bg-surface px-2 py-1 text-xs">
                    <option value="" disabled>+ تمديد</option>
                    {PERIODS.map((p) => <option key={p.d} value={p.d}>+ {p.l}</option>)}
                  </select>
                  {r.status === "active"
                    ? <button onClick={() => change(r, { action: "stop" }, `إيقاف رمز «${r.lab_name}»؟ تُقفل محطاته عند أول اتصال بالإنترنت.`)} className={`${small} text-red-600 hover:bg-red-50`}><Ban className="size-3.5" /> إيقاف</button>
                    : <button onClick={() => change(r, { action: "resume" })} className={`${small} text-brand-dark hover:bg-teal-50`}><Play className="size-3.5" /> إعادة تفعيل</button>}
                  {r.device_id && <button onClick={() => change(r, { action: "reset_device" }, "فك ربط الجهاز؟ يستطيع المختبر بعدها إدخال نفس الرمز على جهاز جديد، والمدة تستمر كما هي.")} className={small}><MonitorSmartphone className="size-3.5" /> نقل لجهاز جديد</button>}
                  <button onClick={() => change(r, { action: "new_code" }, "إنشاء رمز جديد لهذا المختبر؟ الرمز القديم لا يعمل بعدها لتفعيل جهاز، والجهاز الحالي يستمر.")} className={small}><KeyRound className="size-3.5" /> رمز جديد</button>
                  <button onClick={() => copyText(statusMessage(r, now), () => flash(r.id))} title="نسخ رسالة الحالة (المدة والمحطات) لإرسالها للمختبر" className={small}>
                    {copied === r.id ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} رسالة الحالة
                  </button>
                  <button onClick={() => { const lab = window.prompt("اسم المختبر:", r.lab_name); if (lab == null) return; const note = window.prompt("ملاحظة:", r.note) ?? r.note; change(r, { action: "rename", lab, note }); }} title="تعديل الاسم والملاحظة" aria-label="تعديل الاسم" className="grid size-7 place-items-center rounded-lg border border-line hover:bg-canvas"><Pencil className="size-3.5" /></button>
                  <button onClick={() => change(r, { action: "delete" }, `حذف رمز «${r.lab_name}» نهائياً؟ تُقفل محطاته عند أول اتصال بالإنترنت.`)} title="حذف" aria-label="حذف" className="grid size-7 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50"><Trash2 className="size-3.5" /></button>
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-4">
                <Info k="المدة" v={r.activated_at ? `${fmt(r.activated_at)} ← ${fmt(r.expires_at)}` : `${r.duration_days} يوم (تبدأ عند التفعيل)`} />
                <Info k="الجهاز" v={deviceOf(r) || "لم يُربط بعد"} />
                <Info k="آخر اتصال" v={fmtTime(r.last_seen_at)} />
                <Info k="أُنشئ" v={fmt(r.created_at)} />
              </div>
              <div className="mt-2 text-xs text-muted">المحطات — التغيير يصل للجهاز عند اتصاله بالإنترنت:</div>
              <ModuleChips value={r.modules} onChange={(m) => change(r, { action: "modules", modules: m })} />

              <button onClick={() => setOpen((s) => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })}
                aria-expanded={isOpen} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-dark hover:underline">
                <ChevronDown className={`size-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} /> الدفع والجهاز والرسالة والسجل ({evs.length})
              </button>
              {isOpen && <Details r={r} evs={evs} onChange={(c) => change(r, c)} />}
            </div>
          );
        })}
      </div>

      {/* Contact line */}
      <div className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="text-sm font-semibold">سطر التواصل</div>
        <p className="mb-2 text-xs text-muted">يظهر في نافذة التفعيل وشاشة القفل. إذا تُرك فارغاً يظهر رقمك: {OWNER_PHONE}.</p>
        <div className="flex gap-2">
          <input value={contact} onChange={(e) => setContact(e.target.value)} className={inp} placeholder="للتفعيل أو التجديد تواصل مع: …" aria-label="سطر التواصل" />
          <button onClick={async () => { await post({ op: "contact", contact }); load(); flash("contact"); }} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">{copied === "contact" ? "حُفظ" : "حفظ"}</button>
        </div>
      </div>
    </>,
  );
}

/** Payment, device name, message to the lab and the code's history. */
function Details({ r, evs, onChange }: { r: Row; evs: Ev[]; onChange: (c: Record<string, unknown>) => void }) {
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

function Info({ k, v }: { k: string; v: string }) {
  return <div className="rounded-lg bg-canvas px-2.5 py-1.5"><div className="text-[10px] text-muted">{k}</div><div className="font-medium">{v}</div></div>;
}

function ModuleChips({ value, onChange }: { value: LicenseModule[]; onChange: (m: LicenseModule[]) => void }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {LICENSE_MODULES.map((m) => {
        const on = value.includes(m.id);
        return (
          <button key={m.id} type="button" aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== m.id) : [...value, m.id])}
            className={`rounded-full border px-2.5 py-1 text-xs ${on ? (m.id === "admin" ? "border-violet-500 bg-violet-50 font-semibold text-violet-700" : "border-brand bg-brand-light font-semibold text-brand-dark") : "border-line text-muted line-through hover:bg-canvas"}`}>
            {on ? "✓ " : ""}{m.label}
          </button>
        );
      })}
    </div>
  );
}
