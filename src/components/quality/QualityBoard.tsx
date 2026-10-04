"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Printer, Plus, Trash2, Wrench, Check, AlertTriangle } from "lucide-react";
import {
  qcSaveAnalyte, qcDeleteAnalyte, qcSetResult, tempSaveUnit, tempDeleteUnit, tempSet, deviceSave, deviceDelete, deviceTaskDone, deviceLog, deviceResolve,
} from "@/app/actions/quality";
import { evaluateAnalyte, RULES, FREQ, tempOk, type Analyte, type QcResult, type TempUnit, type TempReading, type Device, type QcLevel, type Freq, type Evaluation } from "@/lib/qc/store";
import { LJChart, qcStats } from "@/components/qc/LJChart";

const inp = "rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-brand";
const TABS = [
  ["today", "السيطرة اليومية"], ["chart", "مخطط Levey-Jennings"], ["temps", "درجات الحرارة"], ["devices", "الأجهزة"], ["setup", "المحاليل والوحدات"], ["quick", "تشغيلات سريعة"],
] as const;
type Tab = (typeof TABS)[number][0];

const addDays = (d: string, n: number) => { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + n); return x.toLocaleDateString("en-CA"); };
const addMonths = (d: string, n: number) => { const x = new Date(d + "T12:00:00"); x.setMonth(x.getMonth() + n); return x.toLocaleDateString("en-CA"); };
const daysBetween = (a: string, b: string) => Math.round((new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) / 86_400_000);

type Res = { ok: boolean; error?: string };

export function QualityBoard({ today, analytes, results, units, temps, devices, quick }: {
  today: string; analytes: Analyte[]; results: QcResult[]; units: TempUnit[]; temps: TempReading[]; devices: Device[]; quick: ReactNode;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [tab, setTab] = useState<Tab>("today");
  const run = (fn: () => Promise<Res>, ok?: string, then?: () => void) => start(async () => {
    const r = await fn();
    if (!r.ok) { toast.error(r.error ?? "تعذّر"); return; }
    if (ok) toast.success(ok);
    then?.();
    router.refresh();
  });
  const evals = useMemo(() => new Map(analytes.map((a) => [a.id, evaluateAnalyte(a, results)])), [analytes, results]);

  // The day's state for the tab badges.
  const active = analytes.filter((a) => a.active);
  const levelsTotal = active.reduce((s, a) => s + a.levels.length, 0);
  const levelsDone = active.reduce((s, a) => s + a.levels.filter((l) => results.some((r) => r.analyteId === a.id && r.levelId === l.id && r.date === today)).length, 0);
  const rejectsToday = results.filter((r) => r.date === today && evals.get(r.analyteId)?.get(r.id)?.status === "reject").length;
  const tempsMissing = units.length * 2 - temps.filter((t) => t.date === today).length;
  const due = devices.reduce((s, d) => s + d.tasks.filter((t) => !t.lastDone || daysBetween(today, addDays(t.lastDone, FREQ[t.freq as Freq]?.days ?? 1)) <= 0).length, 0)
    + devices.filter((d) => d.calibMonths && (!d.lastCalib || addMonths(d.lastCalib, d.calibMonths) < today)).length
    + devices.reduce((s, d) => s + d.log.filter((l) => l.type === "fault" && !l.resolved).length, 0);
  const badge: Partial<Record<Tab, string>> = {
    today: levelsTotal ? `${levelsDone}/${levelsTotal}` : "", temps: tempsMissing > 0 ? String(tempsMissing) : "", devices: due ? String(due) : "",
  };

  return (
    <div data-testid="quality-board">
      <div className="no-print mb-4 grid gap-3 sm:grid-cols-4">
        {[["مستويات اليوم", levelsTotal ? `${levelsDone}/${levelsTotal}` : "—", levelsDone < levelsTotal ? "text-amber-600" : "text-brand-dark"],
          ["رفض اليوم (Westgard)", String(rejectsToday), rejectsToday ? "text-red-600" : "text-brand-dark"],
          ["قراءات حرارة ناقصة", String(Math.max(0, tempsMissing)), tempsMissing > 0 ? "text-amber-600" : "text-brand-dark"],
          ["مهام أجهزة مستحقة / أعطال", String(due), due ? "text-amber-600" : "text-brand-dark"]].map(([k, v, c]) => (
          <div key={k} className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]"><div className="text-xs text-muted">{k}</div><div className={`mt-1 text-2xl font-bold ${c}`}>{v}</div></div>
        ))}
      </div>
      <div className="no-print mb-4 flex flex-wrap gap-1 rounded-xl bg-canvas p-1 text-sm">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} aria-pressed={tab === id} data-testid={`qtab-${id}`}
            className={`rounded-lg px-3 py-1.5 font-semibold ${tab === id ? "bg-surface text-brand-dark shadow-sm" : "text-muted hover:text-ink"}`}>
            {label}{badge[id] && <span className="ms-1.5 rounded-full bg-amber-100 px-1.5 text-[11px] text-amber-800">{badge[id]}</span>}
          </button>
        ))}
      </div>
      {tab === "today" && <Today today={today} analytes={active} results={results} evals={evals} busy={busy} run={run} />}
      {tab === "chart" && <Chart analytes={analytes} results={results} evals={evals} today={today} />}
      {tab === "temps" && <Temps today={today} units={units} temps={temps} busy={busy} run={run} />}
      {tab === "devices" && <Devices today={today} devices={devices} busy={busy} run={run} />}
      {tab === "setup" && <Setup analytes={analytes} units={units} busy={busy} run={run} />}
      {tab === "quick" && quick}
    </div>
  );
}

