"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Printer, Save, Check, Beaker, Layers } from "lucide-react";
import {
  getTests, addVisit, getSettings, getPanels, nextAccession, uid, rangeLabel, flagFor,
  type StationTest, type Gender, type StationVisit, type StationSettings, type StationPanel,
} from "@/lib/station/store";
import { Barcode } from "@/components/station/Barcode";

const inp =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

function FlagPill({ f }: { f: "H" | "L" | "N" | null }) {
  if (!f) return null;
  const m = {
    H: "bg-red-50 text-red-600",
    L: "bg-blue-50 text-blue-600",
    N: "bg-teal-50 text-brand-dark",
  }[f];
  const t = { H: "مرتفع", L: "منخفض", N: "طبيعي" }[f];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${m}`}>{f} {t}</span>;
}

export default function StationEntryPage() {
  const [tests, setTests] = useState<StationTest[]>([]);
  const [panels, setPanels] = useState<StationPanel[]>([]);
  const [accession, setAccession] = useState("");
  const [settings, setSettings] = useState<StationSettings>({ labName: "", labSubtitle: "" });
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>("");
  const [age, setAge] = useState("");
  const [phone, setPhone] = useState("");
  const [referrer, setReferrer] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [paper, setPaper] = useState<"A4" | "A5">("A4");
  const [savedNote, setSavedNote] = useState(false);

  useEffect(() => {
    setTests(getTests());
    setSettings(getSettings());
    setPanels(getPanels());
  }, []);

  function addPanel(p: StationPanel) {
    setSelected((s) => {
      const n = new Set(s);
      p.testIds.forEach((id) => n.add(id));
      return n;
    });
  }

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const map = new Map<string, StationTest[]>();
    for (const t of tests) {
      if (term && !t.name_ar.toLowerCase().includes(term) && !(t.name_en ?? "").toLowerCase().includes(term))
        continue;
      const k = t.category?.trim() || "فحوصات أخرى";
      (map.get(k) ?? map.set(k, []).get(k)!).push(t);
    }
    return Array.from(map.entries());
  }, [tests, q]);

  const chosen = tests.filter((t) => selected.has(t.id));

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function saveVisit(acc?: string) {
    const v: StationVisit = {
      id: uid(),
      created_at: Date.now(),
      accession: acc || accession || undefined,
      patient: { name: name.trim(), gender, age, phone },
      referrer: referrer.trim() || undefined,
      results: chosen.map((t) => ({
        testId: t.id, name_ar: t.name_ar, value: results[t.id] ?? "", unit: t.unit,
      })),
    };
    addVisit(v);
  }

  function onPrint() {
    if (!name.trim() || chosen.length === 0) {
      alert("أدخل اسم المريض واختر فحصاً واحداً على الأقل.");
      return;
    }
    const acc = accession || nextAccession();
    setAccession(acc);
    saveVisit(acc);
    setSavedNote(true);
    setTimeout(() => window.print(), 80);
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      {/* Page size for print */}
      <style>{`@media print { @page { size: ${paper}; margin: 12mm; } }`}</style>

      {/* ── Entry form (screen only) ─────────────────────────────────────────── */}
      <div className="no-print">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">إدخال وطباعة النتائج</h1>
            <p className="mt-1 text-sm text-muted">أدخل بيانات المريض ونتائج فحوصاته ثم اطبعها — يعمل بدون إنترنت.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-line text-sm">
              {(["A4", "A5"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPaper(p)}
                  className={`px-3 py-1.5 ${paper === p ? "bg-brand text-white" : "hover:bg-canvas"}`}
                >
                  {p}
                </button>
              ))}
            </div>
            <button onClick={() => saveVisit()} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">
              <Save className="size-4" /> حفظ
            </button>
            <button onClick={onPrint} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
              <Printer className="size-4" /> طباعة {paper}
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          {/* Patient + tests */}
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
              <div className="mb-3 text-sm font-semibold">بيانات المريض</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium sm:col-span-2">
                  الاسم الثلاثي *
                  <input value={name} onChange={(e) => setName(e.target.value)} className={`mt-1 ${inp}`} />
                </label>
                <label className="text-sm font-medium">
                  الجنس
                  <select value={gender} onChange={(e) => setGender(e.target.value as Gender)} className={`mt-1 ${inp}`}>
                    <option value="">—</option>
                    <option value="male">ذكر</option>
                    <option value="female">أنثى</option>
                  </select>
                </label>
                <label className="text-sm font-medium">
                  العمر
                  <input value={age} onChange={(e) => setAge(e.target.value)} inputMode="numeric" className={`mt-1 ${inp}`} />
                </label>
                <label className="text-sm font-medium">
                  رقم الهاتف
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className={`mt-1 ${inp}`} />
                </label>
                <label className="text-sm font-medium">
                  الطبيب المُحيل
                  <input value={referrer} onChange={(e) => setReferrer(e.target.value)} className={`mt-1 ${inp}`} />
                </label>
              </div>
              {gender === "" && chosen.some((t) => t.normal.kind === "sex") && (
                <p className="mt-2 text-xs text-amber-700">حدّد الجنس لعرض المعدل الطبيعي الصحيح لبعض الفحوصات.</p>
              )}
            </div>

            <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold">اختيار الفحوصات</div>
                <span className="text-xs text-muted">{selected.size} محدَّد</span>
              </div>
              {panels.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-xs text-muted"><Layers className="size-3.5" /> باقات:</span>
                  {panels.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addPanel(p)}
                      className="rounded-full border border-line px-2.5 py-1 text-xs hover:bg-brand-light/60"
                    >
                      {p.name} ({p.testIds.length})
                    </button>
                  ))}
                </div>
              )}
              <div className="relative mb-3">
                <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن فحص…" className={`${inp} pr-9`} />
              </div>
              {tests.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">لا توجد فحوصات. أضِفها من «إدارة الفحوصات».</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {groups.map(([cat, items]) => (
                    <div key={cat}>
                      <div className="mb-1.5 text-xs font-semibold text-muted">{cat}</div>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {items.map((t) => {
                          const on = selected.has(t.id);
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => toggle(t.id)}
                              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-right text-sm transition-colors ${on ? "border-brand bg-brand-light/60" : "border-line hover:bg-canvas"}`}
                            >
                              <span className={`grid size-4 shrink-0 place-items-center rounded border ${on ? "border-brand bg-brand text-white" : "border-line"}`}>
                                {on && <Check className="size-3" strokeWidth={3} />}
                              </span>
                              <span className="flex-1 truncate">{t.name_ar}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Results entry for the chosen tests */}
          <div className="lg:sticky lg:top-4 lg:self-start">
            <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Beaker className="size-4" /> إدخال النتائج
              </div>
              {chosen.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">اختر فحوصاً لإدخال نتائجها.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {chosen.map((t) => {
                    const f = flagFor(results[t.id] ?? "", t.normal, gender);
                    return (
                      <div key={t.id}>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{t.name_ar}</span>
                          <FlagPill f={f} />
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            value={results[t.id] ?? ""}
                            onChange={(e) => setResults((r) => ({ ...r, [t.id]: e.target.value }))}
                            placeholder="النتيجة"
                            className={`${inp} text-base font-semibold`}
                          />
                          {t.unit && <span className="shrink-0 text-xs text-muted">{t.unit}</span>}
                        </div>
                        <div className="mt-1 text-xs text-muted">
                          المعدل الطبيعي: {rangeLabel(t.normal, gender, t.unit)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {savedNote && (
                <p className="mt-3 text-xs text-brand-dark">تم حفظ الزيارة محلياً.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Printable report (A4/A5) ─────────────────────────────────────────── */}
      <div id="report-sheet" className="mx-auto mt-6 max-w-[210mm] bg-white p-8 text-black shadow-sm print:mt-0 print:p-0 print:shadow-none">
        <div className="flex items-start justify-between border-b-2 border-teal-700 pb-3">
          <div className="flex items-center gap-3">
            {settings.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.logo} alt="" className="size-12 object-contain" />
            )}
            <div>
              <h2 className="text-xl font-bold text-teal-800">{settings.labName}</h2>
              <p className="text-sm text-gray-600">{settings.labSubtitle}</p>
            </div>
          </div>
          <div className="text-left text-xs text-gray-600">
            <div>التاريخ: {today}</div>
            {accession && <div className="font-mono">{accession}</div>}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg bg-gray-50 p-3 text-sm sm:grid-cols-3 print:bg-white">
          <div><span className="text-gray-500">المريض:</span> <b>{name || "—"}</b></div>
          <div><span className="text-gray-500">الجنس:</span> {gender === "male" ? "ذكر" : gender === "female" ? "أنثى" : "—"}</div>
          <div><span className="text-gray-500">العمر:</span> {age || "—"}</div>
          <div><span className="text-gray-500">الهاتف:</span> {phone || "—"}</div>
          {referrer && <div><span className="text-gray-500">الطبيب المُحيل:</span> {referrer}</div>}
        </div>

        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-right text-xs text-gray-500">
              <th className="py-2 font-medium">الفحص</th>
              <th className="py-2 font-medium">النتيجة</th>
              <th className="py-2 font-medium">الوحدة</th>
              <th className="py-2 font-medium">المعدل الطبيعي</th>
              <th className="py-2 font-medium">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {chosen.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-gray-400">لم تُختَر فحوصات بعد</td></tr>
            )}
            {chosen.map((t) => {
              const f = flagFor(results[t.id] ?? "", t.normal, gender);
              return (
                <tr key={t.id} className="border-b border-gray-100 align-top">
                  <td className="py-2 font-medium">{t.name_ar}</td>
                  <td className={`py-2 ${f === "H" || f === "L" ? "font-bold" : ""}`}>{results[t.id] || "—"}</td>
                  <td className="py-2 text-gray-600">{t.unit || "—"}</td>
                  <td className="py-2 text-gray-600">{rangeLabel(t.normal, gender, t.unit)}</td>
                  <td className="py-2">
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

        <div className="mt-10 flex items-end justify-between text-xs text-gray-600">
          <div>
            <div className="mb-6">اعتمد النتائج:</div>
            <div className="w-48 border-t border-gray-400 pt-1 text-center text-gray-500">التوقيع / الختم</div>
          </div>
          {accession && (
            <div className="text-center">
              <Barcode text={accession} className="block h-8 w-40" />
              <div className="font-mono text-[10px] text-gray-500">{accession}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
