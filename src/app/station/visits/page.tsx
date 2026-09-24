"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Printer, Trash2, FileText, Search, Pencil, Download } from "lucide-react";
import {
  getVisits, getTests, getSettings, rangeLabel, flagFor, deleteVisits, previousResults,
  type StationVisit, type StationTest, type StationSettings,
} from "@/lib/station/store";
import { ReportSheet } from "@/components/station/ReportSheet";


export default function StationVisitsPage() {
  const [visits, setVisits] = useState<StationVisit[]>([]);
  const [tests, setTests] = useState<StationTest[]>([]);
  const [sel, setSel] = useState<StationVisit | null>(null);
  const [settings, setSettings] = useState<StationSettings>({ labName: "", labSubtitle: "" });
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => { setVisits(getVisits()); setTests(getTests()); setSettings(getSettings()); }, []);

  const byId = (id: string) => tests.find((t) => t.id === id);

  // Previous results for the reprinted visit (only when enabled in settings).
  const prev = useMemo(() => {
    if (!sel || settings.printPrevious !== true) return {};
    return previousResults(
      { patientId: sel.patientId, name: sel.patient.name, phone: sel.patient.phone },
      { before: sel.created_at, excludeId: sel.id },
    );
  }, [sel, settings.printPrevious]);
  const printPrev = !!sel && sel.results.some((r) => prev[r.testId]);
  const dayOf = (ms: number) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return visits.filter((v) => {
      if (term &&
        !v.patient.name.toLowerCase().includes(term) &&
        !(v.accession ?? "").toLowerCase().includes(term) &&
        !(v.patient.phone ?? "").toLowerCase().includes(term)) return false;
      const d = dayOf(v.created_at);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [visits, q, from, to]);

  function csvCell(v: unknown) {
    const s = v == null ? "" : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  }

  /** Export the selected visits (or all filtered) to CSV — one row per result. */
  function exportCsv() {
    const source = checked.size > 0 ? filtered.filter((v) => checked.has(v.id)) : filtered;
    if (source.length === 0) return;
    const header = ["التاريخ", "رقم العيّنة", "المريض", "الجنس", "العمر", "الهاتف", "الفحص", "النتيجة", "الوحدة", "المعدل الطبيعي", "الحالة"];
    const lines = [header.map(csvCell).join(",")];
    const flagText: Record<string, string> = { H: "مرتفع", L: "منخفض", N: "طبيعي" };
    for (const v of source) {
      const g = v.patient.gender === "male" ? "ذكر" : v.patient.gender === "female" ? "أنثى" : "";
      for (const r of v.results) {
        const t = byId(r.testId);
        const f = t ? flagFor(r.value, t.normal, v.patient.gender) : null;
        lines.push([
          dayOf(v.created_at), v.accession ?? "", v.patient.name, g, v.patient.age ?? "", v.patient.phone ?? "",
          r.name_ar, r.value, r.unit ?? "", t ? rangeLabel(t.normal, v.patient.gender, t.unit) : "", f ? flagText[f] : "",
        ].map(csvCell).join(","));
      }
    }
    const csv = "﻿" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `visits-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

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

  return (
    <div>
      <div className="no-print mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><FileText className="size-6" /> الزيارات المحفوظة</h1>
        <p className="mt-1 text-sm text-muted">محفوظة محلياً على هذا الحاسوب — ابحث، عدّل، أعد الطباعة، أو احذف مجموعة.</p>
      </div>

      {/* Toolbar: search + date range + export + bulk delete */}
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <div className="flex min-w-56 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3">
          <Search className="size-4 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث بالاسم أو رقم العيّنة أو الهاتف…"
            className="w-full bg-transparent py-2 text-sm outline-none"
          />
        </div>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="من تاريخ" className="rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="إلى تاريخ" className="rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand" />
        {(q || from || to) && (
          <button onClick={() => { setQ(""); setFrom(""); setTo(""); }} className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">مسح</button>
        )}
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas disabled:opacity-50"
        >
          <Download className="size-4" /> تصدير CSV{checked.size > 0 ? ` (${checked.size})` : ""}
        </button>
        {checked.size > 0 && (
          <button
            onClick={() => remove(Array.from(checked))}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            <Trash2 className="size-4" /> حذف المحدَّد ({checked.size})
          </button>
        )}
      </div>
      <div className="no-print mb-3 text-xs text-muted">النتائج: {filtered.length}{checked.size > 0 ? ` · المحدَّد: ${checked.size}` : ""}</div>

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
                <td className="px-4 py-3 text-muted whitespace-nowrap">{new Date(v.created_at).toLocaleString("ar-IQ-u-nu-latn")}</td>
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
          <div className="no-print mt-4 flex justify-center">
            <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
              <Printer className="size-4" /> طباعة
            </button>
          </div>
          <ReportSheet
            className="mt-4"
            settings={settings}
            date={new Date(sel.created_at).toISOString().slice(0, 10)}
            accession={sel.accession}
            patient={sel.patient}
            referrer={sel.referrer}
            rows={sel.results.map((r) => ({ key: r.testId, name: r.name_ar, value: r.value, unit: r.unit, test: byId(r.testId) }))}
            prev={prev}
            printPrev={printPrev}
            emptyText="لا نتائج"
          />
        </>
      )}
    </div>
  );
}
