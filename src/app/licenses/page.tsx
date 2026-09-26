"use client";

import { useCallback, useEffect, useState } from "react";
import {
  KeyRound, LogOut, Plus, Copy, Check, Ban, Play, MonitorSmartphone, RefreshCw, Trash2, Pencil, CalendarPlus, ShieldAlert,
} from "lucide-react";
import { LICENSE_MODULES, DEFAULT_MODULES, type LicenseModule } from "@/lib/license/modules";

/** «إدارة الرموز» — the owner's page: one code per lab, bound to one device, with a period and stations. */

interface Row {
  id: string; lab_name: string; note: string; code_hint: string; duration_days: number; modules: LicenseModule[];
  status: "active" | "stopped"; device_id: string | null; device_label: string | null;
  activated_at: number | null; expires_at: number | null; last_seen_at: number | null; created_at: number;
}
type Data = { enabled: boolean; owner: boolean; licenses?: Row[]; contact?: string; now?: number };

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
const DAY = 86_400_000;
const PERIODS = [{ d: 30, l: "شهر" }, { d: 90, l: "3 أشهر" }, { d: 180, l: "6 أشهر" }, { d: 365, l: "سنة" }];
const fmt = (ms: number | null) => (ms ? new Date(ms).toLocaleDateString("en-CA") : "—");
const fmtTime = (ms: number | null) => (ms ? new Date(ms).toLocaleString("ar-IQ-u-nu-latn") : "—");

