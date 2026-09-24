"use client";

import { useEffect, useState } from "react";
import { Wrench, Plus, Trash2, CheckCircle2, AlertOctagon, Printer, Pencil, ChevronDown, Gauge } from "lucide-react";
import { getDevices, saveDevices, taskDue, calibDue, FREQ, getSettings, type Device, type Freq, type DeviceLog, type QcSettings } from "@/lib/qc/store";
import { newId, todayYmd } from "@/lib/local/util";
import { PrintStyle, Letterhead, PrintFooter, SignRow, exact } from "@/components/local/PrintDoc";

const inp = "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-brand";
const LOG_LABEL: Record<DeviceLog["type"], string> = { maintenance: "صيانة", fault: "عطل", calibration: "معايرة" };

function dueChip(days: number) {
  const c = days < 0 ? "bg-red-50 text-red-700" : days === 0 ? "bg-amber-50 text-amber-700" : days <= 7 ? "bg-sky-50 text-sky-700" : "bg-green-50 text-green-700";
  const t = days < 0 ? `متأخر ${-days} يوم` : days === 0 ? "مستحق اليوم" : `بعد ${days} يوم`;
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${c}`}>{t}</span>;
}

export default function DevicesPage() {
  const [list, setList] = useState<Device[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [by, setBy] = useState("");
  const [fault, setFault] = useState("");
  const [settings, setSettings] = useState<QcSettings | null>(null);
  const [printId, setPrintId] = useState<string | null>(null);

  useEffect(() => { const d = getDevices(); setList(d); setOpen(d[0]?.id ?? null); setSettings(getSettings()); }, []);

  function persist(next: Device[]) { setList(next); saveDevices(next); }
  const upd = (id: string, fn: (d: Device) => Device) => persist(list.map((d) => (d.id === id ? fn(d) : d)));
  const log = (d: Device, e: Omit<DeviceLog, "id" | "date">): Device => ({ ...d, log: [{ id: newId(), date: todayYmd(), ...(by.trim() ? { by: by.trim() } : {}), ...e }, ...d.log] });

  function addDevice() {
    const d: Device = { id: newId(), name: "جهاز جديد", calibMonths: 12, tasks: [], log: [] };
    persist([...list, d]); setOpen(d.id); setEditing(d.id);
  }
  function printDevice(id: string) { setPrintId(id); setTimeout(() => window.print(), 60); }

  const pd = list.find((d) => d.id === printId);

  return (
    <div>
      <div className="no-print">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold"><Wrench className="size-6 text-brand" /> الأجهزة والصيانة</h1>
            <p className="mt-1 text-sm text-muted">مهام الصيانة الدورية، موعد المعايرة، وسجل الأعطال لكل جهاز.</p>
          </div>
          <div className="flex items-end gap-2">
            <label className="text-xs text-muted">المنفّذ<input value={by} onChange={(e) => setBy(e.target.value)} className={`mt-1 ${inp} w-32`} /></label>
            <button onClick={addDevice} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark"><Plus className="size-4" /> جهاز</button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {list.map((d) => {
            const cal = calibDue(d);
            const dueTasks = d.tasks.filter((t) => taskDue(t).days <= 0).length;
            const faults = d.log.filter((l) => l.type === "fault" && !l.resolved);
            const isOpen = open === d.id;
            return (
              <div key={d.id} className="rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
                <button onClick={() => setOpen(isOpen ? null : d.id)} className="flex w-full flex-wrap items-center gap-3 p-4 text-right">
                  <ChevronDown className={`size-4 text-muted transition-transform ${isOpen ? "" : "rotate-90"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">{d.name}</div>
                    <div className="text-xs text-muted">{[d.model, d.location].filter(Boolean).join(" · ") || "—"}</div>
                  </div>
                  {dueTasks > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">{dueTasks} مهمة مستحقة</span>}
                  {faults.length > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">{faults.length} عطل مفتوح</span>}
                  {cal && <span className="inline-flex items-center gap-1 text-xs text-muted"><Gauge className="size-3.5" /> المعايرة {dueChip(cal.days)}</span>}
                </button>

                {isOpen && (
                  <div className="grid gap-4 border-t border-line p-4 lg:grid-cols-2">
                    {/* Info */}
                    <div>
                      <div className="mb-2 flex items-center justify-between"><b className="text-sm">معلومات الجهاز</b>
                        <div className="flex gap-1">
                          <button onClick={() => setEditing(editing === d.id ? null : d.id)} className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs hover:bg-canvas"><Pencil className="size-3.5" /> {editing === d.id ? "تم" : "تعديل"}</button>
                          <button onClick={() => printDevice(d.id)} className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs hover:bg-canvas"><Printer className="size-3.5" /> سجل الجهاز</button>
                          <button onClick={() => window.confirm(`حذف «${d.name}» وسجله؟`) && persist(list.filter((x) => x.id !== d.id))} className="grid size-7 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50"><Trash2 className="size-3.5" /></button>
                        </div>
                      </div>
                      {editing === d.id ? (
                        <div className="grid grid-cols-2 gap-2">
                          {([["name", "الاسم"], ["model", "الموديل"], ["serial", "الرقم التسلسلي"], ["location", "الموقع"], ["vendor", "شركة الصيانة"], ["vendorPhone", "هاتف الصيانة"]] as const).map(([k, l]) => (
                            <label key={k} className="text-xs text-muted">{l}<input value={(d[k] as string) ?? ""} onChange={(e) => upd(d.id, (x) => ({ ...x, [k]: e.target.value }))} className={`mt-1 ${inp}`} /></label>
                          ))}
                          <label className="text-xs text-muted">تاريخ التركيب<input type="date" value={d.installed ?? ""} onChange={(e) => upd(d.id, (x) => ({ ...x, installed: e.target.value || undefined }))} className={`mt-1 ${inp}`} /></label>
                          <label className="text-xs text-muted">المعايرة كل (شهر)<input type="number" min={0} value={d.calibMonths ?? 0} onChange={(e) => upd(d.id, (x) => ({ ...x, calibMonths: Number(e.target.value) || undefined }))} className={`mt-1 ${inp}`} /></label>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                          {[["الموديل", d.model], ["الرقم التسلسلي", d.serial], ["الموقع", d.location], ["التركيب", d.installed], ["شركة الصيانة", d.vendor], ["الهاتف", d.vendorPhone]].map(([k, v]) => (
                            <div key={k}><span className="text-xs text-muted">{k}: </span>{v || "—"}</div>
                          ))}
                        </div>
                      )}
                      {cal && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-canvas px-3 py-2 text-sm">
                          <Gauge className="size-4 text-muted" /> آخر معايرة: <b dir="ltr">{d.lastCalib ?? "—"}</b> · القادمة: <b dir="ltr">{cal.due}</b> {dueChip(cal.days)}
                          <button onClick={() => upd(d.id, (x) => log({ ...x, lastCalib: todayYmd() }, { type: "calibration", text: "تمت المعايرة" }))} className="ms-auto rounded-lg bg-brand px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-dark">تمت المعايرة اليوم</button>
                        </div>
                      )}
                    </div>

                    {/* Tasks */}
                    <div>
                      <b className="text-sm">الصيانة الدورية</b>
                      <div className="mt-2 flex flex-col gap-1.5">
                        {d.tasks.map((t) => {
                          const td = taskDue(t);
                          return (
                            <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                              {editing === d.id ? (
                                <>
                                  <input value={t.name} onChange={(e) => upd(d.id, (x) => ({ ...x, tasks: x.tasks.map((y) => (y.id === t.id ? { ...y, name: e.target.value } : y)) }))} className={`${inp} flex-1`} />
                                  <select value={t.freq} onChange={(e) => upd(d.id, (x) => ({ ...x, tasks: x.tasks.map((y) => (y.id === t.id ? { ...y, freq: e.target.value as Freq } : y)) }))} className={`${inp} w-28`}>
                                    {Object.entries(FREQ).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                                  </select>
                                  <button onClick={() => upd(d.id, (x) => ({ ...x, tasks: x.tasks.filter((y) => y.id !== t.id) }))} className="grid size-7 place-items-center rounded-lg text-red-600 hover:bg-red-50"><Trash2 className="size-3.5" /></button>
                                </>
                              ) : (
                                <>
                                  <span className="flex-1">{t.name} <span className="text-xs text-muted">({FREQ[t.freq].label})</span></span>
                                  {td.days <= 0 ? dueChip(td.days) : <span className="text-[11px] text-muted" dir="ltr">{t.lastDone}</span>}
                                  <button disabled={t.lastDone === todayYmd()} onClick={() => upd(d.id, (x) => log({ ...x, tasks: x.tasks.map((y) => (y.id === t.id ? { ...y, lastDone: todayYmd() } : y)) }, { type: "maintenance", text: t.name }))}
                                    className="inline-flex items-center gap-1 rounded-lg border border-green-300 px-2 py-1 text-xs font-semibold text-green-700 hover:bg-green-50"><CheckCircle2 className="size-3.5" /> تم</button>
                                </>
                              )}
                            </div>
                          );
                        })}
                        {editing === d.id && (
                          <button onClick={() => upd(d.id, (x) => ({ ...x, tasks: [...x.tasks, { id: newId(), name: "مهمة جديدة", freq: "weekly" }] }))} className="inline-flex w-fit items-center gap-1 rounded-lg border border-dashed border-line px-2.5 py-1 text-xs hover:bg-canvas"><Plus className="size-3.5" /> مهمة</button>
                        )}
                      </div>
                    </div>

                    {/* Faults + log */}
                    <div className="lg:col-span-2">
                      <b className="text-sm">الأعطال والسجل</b>
                      <div className="mt-2 flex gap-2">
                        <input value={fault} onChange={(e) => setFault(e.target.value)} placeholder="وصف عطل جديد…" className={inp} />
                        <button disabled={!fault.trim()} onClick={() => { upd(d.id, (x) => log(x, { type: "fault", text: fault.trim(), resolved: false })); setFault(""); }}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"><AlertOctagon className="size-3.5" /> تسجيل عطل</button>
                      </div>
                      <div className="mt-2 flex max-h-72 flex-col gap-1.5 overflow-y-auto">
                        {d.log.length === 0 && <p className="text-xs text-muted">لا يوجد سجل بعد.</p>}
                        {d.log.map((l) => (
                          <div key={l.id} className={`flex flex-wrap items-center gap-2 rounded-lg px-3 py-1.5 text-xs ${l.type === "fault" && !l.resolved ? "bg-red-50" : "bg-canvas"}`}>
                            <span dir="ltr" className="text-muted">{l.date}</span>
                            <span className={`rounded-full px-1.5 font-semibold ${l.type === "fault" ? "text-red-700" : l.type === "calibration" ? "text-sky-700" : "text-green-700"}`}>{LOG_LABEL[l.type]}</span>
                            <span className="flex-1">{l.text}{l.action && <span className="text-muted"> ← {l.action}</span>}{l.downtime ? <span className="text-muted"> ({l.downtime} ساعة توقف)</span> : null}{l.by && <span className="text-muted"> · {l.by}</span>}</span>
                            {l.type === "fault" && !l.resolved && (
                              <button onClick={() => {
                                const action = window.prompt("الإجراء المتّخذ لإصلاح العطل:");
                                if (action === null) return;
                                const hours = Number(window.prompt("مدة التوقف بالساعات (اختياري):") || 0);
                                upd(d.id, (x) => ({ ...x, log: x.log.map((y) => (y.id === l.id ? { ...y, resolved: true, action: action.trim() || undefined, downtime: hours || undefined } : y)) }));
                              }} className="rounded-md border border-green-300 px-2 py-0.5 font-semibold text-green-700 hover:bg-green-50">تم الإصلاح</button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {pd && settings && (
        <div className="print-doc hidden bg-white text-[11.5px] text-black print:block">
          <PrintStyle />
          <Letterhead title={settings.title} subtitle={settings.subtitle} color="#be123c" right={<><div className="font-bold" style={{ color: "#be123c" }}>سجل جهاز</div><div dir="ltr">{todayYmd()}</div></>} />
          <div className="keep mt-3 grid grid-cols-3 gap-2 rounded-lg border border-gray-300 p-3">
            <div className="col-span-3 text-base font-bold">{pd.name}</div>
            {[["الموديل", pd.model], ["الرقم التسلسلي", pd.serial], ["الموقع", pd.location], ["التركيب", pd.installed], ["شركة الصيانة", pd.vendor], ["الهاتف", pd.vendorPhone], ["آخر معايرة", pd.lastCalib], ["المعايرة القادمة", calibDue(pd)?.due]].map(([k, v]) => <div key={k}><b>{k}:</b> {v || "—"}</div>)}
          </div>
          <div className="mt-3 font-bold">الصيانة الدورية</div>
          <table className="mt-1 w-full border-collapse">
            <thead><tr style={{ background: "#fff1f2", ...exact }}><th className="border border-gray-300 px-2 py-1 text-right">المهمة</th><th className="border border-gray-300 px-2 py-1">التكرار</th><th className="border border-gray-300 px-2 py-1">آخر تنفيذ</th><th className="border border-gray-300 px-2 py-1">القادم</th></tr></thead>
            <tbody>{pd.tasks.map((t) => <tr key={t.id}><td className="border border-gray-300 px-2 py-1">{t.name}</td><td className="border border-gray-300 px-2 py-1 text-center">{FREQ[t.freq].label}</td><td className="border border-gray-300 px-2 py-1 text-center" dir="ltr">{t.lastDone ?? "—"}</td><td className="border border-gray-300 px-2 py-1 text-center" dir="ltr">{taskDue(t).due}</td></tr>)}</tbody>
          </table>
          <div className="mt-3 font-bold">السجل</div>
          <table className="mt-1 w-full border-collapse">
            <thead><tr style={{ background: "#fff1f2", ...exact }}><th className="border border-gray-300 px-2 py-1">التاريخ</th><th className="border border-gray-300 px-2 py-1">النوع</th><th className="border border-gray-300 px-2 py-1 text-right">التفاصيل</th><th className="border border-gray-300 px-2 py-1 text-right">الإجراء</th><th className="border border-gray-300 px-2 py-1">المنفّذ</th></tr></thead>
            <tbody>{pd.log.map((l) => <tr key={l.id}><td className="border border-gray-300 px-2 py-1 text-center" dir="ltr">{l.date}</td><td className="border border-gray-300 px-2 py-1 text-center">{LOG_LABEL[l.type]}</td><td className="border border-gray-300 px-2 py-1">{l.text}</td><td className="border border-gray-300 px-2 py-1">{l.action ?? ""}{l.downtime ? ` (${l.downtime} س)` : ""}</td><td className="border border-gray-300 px-2 py-1 text-center">{l.by ?? ""}</td></tr>)}</tbody>
          </table>
          <SignRow labels={["مسؤول الجهاز", "مسؤول الجودة"]} />
          <PrintFooter text={settings.footer} color="#be123c" />
        </div>
      )}
    </div>
  );
}
