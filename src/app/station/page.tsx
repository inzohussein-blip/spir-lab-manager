"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, Printer, Save, Check, Beaker, Layers, Pencil, UserRound, StickyNote } from "lucide-react";
import {
  getTests, addVisit, updateVisit, getVisit, getSettings, getPanels, nextAccession, uid, rangeLabel, flagFor,
  getPatients, getPatient, upsertPatient, addPatientNote, deductStockForTests,
  type StationTest, type Gender, type StationVisit, type StationSettings, type StationPanel, type StationPatient, type NoteEntry,
} from "@/lib/station/store";
import { Barcode } from "@/components/station/Barcode";

const inp =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

// Lab identity colours (from the printed letterhead): purple + gold.
const PURPLE = "#5a2a82";
const GOLD = "#c9a227";
const GOLD_DARK = "#9c7c1e";

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

function StationEntryPage() {
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
  const [editId, setEditId] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<number | null>(null);

  // Recurring-patient linkage + notes
  const [patients, setPatients] = useState<StationPatient[]>([]);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientNotes, setPatientNotes] = useState<NoteEntry[]>([]);
  const [newNote, setNewNote] = useState("");
  const [pq, setPq] = useState("");

  const searchParams = useSearchParams();

  useEffect(() => {
    const catalog = getTests();
    setTests(catalog);
    setSettings(getSettings());
    setPanels(getPanels());
    setPatients(getPatients());

    // Editing an existing saved visit (?edit=<id>) — preload its fields.
    const eid = searchParams.get("edit");
    if (eid) {
      const v = getVisit(eid);
      if (v) {
        setEditId(v.id);
        setCreatedAt(v.created_at);
        setAccession(v.accession ?? "");
        if (v.patientId) loadPatient(v.patientId);
        setName(v.patient.name);
        setGender(v.patient.gender);
        setAge(v.patient.age ?? "");
        setPhone(v.patient.phone ?? "");
        setReferrer(v.referrer ?? "");
        const ids = new Set(v.results.map((r) => r.testId).filter((id) => catalog.some((t) => t.id === id)));
        setSelected(ids);
        const rmap: Record<string, string> = {};
        v.results.forEach((r) => { rmap[r.testId] = r.value; });
        setResults(rmap);
      }
      return;
    }
    // New visit for an existing patient (?patient=<id>) — prefill their info.
    const pid = searchParams.get("patient");
    if (pid) prefillPatient(pid);
  }, [searchParams]);

  function loadPatient(id: string) {
    const p = getPatient(id);
    if (p) { setPatientId(p.id); setPatientNotes(p.notes); }
  }
  function prefillPatient(id: string) {
    const p = getPatient(id);
    if (!p) return;
    setPatientId(p.id);
    setPatientNotes(p.notes);
    setName(p.name); setGender(p.gender); setAge(p.age ?? ""); setPhone(p.phone ?? "");
    setPq("");
  }

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
    if (!name.trim()) return;
    // Link (or create) the patient record and persist any new note.
    const pid = upsertPatient({ id: patientId ?? undefined, name: name.trim(), gender, age, phone });
    setPatientId(pid);
    if (newNote.trim()) { addPatientNote(pid, newNote); setNewNote(""); }
    setPatients(getPatients());
    setPatientNotes(getPatient(pid)?.notes ?? []);

    const v: StationVisit = {
      id: editId ?? uid(),
      created_at: createdAt ?? Date.now(),
      accession: acc || accession || undefined,
      patientId: pid,
      patient: { name: name.trim(), gender, age, phone },
      referrer: referrer.trim() || undefined,
      results: chosen.map((t) => ({
        testId: t.id, name_ar: t.name_ar, value: results[t.id] ?? "", unit: t.unit,
      })),
    };
    if (editId) {
      updateVisit(v);
    } else {
      addVisit(v);
      setEditId(v.id);
      setCreatedAt(v.created_at);
      // Deduct one unit of stock per linked test — only on a new visit.
      deductStockForTests(Array.from(selected));
    }
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
      {/* Page size for print — margin 0 drops the browser's URL/date header;
          the sheet fills the whole page so the footer pins to the bottom and
          the watermark centres on the page. */}
      <style>{`@media print {
        @page { size: ${paper}; margin: 0; }
        #report-sheet { min-height: ${paper === "A5" ? "208mm" : "295mm"}; }
      }`}</style>

      {/* ── Entry form (screen only) ─────────────────────────────────────────── */}
      <div className="no-print">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              {editId && <Pencil className="size-5 text-brand-dark" />}
              {editId ? "تعديل زيارة محفوظة" : "إدخال وطباعة النتائج"}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {editId
                ? "عدّل البيانات ثم احفظ — سيُحدَّث نفس السجل."
                : "أدخل بيانات المريض ونتائج فحوصاته ثم اطبعها — يعمل بدون إنترنت."}
            </p>
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
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold">بيانات المريض</div>
                {patientId && <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-brand-dark">مراجع مسجّل</span>}
              </div>

              {/* Search previous patients */}
              {!editId && (
                <div className="relative mb-3">
                  <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                  <input
                    value={pq}
                    onChange={(e) => setPq(e.target.value)}
                    placeholder="ابحث عن مراجع سابق بالاسم أو الهاتف…"
                    className={`${inp} pr-9`}
                  />
                  {pq.trim() && (
                    <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-line bg-surface shadow-[var(--shadow-pop)]">
                      {patients
                        .filter((p) => p.name.toLowerCase().includes(pq.trim().toLowerCase()) || (p.phone ?? "").includes(pq.trim()))
                        .slice(0, 20)
                        .map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => prefillPatient(p.id)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-right text-sm hover:bg-canvas"
                          >
                            <UserRound className="size-4 text-muted" />
                            <span className="flex-1 truncate font-medium">{p.name}</span>
                            {p.phone && <span className="text-xs text-muted">{p.phone}</span>}
                          </button>
                        ))}
                      {patients.filter((p) => p.name.toLowerCase().includes(pq.trim().toLowerCase()) || (p.phone ?? "").includes(pq.trim())).length === 0 && (
                        <div className="px-3 py-2 text-xs text-muted">لا مراجع مطابق — سيُسجَّل كجديد عند الحفظ</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium sm:col-span-2">
                  الاسم الثلاثي *
                  <input
                    value={name}
                    onChange={(e) => { setName(e.target.value); if (patientId && !editId) { setPatientId(null); setPatientNotes([]); } }}
                    className={`mt-1 ${inp}`}
                  />
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

              {/* Patient notes (previous + add) */}
              <div className="mt-4 border-t border-line pt-4">
                <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><StickyNote className="size-4" /> ملاحظات المريض</div>
                {patientNotes.length > 0 && (
                  <div className="mb-2 flex max-h-28 flex-col gap-1.5 overflow-y-auto">
                    {patientNotes.map((n, i) => (
                      <div key={i} className="rounded-lg bg-canvas px-3 py-1.5 text-xs">
                        <span className="text-[10px] text-muted">{new Date(n.ts).toLocaleDateString("ar-IQ")}: </span>
                        {n.text}
                      </div>
                    ))}
                  </div>
                )}
                <input
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="أضف ملاحظة عن الحالة (تُحفظ مع المريض عند الحفظ)…"
                  className={inp}
                />
              </div>
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
      <div id="report-sheet" className="relative isolate mx-auto mt-6 flex max-w-[210mm] flex-col bg-white p-8 text-black shadow-sm print:mt-0 print:p-[14mm] print:shadow-none">
        {/* Faint centered logo watermark (centres over the whole page) */}
        {settings.logo && (
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={settings.logo} alt="" className="w-1/2 max-w-[110mm] opacity-[0.06]" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties} />
          </div>
        )}

        {/* Letterhead — purple/gold identity */}
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
            <div>التاريخ: {today}</div>
            {accession && <div className="font-mono font-bold" style={{ color: PURPLE }}>{accession}</div>}
          </div>
        </div>
        {/* Gold rule with a purple center accent */}
        <div className="h-1 w-full rounded" style={{ background: `linear-gradient(90deg, ${GOLD} 0%, ${PURPLE} 50%, ${GOLD} 100%)`, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties} />

        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-lg border-2 p-3 text-sm sm:grid-cols-3" style={{ borderColor: GOLD }}>
          <div><span style={{ color: PURPLE }} className="font-semibold">المريض:</span> <b>{name || "—"}</b></div>
          <div><span style={{ color: PURPLE }} className="font-semibold">الجنس:</span> {gender === "male" ? "ذكر" : gender === "female" ? "أنثى" : "—"}</div>
          <div><span style={{ color: PURPLE }} className="font-semibold">العمر:</span> {age || "—"}</div>
          <div><span style={{ color: PURPLE }} className="font-semibold">الهاتف:</span> {phone || "—"}</div>
          {referrer && <div><span style={{ color: PURPLE }} className="font-semibold">الطبيب المُحيل:</span> {referrer}</div>}
        </div>

        {/* Results */}
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
              {chosen.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-gray-400">لم تُختَر فحوصات بعد</td></tr>
              )}
              {chosen.map((t, idx) => {
                const f = flagFor(results[t.id] ?? "", t.normal, gender);
                const abn = f === "H" || f === "L";
                return (
                  <tr key={t.id} className="align-top" style={{ background: idx % 2 ? "#f7f3fb" : "#ffffff", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                    <td className="px-3 py-2 font-medium">{t.name_ar}</td>
                    <td className={`px-3 py-2 tabular-nums ${abn ? "font-bold" : "font-semibold"}`} style={abn ? { color: f === "H" ? "#b91c1c" : "#1d4ed8" } : undefined}>{results[t.id] || "—"}</td>
                    <td className="px-3 py-2 text-gray-600">{t.unit || "—"}</td>
                    <td className="px-3 py-2 text-gray-600">{rangeLabel(t.normal, gender, t.unit)}</td>
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

        {/* Bottom group — pinned to the page bottom */}
        <div className="mt-auto">
          <div className="mt-10 flex items-end justify-between text-xs text-gray-600">
            <div>
              <div className="mb-6">اعتمد النتائج:</div>
              <div className="w-48 border-t pt-1 text-center text-gray-500" style={{ borderColor: GOLD }}>التوقيع / الختم</div>
            </div>
            {accession && (
              <div className="text-center">
                <Barcode text={accession} className="block h-8 w-40" />
                <div className="font-mono text-[10px] text-gray-500">{accession}</div>
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
    </div>
  );
}

export default function StationEntryPageWrapper() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted">جارٍ التحميل…</div>}>
      <StationEntryPage />
    </Suspense>
  );
}
