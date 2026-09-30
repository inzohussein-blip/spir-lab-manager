"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, AlertTriangle, CalendarClock, Minus, Plus, ClipboardCheck, Settings } from "lucide-react";
import {
  getStock, saveStock, getTests, daysToExpiry, stockTestIds, pendingStock, issueVisitStock, skipVisitStock,
  type StockItem, type StationTest, type PendingStock,
} from "@/lib/station/store";
import { NumberInput } from "@/components/local/NumberInput";
import { qcLinks, stockFloor, stockOptions, pendingQcStock, issueQcStock, skipQcStock, type StockOptions, type PendingQc } from "@/lib/local/links";
import { fmtDateTime } from "@/lib/utils";
import { Tile } from "./stockParts";

type Filter = "all" | "low" | "in";

/**
 * «المخزن»: what is in the stock room now. Quantities rise with purchases (or «إضافة» here) and fall
 * with the lab's results — on saving them, or by hand from «نتائج بانتظار الصرف» when the stock room
 * is set to manual (Settings → «المخزن») — and with «صرف» here. Items and their tests: «الأصناف».
 */
export function StockPanel() {
  const [rows, setRows] = useState<StockItem[]>([]);
  const [tests, setTests] = useState<StationTest[]>([]);
  const [qc, setQc] = useState<Map<string, string[]>>(new Map());
  const [pending, setPending] = useState<PendingStock[]>([]);
  const [pendingQc, setPendingQc] = useState<PendingQc[]>([]);
  const [opts, setOpts] = useState<StockOptions>({});
  const [amount, setAmount] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [msg, setMsg] = useState("");

  const reload = () => { setRows(getStock()); setPending(pendingStock()); setPendingQc(pendingQcStock()); };
  useEffect(() => { reload(); setTests(getTests()); setQc(qcLinks()); setOpts(stockOptions()); }, []);

  function persist(next: StockItem[]) { setRows(next); saveStock(next); }
  /** «إضافة» / «صرف» by hand (1 when no number is typed). */
  function move(s: StockItem, sign: 1 | -1) {
    const n = Math.abs(Number(amount[s.id]) || 1);
    persist(rows.map((r) => (r.id === s.id ? { ...r, qty: stockFloor(Number(r.qty) + sign * n) } : r)));
    setAmount((a) => ({ ...a, [s.id]: "" }));
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

  const isLow = (s: StockItem) => s.minQty != null && Number(s.qty) <= Number(s.minQty);
  const testName = (id?: string) => tests.find((t) => t.id === id)?.name_ar;
  const { lowCount, soonCount } = useMemo(() => {
    let low = 0, soon = 0;
    for (const s of rows) {
      if (isLow(s)) low++;
      const d = daysToExpiry(s.expiry);
      if (d != null && d <= 30) soon++;
    }
    return { lowCount: low, soonCount: soon };
  }, [rows]);
  const shown = rows.filter((s) => filter === "all" || (filter === "in" ? Number(s.qty) > 0 : Number(s.qty) <= 0 || isLow(s)));
  const manual = opts.mode === "manual";

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        ما هو محفوظ في المخزن الآن. تزيد الكمية بالشراء وتنقص بنتائج محطة المختبر (الكاشف وحدةً لكل فحص، والأنبوب وحدةً لكل زيارة)
        وبالسيطرة النوعية. الأصناف وربطها بالتحاليل من <Link href="/store/items" className="text-amber-700 underline">«الأصناف»</Link>.
      </p>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm" data-testid="stock-mode-line">
        <ClipboardCheck className="size-4 text-amber-700" />
        حسم المواد عند إدخال النتائج: <b>{manual ? "يدوي — من «بانتظار الصرف» أو زر «صرف المواد» في شاشة الإدخال" : "تلقائي — عند حفظ النتيجة"}</b>
        <Link href="/store/settings#stock" className="ms-auto inline-flex items-center gap-1 text-xs text-amber-700 hover:underline"><Settings className="size-3.5" /> تغيير من الإعدادات</Link>
      </div>

      {(manual || waiting > 0) && (
        <div className="rounded-2xl border border-amber-300 bg-surface shadow-[var(--shadow-card)]" data-testid="stock-pending">
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
            <div className="text-sm font-semibold">بانتظار الصرف <span className="tabular-nums text-amber-700">({waiting})</span></div>
            <span className="text-xs text-muted">نتائج حُفظت وإدخالات سيطرة لم تُصرف موادها بعد.</span>
            {waiting > 1 && (
              <button onClick={() => { issue(pending); issueQc(pendingQc); setMsg(`صُرفت مواد ${waiting} إدخالاً.`); }} className="ms-auto rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700">صرف الكل</button>
            )}
          </div>
          {waiting === 0 && <p className="p-4 text-sm text-muted">لا شيء بانتظار الصرف.</p>}
          {pendingQc.length > 0 && (
            <ul className="divide-y divide-line border-b border-line" data-testid="stock-pending-qc">
              {pendingQc.map((p) => (
                <li key={p.key} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm" data-pending-qc={p.analyte}>
                  <div className="min-w-40">
                    <div className="font-medium">سيطرة: {p.analyte}{p.level && <span className="text-muted"> — {p.level}</span>}</div>
                    <div className="text-[11px] text-muted" dir="ltr" style={{ textAlign: "right" }}>{p.date}</div>
                  </div>
                  <div className="flex flex-1 flex-wrap gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${p.qty < 1 ? "bg-red-50 text-red-700" : "bg-rose-50 text-rose-800"}`}>
                      {p.stock} <b dir="ltr">×1</b> <span className="text-muted">(المتوفر <span dir="ltr">{p.qty}</span>)</span>
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => issueQc([p])} aria-label={`صرف سيطرة ${p.analyte}`} className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700">صرف</button>
                    <button onClick={() => skipQc(p)} aria-label={`تجاهل سيطرة ${p.analyte}`} className="rounded-lg border border-line px-3 py-1 text-xs hover:bg-canvas">تجاهل</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {pending.length > 0 && (
            <ul className="divide-y divide-line">
              {pending.map((p) => (
                <li key={p.visit.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm" data-pending={p.visit.patient.name}>
                  <div className="min-w-40">
                    <div className="font-medium">{p.visit.patient.name}</div>
                    <div className="text-[11px] text-muted">{fmtDateTime(p.visit.created_at)}{p.visit.accession && <> · <span dir="ltr">{p.visit.accession}</span></>}</div>
                  </div>
                  <div className="flex flex-1 flex-wrap gap-1">
                    {p.items.map((i) => (
                      <span key={i.name} className={`rounded-full px-2 py-0.5 text-xs ${i.qty < i.use ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>
                        {i.name} <b dir="ltr">×{i.use}</b> <span className="text-muted">(المتوفر <span dir="ltr">{i.qty}</span>)</span>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => issue([p])} aria-label={`صرف ${p.visit.patient.name}`} className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700">صرف</button>
                    <button onClick={() => skip(p)} aria-label={`تجاهل ${p.visit.patient.name}`} className="rounded-lg border border-line px-3 py-1 text-xs hover:bg-canvas">تجاهل</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {msg && <p className="border-t border-line px-4 py-2 text-xs text-brand-dark" role="status">{msg}</p>}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Tile label="عدد الأصناف" value={rows.length} />
        <Tile label="تحت الحد الأدنى" value={lowCount} tone={lowCount ? "danger" : undefined} />
        <Tile label="قرب/منتهي الصلاحية" value={soonCount} tone={soonCount ? "warn" : undefined} />
      </div>

      <div className="flex flex-wrap gap-1" role="tablist" aria-label="عرض">
        {([["all", "الكل"], ["in", "الموجود"], ["low", "نفد أو ناقص"]] as const).map(([v, label]) => (
          <button key={v} type="button" onClick={() => setFilter(v)} aria-pressed={filter === v}
            className={`rounded-full px-3 py-1 text-xs ${filter === v ? "bg-amber-600 font-semibold text-white" : "border border-line hover:bg-canvas"}`}>{label}</button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-right text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">الصنف</th>
              <th className="px-4 py-3 font-medium">الكمية</th>
              <th className="px-4 py-3 font-medium">مرتبط بـ</th>
              <th className="px-4 py-3 font-medium">الانتهاء</th>
              <th className="px-4 py-3 font-medium">الحالة</th>
              <th className="px-4 py-3 font-medium">إضافة / صرف</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">
                {rows.length ? "لا أصناف في هذا العرض." : <>المخزن فارغ — أضف الأصناف من <Link href="/store/items" className="text-amber-700 underline">«الأصناف»</Link>.</>}
              </td></tr>
            )}
            {shown.map((s) => {
              const d = daysToExpiry(s.expiry);
              const expired = d != null && d < 0;
              const soon = d != null && d >= 0 && d <= 30;
              const low = isLow(s);
              return (
                <tr key={s.id} className="border-b border-line last:border-0 hover:bg-canvas">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/store/items?edit=${s.id}`} className="inline-flex items-center gap-1.5 hover:underline" title="تعديل الصنف في «الأصناف»">
                      {s.name} <Pencil className="size-3 text-muted" />
                    </Link>
                  </td>
                  <td className={`px-4 py-3 tabular-nums ${low || Number(s.qty) < 0 ? "font-bold text-red-600" : ""}`} data-testid="stock-qty">
                    <span dir="ltr">{s.qty}</span>
                    {Number(s.qty) <= 0 && <span className="ms-1.5 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">{Number(s.qty) < 0 ? "بالسالب" : "نفد"}</span>}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {(() => {
                      const ids = stockTestIds(s);
                      if (!ids.length) return qc.has(s.id) ? null : "—";
                      const names = ids.map(testName).filter(Boolean) as string[];
                      return (
                        <span data-testid="stock-tests" title={names.join("، ")} className="inline-flex flex-wrap items-center gap-1">
                          {ids.length === 1 ? names[0] : <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">{ids.length} فحص</span>}
                          {s.perVisit && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700">لكل زيارة</span>}
                        </span>
                      );
                    })()}
                    {qc.has(s.id) && <span data-testid="qc-link" className="ms-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs text-rose-700">سيطرة: {qc.get(s.id)!.join("، ")}</span>}
                  </td>
                  <td className={`px-4 py-3 ${expired ? "text-red-600" : soon ? "text-amber-700" : "text-muted"}`}>{s.expiry ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {low && <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600"><AlertTriangle className="size-3" /> نقص</span>}
                      {expired && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">منتهي</span>}
                      {soon && !expired && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700"><CalendarClock className="size-3" /> {d === 0 ? "ينتهي اليوم" : `${d} يوم`}</span>}
                      {!low && !expired && !soon && <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs text-brand-dark">جيد</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <NumberInput value={amount[s.id] ?? ""} onValue={(v) => setAmount((a) => ({ ...a, [s.id]: v }))} placeholder="1" aria-label={`كمية ${s.name}`}
                        className="w-16 rounded-lg border border-line bg-surface px-2 py-1 text-center text-sm outline-none focus:border-brand" />
                      <button onClick={() => move(s, 1)} aria-label={`إضافة إلى ${s.name}`} title="إضافة إلى المخزن" className="grid size-7 place-items-center rounded-lg border border-line hover:bg-canvas"><Plus className="size-4" /></button>
                      <button onClick={() => move(s, -1)} aria-label={`صرف من ${s.name}`} title="صرف من المخزن" className="grid size-7 place-items-center rounded-lg border border-line hover:bg-canvas"><Minus className="size-4" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
