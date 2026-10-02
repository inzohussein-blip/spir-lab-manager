"use client";

import { useEffect, useState } from "react";
import { Stethoscope, Plus, Copy, Check, RefreshCw, KeyRound, Trash2, Upload, Link2, X, AlertTriangle, MessageCircle } from "lucide-react";
import { getDoctors, getSettings } from "@/lib/station/store";
import {
  shares, createShare, updateShare, renewShare, removeShare, publishAll, visitsFor, referrerNames, DOCTORS_EVENT, DOCTOR_ERRORS, type DoctorShare,
} from "@/lib/doctors/lab";
import { WINDOW_LABEL, type DoctorWindow } from "@/lib/doctors/code";
import { card, btn } from "@/components/sync/parts";
import { PageHead } from "@/components/sync/ui";
import { cn, fmtDateTime } from "@/lib/utils";

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
const WINDOWS = Object.keys(WINDOW_LABEL) as DoctorWindow[];

function useDoctors() {
  const [, set] = useState(0);
  useEffect(() => {
    const up = () => set((x) => x + 1);
    window.addEventListener(DOCTORS_EVENT, up);
    return () => window.removeEventListener(DOCTORS_EVENT, up);
  }, []);
}

/** «رموز الأطباء»: a code for each referring doctor; the doctor sees the results of the patients
 *  the lab referred under his name, for the period the lab chooses, in «نافذة الأطباء». */
