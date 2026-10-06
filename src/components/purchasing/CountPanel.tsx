"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Search, Save, Printer, History, SlidersHorizontal, FileText, X } from "lucide-react";
import { getStock, type StockItem } from "@/lib/station/store";
import { getMoves, type StockMove } from "@/lib/local/links";
import { getCounts, applyCount, countDate, getSettings, saveSettings, type StockCount, type PurchasingSettings } from "@/lib/purchasing/store";
import { NumberInput } from "@/components/local/NumberInput";
import { money } from "@/lib/utils";
import { ScanBox } from "./stockParts";

type Extra = "countExpiry" | "countReceived" | "countValue" | "countCost";
const EXTRAS: [Extra, string][] = [["countExpiry", "الإكسباير"], ["countReceived", "الوارد"], ["countValue", "قيمة المتبقي"], ["countCost", "الكلفة"]];
const today = () => new Date().toLocaleDateString("en-CA");
const dayStart = (ymd: string) => new Date(`${ymd}T00:00:00`).getTime();
const daysBetween = (a: string, b: string) => Math.round((dayStart(b) - dayStart(a)) / 86_400_000);
/** What leaves the stock room in use (the lab's results, control runs, issued by hand), and what comes in. */
const USED = new Set<StockMove["reason"]>(["result", "qc", "issue"]);
const IN = new Set<StockMove["reason"]>(["purchase", "add"]);

interface Row { item: StockItem; device: string; system: number; used: number; received: number }

/**
 * «الجرد», laid out as in the supplier station: per device, each material with what was used in the
 * period (the lab's results, control runs, issued by hand — since the last stocktake by default) and
 * what remains on record, then the count actually on the shelf (optional) and the difference. Extra
 * columns: expiry, received, the value left and the unit cost («أعمدة إضافية», kept in the settings).
 * Saving sets the counted items (the differences go to «سجل الحركة»); each stocktake is kept with a
 * printable record, and a blank sheet prints for counting by hand.
 */
