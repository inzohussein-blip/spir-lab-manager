"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Lock, Eye, EyeOff, Plus, Trash2, Pencil, Search, ChevronDown, KeyRound, Check, X, Users } from "lucide-react";
import { LICENSE_MODULES, type LicenseModule } from "@/lib/license/modules";
import { MODULE_META, ALWAYS_STATIONS } from "./stations";
import { fmtDateTime } from "@/lib/utils";

/** «رموز الدخول (PIN)» in /license: per lab code, hide or show the PIN feature, and set, change or
 *  remove each station's PINs — several for one station only from here. The devices apply it at
 *  their next check with the server (or at once with «نسيت الرمز؟ ← تحديث من المزوّد»). */

type PinStation = "station" | "purchasing" | "training" | "qc" | "roster" | "connect" | "sync" | "about";
interface PinEntry { hash: string; label: string }
export interface PinPolicyView { id: string; at: number; hidden: boolean; stations: Partial<Record<PinStation, { rev: string; pins: PinEntry[] | null; at: number }>> }
export interface PinRow {
  id: string; lab_name: string; note: string; status: "active" | "stopped"; modules: LicenseModule[];
  device_id: string | null; last_seen_at: number | null; devices: { last_seen_at: number | null }[];
  pinPolicy?: PinPolicyView | null;
  pin: { hash: string | null; scope: string; at: number } | null;
}
type Change = (r: PinRow, c: Record<string, unknown>, confirmText?: string) => Promise<void> | void;

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
const PAGE = 40;
const MAX = 10;
const cleanPin = (s: string) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0)).replace(/\D/g, "").slice(0, 8);
const validPin = (s: string) => /^\d{4,8}$/.test(s);

/** The stations a code's devices open: its local stations, then sync and about (with every code). */
function stationsOf(r: PinRow) {
  const local = LICENSE_MODULES.filter((m) => m.id !== "admin" && r.modules.includes(m.id)).map((m) => ({ id: m.id as PinStation, label: m.label, icon: MODULE_META[m.id].icon, color: MODULE_META[m.id].color }));
  const always = ALWAYS_STATIONS.map((a) => ({ id: a.id as PinStation, label: a.label, icon: a.icon, color: a.color }));
  return [...local, ...always];
}
const lastSeen = (r: PinRow) => Math.max(r.last_seen_at ?? 0, ...r.devices.map((d) => d.last_seen_at ?? 0));
const pinCount = (r: PinRow) => Object.values(r.pinPolicy?.stations ?? {}).reduce((n, s) => n + (s?.pins?.length ?? 0), 0);

