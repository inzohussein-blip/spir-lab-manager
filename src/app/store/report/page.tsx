"use client";

import { useEffect, useMemo, useState } from "react";
import { FileBarChart, Printer } from "lucide-react";
import { getPurchases, getSettings, type Purchase, type PurchasingSettings } from "@/lib/purchasing/store";
import { money } from "@/lib/utils";

const MONTHS = ["الكل", "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

export default function PurchasingReportPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [settings, setSettings] = useState<PurchasingSettings>({ orgName: "" });
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState("0"); // 0 = whole year

  useEffect(() => { setPurchases(getPurchases()); setSettings(getSettings()); }, []);

  const years = useMemo(() => {
    const set = new Set(purchases.map((p) => (p.date || "").slice(0, 4)).filter(Boolean));
    set.add(String(now.getFullYear()));
    return Array.from(set).sort().reverse();
  }, [purchases]);

  const rows = useMemo(() => {
    const m = Number(month);
    return purchases
      .filter((p) => {
        const [y, mo] = (p.date || "").split("-");
        if (y !== year) return false;
        if (m > 0 && Number(mo) !== m) return false;
        return true;
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [purchases, year, month]);

  const total = rows.reduce((s, p) => s + Number(p.total || 0), 0);
  const unpaid = rows.filter((p) => !p.paid).reduce((s, p) => s + Number(p.total || 0), 0);

  const bySupplier = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of rows) {
      const k = p.supplierName || "بدون مورّد";
      map.set(k, (map.get(k) ?? 0) + Number(p.total || 0));
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const title = month === "0" ? `تقرير سنة ${year}` : `تقرير ${MONTHS[Number(month)]} ${year}`;

  return (
    <div>
      <style>{`@media print { @page { size: A4; margin: 12mm; } }`}</style>

      {/* Controls */}
      <div className="no-print mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><FileBarChart className="size-6" /> تقارير المشتريات</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select value={year} onChange={(e) => setYear(e.target.value)} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
            {MONTHS.map((m, i) => <option key={i} value={String(i)}>{i === 0 ? "كل السنة" : m}</option>)}
          </select>
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">
            <Printer className="size-4" /> طباعة
          </button>
        </div>
      </div>

      {/* Printable report */}
      <div id="report-sheet" className="mx-auto max-w-[210mm] bg-white p-8 text-black shadow-sm print:p-0 print:shadow-none">
        <div className="flex items-center justify-between border-b-2 border-amber-600 pb-3">
          <div>
            <h2 className="text-xl font-bold text-amber-700">{settings.orgName || "منظومة المشتريات"}</h2>
            <p className="text-sm text-gray-600">{title}</p>
          </div>
          <div className="text-left text-xs text-gray-600">تاريخ الإصدار: {new Date().toLocaleDateString("en-CA")}</div>
        </div>

        {/* Summary */}
        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg border border-gray-200 p-3"><div className="text-gray-500">عدد العمليات</div><div className="mt-1 text-xl font-bold">{rows.length}</div></div>
          <div className="rounded-lg border border-gray-200 p-3"><div className="text-gray-500">إجمالي المصروف</div><div className="mt-1 text-xl font-bold tabular-nums">{money(total)} د.ع</div></div>
          <div className="rounded-lg border border-gray-200 p-3"><div className="text-gray-500">غير مدفوع</div><div className="mt-1 text-xl font-bold tabular-nums text-red-600">{money(unpaid)} د.ع</div></div>
        </div>

        {/* By supplier */}
        <div className="mt-6 text-sm font-bold text-amber-700">حسب المورّد</div>
        <table className="mt-1 w-full border-collapse text-sm">
          <thead><tr className="border-b border-gray-300 text-right text-xs text-gray-500"><th className="py-1.5">المورّد</th><th className="py-1.5 text-left">الإجمالي</th></tr></thead>
          <tbody>
            {bySupplier.length === 0 && <tr><td colSpan={2} className="py-4 text-center text-gray-400">لا بيانات</td></tr>}
            {bySupplier.map(([name, amt]) => (
              <tr key={name} className="border-b border-gray-100"><td className="py-1.5">{name}</td><td className="py-1.5 text-left tabular-nums">{money(amt)} د.ع</td></tr>
            ))}
          </tbody>
        </table>

        {/* Detail */}
        <div className="mt-6 text-sm font-bold text-amber-700">التفاصيل</div>
        <table className="mt-1 w-full border-collapse text-sm">
          <thead><tr className="border-b border-gray-300 text-right text-xs text-gray-500"><th className="py-1.5">التاريخ</th><th className="py-1.5">المورّد</th><th className="py-1.5">البنود</th><th className="py-1.5">الحالة</th><th className="py-1.5 text-left">الإجمالي</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-gray-400">لا عمليات في هذه الفترة</td></tr>}
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-gray-100 align-top">
                <td className="py-1.5 whitespace-nowrap">{p.date}</td>
                <td className="py-1.5">{p.supplierName ?? "—"}</td>
                <td className="py-1.5 text-gray-600">{p.items.map((it) => it.name).join("، ")}</td>
                <td className="py-1.5">{p.paid ? "مدفوعة" : "غير مدفوعة"}</td>
                <td className="py-1.5 text-left tabular-nums">{money(p.total)} د.ع</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-amber-600 font-bold"><td className="py-2" colSpan={4}>الإجمالي</td><td className="py-2 text-left tabular-nums">{money(total)} د.ع</td></tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
