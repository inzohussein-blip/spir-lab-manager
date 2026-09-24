"use client";

import { useEffect, useState } from "react";
import { Wallet, Plus, Trash2, Printer } from "lucide-react";
import { getStaff, getAdvances, saveAdvances, getSettings, type Advance, type Staff, type RosterSettings } from "@/lib/roster/store";
import { newId, todayYmd, monthLabel } from "@/lib/local/util";
import { money, CURRENCY } from "@/lib/utils";
import { PrintStyle, Letterhead, PrintFooter, SignRow, exact } from "@/components/local/PrintDoc";

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

export default function PayrollPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [list, setList] = useState<Advance[]>([]);
  const [settings, setSettings] = useState<RosterSettings | null>(null);
  const [month, setMonth] = useState(todayYmd().slice(0, 7));
  const [f, setF] = useState({ staffId: "", date: todayYmd(), amount: "", deductMonth: todayYmd().slice(0, 7), note: "" });

  useEffect(() => {
    const s = getStaff(); setStaff(s); setList(getAdvances()); setSettings(getSettings());
    setF((c) => ({ ...c, staffId: s.find((x) => x.active)?.id ?? "" }));
  }, []);
  if (!settings) return null;

  function persist(next: Advance[]) { setList(next); saveAdvances(next); }
  function add() {
    const amount = Number(f.amount);
    if (!f.staffId || !amount) return;
    persist([...list, { id: newId(), staffId: f.staffId, date: f.date, amount, deductMonth: f.deductMonth, ...(f.note.trim() ? { note: f.note.trim() } : {}) }]);
    setF({ ...f, amount: "", note: "" });
  }
  const name = (id: string) => staff.find((s) => s.id === id)?.name ?? "—";
  const rows = staff.filter((s) => s.active || list.some((a) => a.staffId === s.id && a.deductMonth === month)).map((s) => {
    const adv = list.filter((a) => a.staffId === s.id && a.deductMonth === month).reduce((t, a) => t + a.amount, 0);
    const base = s.salary ?? 0;
    return { s, base, adv, net: base - adv };
  });
  const tot = rows.reduce((t, r) => ({ base: t.base + r.base, adv: t.adv + r.adv, net: t.net + r.net }), { base: 0, adv: 0, net: 0 });

  const sheet = (print: boolean) => {
    const b = print ? "border border-gray-300" : "border-b border-line";
    return (
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className={print ? "" : "text-right text-xs text-muted"} style={print ? { background: "#f0f9ff", ...exact } : undefined}>
            {["الموظف", "الوظيفة", "الراتب الأساسي", "السلف المخصومة", "الصافي", ...(print ? ["توقيع المستلم"] : [])].map((h) => <th key={h} className={`${b} px-2 py-2 font-medium`}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.s.id}>
              <td className={`${b} px-2 py-1.5 font-medium`}>{r.s.name}</td>
              <td className={`${b} px-2 py-1.5 text-xs`}>{r.s.role ?? ""}</td>
              <td className={`${b} px-2 py-1.5 tabular-nums`}>{money(r.base)}</td>
              <td className={`${b} px-2 py-1.5 tabular-nums ${r.adv ? "text-red-700" : ""}`}>{r.adv ? `− ${money(r.adv)}` : "—"}</td>
              <td className={`${b} px-2 py-1.5 font-bold tabular-nums`}>{money(r.net)}</td>
              {print && <td className={`${b} w-32 px-2 py-1.5`} />}
            </tr>
          ))}
          <tr className="font-bold" style={print ? { background: "#f0f9ff", ...exact } : undefined}>
            <td className={`${b} px-2 py-2`} colSpan={2}>المجموع ({CURRENCY})</td>
            <td className={`${b} px-2 py-2 tabular-nums`}>{money(tot.base)}</td>
            <td className={`${b} px-2 py-2 tabular-nums`}>{money(tot.adv)}</td>
            <td className={`${b} px-2 py-2 tabular-nums`}>{money(tot.net)}</td>
            {print && <td className={b} />}
          </tr>
        </tbody>
      </table>
    );
  };

  return (
    <div>
      <div className="no-print">
        <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold"><Wallet className="size-6 text-brand" /> السلف والرواتب</h1>
        <p className="mb-5 text-sm text-muted">سجّل السلفة وحدّد الشهر الذي تُخصم فيه، فتظهر تلقائياً في كشف رواتب ذلك الشهر.</p>

        <div className="mb-5 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
          <div className="mb-3 text-sm font-semibold">سلفة جديدة</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="text-sm font-medium">الموظف<select value={f.staffId} onChange={(e) => setF({ ...f, staffId: e.target.value })} className={`mt-1 ${inp}`}>{staff.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
            <label className="text-sm font-medium">التاريخ<input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={`mt-1 ${inp}`} /></label>
            <label className="text-sm font-medium">المبلغ ({CURRENCY})<input dir="ltr" inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d]/g, "") })} className={`mt-1 ${inp}`} /></label>
            <label className="text-sm font-medium">تُخصم من راتب<input type="month" value={f.deductMonth} onChange={(e) => e.target.value && setF({ ...f, deductMonth: e.target.value })} className={`mt-1 ${inp}`} /></label>
            <label className="text-sm font-medium">ملاحظة<input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className={`mt-1 ${inp}`} /></label>
          </div>
          <button onClick={add} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"><Plus className="size-4" /> تسجيل السلفة</button>
        </div>

        <div className="mb-5 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <b className="text-sm">كشف رواتب</b>
            <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm" />
            <button onClick={() => window.print()} className="ms-auto inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark"><Printer className="size-4" /> طباعة الكشف</button>
          </div>
          <div className="overflow-x-auto">{sheet(false)}</div>
          {rows.some((r) => !r.s.salary) && <p className="mt-2 text-xs text-amber-700">بعض الموظفين بلا راتب أساسي — أضفه من صفحة «الكادر».</p>}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
          <div className="mb-2 text-sm font-bold">سجل السلف</div>
          {list.length === 0 ? <p className="text-sm text-muted">لا سلف مسجّلة.</p> : (
            <div className="flex flex-col gap-1.5">
              {[...list].sort((a, b) => b.date.localeCompare(a.date)).map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                  <b className="min-w-28">{name(a.staffId)}</b>
                  <span className="font-semibold tabular-nums">{money(a.amount)} {CURRENCY}</span>
                  <span className="text-xs text-muted" dir="ltr">{a.date}</span>
                  <span className="rounded-full bg-brand-light px-2 py-0.5 text-xs text-brand-dark">تُخصم: {monthLabel(a.deductMonth)}</span>
                  {a.note && <span className="text-xs text-muted">— {a.note}</span>}
                  <button onClick={() => window.confirm("حذف هذه السلفة؟") && persist(list.filter((x) => x.id !== a.id))} className="ms-auto grid size-7 place-items-center rounded-lg text-red-600 hover:bg-red-50"><Trash2 className="size-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="print-doc hidden bg-white text-[12px] text-black print:block">
        <PrintStyle />
        <Letterhead title={settings.title} subtitle={settings.subtitle} color="#0369a1" right={<><div className="font-bold" style={{ color: "#0369a1" }}>كشف الرواتب</div><div>{monthLabel(month)}</div></>} />
        <div className="mt-3">{sheet(true)}</div>
        <SignRow labels={["المحاسب", "مدير المختبر"]} />
        <PrintFooter text={settings.footer} color="#0369a1" />
      </div>
    </div>
  );
}
