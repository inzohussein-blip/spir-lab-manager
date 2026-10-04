"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, RefreshCw, Search, Printer, ArrowRight, Building2, AlertTriangle, Phone, Plus } from "lucide-react";
import { allRows, isNew, markSeen, refreshAll, labs, useDoctor, FETCH_ERRORS, type Row } from "@/lib/doctors/viewer";
import { WINDOW_LABEL } from "@/lib/doctors/code";
import { card, btn } from "@/components/sync/parts";
import { PageHead } from "@/components/sync/ui";
import { cn, fmtDate, fmtDateTime } from "@/lib/utils";
import { formPlain } from "@/lib/station/formPlain";

const DAY = 86_400_000;
type Period = "all" | "today" | "week" | "month";
const PERIODS: { id: Period; label: string }[] = [
  { id: "all", label: "الكل" }, { id: "today", label: "اليوم" }, { id: "week", label: "آخر أسبوع" }, { id: "month", label: "آخر شهر" },
];
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const sinceOf = (p: Period) => (p === "today" ? startOfToday() : p === "week" ? Date.now() - 7 * DAY : p === "month" ? Date.now() - 31 * DAY : 0);
const genderLabel = (g: string) => (g === "female" ? "أنثى" : g === "male" ? "ذكر" : g);
const flagged = (r: Row) => r.visit.results.filter((x) => x.flag === "H" || x.flag === "L" || x.hl).length;

