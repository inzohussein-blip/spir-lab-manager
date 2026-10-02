"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Database, Link2, Loader2, RefreshCw, RotateCcw, Unlink } from "lucide-react";
import { STATION_SYNC, SUPABASE_SQL } from "@/lib/sync/protocol";
import type { JoinMode, SyncErrorCode, SyncStatus } from "@/lib/sync/client";

type Sync = typeof import("@/lib/sync/client");

export const SYNC_ERRORS: Record<string, string> = {
  paused: "المزامنة موقوفة على هذا الحاسوب (الحماية) — شغّلها من «محطة المزامنة ← الإعدادات ← الحماية».",
  auth: "تعذّر الدخول — تحقّق من البريد وكلمة المرور والمفتاح.",
  no_table: "الجدول غير موجود في قاعدة البيانات — نفّذ سكربت الإعداد في SQL Editor أولاً.",
  unreachable: "تعذّر الوصول إلى قاعدة البيانات — تحقّق من العنوان والاتصال.",
  db: "رفضت قاعدة البيانات الطلب.",
  no_code: "PostgreSQL يحتاج أن يكون هذا الجهاز مفعّلاً برمز مختبر.",
  offline: "لا يوجد اتصال بالإنترنت — تُكمل المزامنة وحدها عند عودته.",
  private_host: "عنوان قاعدة البيانات داخلي — استخدم عنواناً يصل إليه الإنترنت.",
  bad_url: "رابط الاتصال غير صحيح.",
  bad_config: "البيانات المدخلة غير مكتملة أو غير صحيحة.",
  owner_set: "هذا الربط مضبوط من صفحة الرموز — يغيّره صاحب الرموز.",
  no_secret: "الخادم يحتاج AUTH_SECRET ليحفظ بيانات الاتصال مشفّرة.",
  tls: "شهادة TLS لخادم القاعدة غير موثوقة أو لا يدعم TLS — لخادم بشهادة ذاتية أضف ‎?sslmode=no-verify‎ إلى الرابط.",
};
const t = (n?: number) => (n ? new Date(n).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—");
const input = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

/** «قاعدة بيانات المختبر»: link this device to the lab's database and follow the sync. */
/** The lab database window in a station's settings — only when station sync is switched on. */
export function SyncPanel() {
  return STATION_SYNC ? <SyncPanelInner /> : null;
}

function SyncPanelInner() {
  const [m, setM] = useState<Sync | null>(null);
  const [st, setSt] = useState<SyncStatus | null>(null);
  const [kind, setKind] = useState<"supabase" | "postgres">("supabase");
  const [f, setF] = useState({ url: "", anonKey: "", email: "", password: "", conn: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let off = () => {};
    import("@/lib/sync/client").then((mod) => {
      setM(mod);
      const upd = () => setSt({ ...mod.syncStatus() });
      window.addEventListener(mod.SYNC_EVENT, upd);
      off = () => window.removeEventListener(mod.SYNC_EVENT, upd);
      upd();
      void mod.startSync();
    }).catch(() => setSt({ state: "unsupported", link: null, pending: 0 }));
    return () => off();
  }, []);

  const err = (e?: SyncErrorCode) => (e ? SYNC_ERRORS[e] ?? SYNC_ERRORS.db : "");
  async function run(fn: () => Promise<{ ok: boolean; error?: SyncErrorCode; records?: number }>, okText: (r: { records?: number }) => string) {
    setBusy(true); setMsg(null);
    try {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: okText(r) } : { ok: false, text: err(r.error) });
    } finally { setBusy(false); }
  }
  const link = () => run(
    () => kind === "supabase"
      ? m!.linkSupabase({ kind: "supabase", url: f.url.trim().replace(/\/+$/, ""), anonKey: f.anonKey.trim(), email: f.email.trim(), password: f.password })
      : m!.linkPostgres(f.conn.trim()),
    (r) => `تم الربط ✓${r.records ? ` — في القاعدة ${r.records} سجلاً` : " — القاعدة فارغة، تُرفع بيانات هذا الجهاز إليها"}`,
  );
  const join = (mode: JoinMode) => {
    const warn = mode === "replace"
      ? "ستُستبدل بيانات هذا الجهاز ببيانات المختبر. تُحفظ نسخة من بيانات الجهاز الحالية ويمكن استرجاعها من هنا. متابعة؟"
      : "ستُضاف بيانات هذا الجهاز إلى بيانات المختبر (وحيث يوجد السجل نفسه في الاثنين تُعتمد نسخة المختبر). قد تتكرر القوائم الافتراضية (الفحوص، الورديات…) إن أُنشئت على كل جهاز. متابعة؟";
    if (!confirm(warn)) return;
    void run(() => m!.join(mode), () => "تم الربط ✓");
  };

  if (!st) return null;
  const linked = !!st.link;
  const valid = kind === "supabase" ? f.url && f.anonKey && f.email && f.password : /^postgres(ql)?:\/\//.test(f.conn.trim());

  return (
    <div id="lab-db" data-testid="sync-panel" className="mt-4 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold"><Database className="size-4" /> قاعدة بيانات المختبر (مزامنة الأجهزة)</div>
      <p className="mb-3 text-xs text-muted">
        يبقى كل جهاز يعمل ويحفظ على نفسه حتى بدون إنترنت، ويتبادل التعديلات مع أجهزة المختبر الأخرى عبر قاعدة بيانات خاصة بالمختبر (Supabase أو أي PostgreSQL).
        تُزامَن النصوص فقط — الصور (كشعار المختبر المرفوع) تبقى على الجهاز الذي أُضيفت فيه.
      </p>

      {st.state === "unsupported" && <p className="text-sm text-amber-700">المزامنة غير متاحة في هذا المتصفح (نافذة خاصة أو تخزين محظور).</p>}

      {linked && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="sync-link">
            <span className={`size-2 rounded-full ${st.state === "ok" ? "bg-emerald-500" : st.state === "error" ? "bg-red-500" : st.state === "needs_join" ? "bg-amber-500" : "bg-sky-500"}`} />
            <span className="font-medium">{st.link!.kind === "postgres" ? "PostgreSQL" : "Supabase"}</span>
            <span dir="ltr" className="font-mono text-xs text-muted">{st.link!.where}</span>
            {st.link!.email && <span dir="ltr" className="text-xs text-muted">({st.link!.email})</span>}
            <span className="rounded-full bg-canvas px-2 py-0.5 text-[11px] text-muted">{st.link!.source === "code" ? "من صفحة الرموز / رمز المختبر" : "من هذا الجهاز"}</span>
          </div>
          <p className="text-xs text-muted" data-testid="sync-state">
            {st.state === "syncing" ? "جارٍ المزامنة…" : st.state === "needs_join" ? "بانتظار اختيارك (بالأسفل)." : st.state === "error" ? <span className="text-red-700">{err(st.error)}</span> : <>آخر مزامنة: <span dir="ltr">{t(st.lastSync)}</span></>}
            {st.pending > 0 && <> · بانتظار الإرسال: <span dir="ltr">{st.pending}</span></>}
            {st.error === "offline" && <> · {SYNC_ERRORS.offline}</>}
          </p>
          {Math.abs(m?.clockOffset() ?? 0) > 120_000 && (
            <p className="text-xs text-amber-700" data-testid="sync-clock">
              ساعة هذا الجهاز تختلف عن الوقت الصحيح بنحو <span dir="ltr">{Math.round(Math.abs(m!.clockOffset()) / 60_000)}</span> دقيقة — تُصحَّح أوقات التعديلات تلقائياً عند المزامنة، ويُفضَّل ضبط الساعة.
            </p>
          )}

          {st.state === "needs_join" && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" data-testid="sync-join">
              <p className="mb-2">في قاعدة بيانات المختبر <b dir="ltr">{st.remoteRecords ?? 0}</b> سجلاً من أجهزة أخرى. كيف يُربط هذا الجهاز؟</p>
              {st.error && st.error !== "offline" && <p className="mb-2 text-xs text-red-700">{err(st.error)}</p>}
              <div className="flex flex-wrap gap-2">
                <button disabled={busy} onClick={() => join("replace")} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50">استخدام بيانات المختبر (لجهاز جديد)</button>
                <button disabled={busy} onClick={() => join("merge")} className="rounded-lg border border-amber-400 px-3 py-1.5 text-xs font-semibold hover:bg-amber-100 disabled:opacity-50">دمج بيانات هذا الجهاز معها</button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => void m!.syncNow()} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs hover:bg-canvas disabled:opacity-50"><RefreshCw className="size-3.5" /> مزامنة الآن</button>
            {st.link!.source === "code" && (
              <button disabled={busy} onClick={() => run(async () => { await m!.refreshLink(); return { ok: true }; }, () => "تم التحديث من صفحة الرموز")} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs hover:bg-canvas disabled:opacity-50"><Link2 className="size-3.5" /> تحديث الربط</button>
            )}
            {!(st.link!.source === "code" && st.link!.kind === "supabase") && (
              <button disabled={busy} onClick={() => { if (confirm("إيقاف المزامنة على هذا الجهاز؟ تبقى بياناته عليه.")) void run(() => m!.unlink(), () => "أُلغي الربط — البيانات على هذا الجهاز فقط."); }} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"><Unlink className="size-3.5" /> إلغاء الربط</button>
            )}
          </div>
        </div>
      )}

      {st.hasSnapshot && (
        <button disabled={busy} onClick={() => { if (confirm("إرجاع بيانات هذا الجهاز كما كانت قبل استبدالها ببيانات المختبر، وإلغاء الربط؟")) void run(async () => ({ ok: await m!.restoreSnapshot() }), () => "أُعيدت بيانات الجهاز السابقة."); }} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs hover:bg-canvas disabled:opacity-50">
          <RotateCcw className="size-3.5" /> استرجاع بيانات الجهاز قبل الربط
        </button>
      )}

      {!linked && st.state !== "unsupported" && (
        <div className="space-y-3">
          <p className="text-sm text-muted">غير مربوط — البيانات على هذا الجهاز فقط.</p>
          <div className="inline-flex rounded-lg border border-line p-0.5 text-xs">
            {(["supabase", "postgres"] as const).map((k) => (
              <button key={k} onClick={() => setKind(k)} className={`rounded-md px-3 py-1 ${kind === k ? "bg-brand text-white" : "hover:bg-canvas"}`}>{k === "supabase" ? "Supabase" : "PostgreSQL"}</button>
            ))}
          </div>
          {kind === "supabase" ? (
            <div className="space-y-2">
              <ol className="list-inside list-decimal space-y-0.5 text-xs text-muted">
                <li>أنشئ مشروعاً في Supabase خاصاً بالمختبر.</li>
                <li>من SQL Editor الصق سكربت الإعداد ونفّذه مرة واحدة.</li>
                <li>من Authentication → Users أضف مستخدماً للمختبر (بريد وكلمة مرور).</li>
                <li>من Project Settings → API انسخ Project URL و anon key.</li>
              </ol>
              <button type="button" onClick={() => { void navigator.clipboard?.writeText(SUPABASE_SQL).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs hover:bg-canvas">
                {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />} نسخ سكربت الإعداد (SQL)
              </button>
              <div className="grid gap-2 sm:grid-cols-2">
                <input dir="ltr" aria-label="Project URL" placeholder="https://xxxx.supabase.co" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} className={input} />
                <input dir="ltr" aria-label="anon key" placeholder="anon key" value={f.anonKey} onChange={(e) => setF({ ...f, anonKey: e.target.value })} className={input} />
                <input dir="ltr" aria-label="بريد مستخدم المختبر" placeholder="lab@example.com" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={input} />
                <input dir="ltr" type="password" aria-label="كلمة مرور مستخدم المختبر" placeholder="••••••••" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className={input} />
              </div>
              <p className="text-[11px] text-muted">تُحفظ هذه البيانات على هذا الجهاز فقط. لربط كل أجهزة المختبر مرة واحدة يضبطها صاحب الرموز من صفحة الرموز.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <input dir="ltr" aria-label="رابط الاتصال" placeholder="postgresql://user:password@host:5432/db" value={f.conn} onChange={(e) => setF({ ...f, conn: e.target.value })} className={input} />
              <p className="text-[11px] text-muted">أي PostgreSQL (Neon أو Supabase أو Railway أو خادمك). يُحفظ الرابط مشفّراً على الخادم ولا يعود إلى الجهاز، وينشئ الخادم الجدول بنفسه. يحتاج أن يكون الجهاز مفعّلاً برمز مختبر.</p>
            </div>
          )}
          <button data-testid="sync-link-btn" disabled={busy || !valid || !m} onClick={link} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />} ربط
          </button>
        </div>
      )}
      {msg && <p className={`mt-2 text-xs ${msg.ok ? "text-emerald-700" : "text-red-700"}`} data-testid="sync-msg">{msg.text}</p>}
    </div>
  );
}
