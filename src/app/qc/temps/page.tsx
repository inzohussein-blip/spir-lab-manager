"use client";

import { useEffect, useState } from "react";
import { Thermometer, Printer, Plus, Trash2, ChevronRight, ChevronLeft, Settings2 } from "lucide-react";
import { getUnits, saveUnits, getTemps, setTemp, tempOk, getSettings, type TempUnit, type TempReading, type QcSettings } from "@/lib/qc/store";
import { todayYmd, addDays, newId, monthLabel } from "@/lib/local/util";
import { PrintStyle, Letterhead, PrintFooter, SignRow, exact } from "@/components/local/PrintDoc";

const inp = "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-brand";

export default function TempsPage() {
  const [units, setUnits] = useState<TempUnit[]>([]);
  const [temps, setTemps] = useState<TempReading[]>([]);
  const [settings, setSettings] = useState<QcSettings | null>(null);
  const [date, setDate] = useState(todayYmd());
  const [month, setMonth] = useState(todayYmd().slice(0, 7));
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [by, setBy] = useState("");
  const [manage, setManage] = useState(false);

  const reload = () => setTemps(getTemps());
  useEffect(() => { setUnits(getUnits()); reload(); setSettings(getSettings()); }, []);
  useEffect(() => { setDrafts({}); }, [date]);

  const reading = (u: string, slot: "AM" | "PM", d = date) => temps.find((t) => t.unitId === u && t.slot === slot && t.date === d);
  function commit(u: TempUnit, slot: "AM" | "PM", field: "v" | "a") {
    const k = `${u.id}|${slot}|${field}`;
    if (!(k in drafts)) return;
    const cur = reading(u.id, slot);
    const vRaw = field === "v" ? drafts[k].trim() : cur ? String(cur.value) : "";
    const action = field === "a" ? drafts[k].trim() : cur?.action;
    setTemp(u.id, date, slot, vRaw === "" ? null : Number(vRaw), { ...(by.trim() ? { by: by.trim() } : cur?.by ? { by: cur.by } : {}), ...(action ? { action } : {}) });
    setDrafts((d) => { const n = { ...d }; delete n[k]; return n; });
    reload();
  }
  function persistUnits(next: TempUnit[]) { setUnits(next); saveUnits(next); }

  const days = (() => {
    const [y, m] = month.split("-").map(Number);
    const n = new Date(y, m, 0).getDate();
    return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
  })();

  return (
    <div>
      <div className="no-print">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold"><Thermometer className="size-6 text-brand" /> سجل الحرارة</h1>
            <p className="mt-1 text-sm text-muted">قراءة صباحية ومسائية لكل جهاز. القراءة خارج المدى تُلوَّن بالأحمر وتطلب إجراءً تصحيحياً.</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-muted">القارئ<input value={by} onChange={(e) => setBy(e.target.value)} className={`mt-1 ${inp} w-32`} /></label>
            <div className="flex items-center gap-1">
              <button onClick={() => setDate(addDays(date, -1))} className="grid size-9 place-items-center rounded-lg border border-line hover:bg-canvas"><ChevronRight className="size-4" /></button>
              <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={`${inp} w-40 py-2`} />
              <button onClick={() => setDate(addDays(date, 1))} className="grid size-9 place-items-center rounded-lg border border-line hover:bg-canvas"><ChevronLeft className="size-4" /></button>
            </div>
            <button onClick={() => setManage((m) => !m)} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas"><Settings2 className="size-4" /> الأجهزة</button>
          </div>
        </div>

        {manage && (
          <div className="mb-5 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
            <div className="mb-2 text-sm font-bold">الأجهزة المراقَبة والمدى المسموح</div>
            <div className="flex flex-col gap-2">
              {units.map((u) => (
                <div key={u.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] items-center gap-2">
                  <input value={u.name} onChange={(e) => persistUnits(units.map((x) => (x.id === u.id ? { ...x, name: e.target.value } : x)))} className={inp} />
                  <input value={u.kind} onChange={(e) => persistUnits(units.map((x) => (x.id === u.id ? { ...x, kind: e.target.value } : x)))} placeholder="النوع" className={inp} />
                  <label className="flex items-center gap-1 text-xs text-muted">من<input dir="ltr" inputMode="decimal" value={u.min} onChange={(e) => persistUnits(units.map((x) => (x.id === u.id ? { ...x, min: Number(e.target.value) } : x)))} className={inp} /></label>
                  <label className="flex items-center gap-1 text-xs text-muted">إلى<input dir="ltr" inputMode="decimal" value={u.max} onChange={(e) => persistUnits(units.map((x) => (x.id === u.id ? { ...x, max: Number(e.target.value) } : x)))} className={inp} /></label>
                  <button onClick={() => window.confirm(`حذف «${u.name}»؟`) && persistUnits(units.filter((x) => x.id !== u.id))} className="grid size-8 place-items-center rounded-lg text-red-600 hover:bg-red-50"><Trash2 className="size-4" /></button>
                </div>
              ))}
              <button onClick={() => persistUnits([...units, { id: newId(), name: "جهاز جديد", kind: "ثلاجة", min: 2, max: 8 }])} className="inline-flex w-fit items-center gap-1 rounded-lg border border-dashed border-line px-2.5 py-1 text-xs hover:bg-canvas"><Plus className="size-3.5" /> جهاز</button>
            </div>
          </div>
        )}

        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {units.map((u) => (
            <div key={u.id} className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
              <div className="mb-2 flex items-baseline justify-between"><b>{u.name}</b><span className="text-xs text-muted" dir="ltr">{u.min} – {u.max} °C</span></div>
              {(["AM", "PM"] as const).map((slot) => {
                const r = reading(u.id, slot);
                const kv = `${u.id}|${slot}|v`, ka = `${u.id}|${slot}|a`;
                const bad = r && !tempOk(u, r.value);
                return (
                  <div key={slot} className="mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-14 text-xs text-muted">{slot === "AM" ? "صباحاً" : "مساءً"}</span>
                      <input dir="ltr" inputMode="decimal" value={kv in drafts ? drafts[kv] : r ? String(r.value) : ""} onChange={(e) => setDrafts((d) => ({ ...d, [kv]: e.target.value }))}
                        onBlur={() => commit(u, slot, "v")} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} placeholder="°C"
                        className={`${inp} font-semibold ${r ? (bad ? "!border-red-400 bg-red-50 text-red-700" : "!border-green-400") : ""}`} />
                    </div>
                    {bad && (
                      <input value={ka in drafts ? drafts[ka] : r?.action ?? ""} onChange={(e) => setDrafts((d) => ({ ...d, [ka]: e.target.value }))} onBlur={() => commit(u, slot, "a")}
                        placeholder="الإجراء التصحيحي (نُقلت الكواشف، أُبلغت الصيانة…)" className={`mt-1 ${inp} text-xs !border-red-300`} />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
          <Printer className="size-4 text-muted" />
          <span className="text-sm font-semibold">طباعة سجل الشهر</span>
          <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm" />
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"><Printer className="size-4" /> طباعة</button>
        </div>
      </div>

      {settings && (
        <div className="print-doc hidden bg-white text-[9.5px] leading-[1.2] text-black print:block">
          <PrintStyle landscape={units.length > 3} />
          <Letterhead title={settings.title} subtitle={settings.subtitle} color="#be123c"
            right={<><div className="font-bold" style={{ color: "#be123c" }}>سجل درجات الحرارة</div><div>{monthLabel(month)}</div></>} />
          <table className="mt-2 w-full border-collapse text-center">
            <thead>
              <tr style={{ background: "#fff1f2", ...exact }}>
                <th rowSpan={2} className="border border-gray-300 px-1 py-1">اليوم</th>
                {units.map((u) => <th key={u.id} colSpan={2} className="border border-gray-300 px-1 py-1">{u.name} <span dir="ltr" className="font-normal">({u.min}–{u.max}°C)</span></th>)}
                <th rowSpan={2} className="border border-gray-300 px-1 py-1">ملاحظات / إجراء</th>
              </tr>
              <tr style={{ background: "#fff1f2", ...exact }}>{units.map((u) => [<th key={u.id + "a"} className="border border-gray-300 px-1">ص</th>, <th key={u.id + "p"} className="border border-gray-300 px-1">م</th>])}</tr>
            </thead>
            <tbody>
              {days.map((d) => {
                const actions: string[] = [];
                return (
                  <tr key={d}>
                    <td className="border border-gray-300 px-1" dir="ltr">{d.slice(8)}</td>
                    {units.map((u) => (["AM", "PM"] as const).map((slot) => {
                      const r = reading(u.id, slot, d);
                      const bad = r && !tempOk(u, r.value);
                      if (bad && r?.action) actions.push(`${u.name}: ${r.action}`);
                      return <td key={u.id + slot} className="border border-gray-300 px-1" dir="ltr" style={bad ? { color: "#b91c1c", fontWeight: 700 } : undefined}>{r ? r.value : ""}</td>;
                    }))}
                    <td className="border border-gray-300 px-1 text-right">{actions.join(" · ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <SignRow labels={["المسؤول", "مسؤول الجودة"]} />
          <PrintFooter text={settings.footer} color="#be123c" />
        </div>
      )}
    </div>
  );
}