/** «نتائج المراجعين»: the visits every lab shared, latest first; a visit opens as a report to print. */
export default function DoctorResults() {
  useDoctor();
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState<Period>("all");
  const [onlyNew, setOnlyNew] = useState(false);
  const [lab, setLab] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const list = labs();
  const rows = allRows();
  const since = sinceOf(period);
  const needle = q.trim().toLowerCase();
  const shown = rows.filter((r) => r.visit.at >= since && (!lab || r.lab.id === lab) && (!onlyNew || isNew(r))
    && (!needle || r.visit.patient.name.toLowerCase().includes(needle) || (r.visit.acc ?? "").toLowerCase().includes(needle)));
  const current = open ? rows.find((r) => r.key === open) : undefined;
  const lastFetch = Math.max(0, ...list.map((l) => l.fetchedAt ?? 0));

  async function refresh() { setBusy(true); await refreshAll(); setBusy(false); }

  if (current) return <Report row={current} onBack={() => setOpen(null)} />;

  return (
    <div className="space-y-5">
      <PageHead icon={<FileText />} title="نتائج المراجعين" sub={list.length ? `من ${list.length} مختبر${lastFetch ? ` · آخر تحديث ${fmtDateTime(lastFetch)}` : ""}` : "أضف رمز المختبر لترى نتائج مراجعيك"}>
        {list.length > 0 && (
          <button onClick={refresh} disabled={busy} className={cn(btn, "border border-line bg-surface hover:bg-canvas")} data-testid="doctor-refresh">
            <RefreshCw className={cn("size-4", busy && "animate-spin")} /> تحديث
          </button>
        )}
      </PageHead>

      {list.length === 0 ? (
        <section className={cn(card, "text-center")} data-testid="doctor-empty">
          <Building2 className="mx-auto size-10 text-brand" />
          <p className="mt-3 font-bold">لا مختبر مضاف بعد</p>
          <p className="mt-1 text-sm text-muted">اطلب من المختبر «رمز الطبيب» ثم أضفه هنا، فتظهر لك نتائج المراجعين الذين أرسلتهم.</p>
          <Link href="/doctor/labs" className={cn(btn, "mt-4 bg-brand text-white hover:bg-brand-dark")}><Plus className="size-4" /> إضافة رمز مختبر</Link>
        </section>
      ) : (
        <>
          {list.filter((l) => l.error && l.error !== "offline").map((l) => (
            <div key={l.id} role="alert" data-testid="lab-error" className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span><b>{l.name}</b>: {l.error === "not_found" ? "أوقف المختبر هذا الرمز أو لم يرفع النتائج بعد." : FETCH_ERRORS[l.error!] ?? FETCH_ERRORS.unreachable}</span>
            </div>
          ))}

          <section className={cn(card, "space-y-3")}>
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative min-w-52 flex-1">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="بحث باسم المراجع" placeholder="بحث باسم المراجع أو رقم العينة"
                  className="w-full rounded-lg border border-line bg-surface py-2 pe-3 ps-9 text-sm outline-none focus:border-brand" />
              </label>
              {list.length > 1 && (
                <select value={lab} onChange={(e) => setLab(e.target.value)} aria-label="المختبر" className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
                  <option value="">كل المختبرات</option>
                  {list.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="المدة">
              {PERIODS.map((p) => (
                <button key={p.id} onClick={() => setPeriod(p.id)} aria-pressed={period === p.id}
                  className={cn("rounded-full border px-3 py-1 text-xs font-semibold", period === p.id ? "border-brand bg-brand-light text-brand-dark" : "border-line text-muted hover:bg-canvas")}>{p.label}</button>
              ))}
              <label className="ms-auto flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} aria-label="الجديدة فقط" className="size-4 accent-[var(--color-brand)]" /> الجديدة فقط
              </label>
            </div>
          </section>

          {shown.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted" data-testid="doctor-no-results">
              {rows.length ? "لا نتائج تطابق البحث." : "لا نتائج بعد في المدة التي يعرضها المختبر."}
            </p>
          ) : (
            <ul className="space-y-2" data-testid="doctor-results">
              {shown.map((r) => {
                const fresh = isNew(r);
                const f = flagged(r);
                return (
                  <li key={r.key}>
                    <button onClick={() => { markSeen(r); setOpen(r.key); }} data-testid="doctor-visit" data-patient={r.visit.patient.name}
                      className={cn("flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border bg-surface px-4 py-3 text-start shadow-[var(--shadow-card)] hover:border-brand", fresh ? "border-brand" : "border-line")}>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 font-bold">
                          {r.visit.patient.name}
                          {fresh && <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-white" data-testid="visit-new">جديد</span>}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted">
                          {genderLabel(r.visit.patient.gender)}{r.visit.patient.age ? ` · ${r.visit.patient.age}` : ""}{list.length > 1 ? ` · ${r.lab.name}` : ""}{r.visit.acc ? ` · ${r.visit.acc}` : ""}
                        </span>
                      </span>
                      <span className="text-xs text-muted">{r.visit.results.length} نتيجة</span>
                      {f > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">{f} خارج المدى</span>}
                      <span className="text-xs text-muted">{fmtDateTime(r.visit.at)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-xs text-muted">
            {list.map((l) => l.snap ? `${l.name}: ${WINDOW_LABEL[l.snap.window]}` : null).filter(Boolean).join(" · ")}
          </p>
        </>
      )}
    </div>
  );
}

/** One visit as a report (the lab's name and footer), with print. */
function Report({ row, onBack }: { row: Row; onBack: () => void }) {
  const { visit: v, lab } = row;
  const s = lab.snap;
  const anyRange = v.results.some((r) => r.range);
  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center gap-2">
        <button onClick={onBack} className={cn(btn, "border border-line bg-surface hover:bg-canvas")}><ArrowRight className="size-4" /> رجوع</button>
        <button onClick={() => window.print()} className={cn(btn, "bg-brand text-white hover:bg-brand-dark")}><Printer className="size-4" /> طباعة</button>
      </div>
      <article className="mx-auto max-w-3xl rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-card)] print:border-0 print:shadow-none" data-testid="doctor-report">
        <header className="border-b-2 border-brand pb-3 text-center">
          <div className="text-xl font-bold">{s?.lab.name || lab.name}</div>
          {s?.lab.sub && <div className="text-sm text-muted">{s.lab.sub}</div>}
        </header>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
          <div><dt className="inline text-muted">المراجع: </dt><dd className="inline font-bold" data-testid="report-patient">{v.patient.name}</dd></div>
          <div><dt className="inline text-muted">الجنس: </dt><dd className="inline">{genderLabel(v.patient.gender)}</dd></div>
          {v.patient.age && <div><dt className="inline text-muted">العمر: </dt><dd className="inline">{v.patient.age}</dd></div>}
          <div><dt className="inline text-muted">التاريخ: </dt><dd className="inline">{fmtDate(v.at)}</dd></div>
          {v.acc && <div><dt className="inline text-muted">رقم العينة: </dt><dd className="inline" dir="ltr">{v.acc}</dd></div>}
          {s?.doctor && <div><dt className="inline text-muted">الطبيب: </dt><dd className="inline">{s.doctor}</dd></div>}
          {v.patient.phone && <div data-testid="report-phone"><dt className="inline text-muted"><Phone className="inline size-3.5" /> </dt><dd className="inline" dir="ltr">{v.patient.phone}</dd></div>}
        </dl>
        <table className="mt-5 w-full border-collapse text-sm" dir="ltr">
          <thead>
            <tr className="border-b border-line text-start text-xs text-muted">
              <th className="py-2 text-left">Test</th><th className="py-2 text-left">Result</th><th className="py-2 text-left">Unit</th>
              {anyRange && <th className="py-2 text-left">Normal range</th>}
            </tr>
          </thead>
          <tbody>
            {v.results.map((r, i) => (
              <tr key={i} className="border-b border-line/60" data-testid="report-result">
                <td className="py-1.5">{r.name}</td>
                <td className={cn("py-1.5 font-semibold", r.flag === "H" && "flag-H", r.flag === "L" && "flag-L", r.hl && "underline")}>
                  {formPlain(r.value)}{r.flag === "H" || r.flag === "L" ? ` ${r.flag}` : ""}
                </td>
                <td className="py-1.5 text-muted">{r.unit ?? ""}</td>
                {anyRange && <td className="py-1.5 text-muted">{r.range ?? ""}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        {s?.lab.footer && <footer className="mt-6 whitespace-pre-line border-t border-line pt-3 text-center text-xs text-muted">{s.lab.footer}</footer>}
        <p className="mt-3 text-center text-[11px] text-muted">نسخة للطبيب من «نافذة الأطباء» — التقرير الرسمي يصدر من المختبر.</p>
      </article>
    </div>
  );
}
