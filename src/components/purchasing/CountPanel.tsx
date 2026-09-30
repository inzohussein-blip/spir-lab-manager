"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Printer, ClipboardCheck } from "lucide-react";
import { getStock, type StockItem } from "@/lib/station/store";
import { getCounts, applyCount, getSettings, type StockCount, type PurchasingSettings } from "@/lib/purchasing/store";
import { NumberInput } from "@/components/local/NumberInput";
import { fmtDateTime } from "@/lib/utils";
import { ScanBox } from "./stockParts";

/**
 * «الجرد»: count what is on the shelf; each counted item shows its difference from the record, and
 * «حفظ الجرد» sets the counts (the differences go to «سجل الحركة»). Items left empty are not
 * touched. The sheet prints blank for counting by hand. Past stocktakes are kept below.
 */
export function CountPanel() {
  const [rows, setRows] = useState<StockItem[]>([]);
  const [counts, setCounts] = useState<StockCount[]>([]);
  const [opts, setOpts] = useState<PurchasingSettings>({ orgName: "" });
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [today, setToday] = useState("");
  useEffect(() => { setRows(getStock()); setCounts(getCounts()); setOpts(getSettings()); setToday(new Date().toLocaleDateString("en-CA")); }, []);

  const term = q.trim().toLowerCase();
  const shown = useMemo(() => rows.filter((s) => !term || s.name.toLowerCase().includes(term)), [rows, term]);
  const entered = Object.entries(counted).filter(([, v]) => v.trim() !== "");
  const diffs = entered.filter(([id, v]) => Number(v) !== (Number(rows.find((s) => s.id === id)?.qty) || 0)).length;

  /** Settings → «الباركود»: each scan of an item counts one more of it. */
  function onScan(code: string): string {
    const s = rows.find((r) => r.barcode === code);
    if (!s) return `باركود غير معروف: ${code}`;
    const n = (Number(counted[s.id]) || 0) + 1;
    setCounted((c) => ({ ...c, [s.id]: String(n) }));
    return `${s.name}: ${n}`;
  }
  function save() {
    if (!entered.length) { setMsg("أدخل الكمية المعدودة لصنف واحد على الأقل."); return; }
    if (!window.confirm(`حفظ الجرد لـ ${entered.length} صنف؟ ${diffs ? `تُصحَّح كمية ${diffs} صنف إلى المعدود.` : "لا فروقات."}`)) return;
    const rec = applyCount(Object.fromEntries(entered.map(([id, v]) => [id, Number(v)])));
    setRows(getStock()); setCounts(getCounts()); setCounted({});
    setMsg(rec ? `حُفظ الجرد: ${rec.lines.length} صنف، وصُحِّح ${rec.lines.filter((l) => l.before !== l.counted).length}.` : "");
  }

  return (
    <div className="flex flex-col gap-4">
      <style>{`@media print { @page { size: A4; margin: 12mm; } #count-sheet input { border: 0 !important; } }`}</style>
      <p className="no-print text-sm text-muted">اكتب الكمية الموجودة فعلاً على الرف لكل صنف تعدّه، فيظهر الفرق عن المسجَّل. «حفظ الجرد» يصحّح الكميات المعدودة فقط ويُسجَّل الفرق في «سجل الحركة». اطبع الورقة لتعدّ بالقلم.</p>

      <div className="no-print flex flex-wrap items-center gap-2">
        <label className="flex flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3">
          <Search className="size-4 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن صنف…" aria-label="بحث في الأصناف" className="w-full bg-transparent py-2 text-sm outline-none" />
        </label>
        <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm hover:bg-canvas"><Printer className="size-4" /> طباعة ورقة الجرد</button>
        <button onClick={save} data-testid="count-save" className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">
          <ClipboardCheck className="size-4" /> حفظ الجرد {entered.length > 0 && <span className="tabular-nums">({entered.length})</span>}
        </button>
      </div>
      {opts.barcode && <div className="no-print"><ScanBox onScan={onScan} hint="امسح باركود كل علبة تعدّها (كل مسح = واحدة)…" /></div>}
      {msg && <p className="no-print rounded-lg bg-teal-50 px-3 py-2 text-sm text-brand-dark" role="status">{msg}</p>}

      <div id="count-sheet" className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)] print:border-0 print:shadow-none">
        <div className="hidden px-4 pt-4 text-lg font-bold print:block">ورقة الجرد — {today}</div>
        <table className="w-full text-sm" data-testid="count-table">
          <thead className="border-b border-line text-right text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">الصنف</th>
              <th className="px-4 py-3 font-medium">المسجَّل</th>
              <th className="px-4 py-3 font-medium">المعدود</th>
              <th className="px-4 py-3 font-medium">الفرق</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">لا أصناف.</td></tr>}
            {shown.map((s) => {
              const v = counted[s.id] ?? "";
              const d = v.trim() === "" ? null : Number(v) - (Number(s.qty) || 0);
              return (
                <tr key={s.id} data-count={s.name} className={`border-b border-line last:border-0 ${d ? "bg-amber-50/60" : ""}`}>
                  <td className="px-4 py-2 font-medium">{s.name}</td>
                  <td className="px-4 py-2 tabular-nums" dir="ltr" style={{ textAlign: "right" }}>{s.qty}</td>
                  <td className="px-4 py-2">
                    <NumberInput value={v} onValue={(x) => setCounted((c) => ({ ...c, [s.id]: x }))} aria-label={`المعدود ${s.name}`}
                      className="w-24 rounded-lg border border-line bg-surface px-2 py-1 text-center text-sm outline-none focus:border-brand" />
                  </td>
                  <td className={`px-4 py-2 font-bold tabular-nums ${d == null || d === 0 ? "text-muted" : d > 0 ? "text-teal-700" : "text-red-600"}`} dir="ltr" style={{ textAlign: "right" }} data-testid="count-diff">
                    {d == null ? "" : d > 0 ? `+${d}` : d}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {counts.length > 0 && (
        <div className="no-print rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]" data-testid="count-history">
          <div className="mb-2 text-sm font-semibold">عمليات الجرد السابقة</div>
          <div className="flex flex-col gap-1">
            {counts.map((c) => {
              const changed = c.lines.filter((l) => l.before !== l.counted);
              return (
                <details key={c.id} className="rounded-lg border border-line px-3 py-2 text-sm">
                  <summary className="cursor-pointer">
                    {fmtDateTime(c.at)} — {c.lines.length} صنف، {changed.length ? `${changed.length} بفرق` : "بلا فروقات"}
                  </summary>
                  <ul className="mt-2 space-y-0.5 text-xs text-muted">
                    {c.lines.map((l) => (
                      <li key={l.stockId}>{l.name}: <span dir="ltr">{l.before} → {l.counted}</span>{l.before !== l.counted && <b className={l.counted > l.before ? "text-teal-700" : "text-red-600"} dir="ltr"> ({l.counted - l.before > 0 ? "+" : ""}{l.counted - l.before})</b>}</li>
                    ))}
                  </ul>
                </details>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