type Run = (fn: () => Promise<Res>, ok?: string, then?: () => void) => void;

function Status({ e }: { e?: Evaluation }) {
  if (!e) return null;
  const tone = e.status === "reject" ? "bg-red-50 text-red-700" : e.status === "warn" ? "bg-amber-50 text-amber-800" : "bg-teal-50 text-brand-dark";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`} title={e.rules.map((c) => RULES[c].text).join("\n")} data-testid="qc-status">
      {e.status === "reject" ? "رفض" : e.status === "warn" ? "تحذير" : "مقبول"}{e.rules.length ? ` · ${e.rules.join(", ")}` : ""} <span dir="ltr">(z {e.z.toFixed(1)})</span>
    </span>
  );
}

function Today({ today, analytes, results, evals, busy, run }: { today: string; analytes: Analyte[]; results: QcResult[]; evals: Map<string, Map<string, Evaluation>>; busy: boolean; run: Run }) {
  const [date, setDate] = useState(today);
  const [draft, setDraft] = useState<Record<string, string>>({});
  if (!analytes.length) return <Empty text="أضف المحاليل الضابطة ومستوياتها من «المحاليل والوحدات» أولاً." />;
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted">تُقيَّم كل قيمة فوراً بقواعد Westgard (1-2s تحذير؛ 1-3s، 2-2s، R-4s، 4-1s، 10x رفض) وتُحفظ عند مغادرة الحقل.</div>
        <input type="date" value={date} max={today} onChange={(e) => { if (e.target.value) { setDate(e.target.value); setDraft({}); } }} className={inp} aria-label="تاريخ السيطرة" />
      </div>
      <div className="flex flex-col gap-3">
        {analytes.map((a) => (
          <div key={a.id} className="rounded-xl border border-line p-3">
            <div className="mb-2 font-semibold">{a.name} {a.device && <span className="text-xs font-normal text-muted">· {a.device}</span>}</div>
            <div className="grid gap-2 md:grid-cols-2">
              {a.levels.map((l) => {
                const r = results.find((x) => x.analyteId === a.id && x.levelId === l.id && x.date === date);
                const k = `${a.id}|${l.id}`;
                const v = draft[k] ?? (r ? String(r.value) : "");
                const commit = () => {
                  if (!(k in draft) || draft[k] === (r ? String(r.value) : "")) return;
                  run(() => qcSetResult(a.id, l.id, date, draft[k]), undefined, () => setDraft((d) => { const n = { ...d }; delete n[k]; return n; }));
                };
                return (
                  <div key={l.id} className="flex flex-wrap items-center gap-2" data-testid="qc-level">
                    <span className="w-28 text-sm">{l.label} <span className="block text-[11px] text-muted" dir="ltr">{l.mean} ± {l.sd}</span></span>
                    <input value={v} disabled={busy} inputMode="decimal" aria-label={`${a.name} ${l.label}`} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                      onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} className={`${inp} w-28 text-center font-semibold`} dir="ltr" />
                    {a.unit && <span className="text-xs text-muted" dir="ltr">{a.unit}</span>}
                    {r && <Status e={evals.get(a.id)?.get(r.id)} />}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Chart({ analytes, results, evals, today }: { analytes: Analyte[]; results: QcResult[]; evals: Map<string, Map<string, Evaluation>>; today: string }) {
  const [aid, setAid] = useState(analytes[0]?.id ?? "");
  const [month, setMonth] = useState(today.slice(0, 7));
  const a = analytes.find((x) => x.id === aid);
  if (!a) return <Empty text="لا توجد محاليل ضابطة بعد." />;
  const ev = evals.get(a.id);
  return (
    <div>
      <div className="no-print mb-3 flex flex-wrap items-center gap-2">
        <select value={aid} onChange={(e) => setAid(e.target.value)} className={inp} aria-label="التحليل">{analytes.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className={inp} aria-label="الشهر" />
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white"><Printer className="size-4" /> طباعة</button>
        <span className="text-xs text-muted">الأخضر = المتوسط، البرتقالي = ±2SD، الأحمر = ±3SD.</span>
      </div>
      <div className="flex flex-col gap-4" data-testid="qc-chart">
        <div className="hidden text-lg font-bold print:block">{a.name} — {month}</div>
        {a.levels.map((level: QcLevel) => {
          const points = results.filter((r) => r.analyteId === a.id && r.levelId === level.id && r.date.startsWith(month))
            .sort((x, y) => x.date.localeCompare(y.date) || x.at - y.at).map((r) => ({ r, e: ev?.get(r.id) }));
          const st = qcStats(points.map((p) => p.r.value), level);
          const flagged = points.filter((p) => p.e && p.e.status !== "ok");
          return (
            <div key={level.id} className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)] print:break-inside-avoid">
              <div className="mb-2 flex flex-wrap justify-between gap-2"><b>{level.label}{level.lot && <span className="text-xs font-normal text-muted" dir="ltr"> · Lot {level.lot}</span>}</b><span className="text-xs text-muted" dir="ltr">Target {level.mean} ± {level.sd} {a.unit}</span></div>
              <LJChart level={level} points={points} />
              {st && (
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                  {[["عدد القيم", String(st.n)], ["المتوسط الفعلي", st.mean.toFixed(2)], ["SD الفعلي", st.sd.toFixed(2)], ["CV%", st.cv.toFixed(1) + "%"], ["الانحياز", (st.bias > 0 ? "+" : "") + st.bias.toFixed(1) + "%"]].map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-canvas px-2.5 py-1.5"><div className="text-muted">{k}</div><b dir="ltr">{v}</b></div>
                  ))}
                </div>
              )}
              {flagged.map((p) => (
                <div key={p.r.id} className={`mt-1 rounded-lg px-2.5 py-1 text-xs ${p.e!.status === "reject" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800"}`}>
                  <b dir="ltr">{p.r.date}</b> — <b dir="ltr">{p.r.value}</b> — {p.e!.rules.map((c) => `${c}: ${RULES[c].text}`).join(" | ")}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Temps({ today, units, temps, busy, run }: { today: string; units: TempUnit[]; temps: TempReading[]; busy: boolean; run: Run }) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  if (!units.length) return <Empty text="أضف الثلاجات والحاضنات وحدودها من «المحاليل والوحدات»." />;
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, -i));
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
      <table className="w-full text-sm" data-testid="temps-table">
        <thead className="text-xs text-muted"><tr><th className="py-2 text-start font-medium">الوحدة</th>{days.map((d) => <th key={d} className="px-1 py-2 font-medium" dir="ltr">{d.slice(5)}</th>)}</tr></thead>
        <tbody>
          {units.map((u) => (
            <tr key={u.id} className="border-t border-line">
              <td className="py-2 font-medium">{u.name}<span className="block text-[11px] text-muted" dir="ltr">{u.min} – {u.max} °C</span></td>
              {days.map((d) => (
                <td key={d} className="px-1 py-1">
                  <div className="flex flex-col gap-1">
                    {(["AM", "PM"] as const).map((slot) => {
                      const r = temps.find((t) => t.unitId === u.id && t.date === d && t.slot === slot);
                      const k = `${u.id}|${d}|${slot}`;
                      const v = draft[k] ?? (r ? String(r.value) : "");
                      const bad = r && !tempOk(u, r.value);
                      return (
                        <input key={slot} value={v} disabled={busy} placeholder={slot === "AM" ? "ص" : "م"} inputMode="decimal" dir="ltr" aria-label={`${u.name} ${d} ${slot}`}
                          title={r?.by ? `${r.by}${r.action ? " — " + r.action : ""}` : undefined}
                          onChange={(e) => setDraft((x) => ({ ...x, [k]: e.target.value }))}
                          onBlur={() => {
                            if (!(k in draft) || draft[k] === (r ? String(r.value) : "")) return;
                            const val = draft[k];
                            const out = val.trim() !== "" && Number.isFinite(Number(val)) && !tempOk(u, Number(val));
                            const action = out ? prompt("القراءة خارج الحدود — ما الإجراء المتخذ؟") ?? "" : undefined;
                            run(() => tempSet(u.id, d, slot, val, action), undefined, () => setDraft((x) => { const n = { ...x }; delete n[k]; return n; }));
                          }}
                          className={`w-16 rounded-md border px-1.5 py-1 text-center text-xs ${bad ? "border-red-400 bg-red-50 font-bold text-red-700" : r ? "border-teal-300" : "border-line"}`} />
                      );
                    })}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Devices({ today, devices, busy, run }: { today: string; devices: Device[]; busy: boolean; run: Run }) {
  const [edit, setEdit] = useState<Device | null>(null);
  const [log, setLog] = useState<Record<string, { type: string; text: string }>>({});
  return (
    <div className="flex flex-col gap-3" data-testid="devices">
      <div><button type="button" onClick={() => setEdit({ id: "", name: "", tasks: [], log: [] })} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white" data-testid="device-add"><Plus className="size-4" /> جهاز</button></div>
      {edit && <DeviceForm d={edit} busy={busy} onClose={() => setEdit(null)} run={run} />}
      {devices.length === 0 && !edit && <Empty text="لا توجد أجهزة مسجّلة." />}
      {devices.map((d) => {
        const calibDue = d.calibMonths ? (d.lastCalib ? addMonths(d.lastCalib, d.calibMonths) : today) : null;
        const l = log[d.id] ?? { type: "fault", text: "" };
        return (
          <div key={d.id} className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]" data-testid="device">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-bold">{d.name}</div>
                <div className="text-xs text-muted">{[d.model, d.serial && `S/N ${d.serial}`].filter(Boolean).join(" · ")}</div>
                {calibDue && <div className={`mt-1 text-xs ${calibDue < today ? "font-bold text-red-600" : "text-muted"}`}>المعايرة القادمة: <span dir="ltr">{calibDue}</span>{calibDue < today && " (متأخرة)"}</div>}
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={() => setEdit(d)} className="rounded-lg border border-line px-2 py-1 text-xs">تعديل</button>
                <button type="button" onClick={() => confirm("حذف الجهاز وسجله؟") && run(() => deviceDelete(d.id))} aria-label="حذف الجهاز" className="rounded-lg border border-line px-2 py-1 text-xs text-red-600"><Trash2 className="size-3.5" /></button>
              </div>
            </div>
            {d.tasks.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {d.tasks.map((t) => {
                  const next = t.lastDone ? addDays(t.lastDone, FREQ[t.freq as Freq]?.days ?? 1) : today;
                  const late = next <= today;
                  return (
                    <span key={t.id} className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs ${late ? "border-amber-300 bg-amber-50" : "border-line"}`} data-testid="device-task">
                      <Wrench className="size-3.5" /> {t.name} · {FREQ[t.freq as Freq]?.label} · <span dir="ltr">{t.lastDone ?? "—"}</span>
                      {late && <button type="button" disabled={busy} onClick={() => run(() => deviceTaskDone(d.id, t.id), "سُجّلت الصيانة")} className="rounded bg-teal-600 px-1.5 py-0.5 font-semibold text-white">تم <Check className="inline size-3" /></button>}
                    </span>
                  );
                })}
              </div>
            )}
            {d.log.filter((x) => x.type === "fault" && !x.resolved).map((x) => (
              <div key={x.id} className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-800" data-testid="device-fault">
                <AlertTriangle className="size-3.5" /> <span dir="ltr">{x.date}</span> {x.text}
                <button type="button" disabled={busy} onClick={() => run(() => deviceResolve(x.id, prompt("ما الإصلاح؟") ?? ""), "أُغلق العطل")} className="rounded bg-white px-2 py-0.5 font-semibold">تم الإصلاح</button>
              </div>
            ))}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <select value={l.type} onChange={(e) => setLog((x) => ({ ...x, [d.id]: { ...l, type: e.target.value } }))} aria-label="نوع السجل" className={inp}>
                <option value="fault">عطل</option><option value="maintenance">صيانة</option><option value="calibration">معايرة</option>
              </select>
              <input value={l.text} onChange={(e) => setLog((x) => ({ ...x, [d.id]: { ...l, text: e.target.value } }))} placeholder="الوصف" aria-label="وصف السجل" className={`${inp} min-w-48 flex-1`} />
              <button type="button" disabled={busy || !l.text.trim()} onClick={() => run(() => deviceLog(d.id, l), "سُجّل", () => setLog((x) => ({ ...x, [d.id]: { type: l.type, text: "" } })))} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">تسجيل</button>
            </div>
            {d.log.length > 0 && (
              <details className="mt-2 text-xs"><summary className="cursor-pointer text-muted">السجل ({d.log.length})</summary>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {d.log.slice(0, 50).map((x) => <li key={x.id}><span dir="ltr">{x.date}</span> · {x.type === "fault" ? "عطل" : x.type === "calibration" ? "معايرة" : "صيانة"} · {x.text}{x.action && ` ← ${x.action}`}{x.by && <span className="text-muted"> ({x.by})</span>}</li>)}
                </ul>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DeviceForm({ d, busy, onClose, run }: { d: Device; busy: boolean; onClose: () => void; run: Run }) {
  const [f, setF] = useState({ name: d.name, model: d.model ?? "", serial: d.serial ?? "", calibMonths: d.calibMonths ? String(d.calibMonths) : "", lastCalib: d.lastCalib ?? "" });
  const [tasks, setTasks] = useState(d.tasks.map((t) => ({ ...t })));
  return (
    <div className="rounded-2xl border border-brand/40 bg-surface p-4" data-testid="device-form">
      <div className="grid gap-2 sm:grid-cols-3">
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="اسم الجهاز" aria-label="اسم الجهاز" className={inp} />
        <input value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} placeholder="الطراز" aria-label="الطراز" className={inp} />
        <input value={f.serial} onChange={(e) => setF({ ...f, serial: e.target.value })} placeholder="الرقم التسلسلي" aria-label="الرقم التسلسلي" className={inp} dir="ltr" />
        <input value={f.calibMonths} onChange={(e) => setF({ ...f, calibMonths: e.target.value.replace(/[^\d]/g, "") })} placeholder="المعايرة كل (شهر)" aria-label="المعايرة كل كم شهر" className={inp} />
        <label className="flex items-center gap-2 text-xs text-muted">آخر معايرة<input type="date" value={f.lastCalib} onChange={(e) => setF({ ...f, lastCalib: e.target.value })} className={inp} /></label>
      </div>
      <div className="mt-3 text-sm font-semibold">الصيانة الدورية</div>
      {tasks.map((t, i) => (
        <div key={t.id} className="mt-1 flex gap-1.5">
          <input value={t.name} onChange={(e) => setTasks(tasks.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="المهمة" aria-label="المهمة" className={`${inp} flex-1`} />
          <select value={t.freq} onChange={(e) => setTasks(tasks.map((x, j) => (j === i ? { ...x, freq: e.target.value as Freq } : x)))} aria-label="التكرار" className={inp}>
            {Object.entries(FREQ).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button type="button" onClick={() => setTasks(tasks.filter((_, j) => j !== i))} aria-label="حذف المهمة" className="px-2 text-red-600"><Trash2 className="size-4" /></button>
        </div>
      ))}
      <button type="button" onClick={() => setTasks([...tasks, { id: crypto.randomUUID(), name: "", freq: "daily" }])} className="mt-1 text-xs font-semibold text-brand-dark">+ مهمة</button>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-line px-3 py-1.5 text-sm">إلغاء</button>
        <button type="button" disabled={busy} data-testid="device-save"
          onClick={() => run(() => deviceSave({ id: d.id || undefined, ...f, calibMonths: f.calibMonths ? Number(f.calibMonths) : null, lastCalib: f.lastCalib || null, tasks }), "حُفظ الجهاز", onClose)}
          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white">حفظ</button>
      </div>
    </div>
  );
}

function Setup({ analytes, units, busy, run }: { analytes: Analyte[]; units: TempUnit[]; busy: boolean; run: Run }) {
  const blank = () => ({ id: "", name: "", unit: "", device: "", active: true, levels: [{ id: crypto.randomUUID(), label: "Level 1", lot: "", mean: "", sd: "" }] });
  const [a, setA] = useState<ReturnType<typeof blank> | null>(null);
  const [u, setU] = useState({ name: "", kind: "", min: "", max: "" });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]" data-testid="qc-setup">
        <div className="mb-2 flex items-center justify-between"><b>المحاليل الضابطة</b>
          <button type="button" onClick={() => setA(blank())} className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1 text-xs font-semibold text-white" data-testid="qc-add"><Plus className="size-3.5" /> تحليل</button></div>
        {a && (
          <div className="mb-3 rounded-xl border border-brand/40 p-3">
            <div className="grid gap-1.5 sm:grid-cols-3">
              <input value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} placeholder="التحليل (مثلاً Glucose)" aria-label="اسم التحليل" className={inp} />
              <input value={a.unit} onChange={(e) => setA({ ...a, unit: e.target.value })} placeholder="الوحدة" aria-label="وحدة التحليل" className={inp} dir="ltr" />
              <input value={a.device} onChange={(e) => setA({ ...a, device: e.target.value })} placeholder="الجهاز" aria-label="جهاز التحليل" className={inp} />
            </div>
            {a.levels.map((l, i) => (
              <div key={l.id} className="mt-1.5 grid grid-cols-4 gap-1.5">
                {(["label", "lot", "mean", "sd"] as const).map((k) => (
                  <input key={k} value={String(l[k])} dir="ltr" placeholder={{ label: "المستوى", lot: "Lot", mean: "المتوسط", sd: "SD" }[k]} aria-label={`${{ label: "المستوى", lot: "Lot", mean: "المتوسط", sd: "SD" }[k]} ${i + 1}`}
                    onChange={(e) => setA({ ...a, levels: a.levels.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)) })} className={inp} />
                ))}
              </div>
            ))}
            <div className="mt-2 flex flex-wrap justify-between gap-2">
              <button type="button" onClick={() => setA({ ...a, levels: [...a.levels, { id: crypto.randomUUID(), label: `Level ${a.levels.length + 1}`, lot: "", mean: "", sd: "" }] })} className="text-xs font-semibold text-brand-dark">+ مستوى</button>
              <span className="flex gap-2">
                <button type="button" onClick={() => setA(null)} className="rounded-lg border border-line px-3 py-1 text-sm">إلغاء</button>
                <button type="button" disabled={busy} data-testid="qc-save"
                  onClick={() => run(() => qcSaveAnalyte({ id: a.id || undefined, name: a.name, unit: a.unit, device: a.device, active: a.active, levels: a.levels.map((l) => ({ ...l, mean: Number(l.mean), sd: Number(l.sd) })) }), "حُفظ", () => setA(null))}
                  className="rounded-lg bg-brand px-3 py-1 text-sm font-semibold text-white">حفظ</button>
              </span>
            </div>
          </div>
        )}
        <ul className="flex flex-col gap-1 text-sm">
          {analytes.map((x) => (
            <li key={x.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-canvas">
              <span><b>{x.name}</b> <span className="text-xs text-muted" dir="ltr">{x.levels.map((l) => `${l.label}: ${l.mean}±${l.sd}`).join(" · ")}</span></span>
              <span className="flex gap-1">
                <button type="button" onClick={() => setA({ id: x.id, name: x.name, unit: x.unit ?? "", device: x.device ?? "", active: x.active, levels: x.levels.map((l) => ({ id: l.id, label: l.label, lot: l.lot ?? "", mean: String(l.mean), sd: String(l.sd) })) })} className="text-xs text-brand-dark">تعديل</button>
                <button type="button" onClick={() => confirm("حذف التحليل وقيمه؟") && run(() => qcDeleteAnalyte(x.id))} aria-label={`حذف ${x.name}`} className="text-red-600"><Trash2 className="size-3.5" /></button>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
        <b>وحدات الحرارة (ثلاجات، حاضنات، مجمّدات)</b>
        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
          <input value={u.name} onChange={(e) => setU({ ...u, name: e.target.value })} placeholder="الاسم" aria-label="اسم الوحدة" className={`${inp} sm:col-span-2`} />
          <input value={u.min} onChange={(e) => setU({ ...u, min: e.target.value })} placeholder="الأدنى °C" aria-label="الحد الأدنى" className={inp} dir="ltr" />
          <input value={u.max} onChange={(e) => setU({ ...u, max: e.target.value })} placeholder="الأعلى °C" aria-label="الحد الأعلى" className={inp} dir="ltr" />
          <button type="button" disabled={busy} data-testid="temp-unit-add" onClick={() => run(() => tempSaveUnit({ name: u.name, kind: u.kind, min: Number(u.min), max: Number(u.max) }), "أُضيفت", () => setU({ name: "", kind: "", min: "", max: "" }))}
            className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white">إضافة</button>
        </div>
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {units.map((x) => (
            <li key={x.id} className="flex justify-between rounded-lg px-2 py-1 hover:bg-canvas"><span>{x.name} <span className="text-xs text-muted" dir="ltr">{x.min} – {x.max} °C</span></span>
              <button type="button" onClick={() => confirm("حذف الوحدة وقراءاتها؟") && run(() => tempDeleteUnit(x.id))} aria-label={`حذف ${x.name}`} className="text-red-600"><Trash2 className="size-3.5" /></button></li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">{text}</div>;
}
