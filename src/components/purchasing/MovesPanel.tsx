"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { getMoves, MOVE_LABEL, type StockMove, type MoveReason } from "@/lib/local/links";
import { getStock, type StockItem } from "@/lib/station/store";
import { fmtDateTime } from "@/lib/utils";

const TONE: Partial<Record<MoveReason, string>> = {
  purchase: "bg-amber-50 text-amber-800", "purchase-del": "bg-red-50 text-red-700", result: "bg-teal-50 text-brand-dark",
  qc: "bg-rose-50 text-rose-700", add: "bg-sky-50 text-sky-700", issue: "bg-violet-50 text-violet-700", count: "bg-lime-50 text-lime-800",
};

/**
 * «سجل الحركة»: every change of a stock count — purchases, the lab's results, control runs, manual
 * add / issue, stocktakes and edits — newest first, with the count after it. One item's history
 * opens from «المخزن» (?item=<id>).
 */
export function MovesPanel() {
  const [moves, setMoves] = useState<StockMove[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [item, setItem] = useState("");
  const [reason, setReason] = useState<"" | MoveReason>("");
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(200);
  useEffect(() => {
    setMoves(getMoves()); setStock(getStock());
    setItem(new URLSearchParams(window.location.search).get("item") ?? "");
  }, []);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return moves.filter((m) => (!item || m.stockId === item) && (!reason || m.reason === reason)
      && (!term || m.name.toLowerCase().includes(term) || (m.ref ?? "").toLowerCase().includes(term)));
  }, [moves, item, reason, q]);
  const inQty = rows.filter((m) => m.delta > 0).reduce((n, m) => n + m.delta, 0);
  const outQty = rows.filter((m) => m.delta < 0).reduce((n, m) => n - m.delta, 0);
  const sel = "rounded-lg border border-line bg-surface px-3 py-2 text-sm";

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">كل تغيّر في كمية أي صنف: الشراء، ونتائج محطة المختبر، والسيطرة النوعية، والإضافة والصرف اليدوي، والجرد، وتعديل الصنف — الأحدث أولاً.</p>
      <div className="flex flex-wrap items-center gap-2">
        <select value={item} onChange={(e) => setItem(e.target.value)} aria-label="الصنف" className={sel}>
          <option value="">كل الأصناف</option>
          {stock.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={reason} onChange={(e) => setReason(e.target.value as "" | MoveReason)} aria-label="نوع الحركة" className={sel}>
          <option value="">كل الحركات</option>
          {(Object.keys(MOVE_LABEL) as MoveReason[]).map((r) => <option key={r} value={r}>{MOVE_LABEL[r]}</option>)}
        </select>
        <label className="flex flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3">
          <Search className="size-4 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالصنف أو المريض أو المورّد…" aria-label="بحث في السجل" className="w-full bg-transparent py-2 text-sm outline-none" />
        </label>
      </div>
      <div className="text-xs text-muted" data-testid="moves-sum">
        {rows.length} حركة · دخل <b className="tabular-nums text-teal-700" dir="ltr">+{inQty}</b> · خرج <b className="tabular-nums text-red-600" dir="ltr">-{outQty}</b>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
        <table className="w-full text-sm" data-testid="moves">
          <thead className="border-b border-line text-right text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">الوقت</th>
              <th className="px-4 py-3 font-medium">الصنف</th>
              <th className="px-4 py-3 font-medium">الحركة</th>
              <th className="px-4 py-3 font-medium">التفاصيل</th>
              <th className="px-4 py-3 font-medium">الكمية</th>
              <th className="px-4 py-3 font-medium">بعدها</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">لا حركات.</td></tr>}
            {rows.slice(0, shown).map((m) => (
              <tr key={m.id} data-reason={m.reason} className="border-b border-line last:border-0">
                <td className="whitespace-nowrap px-4 py-2 text-xs text-muted">{fmtDateTime(m.at)}</td>
                <td className="px-4 py-2 font-medium">{m.name}</td>
                <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-xs ${TONE[m.reason] ?? "bg-canvas text-muted"}`}>{MOVE_LABEL[m.reason]}</span></td>
                <td className="px-4 py-2 text-xs text-muted">{m.ref ?? "—"}</td>
                <td className={`px-4 py-2 font-bold tabular-nums ${m.delta > 0 ? "text-teal-700" : "text-red-600"}`} dir="ltr" style={{ textAlign: "right" }}>{m.delta > 0 ? `+${m.delta}` : m.delta}</td>
                <td className="px-4 py-2 tabular-nums" dir="ltr" style={{ textAlign: "right" }}>{m.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > shown && (
        <button onClick={() => setShown((n) => n + 200)} className="self-center rounded-lg border border-line px-4 py-2 text-sm hover:bg-canvas">عرض المزيد ({rows.length - shown})</button>
      )}
    </div>
  );
}