async function post(body: unknown) {
  const r = await fetch("/api/license/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return r.json().catch(() => ({ ok: false }));
}

function status(r: Row, now: number) {
  if (r.status === "stopped") return { t: "موقوف", c: "bg-red-50 text-red-700" };
  if (!r.activated_at) return { t: "غير مستخدم", c: "bg-gray-100 text-gray-600" };
  if (r.expires_at != null && r.expires_at <= now) return { t: "منتهٍ", c: "bg-red-50 text-red-700" };
  const left = Math.ceil(((r.expires_at ?? now) - now) / DAY);
  return { t: `فعّال — باقٍ ${left} يوم`, c: left <= 14 ? "bg-amber-50 text-amber-700" : "bg-teal-50 text-brand-dark" };
}

export default function LicensesPage() {
  const [data, setData] = useState<Data | null>(null);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [shownCode, setShownCode] = useState<{ lab: string; code: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [f, setF] = useState({ lab: "", days: 365, custom: "", note: "", modules: [...DEFAULT_MODULES] as LicenseModule[] });
  const [contact, setContact] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/license/admin", { cache: "no-store" });
    const d = (await r.json()) as Data;
    setData(d);
    if (d.contact != null) setContact(d.contact);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const d = await post({ op: "login", password: pw });
    if (d.ok) { setPw(""); load(); } else setErr(d.error === "too_many" ? "محاولات كثيرة — حاول بعد قليل." : "كلمة المرور غير صحيحة.");
  }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    const days = f.days === -1 ? Number(f.custom) : f.days;
    if (!f.lab.trim() || !days || days < 1) return;
    const d = await post({ op: "create", lab: f.lab, days, note: f.note, modules: f.modules });
    if (d.ok) { setShownCode({ lab: d.row.lab_name, code: d.code }); setCopied(false); setF({ lab: "", days: 365, custom: "", note: "", modules: [...DEFAULT_MODULES] }); load(); }
  }
  async function change(r: Row, c: Record<string, unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    const d = await post({ op: "update", id: r.id, change: c });
    if (d.code) { setShownCode({ lab: r.lab_name, code: d.code }); setCopied(false); }
    load();
  }

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
      <p className="mt-2 text-sm text-muted">لتفعيلها أضف المتغير <b dir="ltr">LICENSE_ADMIN_PASSWORD</b> (كلمة مرور هذه الصفحة) في إعدادات Vercel ثم أعد النشر.</p>
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

  const now = data.now ?? Date.now();
  const rows = (data.licenses ?? []).filter((r) => !q.trim() || r.lab_name.includes(q.trim()) || r.note.includes(q.trim()) || r.code_hint.includes(q.trim().toUpperCase()));
  const counts = {
    all: data.licenses?.length ?? 0,
    active: data.licenses?.filter((r) => r.status === "active" && r.activated_at && (r.expires_at ?? 0) > now).length ?? 0,
    unused: data.licenses?.filter((r) => !r.activated_at).length ?? 0,
  };

  return shell(
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><KeyRound className="size-6" /> إدارة الرموز</h1>
          <p className="mt-1 text-sm text-muted">رمز لكل مختبر، يعمل على جهاز واحد، وتبدأ مدته من يوم التفعيل. {counts.all} رمز · {counts.active} فعّال · {counts.unused} غير مستخدم</p>
        </div>
        <button onClick={async () => { await post({ op: "logout" }); load(); }} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-surface">
          <LogOut className="size-4" /> خروج
        </button>
      </div>

      {shownCode && (
        <div className="mb-5 rounded-2xl border-2 border-brand bg-brand-light/40 p-5 text-center">
          <div className="text-sm font-semibold">رمز «{shownCode.lab}»</div>
          <div className="mt-2 font-mono text-3xl font-extrabold tracking-widest text-brand-dark" dir="ltr">{shownCode.code}</div>
          <div className="mt-3 flex justify-center gap-2">
            <button onClick={() => { navigator.clipboard?.writeText(shownCode.code).then(() => setCopied(true)).catch(() => {}); }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "نُسخ" : "نسخ الرمز"}
            </button>
            <button onClick={() => setShownCode(null)} className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-surface">تم</button>
          </div>
          <p className="mt-2 text-xs text-amber-700">احفظه الآن وأرسله للمختبر — لا يُعرض مرة أخرى (يُحفظ مشفّراً). إن ضاع أنشئ «رمزاً جديداً» لنفس المختبر.</p>
        </div>
      )}

      {/* New code */}
      <form onSubmit={create} className="mb-5 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Plus className="size-4" /> رمز جديد</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">اسم المختبر *<input value={f.lab} onChange={(e) => setF({ ...f, lab: e.target.value })} className={`mt-1 ${inp}`} required /></label>
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
        <button className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"><KeyRound className="size-4" /> إنشاء الرمز</button>
      </form>

      {/* Codes */}
      <div className="mb-3 flex items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث باسم المختبر أو الملاحظة أو آخر 4 خانات…" aria-label="بحث" className={inp} />
        <button onClick={load} title="تحديث" className="grid size-9 shrink-0 place-items-center rounded-lg border border-line hover:bg-surface"><RefreshCw className="size-4" /></button>
      </div>
      <div className="flex flex-col gap-3">
        {rows.length === 0 && <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">لا رموز بعد.</p>}
        {rows.map((r) => {
          const st = status(r, now);
          return (
            <div key={r.id} className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold">{r.lab_name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.c}`}>{st.t}</span>
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
                    ? <button onClick={() => change(r, { action: "stop" }, `إيقاف رمز «${r.lab_name}»؟ تُقفل محطاته عند أول اتصال بالإنترنت.`)} className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs text-red-600 hover:bg-red-50"><Ban className="size-3.5" /> إيقاف</button>
                    : <button onClick={() => change(r, { action: "resume" })} className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs text-brand-dark hover:bg-teal-50"><Play className="size-3.5" /> إعادة تفعيل</button>}
                  {r.device_id && <button onClick={() => change(r, { action: "reset_device" }, "فك ربط الجهاز؟ يستطيع المختبر بعدها إدخال نفس الرمز على جهاز جديد، والمدة تستمر كما هي.")} className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs hover:bg-canvas"><MonitorSmartphone className="size-3.5" /> نقل لجهاز جديد</button>}
                  <button onClick={() => change(r, { action: "new_code" }, "إنشاء رمز جديد لهذا المختبر؟ الرمز القديم لا يعمل بعدها لتفعيل جهاز، والجهاز الحالي يستمر.")} className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs hover:bg-canvas"><KeyRound className="size-3.5" /> رمز جديد</button>
                  <button onClick={() => { const lab = window.prompt("اسم المختبر:", r.lab_name); if (lab == null) return; const note = window.prompt("ملاحظة:", r.note) ?? r.note; change(r, { action: "rename", lab, note }); }} title="تعديل الاسم والملاحظة" className="grid size-7 place-items-center rounded-lg border border-line hover:bg-canvas"><Pencil className="size-3.5" /></button>
                  <button onClick={() => change(r, { action: "delete" }, `حذف رمز «${r.lab_name}» نهائياً؟ تُقفل محطاته عند أول اتصال بالإنترنت.`)} title="حذف" className="grid size-7 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50"><Trash2 className="size-3.5" /></button>
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-4">
                <Info k="المدة" v={r.activated_at ? `${fmt(r.activated_at)} ← ${fmt(r.expires_at)}` : `${r.duration_days} يوم (تبدأ عند التفعيل)`} />
                <Info k="الجهاز" v={r.device_label || (r.device_id ? "مربوط" : "لم يُربط بعد")} />
                <Info k="آخر اتصال" v={fmtTime(r.last_seen_at)} />
                <Info k="أُنشئ" v={fmt(r.created_at)} />
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs"><CalendarPlus className="size-3.5 text-muted" /><span className="text-muted">المحطات — التغيير يصل للجهاز عند اتصاله بالإنترنت:</span></div>
              <ModuleChips value={r.modules} onChange={(m) => change(r, { action: "modules", modules: m })} small />
            </div>
          );
        })}
      </div>

      {/* Contact line */}
      <div className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="text-sm font-semibold">سطر التواصل</div>
        <p className="mb-2 text-xs text-muted">يظهر في نافذة التفعيل وشاشة القفل عند انتهاء الرمز (مثلاً: للتجديد اتصل على …).</p>
        <div className="flex gap-2">
          <input value={contact} onChange={(e) => setContact(e.target.value)} className={inp} placeholder="للتفعيل أو التجديد تواصل مع: …" />
          <button onClick={async () => { await post({ op: "contact", contact }); load(); }} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">حفظ</button>
        </div>
      </div>
    </>,
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return <div className="rounded-lg bg-canvas px-2.5 py-1.5"><div className="text-[10px] text-muted">{k}</div><div className="font-medium">{v}</div></div>;
}

function ModuleChips({ value, onChange, small }: { value: LicenseModule[]; onChange: (m: LicenseModule[]) => void; small?: boolean }) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${small ? "mt-1.5" : "mt-1.5"}`}>
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
