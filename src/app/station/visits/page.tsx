"use client";

import { useEffect, useState } from "react";
import { Printer, Trash2, FileText } from "lucide-react";
import {
  getVisits, getTests, getSettings, rangeLabel, flagFor, saveVisitsRaw,
  type StationVisit, type StationTest, type StationSettings,
} from "@/lib/station/store";
import { Barcode } from "@/components/station/Barcode";

const PURPLE = "#5a2a82";
const GOLD = "#c9a227";
const GOLD_DARK = "#9c7c1e";

export default function StationVisitsPage() {
  const [visits, setVisits] = useState<StationVisit[]>([]);
  const [tests, setTests] = useState<StationTest[]>([]);
  const [sel, setSel] = useState<StationVisit | null>(null);
  const [settings, setSettings] = useState<StationSettings>({ labName: "", labSubtitle: "" });

  useEffect(() => { setVisits(getVisits()); setTests(getTests()); setSettings(getSettings()); }, []);

  function remove(id: string) {
    if (!window.confirm("حذف هذه الزيارة؟")) return;
    const next = getVisits().filter((v) => v.id !== id);
    saveVisitsRaw(next);
    setVisits(next);
    if (sel?.id === id) setSel(null);
  }

  const byId = (id: string) => tests.find((t) => t.id === id);

  return (
    <div>
      <div className="no-print mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><FileText className="size-6" /> الزيارات المحفوظة</h1>
        <p className="mt-1 text-sm text-muted">محفوظة محلياً على هذا الحاسوب — يمكن إعادة طباعتها.</p>
      </div>

      <div className="no-print overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-right text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">التاريخ</th>
              <th className="px-4 py-3 font-medium">المريض</th>
              <th className="px-4 py-3 font-medium">الفحوصات</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {visits.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">لا زيارات محفوظة بعد</td></tr>
            )}
            {visits.map((v) => (
              <tr key={v.id} className="border-b border-line last:border-0 hover:bg-canvas">
                <td className="px-4 py-3 text-muted whitespace-nowrap">{new Date(v.created_at).toLocaleString("ar-IQ")}</td>
                <td className="px-4 py-3 font-medium">{v.patient.name || "—"}</td>
                <td className="px-4 py-3">{v.results.length}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => setSel(v)} className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1 text-xs hover:bg-canvas"><Printer className="size-3.5" /> عرض/طباعة</button>
                    <button onClick={() => remove(v.id)} className="grid size-7 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50"><Trash2 className="size-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sel && (
        <>
          <div className="no-print mt-4 flex justify-center">
            <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
              <Printer className="size-4" /> طباعة
            </button>
          </div>
          <div id="report-sheet" className="mx-auto mt-4 max-w-[210mm] bg-white p-8 text-black shadow-sm print:mt-0 print:p-0 print:shadow-none">
            <div className="flex items-center justify-between gap-4 border-b-4 pb-3" style={{ borderColor: GOLD }}>
              <div className="flex items-center gap-3">
                {settings.logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={settings.logo} alt="" className="size-16 object-contain" />
                )}
                <div>
                  <h2 className="text-2xl font-extrabold" style={{ color: PURPLE }}>{settings.labName}</h2>
                  <p className="text-sm font-medium" style={{ color: GOLD_DARK }}>{settings.labSubtitle}</p>
                </div>
              </div>
              <div className="text-left text-xs text-gray-600">
                <div>التاريخ: {new Date(sel.created_at).toISOString().slice(0, 10)}</div>
                {sel.accession && <div className="font-mono font-bold" style={{ color: PURPLE }}>{sel.accession}</div>}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg bg-gray-50 p-3 text-sm sm:grid-cols-3 print:bg-white">
              <div><span className="text-gray-500">المريض:</span> <b>{sel.patient.name || "—"}</b></div>
              <div><span className="text-gray-500">الجنس:</span> {sel.patient.gender === "male" ? "ذكر" : sel.patient.gender === "female" ? "أنثى" : "—"}</div>
              <div><span className="text-gray-500">العمر:</span> {sel.patient.age || "—"}</div>
              {sel.referrer && <div><span className="text-gray-500">الطبيب المُحيل:</span> {sel.referrer}</div>}
            </div>
            <table className="mt-4 w-full border-collapse text-sm">
              <thead>
                <tr className="text-right text-xs text-white" style={{ background: PURPLE, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                  <th className="px-2 py-2 font-medium">الفحص</th>
                  <th className="px-2 py-2 font-medium">النتيجة</th>
                  <th className="px-2 py-2 font-medium">الوحدة</th>
                  <th className="px-2 py-2 font-medium">المعدل الطبيعي</th>
                  <th className="px-2 py-2 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {sel.results.map((r, i) => {
                  const t = byId(r.testId);
                  const f = t ? flagFor(r.value, t.normal, sel.patient.gender) : null;
                  return (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-2 py-2 font-medium">{r.name_ar}</td>
                      <td className={`px-2 py-2 ${f === "H" || f === "L" ? "font-bold" : ""}`}>{r.value || "—"}</td>
                      <td className="px-2 py-2 text-gray-600">{r.unit || "—"}</td>
                      <td className="px-2 py-2 text-gray-600">{t ? rangeLabel(t.normal, sel.patient.gender, t.unit) : "—"}</td>
                      <td className="px-2 py-2">
                        {f === "H" ? <span className="font-bold text-red-600">مرتفع H</span>
                          : f === "L" ? <span className="font-bold text-blue-600">منخفض L</span>
                          : f === "N" ? <span className="text-teal-700">طبيعي</span>
                          : <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {sel.accession && (
              <div className="mt-8 flex justify-end">
                <div className="text-center">
                  <Barcode text={sel.accession} className="block h-8 w-40" />
                  <div className="font-mono text-[10px] text-gray-500">{sel.accession}</div>
                </div>
              </div>
            )}
            {settings.footer && (
              <div
                className="mt-6 rounded-md px-4 py-2 text-center text-xs font-medium text-white"
                style={{ background: PURPLE, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}
              >
                {settings.footer}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