export function CountPanel() {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [moves, setMoves] = useState<StockMove[]>([]);
  const [counts, setCounts] = useState<StockCount[]>([]);
  const [opts, setOpts] = useState<PurchasingSettings>({ orgName: "" });
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [msg, setMsg] = useState("");
  const [showExtras, setShowExtras] = useState(false);
  const [period, setPeriod] = useState<"last" | "all" | "custom">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sheet, setSheet] = useState(false);
  const [sel, setSel] = useState<StockCount | null>(null);

  const load = () => { setStock(getStock()); setMoves(getMoves()); setCounts(getCounts()); setOpts(getSettings()); };
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- this device's data (browser storage) is read once the page is on screen, never while rendering on the server
    load();
    const c = getCounts()[0];
    setDate(today()); setTo(today());
    if (c) { setPeriod("last"); setFrom(countDate(c)); }
  }, []);

  const last = counts[0] ? countDate(counts[0]) : null;
  const toggle = (k: Extra) => { const next = { ...getSettings(), [k]: !opts[k] }; saveSettings(next); setOpts(next); };

  const rows = useMemo<Row[]>(() => {
    const [f, t] = period === "all" ? ["", ""] : period === "last" ? [last ?? "", ""] : [from, to];
    const fromMs = period === "last" && counts[0] ? counts[0].at : f ? dayStart(f) : 0;
    const toMs = t ? dayStart(t) + 86_400_000 : Infinity;
    const inRange = moves.filter((m) => m.at >= fromMs && m.at < toMs);
    return stock.map((item) => {
      const mine = inRange.filter((m) => m.stockId === item.id);
      return {
        item, device: item.device?.trim() || "بدون جهاز", system: Number(item.qty) || 0,
        used: mine.filter((m) => USED.has(m.reason)).reduce((n, m) => n - m.delta, 0),
        received: mine.filter((m) => IN.has(m.reason)).reduce((n, m) => n + m.delta, 0),
      };
    }).sort((a, b) => (a.device === "بدون جهاز" ? 1 : 0) - (b.device === "بدون جهاز" ? 1 : 0) || a.device.localeCompare(b.device) || a.item.name.localeCompare(b.item.name));
  }, [stock, moves, counts, period, from, to, last]);

  const term = q.trim().toLowerCase();
  const shown = rows.filter((r) => !term || r.item.name.toLowerCase().includes(term) || r.device.toLowerCase().includes(term) || (r.item.lot ?? "").toLowerCase().includes(term));
  const groups = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const r of shown) m.set(r.device, [...(m.get(r.device) ?? []), r]);
    return [...m.entries()];
  }, [shown]);
  const entered = rows.filter((r) => (counted[r.item.id] ?? "").trim() !== "");
  const diffOf = (r: Row) => Number(counted[r.item.id]) - r.system;
  const diffValue = entered.reduce((a, r) => a + diffOf(r) * (r.item.price ?? 0), 0);
  const tot = shown.reduce((a, r) => ({ used: a.used + r.used, received: a.received + r.received, system: a.system + r.system, value: a.value + Math.max(0, r.system) * (r.item.price ?? 0) }), { used: 0, received: 0, system: 0, value: 0 });
  const periodLabel = period === "all" ? "كل المدة" : period === "last" ? `منذ آخر جرد (${last})` : `${from || "البداية"} ← ${to || "اليوم"}`;
  const cols = 6 + (opts.countExpiry ? 1 : 0) + (opts.countReceived ? 1 : 0) + (opts.countValue ? 1 : 0) + (opts.countCost ? 1 : 0);

  /** Settings → «الباركود»: each scan of an item counts one more of it. */
  function onScan(code: string): string {
    const s = stock.find((r) => r.barcode === code);
    if (!s) return `باركود غير معروف: ${code}`;
    const n = (Number(counted[s.id]) || 0) + 1;
    setCounted((c) => ({ ...c, [s.id]: String(n) }));
    return `${s.name}: ${n}`;
  }
  function save() {
    if (!entered.length) { setMsg("أدخل العدد الفعلي لصنف واحد على الأقل."); return; }
    const diffs = entered.filter((r) => diffOf(r) !== 0).length;
    if (!window.confirm(`حفظ الجرد لـ ${entered.length} صنف؟ ${diffs ? `تُصحَّح كمية ${diffs} صنف إلى المعدود.` : "لا فروقات."}`)) return;
    const rec = applyCount(Object.fromEntries(entered.map((r) => [r.item.id, Number(counted[r.item.id])])), { date, note });
    setCounted({}); setNote(""); setSheet(false); load();
    if (rec) { setMsg(`حُفظ الجرد: ${rec.lines.length} صنف، وصُحِّح ${rec.lines.filter((l) => l.before !== l.counted).length}، والفروقات أُضيفت إلى سجل الحركة.`); setSel(rec); setPeriod("last"); }
  }

  return (
    <div>
      <style>{`@media print { @page { size: A4; margin: 12mm; } }`}</style>
      <div className="no-print mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><ClipboardCheck className="size-6" /> الجرد</h1>
          <p className="mt-1 text-sm text-muted">لكل جهاز موادّه: ما صُرف (نتائج المختبر، السيطرة، الصرف اليدوي) والمتبقي في السجل. اكتب العدد الفعلي على الرف (اختياري — اترك الفارغ لما لم يُعدّ)، والفرق يُسجَّل في «سجل الحركة».</p>
          <p className="mt-1 text-xs text-muted" data-testid="count-last">آخر جرد: <b>{last ?? "لم يُجرَ بعد"}</b>{last && date && ` (قبل ${daysBetween(last, today())} يوم)`}</p>
        </div>
        <button onClick={() => { setSel(null); setSheet(true); }} data-testid="count-sheet" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas"><FileText className="size-4" /> طباعة ورقة الجرد</button>
      </div>

      <div className="no-print mb-3 flex flex-wrap items-center gap-2">
        <div className="flex min-w-56 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3">
          <Search className="size-4 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالجهاز أو المادة أو اللوت…" aria-label="بحث في الأصناف" className="w-full bg-transparent py-2 text-sm outline-none" />
        </div>
        <label className="flex items-center gap-1.5 text-sm">الفترة
          <select value={period} onChange={(e) => setPeriod(e.target.value as typeof period)} aria-label="فترة الصرف" data-testid="count-period" className="rounded-lg border border-line bg-surface px-2 py-2 text-sm">
            {last && <option value="last">منذ آخر جرد</option>}
            <option value="all">كل المدة</option>
            <option value="custom">من — إلى</option>
          </select>
        </label>
        {period === "custom" && <>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="من تاريخ" className="rounded-lg border border-line bg-surface px-2 py-2 text-sm" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="إلى تاريخ" className="rounded-lg border border-line bg-surface px-2 py-2 text-sm" />
        </>}
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="تاريخ الجرد" title="تاريخ الجرد" className="rounded-lg border border-line bg-surface px-3 py-2 text-sm" />
        <button onClick={() => setShowExtras((v) => !v)} aria-expanded={showExtras} data-testid="count-extras-toggle" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas"><SlidersHorizontal className="size-4" /> أعمدة إضافية</button>
      </div>
      {showExtras && (
        <div className="no-print mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3 text-sm" data-testid="count-extras">
          {EXTRAS.map(([k, l]) => (
            <label key={k} className="flex items-center gap-1.5"><input type="checkbox" checked={opts[k] === true} onChange={() => toggle(k)} aria-label={l} /> {l}</label>
          ))}
          <span className="text-xs text-muted">تُحفظ لهذا الجهاز.</span>
        </div>
      )}
      {opts.barcode && <div className="no-print mb-3"><ScanBox onScan={onScan} hint="امسح باركود كل علبة تعدّها (كل مسح = واحدة)…" /></div>}
      {msg && <p className="no-print mb-3 rounded-lg bg-teal-50 px-3 py-2 text-sm text-brand-dark" role="status">{msg}</p>}

      <div className="no-print overflow-x-auto rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
        <table className="w-full min-w-[820px] text-sm" data-testid="count-table">
          <thead className="border-b border-line text-right text-muted">
            <tr>
              <th className="px-3 py-3 font-medium">الجهاز</th>
              <th className="px-3 py-3 font-medium">المادة</th>
              {opts.countExpiry && <th className="px-3 py-3 font-medium">الإكسباير</th>}
              {opts.countReceived && <th className="px-3 py-3 font-medium">الوارد</th>}
              <th className="px-3 py-3 font-medium">ما صُرف</th>
              <th className="px-3 py-3 font-medium">المتبقي</th>
              <th className="px-3 py-3 font-medium">العدد الفعلي بالمخزن <span className="font-normal">(اختياري)</span></th>
              <th className="px-3 py-3 font-medium">الفرق</th>
              {opts.countValue && <th className="px-3 py-3 font-medium">قيمة المتبقي</th>}
              {opts.countCost && <th className="px-3 py-3 font-medium">الكلفة</th>}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={cols} className="px-4 py-8 text-center text-muted">لا مواد.</td></tr>}
            {groups.map(([device, list]) => (
              <Fragment key={device}>
                {list.map((r, idx) => {
                  const v = counted[r.item.id] ?? "";
                  const d = v.trim() === "" ? null : diffOf(r);
                  return (
                    <tr key={r.item.id} data-count={r.item.name} className={`border-line hover:bg-canvas ${idx === list.length - 1 ? "border-b-2" : "border-b"} last:border-0 ${d ? "bg-amber-50/60" : ""}`}>
                      {idx === 0 && <td rowSpan={list.length} className="border-e border-line bg-canvas/60 px-3 py-2 align-top font-semibold" data-testid="count-device">{device}<div className="text-[11px] font-normal text-muted">{list.length} مادة</div></td>}
                      <td className="px-3 py-2 font-medium">{r.item.name}{r.item.lot && <div className="text-[11px] font-normal text-muted" dir="ltr" style={{ textAlign: "right" }}>LOT {r.item.lot}</div>}</td>
                      {opts.countExpiry && <td className="px-3 py-2 text-xs tabular-nums">{r.item.expiry ?? "—"}</td>}
                      {opts.countReceived && <td className="px-3 py-2 tabular-nums text-emerald-700" data-testid="count-received">{r.received || "—"}</td>}
                      <td className="px-3 py-2 tabular-nums" data-testid="count-used">{r.used}</td>
                      <td className="px-3 py-2 font-semibold tabular-nums" dir="ltr" style={{ textAlign: "right" }} data-testid="count-system">{r.system}</td>
                      <td className="px-3 py-2">
                        <NumberInput value={v} onValue={(x) => setCounted((c) => ({ ...c, [r.item.id]: x }))} placeholder="—" aria-label={`المعدود ${r.item.name}`}
                          className="w-24 rounded-lg border border-line bg-surface px-2 py-1.5 text-center text-sm tabular-nums outline-none focus:border-brand" />
                      </td>
                      <td className={`px-3 py-2 font-semibold tabular-nums ${d == null || d === 0 ? "text-muted" : d > 0 ? "text-emerald-700" : "text-red-600"}`} dir="ltr" style={{ textAlign: "right" }} data-testid="count-diff">
                        {d == null ? "" : d > 0 ? `+${d}` : d}
                      </td>
                      {opts.countValue && <td className="px-3 py-2 tabular-nums">{r.item.price != null ? money(Math.max(0, r.system) * r.item.price) : "—"}</td>}
                      {opts.countCost && <td className="px-3 py-2 tabular-nums text-muted">{r.item.price != null ? money(r.item.price) : "—"}</td>}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
          {shown.length > 0 && (
            <tfoot className="border-t-2 border-line bg-canvas/60 font-semibold">
              <tr>
                <td className="px-3 py-2" colSpan={2 + (opts.countExpiry ? 1 : 0)}>المجموع · {periodLabel}</td>
                {opts.countReceived && <td className="px-3 py-2 tabular-nums">{tot.received}</td>}
                <td className="px-3 py-2 tabular-nums">{tot.used}</td>
                <td className="px-3 py-2 tabular-nums">{tot.system}</td>
                <td colSpan={2} />
                {opts.countValue && <td className="px-3 py-2 tabular-nums">{money(tot.value)}</td>}
                {opts.countCost && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <div className="no-print mt-3 flex flex-wrap items-center gap-2">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة على الجرد (اختياري)" aria-label="ملاحظة الجرد" className="min-w-56 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm" />
        <span className="text-sm">قيمة الفروقات: <b className={`tabular-nums ${diffValue < 0 ? "text-red-600" : ""}`} data-testid="count-diff-value">{money(diffValue)}</b></span>
        <button onClick={save} disabled={!entered.length} data-testid="count-save" className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"><Save className="size-4" /> حفظ الجرد ({entered.length})</button>
      </div>

      <div className="no-print mt-6 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]" data-testid="count-history">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold"><History className="size-4 text-amber-700" /> سجل الجرد</div>
        {counts.length === 0 ? <p className="py-3 text-center text-sm text-muted">لا جرد بعد.</p> : (
          <ul className="flex flex-col gap-1.5">
            {counts.map((c) => {
              const changed = c.lines.filter((l) => l.before !== l.counted);
              return (
                <li key={c.id} data-count-record={c.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-canvas px-3 py-2 text-sm">
                  <b className="tabular-nums">{countDate(c)}</b>
                  <span className="flex-1 text-muted">{c.lines.length} صنف · {changed.length ? `${changed.length} بفرق` : "بلا فروقات"}{c.note ? ` · ${c.note}` : ""}</span>
                  <button onClick={() => { setSheet(false); setSel(c); }} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-0.5 text-xs hover:bg-surface"><Printer className="size-3.5" /> المحضر</button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {(sheet || sel) && (
        <div className="mt-6">
          <div className="no-print mb-3 flex justify-end gap-2">
            <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700"><Printer className="size-4" /> طباعة</button>
            <button onClick={() => { setSheet(false); setSel(null); }} aria-label="إغلاق" className="grid size-8 place-items-center rounded-lg border border-line"><X className="size-4" /></button>
          </div>
          <div id="report-sheet" className="mx-auto max-w-[210mm] bg-white p-8 text-black shadow-sm print:p-0 print:shadow-none" data-testid={sel ? "count-record" : "count-print"}>
            <div className="flex items-center justify-between border-b-2 border-amber-600 pb-3">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={opts.logo || "/lab-logo.png"} alt="" className="size-14 object-contain" />
                <div>
                  <h2 className="text-xl font-bold text-amber-700">{opts.orgName || "المخزن والمشتريات"}</h2>
                  {opts.subtitle && <p className="text-xs text-gray-600">{opts.subtitle}</p>}
                  <p className="text-sm text-gray-600">{sel ? "محضر جرد المخزن" : "ورقة جرد المخزن"}</p>
                </div>
              </div>
              <div className="text-left text-xs text-gray-600">
                <div>التاريخ: {sel ? countDate(sel) : date}</div>
                {!sel && <div>الفترة: {periodLabel}</div>}
              </div>
            </div>
            <table className="mt-4 w-full border-collapse text-sm">
              {sel ? <>
                <thead><tr className="border-b border-gray-300 text-right text-xs text-gray-500"><th className="py-1.5">المادة</th><th className="py-1.5 text-center">في السجل</th><th className="py-1.5 text-center">المعدود</th><th className="py-1.5 text-center">الفرق</th></tr></thead>
                <tbody>
                  {sel.lines.map((l) => {
                    const d = l.counted - l.before;
                    return (
                      <tr key={l.stockId} className="border-b border-gray-100">
                        <td className="py-1.5">{l.name}</td><td className="py-1.5 text-center tabular-nums">{l.before}</td><td className="py-1.5 text-center tabular-nums">{l.counted}</td>
                        <td className={`py-1.5 text-center font-semibold tabular-nums ${d < 0 ? "text-red-600" : d > 0 ? "text-emerald-700" : ""}`} dir="ltr">{d > 0 ? `+${d}` : d}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </> : <>
                <thead><tr className="border-b border-gray-300 text-right text-xs text-gray-500"><th className="py-1.5">الجهاز</th><th className="py-1.5">المادة</th><th className="py-1.5 text-center">ما صُرف</th><th className="py-1.5 text-center">المتبقي</th><th className="w-28 py-1.5 text-center">العدد الفعلي</th></tr></thead>
                <tbody>
                  {shown.map((r, i) => (
                    <tr key={r.item.id} className="border-b border-gray-100">
                      <td className="py-1.5 font-semibold">{i === 0 || shown[i - 1].device !== r.device ? r.device : ""}</td><td className="py-1.5">{r.item.name}</td>
                      <td className="py-1.5 text-center tabular-nums">{r.used}</td><td className="py-1.5 text-center tabular-nums">{r.system}</td>
                      <td className="py-1.5 text-center tabular-nums">{counted[r.item.id] ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </>}
            </table>
            {sel?.note && <p className="mt-3 text-xs text-gray-600">ملاحظة: {sel.note}</p>}
            {opts.footer && <div className="mt-6 rounded-md bg-amber-600 px-3 py-1.5 text-center text-[10px] text-white" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>{opts.footer}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