export function PinSection({ rows, focus, onFocused, change }: { rows: PinRow[]; focus: string | null; onFocused: () => void; change: Change }) {
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);
  const [limit, setLimit] = useState(PAGE);
  // Opened from a code's «رموز الدخول» button: that code starts expanded (and is scrolled to below).
  const [open, setOpen] = useState<Set<string>>(() => new Set(focus ? [focus] : []));
  const list = useMemo(() => {
    const t = dq.trim();
    return rows.filter((r) => !t || r.lab_name.includes(t) || r.note.includes(t)).sort((a, b) => a.lab_name.localeCompare(b.lab_name, "ar"));
  }, [rows, dq]);
  useEffect(() => { setLimit(PAGE); }, [dq]);
  useEffect(() => {
    if (!focus) return;
    const r = rows.find((x) => x.id === focus);
    if (r) setTimeout(() => document.querySelector(`[data-testid="pin-code"][data-pin-lab="${CSS.escape(r.lab_name)}"]`)?.scrollIntoView({ block: "start" }), 80);
    onFocused();
  }, [focus, rows, onFocused]);

  const hidden = rows.filter((r) => r.pinPolicy?.hidden).length;
  const withPins = rows.filter((r) => pinCount(r) > 0).length;
  return (
    <div data-testid="pin-section">
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="الرموز" value={rows.length} />
        <Stat label="لها رموز دخول من هنا" value={withPins} />
        <Stat label="الخاصية مخفية" value={hidden} warn={hidden > 0} />
      </div>
      <p className="mb-4 rounded-xl bg-surface px-4 py-3 text-xs leading-relaxed text-muted ring-1 ring-line">
        لكل محطة رمزها الخاص. يستطيع المختبر تفعيل رمز واحد لكل محطة من إعداداتها، أما <b className="text-ink">عدة رموز للمحطة نفسها</b> (مثلاً رمز لكل موظف) فمن هنا فقط.
        «إخفاء الخاصية» يوقف طلب الرمز في كل محطات المختبر ويخفي بطاقته من الإعدادات، و«إظهار» يعيدها كما كانت. يُطبَّق كل تغيير عند اتصال الجهاز التالي بالإنترنت، أو فوراً بـ«نسيت الرمز؟ ← تحديث من المزوّد».
        لا يُحفظ الرمز نفسه، بل بصمته فقط — فلا يمكن عرضه بعد الحفظ.
      </p>
      <label className="relative mb-3 block">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث باسم المختبر أو الملاحظة…" aria-label="بحث في رموز الدخول" className={`${inp} ps-9`} />
      </label>
      <div className="mb-2 text-xs text-muted">المعروض: {list.length} من {rows.length}</div>
      <div className="flex flex-col gap-3">
        {list.length === 0 && <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">{rows.length ? "لا رموز مطابقة." : "لا رموز بعد."}</p>}
        {list.slice(0, limit).map((r) => (
          <PinCode key={r.id} r={r} open={open.has(r.id)} change={change}
            toggle={() => setOpen((s) => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} />
        ))}
        {list.length > limit && (
          <button onClick={() => setLimit((n) => n + PAGE)} className="rounded-2xl border border-dashed border-line py-3 text-sm font-semibold text-brand-dark hover:bg-surface">عرض المزيد ({list.length - limit})</button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2.5 shadow-[var(--shadow-card)]">
      <div className={`font-mono text-xl font-extrabold tabular-nums ${warn ? "text-amber-700" : ""}`}>{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}

function PinCode({ r, open, toggle, change }: { r: PinRow; open: boolean; toggle: () => void; change: Change }) {
  const hidden = !!r.pinPolicy?.hidden;
  const n = pinCount(r);
  const stations = stationsOf(r);
  return (
    <div data-testid="pin-code" data-pin-lab={r.lab_name} className={`rounded-2xl border border-s-4 border-line bg-surface p-4 shadow-[var(--shadow-card)] ${hidden ? "border-s-slate-400" : n ? "border-s-teal-500" : "border-s-slate-200"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button onClick={toggle} aria-expanded={open} className="flex min-w-0 items-center gap-2 text-start">
          <ChevronDown className={`size-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
          <span className="truncate text-base font-bold">{r.lab_name}</span>
          {r.status === "stopped" && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">موقوف</span>}
          {hidden
            ? <span data-testid="pin-hidden-badge" className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700"><EyeOff className="size-3" /> مخفية</span>
            : <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-brand-dark"><Eye className="size-3" /> ظاهرة</span>}
          {n > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-canvas px-2 py-0.5 text-xs text-muted ring-1 ring-line"><Lock className="size-3" /> {n} {n === 1 ? "رمز" : "رموز"}</span>}
        </button>
        <button data-testid="pin-hide-toggle" aria-pressed={hidden}
          onClick={() => change(r, { action: "pin_hidden", hidden: !hidden }, hidden ? undefined : `إخفاء خاصية رمز الدخول عن «${r.lab_name}»؟ لا يُطلب رمز في محطاته حتى تعيد إظهارها.`)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${hidden ? "border-brand bg-brand text-white hover:bg-brand-dark" : "border-line hover:bg-canvas"}`}>
          {hidden ? <><Eye className="size-3.5" /> إظهار الخاصية</> : <><EyeOff className="size-3.5" /> إخفاء الخاصية</>}
        </button>
      </div>
      {r.note && <div className="mt-0.5 ps-6 text-xs text-muted">{r.note}</div>}
      {open && (
        <div className="mt-3 grid gap-3">
          {hidden && <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">الخاصية مخفية: الرموز أدناه محفوظة ولا تُطلب حتى تعيد إظهارها.</p>}
          {r.pin?.hash && <p className="text-[11px] text-muted">سبق تعيين رمز بالطريقة القديمة في {fmtDateTime(r.pin.at)}؛ ما تعيّنه هنا لمحطة يحلّ محله فيها.</p>}
          <div className="grid gap-3 lg:grid-cols-2">
            {stations.map((s) => <PinStationBox key={s.id} r={r} st={s} change={change} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function PinStationBox({ r, st, change }: { r: PinRow; st: ReturnType<typeof stationsOf>[number]; change: Change }) {
  const cur = r.pinPolicy?.stations[st.id];
  const pins = cur?.pins ?? [];
  const [label, setLabel] = useState("");
  const [pin, setPin] = useState("");
  const [edit, setEdit] = useState<number | null>(null);
  const [eLabel, setELabel] = useState("");
  const [ePin, setEPin] = useState("");
  const [err, setErr] = useState("");
  const busy = useRef(false);
  const Icon = st.icon;
  const seen = lastSeen(r);

  async function save(entries: { label: string; pin?: string; keep?: string }[] | null, confirmText?: string) {
    if (busy.current) return;
    busy.current = true;
    try { await change(r, { action: "pin_station", station: st.id, entries }, confirmText); } finally { busy.current = false; }
  }
  const keepAll = () => pins.map((p) => ({ label: p.label, keep: p.hash }));
  function add() {
    if (!validPin(pin)) { setErr("الرمز من 4 إلى 8 أرقام."); return; }
    if (pins.length >= MAX) { setErr(`حتى ${MAX} رموز للمحطة.`); return; }
    save([...keepAll(), { label: label.trim() || `رمز ${pins.length + 1}`, pin }]);
    setLabel(""); setPin(""); setErr("");
  }
  function saveEdit(i: number) {
    if (ePin && !validPin(ePin)) { setErr("الرمز من 4 إلى 8 أرقام."); return; }
    save(pins.map((p, j) => (j === i ? { label: eLabel.trim() || p.label, ...(ePin ? { pin: ePin } : { keep: p.hash }) } : { label: p.label, keep: p.hash })));
    setEdit(null); setErr("");
  }
  function remove(i: number) {
    const rest = pins.filter((_, j) => j !== i).map((p) => ({ label: p.label, keep: p.hash }));
    save(rest.length ? rest : null, `حذف الرمز «${pins[i].label}» من ${st.label}؟`);
  }

  return (
    <div data-testid="pin-station" data-station={st.id} className="rounded-xl border border-line bg-canvas/60 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg text-white" style={{ background: st.color }}><Icon className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">{st.label}</div>
          <div className="text-[11px] text-muted">
            {cur ? (
              <>{cur.pins ? `${pins.length} ${pins.length === 1 ? "رمز" : "رموز"}` : "أُزيل الرمز"} — {fmtDateTime(cur.at)} — {seen >= cur.at
                ? <span className="text-brand-dark">وصل الجهاز</span> : <span className="text-amber-700">بانتظار اتصال الجهاز</span>}</>
            ) : "لم يُعيَّن من هنا — للمختبر أن يفعّل رمزه من إعدادات المحطة"}
          </div>
        </div>
        {pins.length > 0 && (
          <button onClick={() => save(null, `إزالة كل رموز الدخول من ${st.label}؟ تُفتح المحطة بلا رمز.`)} className="rounded-lg border border-line px-2 py-1 text-[11px] text-red-700 hover:bg-red-50">إزالة الرمز</button>
        )}
      </div>

      {pins.length > 0 && (
        <ul className="mb-2 rounded-lg border border-line bg-surface text-xs">
          {pins.map((p, i) => (
            <li key={p.hash} data-testid="pin-entry" className="border-b border-line px-2.5 py-1.5 last:border-0">
              {edit === i ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <input value={eLabel} onChange={(e) => setELabel(e.target.value.slice(0, 40))} aria-label="اسم الرمز" className={`${inp} w-32 py-1 text-xs`} />
                  <input value={ePin} onChange={(e) => { setEPin(cleanPin(e.target.value)); setErr(""); }} inputMode="numeric" dir="ltr" placeholder="رمز جديد (اختياري)" aria-label="الرمز الجديد"
                    className={`${inp} w-36 py-1 text-center text-xs tracking-widest`} />
                  <button onClick={() => saveEdit(i)} aria-label="حفظ التعديل" className="grid size-7 place-items-center rounded-md bg-brand text-white hover:bg-brand-dark"><Check className="size-3.5" /></button>
                  <button onClick={() => { setEdit(null); setErr(""); }} aria-label="إلغاء" className="grid size-7 place-items-center rounded-md border border-line hover:bg-canvas"><X className="size-3.5" /></button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {i === 0 ? <KeyRound className="size-3.5 shrink-0 text-brand-dark" /> : <Users className="size-3.5 shrink-0 text-muted" />}
                  <span className="min-w-0 flex-1 truncate font-medium">{p.label || `رمز ${i + 1}`}</span>
                  <span className="font-mono tracking-widest text-muted" dir="ltr">••••</span>
                  <button onClick={() => { setEdit(i); setELabel(p.label); setEPin(""); setErr(""); }} aria-label={`تعديل ${p.label}`} title="تعديل الاسم أو تغيير الرمز" className="grid size-7 place-items-center rounded-md hover:bg-canvas"><Pencil className="size-3.5" /></button>
                  <button onClick={() => remove(i)} aria-label={`حذف ${p.label}`} title="حذف هذا الرمز" className="grid size-7 place-items-center rounded-md text-red-700 hover:bg-red-50"><Trash2 className="size-3.5" /></button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {pins.length < MAX && (
        <form onSubmit={(e) => { e.preventDefault(); add(); }} className="flex flex-wrap items-center gap-1.5">
          <input value={label} onChange={(e) => setLabel(e.target.value.slice(0, 40))} placeholder={pins.length ? "اسمه، مثلاً: المساء" : "اسمه، مثلاً: الاستقبال"} aria-label="اسم الرمز"
            className={`${inp} min-w-0 flex-1 py-1.5 text-xs`} />
          <input value={pin} onChange={(e) => { setPin(cleanPin(e.target.value)); setErr(""); }} inputMode="numeric" dir="ltr" placeholder="4–8 أرقام" aria-label="رمز الدخول الجديد"
            className={`${inp} w-28 py-1.5 text-center text-xs tracking-widest`} />
          <button disabled={!pin} className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-40">
            <Plus className="size-3.5" /> {pins.length ? "إضافة رمز آخر" : "تعيين الرمز"}
          </button>
        </form>
      )}
      {err && <p className="mt-1 text-[11px] text-red-600">{err}</p>}
    </div>
  );
}