export default function DoctorCodesPage() {
  useDoctors();
  const [on, setOn] = useState<boolean | null>(null);
  const [shown, setShown] = useState<{ doctor: string; code: string } | null>(null);
  useEffect(() => { fetch("/api/doctors", { cache: "no-store" }).then((r) => r.json()).then((d) => setOn(d?.on !== false)).catch(() => setOn(null)); }, []);
  const list = shares();
  return (
    <div className="flex max-w-5xl flex-col gap-5">
      <PageHead icon={<Stethoscope />} title="رموز الأطباء" sub="أعطِ كل طبيب رمز تفعيل لحسابه: يرى في «نافذة الأطباء» (تُفتح بهذا الرمز وحده) نتائج المراجعين المحالين باسمه، للمدة التي تختارها. النتائج تُرفع مشفّرة برمزه، ولا يقرؤها غيره." />
      {on === false && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200" data-testid="doctors-off">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> أوقف المزوّد نافذة الأطباء — لا تُرفع النتائج ولا يراها الأطباء حتى يعيدها.
        </div>
      )}
      {shown && <ShownCode {...shown} onClose={() => setShown(null)} />}
      <NewCode onMade={setShown} />
      <section className={card} data-testid="doctor-shares">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">الأطباء ({list.length})</h2>
          {list.length > 0 && <button onClick={() => void publishAll(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs hover:bg-canvas"><Upload className="size-3.5" /> رفع الآن</button>}
        </div>
        {list.length === 0 ? <p className="text-sm text-muted">لا رموز بعد.</p> : (
          <div className="flex flex-col gap-3">{list.map((s) => <ShareRow key={s.id} s={s} onCode={(code) => setShown({ doctor: s.doctor, code })} />)}</div>
        )}
        <p className="mt-3 text-xs text-muted">الرموز محفوظة على هذا الحاسوب وحده، وهو الذي يرفع النتائج كل بضع دقائق ما دامت «محطة المختبر» أو «محطة المزامنة» مفتوحة فيه.</p>
      </section>
      <NamesCheck />
    </div>
  );
}

function NewCode({ onMade }: { onMade: (v: { doctor: string; code: string }) => void }) {
  const doctors = getDoctors();
  const [doctor, setDoctor] = useState("");
  const [win, setWin] = useState<DoctorWindow>("week");
  const [err, setErr] = useState("");
  function make() {
    const d = doctor.trim();
    if (!d) { setErr("اكتب اسم الطبيب كما يُكتب في الزيارات."); return; }
    if (shares().some((s) => s.doctor.trim() === d)) { setErr("لهذا الطبيب رمز — استعمل «رمز جديد» في قائمته."); return; }
    const { code } = createShare(d, win);
    setDoctor(""); setErr(""); onMade({ doctor: d, code });
  }
  return (
    <section className={card} data-testid="new-doctor-code">
      <div className="mb-2 flex items-center gap-2 font-bold"><Plus className="size-4 text-brand" /> رمز لطبيب</div>
      <div className="grid gap-2 sm:grid-cols-[1fr_12rem_auto]">
        <input value={doctor} onChange={(e) => { setDoctor(e.target.value); setErr(""); }} list="station-doctors" aria-label="اسم الطبيب" placeholder="اسم الطبيب (من قائمة الأطباء أو كما يُكتب في الزيارات)" className={inp} />
        <datalist id="station-doctors">{doctors.map((d) => <option key={d.id} value={d.name} />)}</datalist>
        <select value={win} onChange={(e) => setWin(e.target.value as DoctorWindow)} aria-label="مدة العرض" className={inp}>
          {WINDOWS.map((w) => <option key={w} value={w}>يرى نتائج {WINDOW_LABEL[w]}</option>)}
        </select>
        <button onClick={make} className={`${btn} bg-brand text-white hover:bg-brand-dark`}><KeyRound className="size-4" /> إنشاء الرمز</button>
      </div>
      {err && <p className="mt-1.5 text-xs text-red-600">{err}</p>}
    </section>
  );
}

function ShownCode({ doctor, code, onClose }: { doctor: string; code: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const lab = getSettings().labName;
  const link = typeof window !== "undefined" ? `${window.location.origin}/doctor` : "/doctor";
  const msg = `د. ${doctor}، رمز تفعيل حسابك في «نافذة الأطباء» لدى ${lab}:\n${code}\nافتح الرابط وأدخل الرمز: ${link}`;
  return (
    <section className="rounded-2xl border-2 border-brand bg-brand-light/40 p-5 text-center" data-testid="doctor-code-shown">
      <div className="text-sm font-semibold">رمز «{doctor}»</div>
      <div className="mt-2 font-mono text-3xl font-extrabold tracking-widest text-brand-dark" dir="ltr" data-testid="doctor-code">{code}</div>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <button onClick={() => navigator.clipboard?.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => window.prompt("انسخ الرمز:", code))}
          className={`${btn} bg-brand text-white hover:bg-brand-dark`}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />} نسخ الرمز</button>
        <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer" className={`${btn} border border-green-600 bg-surface text-green-700 hover:bg-green-50`}><MessageCircle className="size-4" /> إرسال بواتساب</a>
        <button onClick={onClose} className={`${btn} border border-line hover:bg-surface`}>تم</button>
      </div>
      <p className="mt-2 text-xs text-amber-700">احفظه وأرسله للطبيب الآن — لا يُعرض مرة أخرى. إن ضاع اضغط «رمز جديد».</p>
    </section>
  );
}

function ShareRow({ s, onCode }: { s: DoctorShare; onCode: (code: string) => void }) {
  const n = visitsFor(s).length;
  const toggle = (k: "hidePhone" | "completeOnly" | "ranges", label: string) => (
    <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={s[k]} onChange={(e) => updateShare(s.id, { [k]: e.target.checked })} aria-label={`${label} — ${s.doctor}`} /> {label}</label>
  );
  return (
    <div className="rounded-xl border border-line p-3" data-testid="doctor-share" data-doctor={s.doctor}>
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-bold">{s.doctor}</div>
          <div className="text-xs text-muted" data-testid="share-status">
            {n} مراجع في {WINDOW_LABEL[s.window]} · {s.lastError
              ? <span className="text-red-600">{DOCTOR_ERRORS[s.lastError] ?? "تعذّر الرفع"}</span>
              : s.lastAt ? <>آخر رفع {fmtDateTime(s.lastAt)} ({s.lastCount})</> : "لم يُرفع بعد"}
          </div>
        </div>
        <select value={s.window} onChange={(e) => updateShare(s.id, { window: e.target.value as DoctorWindow })} aria-label={`مدة العرض — ${s.doctor}`} className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs">
          {WINDOWS.map((w) => <option key={w} value={w}>{WINDOW_LABEL[w]}</option>)}
        </select>
        <button onClick={async () => { if (!window.confirm(`رمز جديد لـ«${s.doctor}»؟ يتوقف الرمز القديم فوراً.`)) return; const c = await renewShare(s.id); if (c) onCode(c); else window.alert("تعذّر إيقاف الرمز القديم الآن — تحقّق من الاتصال وأعد المحاولة. لم يتغير شيء."); }} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs hover:bg-canvas"><RefreshCw className="size-3.5" /> رمز جديد</button>
        <button onClick={async () => { if (!window.confirm(`إيقاف رمز «${s.doctor}»؟ تُحذف نتائجه من الخادم ولا يرى شيئاً بعدها.`)) return; if (!(await removeShare(s.id))) window.alert("تعذّر الإيقاف الآن — تحقّق من الاتصال وأعد المحاولة."); }} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs text-red-700 hover:bg-red-50"><Trash2 className="size-3.5" /> إيقاف الرمز</button>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {toggle("hidePhone", "إخفاء هاتف المريض")}
        {toggle("completeOnly", "المكتملة النتائج فقط")}
        {toggle("ranges", "القيم الطبيعية وH / L")}
      </div>
      {s.aliases.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted">أسماء أخرى له:</span>
          {s.aliases.map((a) => (
            <span key={a} className="inline-flex items-center gap-1 rounded-full bg-canvas px-2 py-0.5 ring-1 ring-line">{a}
              <button onClick={() => updateShare(s.id, { aliases: s.aliases.filter((x) => x !== a) })} aria-label={`إزالة ${a}`}><X className="size-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** The referring names written on the lab's visits: which go to a doctor code, and which do not —
 *  a spelling of a doctor that has a code can be linked to it. */
function NamesCheck() {
  const names = referrerNames();
  const list = shares();
  if (!names.length) return null;
  return (
    <section className={card} data-testid="names-check">
      <h2 className="mb-1 font-bold">أسماء الأطباء في الزيارات</h2>
      <p className="mb-3 text-xs text-muted">آخر سنة. الاسم غير المربوط لا تصل نتائجه لأي طبيب — إن كان طريقة أخرى لكتابة اسم طبيب له رمز فاربطه به.</p>
      <ul className="divide-y divide-line text-sm">
        {names.slice(0, 40).map((x) => {
          const linked = list.find((s) => s.id === x.shareId);
          return (
            <li key={x.name} className="flex flex-wrap items-center gap-2 py-2" data-referrer={x.name}>
              <span className="min-w-0 flex-1">{x.name} <span className="text-xs text-muted">({x.count})</span></span>
              {linked ? <span className="inline-flex items-center gap-1 text-xs text-brand-dark"><Link2 className="size-3" /> {linked.doctor}</span>
                : list.length > 0 ? (
                  <select defaultValue="" onChange={(e) => { const s = list.find((y) => y.id === e.target.value); if (s) updateShare(s.id, { aliases: [...s.aliases, x.name] }); }} aria-label={`ربط ${x.name}`} className={cn("rounded-lg border border-line bg-surface px-2 py-1 text-xs")}>
                    <option value="" disabled>ربط بطبيب…</option>
                    {list.map((s) => <option key={s.id} value={s.id}>{s.doctor}</option>)}
                  </select>
                ) : <span className="text-xs text-muted">غير مربوط</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
