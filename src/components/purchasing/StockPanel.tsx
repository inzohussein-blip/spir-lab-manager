"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Minus, Plus, History, Pencil, Search, PackagePlus } from "lucide-react";
import {
  getStock, saveStock, getTests, daysToExpiry, stockTestIds, pendingStock, issueVisitStock, skipVisitStock,
  type StockItem, type StationTest, type PendingStock,
} from "@/lib/station/store";
import { NumberInput } from "@/components/local/NumberInput";
import { qcLinks, stockFloor, stockOptions, pendingQcStock, issueQcStock, skipQcStock, type StockOptions, type PendingQc } from "@/lib/local/links";
import { fmtDateTime, money } from "@/lib/utils";
import { ScanBox, Modal, Chips } from "./stockParts";
import { getSettings, type PurchasingSettings } from "@/lib/purchasing/store";

type Filter = "all" | "low" | "soon";
type Move = { item: StockItem; sign: 1 | -1 };

/**
 * «المخزن»: what is in the stock room now — one clear list. Search, a filter for what needs attention,
 * and on each item «إضافة» / «صرف» (a small window asks how many). Items are made in «الأصناف»;
 * purchases and the lab's results change the counts by themselves.
 */
export function StockPanel() {
  const [rows, setRows] = useState<StockItem[]>([]);
  const [tests, setTests] = useState<StationTest[]>([]);
  const [qc, setQc] = useState<Map<string, string[]>>(new Map());
  const [pending, setPending] = useState<PendingStock[]>([]);
  const [pendingQc, setPendingQc] = useState<PendingQc[]>([]);
  const [opts, setOpts] = useState<StockOptions>({});
  const [store, setStore] = useState<PurchasingSettings>({ orgName: "" });
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [move, setMove] = useState<Move | null>(null);

  const reload = () => { setRows(getStock()); setPending(pendingStock()); setPendingQc(pendingQcStock()); };
  useEffect(() => { reload(); setTests(getTests()); setQc(qcLinks()); setOpts(stockOptions()); setStore(getSettings()); }, []);

  const isLow = (s: StockItem) => Number(s.qty) <= 0 || (s.minQty != null && Number(s.qty) <= Number(s.minQty));
  const isSoon = (s: StockItem) => { const d = daysToExpiry(s.expiry); return d != null && d <= 30; };
  const counts = useMemo(() => ({ low: rows.filter(isLow).length, soon: rows.filter(isSoon).length }), [rows]);
  const term = q.trim().toLowerCase();
  const shown = rows.filter((s) => (filter === "all" || (filter === "low" ? isLow(s) : isSoon(s))) && (!term || s.name.toLowerCase().includes(term)));
  const value = rows.reduce((t, s) => t + (s.price != null ? Math.max(0, Number(s.qty) || 0) * s.price : 0), 0);

  /** The add / issue window's «حفظ»: the count changes and goes to «سجل الحركة». */
  function applyMove(n: number) {
    if (!move || !(n > 0)) return;
    const next = rows.map((r) => (r.id === move.item.id ? { ...r, qty: stockFloor(Number(r.qty) + move.sign * n) } : r));
    setRows(next); saveStock(next, move.sign > 0 ? "add" : "issue");
    setMsg(`${move.sign > 0 ? "أُضيف" : "صُرف"} ${n} — ${move.item.name}`);
    setMove(null);
  }
  /** Settings → «الباركود»: a scanned item opens its «صرف» window (the most common task). */
  function onScan(code: string): string {
    const s = rows.find((r) => r.barcode === code);
    if (!s) return `باركود غير معروف: ${code}`;
    setMove({ item: s, sign: -1 });
    return s.name;
  }
  function issue(list: PendingStock[]) {
    const short = list.flatMap((p) => issueVisitStock(p.visit.id, p.testIds));
    reload();
    setMsg(short.length && opts.warnOut ? `صُرفت — مواد غير متوفرة: ${short.map((x) => `${x.name} (${x.qty})`).join("، ")}` : `صُرفت مواد ${list.length} زيارة.`);
  }
  function skip(p: PendingStock) { skipVisitStock(p.visit.id, p.testIds); reload(); setMsg("تُركت الزيارة دون صرف."); }
  function issueQc(list: PendingQc[]) { list.forEach(issueQcStock); reload(); setMsg(`صُرفت مادة ${list.length} إدخال سيطرة.`); }
  function skipQc(p: PendingQc) { skipQcStock(p); reload(); setMsg("تُرك إدخال السيطرة دون صرف."); }
  const waiting = pending.length + pendingQc.length;

  /** One line under the name: what the item is and what it is used for. */
  function about(s: StockItem) {
    const ids = stockTestIds(s);
    const names = ids.map((id) => tests.find((t) => t.id === id)?.name_ar).filter(Boolean) as string[];
    const d = daysToExpiry(s.expiry);
    return (
      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
        {ids.length > 0 && (
          <span data-testid="stock-tests" title={names.join("، ")}>
            {s.perVisit ? "لكل زيارة · " : ""}{ids.length === 1 ? names[0] : `${ids.length} فحص`}
          </span>
        )}
        {qc.has(s.id) && <span data-testid="qc-link" className="text-rose-700">سيطرة: {qc.get(s.id)!.join("، ")}</span>}
        {s.expiry && <span className={d != null && d < 0 ? "text-red-600" : d != null && d <= 30 ? "text-amber-700" : ""}>ينتهي {s.expiry}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {waiting > 0 && (
        <details open className="rounded-2xl border border-amber-300 bg-surface shadow-[var(--shadow-card)]" data-testid="stock-pending">
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 p-4 [&::-webkit-details-marker]:hidden">
            <span className="text-sm font-semibold">بانتظار الصرف <span className="tabular-nums text-amber-700">({waiting})</span></span>
            <span className="text-xs text-muted">نتائج وإدخالات سيطرة لم تُصرف موادها بعد</span>
            {waiting > 1 && (
              <button onClick={(e) => { e.preventDefault(); issue(pending); issueQc(pendingQc); setMsg(`صُرفت مواد ${waiting} إدخالاً.`); }}
                className="ms-auto rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700">صرف الكل</button>
            )}
          </summary>
          {pendingQc.length > 0 && (
            <ul className="divide-y divide-line border-t border-line" data-testid="stock-pending-qc">
              {pendingQc.map((p) => (
                <li key={p.key} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm" data-pending-qc={p.analyte}>
                  <div className="min-w-40 flex-1">
                    <div className="font-medium">سيطرة: {p.analyte}{p.level && <span className="text-muted"> — {p.level}</span>}</div>
                    <div className="text-[11px] text-muted">{p.stock} × 1 · {p.date}</div>
                  </div>
                  <button onClick={() => issueQc([p])} aria-label={`صرف سيطرة ${p.analyte}`} className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700">صرف</button>
                  <button onClick={() => skipQc(p)} aria-label={`تجاهل سيطرة ${p.analyte}`} className="rounded-lg border border-line px-3 py-1 text-xs hover:bg-canvas">تجاهل</button>
                </li>
              ))}
            </ul>
          )}
          {pending.length > 0 && (
            <ul className="divide-y divide-line border-t border-line">
              {pending.map((p) => (
                <li key={p.visit.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm" data-pending={p.visit.patient.name}>
                  <div className="min-w-40 flex-1">
                    <div className="font-medium">{p.visit.patient.name}</div>
                    <div className="text-[11px] text-muted">
                      {p.items.map((i) => `${i.name} × ${i.use}`).join("، ")} · {fmtDateTime(p.visit.created_at)}
                    </div>
                  </div>
                  <button onClick={() => issue([p])} aria-label={`صرف ${p.visit.patient.name}`} className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700">صرف</button>
                  <button onClick={() => skip(p)} aria-label={`تجاهل ${p.visit.patient.name}`} className="rounded-lg border border-line px-3 py-1 text-xs hover:bg-canvas">تجاهل</button>
                </li>
              ))}
            </ul>
          )}
        </details>
      )}

      {/* Search, then what needs attention */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-60 flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3">
          <Search className="size-5 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن صنف…" aria-label="بحث في المخزن" className="w-full bg-transparent py-2.5 text-base outline-none" />
        </label>
        <Link href="/store/items?new=1" className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-medium hover:bg-canvas">
          <PackagePlus className="size-4" /> صنف جديد
        </Link>
      </div>
      {store.barcode && <ScanBox onScan={onScan} hint="امسح باركود صنف لتصرف منه…" />}
      <div className="flex flex-wrap items-center gap-3">
        <Chips label="عرض" value={filter} onChange={setFilter}
          options={[["all", "الكل", rows.length], ["low", "نفد أو ناقص", counts.low], ["soon", "قرب الانتهاء", counts.soon]]} />
        {store.prices && <span className="ms-auto text-sm text-muted" data-testid="stock-value">قيمة المخزن: <b className="tabular-nums text-amber-700">{money(value)}</b> د.ع</span>}
      </div>
      {msg && <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-brand-dark" role="status">{msg}</p>}

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
        {shown.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">
            {rows.length ? "لا أصناف هنا." : <>المخزن فارغ — أضف الأصناف من <Link href="/store/items" className="text-amber-700 underline">«الأصناف»</Link>، أو سجّل عملية شراء.</>}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((s) => {
              const n = Number(s.qty) || 0;
              const low = isLow(s);
              return (
                <li key={s.id} data-stock={s.name} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-canvas">
                  <div className="min-w-44 flex-1">
                    <div className="font-semibold">{s.name}</div>
                    {about(s)}
                  </div>
                  <div className="w-28 text-center" data-testid="stock-qty">
                    <span className={`text-2xl font-bold tabular-nums ${low ? "text-red-600" : ""}`} dir="ltr">{s.qty}</span>
                    {n <= 0 ? <span className="block text-[11px] font-semibold text-red-700">{n < 0 ? "بالسالب" : "نفد"}</span>
                      : low ? <span className="block text-[11px] font-semibold text-red-700">ناقص</span> : null}
                  </div>
                  {store.prices && <div className="w-28 text-center text-sm tabular-nums text-muted" data-testid="stock-price">{s.price != null ? `${money(Math.max(0, n) * s.price)} د.ع` : "—"}</div>}
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setMove({ item: s, sign: 1 })} aria-label={`إضافة إلى ${s.name}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-teal-300 px-3 py-1.5 text-sm font-medium text-teal-800 hover:bg-teal-50"><Plus className="size-4" /> إضافة</button>
                    <button onClick={() => setMove({ item: s, sign: -1 })} aria-label={`صرف من ${s.name}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-50"><Minus className="size-4" /> صرف</button>
                    <Link href={`/store/moves?item=${s.id}`} aria-label={`سجل حركة ${s.name}`} title="سجل الحركة" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface hover:text-ink"><History className="size-4" /></Link>
                    <Link href={`/store/items?edit=${s.id}`} aria-label={`تعديل ${s.name}`} title="تعديل الصنف" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface hover:text-ink"><Pencil className="size-4" /></Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {move && <MoveDialog move={move} onClose={() => setMove(null)} onSave={applyMove} />}
    </div>
  );
}

/** «إضافة» / «صرف»: how many (1 unless changed), Enter to save. */
function MoveDialog({ move, onClose, onSave }: { move: Move; onClose: () => void; onSave: (n: number) => void }) {
  const [n, setN] = useState("1");
  const now = Number(move.item.qty) || 0;
  const after = now + move.sign * (Number(n) || 0);
  return (
    <Modal title={`${move.sign > 0 ? "إضافة إلى" : "صرف من"} ${move.item.name}`} onClose={onClose} testid="move-dialog">
      <form onSubmit={(e) => { e.preventDefault(); onSave(Number(n) || 0); }} className="flex flex-col gap-4">
        <label className="text-sm font-medium">الكمية
          <NumberInput value={n} onValue={setN} autoFocus onFocus={(e) => e.currentTarget.select()} aria-label="كمية الحركة"
            className="mt-1 w-full rounded-xl border-2 border-line bg-surface px-4 py-3 text-center text-3xl font-bold outline-none focus:border-amber-500" />
        </label>
        <p className="text-center text-sm text-muted">
          الآن <b className="tabular-nums text-ink" dir="ltr">{now}</b> ← بعد {move.sign > 0 ? "الإضافة" : "الصرف"} <b className={`tabular-nums ${after < 0 ? "text-red-600" : "text-ink"}`} dir="ltr">{after}</b>
        </p>
        <div className="flex gap-2">
          <button type="submit" className={`flex-1 rounded-xl px-4 py-3 text-base font-semibold text-white ${move.sign > 0 ? "bg-teal-600 hover:bg-teal-700" : "bg-amber-600 hover:bg-amber-700"}`}>
            {move.sign > 0 ? "حفظ الإضافة" : "حفظ الصرف"}
          </button>
          <button type="button" onClick={onClose} className="rounded-xl border border-line px-4 py-3 text-sm hover:bg-canvas">إلغاء</button>
        </div>
      </form>
    </Modal>
  );
}
