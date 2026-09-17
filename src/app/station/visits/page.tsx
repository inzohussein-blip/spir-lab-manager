"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Printer, Trash2, FileText, Search, Pencil } from "lucide-react";
import {
  getVisits, getTests, getSettings, rangeLabel, flagFor, deleteVisits,
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
  const [q, setQ] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => { setVisits(getVisits()); setTests(getTests()); setSettings(getSettings()); }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return visits;
    return visits.filter(
      (v) =>
        v.patient.name.toLowerCase().includes(term) ||
        (v.accession ?? "").toLowerCase().includes(term) ||
        (v.patient.phone ?? "").toLowerCase().includes(term)
    );
  }, [visits, q]);

  function refresh() { setVisits(getVisits()); }

  function remove(ids: string[]) {
    if (ids.length === 0) return;
    if (!window.confirm(ids.length === 1 ? "حذف هذه الزيارة؟" : `حذف ${ids.length} زيارة؟`)) return;
    deleteVisits(ids);
    refresh();
    setChecked((c) => { const n = new Set(c); ids.forEach((id) => n.delete(id)); return n; });
    if (sel && ids.includes(sel.id)) setSel(null);
  }

  function toggleCheck(id: string) {
    setChecked((c) => { const n = new Set(c); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  const allShownChecked = filtered.length > 0 && filtered.every((v) => checked.has(v.id));
  function toggleAll() {
    setChecked((c) => {
      const n = new Set(c);
      if (allShownChecked) filtered.forEach((v) => n.delete(v.id));
      else filtered.forEach((v) => n.add(v.id));
      return n;
    });
  }

  const byId = (id: string) => tests.find((t) => t.id === id);

  return (
    <div>
      <div className="no-print mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><FileText className="size-6" /> الزيارات المحفوظة</h1>
        <p className="mt-1 text-sm text-muted">محفوظة محلياً على هذا الحاسوب — ابحث، عدّل، أعد الطباعة، أو احذف مجموعة.</p>
      </div>

      {/* Toolbar: search + bulk delete */}
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3">
          <Search className="size-4 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث بالاسم أو رقم العيّنة أو الهاتف…"
            className="w-full bg-transparent py-2 text-sm outline-none"
          />
        </div>
        {checked.size > 0 && (
          <button
            onClick={() => remove(Array.from(checked))}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            <Trash2 className="size-4" /> حذف المحدَّد ({checked.size})
          </button>
        )}
      </div>

      <div className="no-print overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-right text-muted">
            <tr>
              <th className="px-4 py-3">
                <input type="checkbox" checked={allShownChecked} onChange={toggleAll} className="size-4 align-middle" aria-label="تحديد الكل" />
              </th>
              <th className="px-4 py-3 font-medium">التاريخ</th>
              <th className="px-4 py-3 font-medium">رقم العيّنة</th>
              <th className="px-4 py-3 font-medium">المريض</th>
              <th className="px-4 py-3 font-medium">الفحوصات</th>
              <th className="px-4 py-3 font-medium">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">{visits.length === 0 ? "لا زيارات محفوظة بعد" : "لا نتائج مطابقة"}</td></tr>
            )}
            {filtered.map((v) => (
              <tr key={v.id} className={`border-b border-line last:border-0 hover:bg-canvas ${checked.has(v.id) ? "bg-brand-light/40" : ""}`}>
                <td className="px-4 py-3">
                  <input type="checkbox" checked={checked.has(v.id)} onChange={() => toggleCheck(v.id)} className="size-4 align-middle" />
                </td>
                <td className="px-4 py-3 text-muted whitespace-nowrap">{new Date(v.created_at).toLocaleString("ar-IQ")}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted">{v.accession ?? "—"}</td>
                <td className="px-4 py-3 font-medium">{v.patient.name || "—"}</td>
                <td className="px-4 py-3">{v.results.length}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <button onClick={() => setSel(v)} className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1 text-xs hover:bg-canvas"><Printer className="size-3.5" /> عرض/طباعة</button>
                    <Link href={`/station?edit=${v.id}`} className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1 text-xs hover:bg-canvas"><Pencil className="size-3.5" /> تعديل</Link>
                    <button onClick={() => remove([v.id])} className="grid size-7 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50"><Trash2 className="size-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sel && (
        <>
          <style>{`@media print {
            @page { size: A4; margin: 0; }
            #report-sheet { min-height: 295mm; }
          }`}</style>
          <div className="no-print mt-4 flex justify-center">
            <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
              <Printer className="size-4" /> طباعة
            </button>
          </div>
          <div id="report-sheet" className="relative isolate mx-auto mt-4 flex max-w-[210mm] flex-col bg-white p-8 text-black shadow-sm print:mt-0 print:p-[14mm] print:shadow-none">
            {settings.logo && (
              <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={settings.logo} alt="" className="w-1/2 max-w-[110mm] opacity-[0.06]" />
              </div>
            )}
            <div className="flex items-center justify-between gap-4 pb-3">
              <div className="flex items-center gap-3">
                {settings.logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={settings.logo} alt="" className="size-20 object-contain" />
                )}
                <div>
                  <h2 className="text-2xl font-extrabold leading-tight" style={{ color: PURPLE }}>{settings.labName}</h2>
                  <p className="text-sm font-medium" style={{ color: GOLD_DARK }}>{settings.labSubtitle}</p>
                </div>
              </div>
              <div className="text-left text-xs text-gray-600">
                <div>التاريخ: {new Date(sel.created_at).toISOString().slice(0, 10)}</div>
                {sel.accession && <div className="font-mono font-bold" style={{ color: PURPLE }}>{sel.accession}</div>}
              </div>
            </div>
            <div className="h-1 w-full rounded" style={{ background: `linear-gradient(90deg, ${GOLD} 0%, ${PURPLE} 50%, ${GOLD} 100%)`, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties} />

            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-lg border-2 p-3 text-sm sm:grid-cols-3" style={{ borderColor: GOLD }}>
              <div><span style={{ color: PURPLE }} className="font-semibold">المريض:</span> <b>{sel.patient.name || "—"}</b></div>
              <div><span style={{ color: PURPLE }} className="font-semibold">الجنس:</span> {sel.patient.gender === "male" ? "ذكر" : sel.patient.gender === "female" ? "أنثى" : "—"}</div>
              <div><span style={{ color: PURPLE }} className="font-semibold">العمر:</span> {sel.patient.age || "—"}</div>
              {sel.referrer && <div><span style={{ color: PURPLE }} className="font-semibold">الطبيب المُحيل:</span> {sel.referrer}</div>}
            </div>

            <div className="mt-5 flex items-center gap-2">
              <span className="h-5 w-1.5 rounded" style={{ background: GOLD, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties} />
              <span className="text-sm font-bold" style={{ color: PURPLE }}>نتائج الفحوصات</span>
            </div>
            <div className="mt-2 overflow-hidden rounded-lg border" style={{ borderColor: GOLD }}>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-right text-xs text-white" style={{ background: PURPLE, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                    <th className="px-3 py-2.5 font-semibold">الفحص</th>
                    <th className="px-3 py-2.5 font-semibold">النتيجة</th>
                    <th className="px-3 py-2.5 font-semibold">الوحدة</th>
                    <th className="px-3 py-2.5 font-semibold">المعدل الطبيعي</th>
                    <th className="px-3 py-2.5 font-semibold">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {sel.results.map((r, i) => {
                    const t = byId(r.testId);
                    const f = t ? flagFor(r.value, t.normal, sel.patient.gender) : null;
                    const abn = f === "H" || f === "L";
                    return (
                      <tr key={i} style={{ background: i % 2 ? "#f7f3fb" : "#ffffff", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                        <td className="px-3 py-2 font-medium">{r.name_ar}</td>
                        <td className={`px-3 py-2 tabular-nums ${abn ? "font-bold" : "font-semibold"}`} style={abn ? { color: f === "H" ? "#b91c1c" : "#1d4ed8" } : undefined}>{r.value || "—"}</td>
                        <td className="px-3 py-2 text-gray-600">{r.unit || "—"}</td>
                        <td className="px-3 py-2 text-gray-600">{t ? rangeLabel(t.normal, sel.patient.gender, t.unit) : "—"}</td>
                        <td className="px-3 py-2">
                          {f === "H" ? <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: "#b91c1c", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>مرتفع H</span>
                            : f === "L" ? <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: "#1d4ed8", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>منخفض L</span>
                            : f === "N" ? <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: "#e7f6ef", color: "#127a4f", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>طبيعي</span>
                            : <span className="text-gray-400">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-auto">
              <div className="mt-10 flex items-end justify-between text-xs text-gray-600">
                <div>
                  <div className="mb-6">اعتمد النتائج:</div>
                  <div className="w-48 border-t pt-1 text-center text-gray-500" style={{ borderColor: GOLD }}>التوقيع / الختم</div>
                </div>
                {sel.accession && (
                  <div className="text-center">
                    <Barcode text={sel.accession} className="block h-8 w-40" />
                    <div className="font-mono text-[10px] text-gray-500">{sel.accession}</div>
                  </div>
                )}
              </div>
              {settings.footer && (
                <div
                  className="mt-4 rounded-md px-4 py-2 text-center text-xs font-medium text-white"
                  style={{ background: PURPLE, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}
                >
                  {settings.footer}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
