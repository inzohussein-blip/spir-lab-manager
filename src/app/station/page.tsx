"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Printer, Save, Check, Beaker, Layers, Pencil, UserRound, StickyNote, Plus, X, RotateCcw, ListChecks, ChevronDown, type LucideIcon } from "lucide-react";
import {
  getTests, addVisit, updateVisit, getVisit, getSettings, getPanels, nextAccession, uid, rangeLabel, flagFor,
  getPatients, getPatient, upsertPatient, addPatientNote, deductStockForTests, getDoctors, addDoctor,
  previousResults, resultDelta, localYmd,
  type StationTest, type Gender, type StationVisit, type StationSettings, type StationPanel, type StationPatient, type NoteEntry, type StationDoctor,
} from "@/lib/station/store";
import { ReportSheet } from "@/components/station/ReportSheet";
import { computeDerived } from "@/lib/station/derived";
import { useToast } from "@/components/station/Toast";

const inp =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";


function FlagPill({ f }: { f: "H" | "L" | "N" | null }) {
  if (!f) return null;
  const m = {
    H: "bg-red-50 text-red-600",
    L: "bg-blue-50 text-blue-600",
    N: "bg-teal-50 text-brand-dark",
  }[f];
  return <span className={`grid size-6 place-items-center rounded-full text-xs font-bold ${m}`}>{f}</span>;
}

const ymd = (ms: number) => new Date(ms).toLocaleDateString("en-CA");

/** Previous result + direction of change, shown to the examiner only. */
function PrevLine({ prev, current }: { prev: { value: string; at: number }; current: string }) {
  const d = resultDelta(current, prev.value);
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
      <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-line bg-canvas px-2.5 py-0.5 text-muted">
        <span className="font-semibold text-ink">السابق:</span>
        <b className="tabular-nums text-ink">{prev.value}</b>
        <span className="tabular-nums">· {ymd(prev.at)}</span>
      </span>
      {d != null && d !== 0 && (
        <span dir="ltr" className={`rounded-full px-2 py-0.5 font-bold tabular-nums ${d > 0 ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"}`}>
          {d > 0 ? `+${d} ▲` : `${d} ▼`}
        </span>
      )}
    </div>
  );
}

/** Serialized form state used to detect unsaved changes. */
function formSnapshot(
  f: { name: string; gender: Gender; age: string; phone: string; referrer: string },
  selected: Set<string>, results: Record<string, string>, tests: StationTest[],
): string {
  const chosen = tests.filter((t) => selected.has(t.id));
  return JSON.stringify([f.name.trim(), f.gender, f.age, f.phone, f.referrer, Array.from(selected).sort(), chosen.map((t) => results[t.id] ?? "")]);
}

/** Card header — icon tile + title + hint, matching the sidebar style. */
function PanelTitle({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-light text-brand-dark">
        <Icon className="size-4" />
      </span>
      <div className="leading-tight">
        <div className="text-sm font-bold">{title}</div>
        {hint && <div className="text-[11px] text-muted">{hint}</div>}
      </div>
    </div>
  );
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
  const [openCats, setOpenCats] = useState<Set<string>>(new Set()); // collapsible groups
  const [paper, setPaper] = useState<"A4" | "A5">("A4");
  const [justSaved, setJustSaved] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<number | null>(null);
  // Today's date is read in the browser (a page saved for offline use keeps no stale date).
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => setNowMs(Date.now()), []);

  // Recurring-patient linkage + notes
  const [patients, setPatients] = useState<StationPatient[]>([]);
  const [doctors, setDoctors] = useState<StationDoctor[]>([]);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientNotes, setPatientNotes] = useState<NoteEntry[]>([]);
  const [newNote, setNewNote] = useState("");

  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const nameRef = useRef<HTMLInputElement>(null);
  // Snapshot of the form as last saved/loaded — drives the unsaved-changes guard.
  const [baseline, setBaseline] = useState("");

  useEffect(() => {
    const catalog = getTests();
    setTests(catalog);
    setSettings(getSettings());
    setPanels(getPanels());
    setPatients(getPatients());
    setDoctors(getDoctors());

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
        setBaseline(formSnapshot(
          { name: v.patient.name, gender: v.patient.gender, age: v.patient.age ?? "", phone: v.patient.phone ?? "", referrer: v.referrer ?? "" },
          ids, rmap, catalog,
        ));
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
  }

  function quickAddDoctor() {
    const nm = window.prompt("اسم الطبيب المُحيل:");
    if (!nm || !nm.trim()) return;
    const d = addDoctor(nm.trim());
    setDoctors(getDoctors());
    setReferrer(d.name);
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

  // Instant previous-patient suggestions shown under the name field.
  const nameMatches = useMemo(() => {
    const term = name.trim().toLowerCase();
    if (editId || patientId || term.length < 2) return [];
    return patients.filter((p) => p.name.toLowerCase().includes(term)).slice(0, 8);
  }, [patients, name, editId, patientId]);

  // Previous results for the linked patient (or the visit being edited).
  const [savedTick, setSavedTick] = useState(0);
  const prev = useMemo(() => {
    if (!patientId && !editId) return {};
    return previousResults({ patientId, name, phone }, { before: createdAt ?? undefined, excludeId: editId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, editId, createdAt, savedTick]);
  const showPrev = settings.showPrevious !== false;
  const printPrev = settings.printPrevious === true && chosen.some((t) => prev[t.id]);

  // Chosen tests still missing a result value — used for incomplete-entry protection.
  // Optional: auto-calculated derived tests (Settings). A value typed by hand is never overwritten.
  const [autoVals, setAutoVals] = useState<Record<string, string>>({});
  const derived = useMemo(
    () => (settings.autoDerived
      ? computeDerived(chosen, results, { egfr: settings.derivedEgfr === true, sampson: settings.derivedSampson === true, age, gender })
      : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.autoDerived, settings.derivedEgfr, settings.derivedSampson, age, gender, selected, tests, results]
  );
  useEffect(() => {
    if (!settings.autoDerived) return;
    const nextRes: Record<string, string> = {};
    const nextAuto = { ...autoVals };
    let changed = false;
    for (const [id, d] of Object.entries(derived)) {
      const cur = results[id] ?? "";
      if ((cur === "" || cur === autoVals[id]) && cur !== d.value) { nextRes[id] = d.value; nextAuto[id] = d.value; changed = true; }
    }
    // Inputs removed → clear a value we filled ourselves.
    for (const id of Object.keys(autoVals)) {
      if (id in derived) continue;
      if ((results[id] ?? "") === autoVals[id]) nextRes[id] = "";
      delete nextAuto[id]; changed = true;
    }
    if (changed) { setResults((r) => ({ ...r, ...nextRes })); setAutoVals(nextAuto); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derived]);

  const missingResults = chosen.filter((t) => !(results[t.id] ?? "").trim());
  const filledCount = chosen.length - missingResults.length;

  // Unsaved-changes tracking (note field is checked separately — it clears on save).
  const snapshot = formSnapshot({ name, gender, age, phone, referrer }, selected, results, tests);
  const unsaved = (!!name.trim() || selected.size > 0) && (snapshot !== baseline || !!newNote.trim());

  function resetForm() {
    if (unsaved && !window.confirm("توجد بيانات غير محفوظة — هل تريد بدء زيارة جديدة وتجاهلها؟")) return;
    setEditId(null); setCreatedAt(null); setAccession("");
    setPatientId(null); setPatientNotes([]); setNewNote("");
    setName(""); setGender(""); setAge(""); setPhone(""); setReferrer("");
    setSelected(new Set()); setResults({}); setQ(""); setBaseline("");
    if (searchParams.get("edit") || searchParams.get("patient")) router.replace("/station");
    nameRef.current?.focus();
  }

  function requireName(): boolean {
    if (name.trim()) return true;
    toast.show("أدخل اسم المريض أولاً", "warn");
    nameRef.current?.focus();
    return false;
  }

  function onSave() {
    if (!requireName()) return;
    const wasEdit = !!editId;
    if (!saveVisit()) return;
    toast.show(wasEdit ? "تم تحديث الزيارة" : "تم حفظ الزيارة محلياً");
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1600);
  }

  // Enter in a result field jumps to the next one.
  function focusNextResult(idx: number) {
    const next = document.querySelector<HTMLInputElement>(`[data-result-idx="${idx + 1}"]`);
    if (next) { next.focus(); next.select(); }
  }

  // Keyboard shortcuts: Ctrl+S save, Ctrl+P print (uses the guarded print flow).
  // e.code keeps them working on an Arabic keyboard layout too.
  const actions = useRef({ onSave, onPrint });
  actions.current = { onSave, onPrint };
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      if (e.code === "KeyS") { e.preventDefault(); actions.current.onSave(); }
      else if (e.code === "KeyP") { e.preventDefault(); actions.current.onPrint(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  /** Returns false (and warns) when the browser storage refused the save. */
  function saveVisit(acc?: string): boolean {
    if (!name.trim()) return false;
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
    const stored = editId ? updateVisit(v) : addVisit(v);
    if (!stored) {
      toast.show("تعذّر الحفظ: مساحة التخزين في المتصفح ممتلئة — خذ نسخة احتياطية واحذف زيارات قديمة من «الزيارات المحفوظة».", "warn");
      return false;
    }
    if (!editId) {
      setEditId(v.id);
      setCreatedAt(v.created_at);
      // Deduct one unit of stock per linked test — only on a new visit.
      deductStockForTests(Array.from(selected));
    }
    setBaseline(snapshot);
    setSavedTick((n) => n + 1);
    return true;
  }

  function onPrint() {
    if (!requireName()) return;
    if (chosen.length === 0) {
      toast.show("اختر فحصاً واحداً على الأقل", "warn");
      return;
    }
    // Incomplete-entry protection: warn before printing a sheet with blank results.
    if (missingResults.length > 0) {
      const names = missingResults.map((t) => `• ${t.name_ar}`).join("\n");
      const ok = window.confirm(
        `${missingResults.length} فحص بدون نتيجة:\n${names}\n\nهل تريد الطباعة رغم ذلك؟`
      );
      if (!ok) return;
    }
    const acc = accession || nextAccession();
    setAccession(acc);
    if (!saveVisit(acc)) return;
    toast.show("تم الحفظ — جارٍ فتح نافذة الطباعة");
    setTimeout(() => window.print(), 80);
  }

  // Local date (not UTC); an edited visit keeps its original date on reprint.
  const today = createdAt ? localYmd(createdAt) : nowMs ? localYmd(nowMs) : "";

  return (
    <div>
      {toast.node}

      {/* ── Entry form (screen only) ─────────────────────────────────────────── */}
      <div className="no-print">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              {editId && <Pencil className="size-5 text-brand-dark" />}
              {editId ? "تعديل زيارة محفوظة" : "إدخال وطباعة النتائج"}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              {editId
                ? "عدّل البيانات ثم احفظ — سيُحدَّث نفس السجل."
                : "أدخل بيانات المريض ونتائج فحوصاته ثم اطبعها — يعمل بدون إنترنت."}
              {unsaved && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  <span className="size-1.5 rounded-full bg-amber-500" /> غير محفوظ
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={resetForm} title="بدء زيارة جديدة وتفريغ الحقول" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">
              <RotateCcw className="size-4" /> زيارة جديدة
            </button>
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
            <button
              onClick={onSave}
              title="حفظ (Ctrl+S)"
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm ${justSaved ? "border-teal-300 bg-teal-50 text-brand-dark" : "border-line hover:bg-canvas"}`}
            >
              {justSaved ? <Check className="size-4" strokeWidth={3} /> : <Save className="size-4" />}
              {justSaved ? "تم الحفظ" : "حفظ"}
            </button>
            <button onClick={onPrint} title="طباعة (Ctrl+P)" className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
              <Printer className="size-4" /> طباعة {paper}
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          {/* Patient + tests */}
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
              <div className="mb-3 flex items-center justify-between">
                <PanelTitle icon={UserRound} title="بيانات المريض" />
                {patientId && <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-brand-dark">مراجع مسجّل</span>}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium sm:col-span-2">
                  الاسم الثلاثي *
                  <div className="relative">
                    <input
                      ref={nameRef}
                      value={name}
                      onChange={(e) => { setName(e.target.value); if (patientId && !editId) { setPatientId(null); setPatientNotes([]); } }}
                      className={`mt-1 ${inp}`}
                    />
                    {/* Instant previous-patient suggestions inside the name field */}
                    {nameMatches.length > 0 && (
                      <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-line bg-surface shadow-[var(--shadow-pop)]">
                        {nameMatches.map((p) => (
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
                      </div>
                    )}
                  </div>
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
                  مصدر التحويل
                  <div className="mt-1 flex gap-1.5">
                    <select value={referrer} onChange={(e) => setReferrer(e.target.value)} className={inp}>
                      <option value="">مريض خارجي</option>
                      {referrer && !doctors.some((d) => d.name === referrer) && <option value={referrer}>{referrer}</option>}
                      {doctors.map((d) => (
                        <option key={d.id} value={d.name}>{d.name}{d.clinic ? ` (${d.clinic})` : ""}</option>
                      ))}
                    </select>
                    <button type="button" onClick={quickAddDoctor} title="إضافة طبيب" className="grid size-9 shrink-0 place-items-center rounded-lg border border-line hover:bg-canvas">
                      <Plus className="size-4" />
                    </button>
                  </div>
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
                        <span className="text-[10px] text-muted">{new Date(n.ts).toLocaleDateString("ar-IQ-u-nu-latn")}: </span>
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
                <PanelTitle icon={ListChecks} title="اختيار الفحوصات" hint="اضغط على الفحص لإضافته" />
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${selected.size ? "bg-brand-light font-semibold text-brand-dark" : "text-muted"}`}>{selected.size} محدَّد</span>
                  {selected.size > 0 && (
                    <button type="button" onClick={() => { setSelected(new Set()); setResults({}); }} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted hover:bg-red-50 hover:text-red-600">
                      <X className="size-3.5" /> مسح
                    </button>
                  )}
                </div>
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
                  {groups.map(([cat, items]) => {
                    // Optional (settings): groups fold under their title; a search opens them all.
                    const foldable = settings.collapseGroups === true;
                    const isOpen = !foldable || !!q.trim() || openCats.has(cat);
                    const picked = items.filter((t) => selected.has(t.id)).length;
                    return (
                    <div key={cat}>
                      {foldable ? (
                        <button
                          type="button"
                          onClick={() => setOpenCats((s) => { const n = new Set(s); n.has(cat) ? n.delete(cat) : n.add(cat); return n; })}
                          aria-expanded={isOpen}
                          className="mb-1.5 flex w-full items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-2 text-right text-sm font-semibold hover:border-brand"
                        >
                          <ChevronDown className={`size-4 shrink-0 text-muted transition-transform ${isOpen ? "" : "rotate-90"}`} />
                          <span className="flex-1">{cat}</span>
                          {picked > 0 && <span className="rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-bold leading-none text-white tabular-nums">{picked}</span>}
                          <span className="text-xs font-normal text-muted tabular-nums">{items.length}</span>
                        </button>
                      ) : (
                        <div className="mb-1.5 text-xs font-semibold text-muted">{cat}</div>
                      )}
                      {isOpen && (
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
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Results entry for the chosen tests */}
          <div className="lg:sticky lg:top-4 lg:self-start">
            <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
              <div className="mb-3 flex items-center justify-between gap-2">
                <PanelTitle icon={Beaker} title="إدخال النتائج" hint="المعدل الطبيعي يظهر تحت كل حقل" />
                {chosen.length > 0 && <span className="text-xs tabular-nums text-muted">{filledCount}/{chosen.length}</span>}
              </div>
              {chosen.length > 0 && (
                <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-canvas">
                  <div
                    className={`h-full rounded-full transition-[width] duration-300 ${filledCount === chosen.length ? "bg-brand" : "bg-amber-400"}`}
                    style={{ width: `${(filledCount / chosen.length) * 100}%` }}
                  />
                </div>
              )}
              {chosen.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">اختر فحوصاً لإدخال نتائجها.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {chosen.map((t, idx) => {
                    const f = flagFor(results[t.id] ?? "", t.normal, gender);
                    const tint =
                      f === "H" ? "!border-red-300 bg-red-50/50 text-red-700"
                      : f === "L" ? "!border-blue-300 bg-blue-50/50 text-blue-700"
                      : f === "N" ? "!border-teal-300" : "";
                    return (
                      <div key={t.id} className="group">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{t.name_ar}</span>
                          <div className="flex items-center gap-1">
                            <FlagPill f={f} />
                            <button
                              type="button"
                              onClick={() => toggle(t.id)}
                              title="إزالة الفحص"
                              className="grid size-6 place-items-center rounded-md text-muted opacity-0 hover:bg-red-50 hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            data-result-idx={idx}
                            value={results[t.id] ?? ""}
                            onChange={(e) => setResults((r) => ({ ...r, [t.id]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNextResult(idx); } }}
                            placeholder="النتيجة"
                            className={`${inp} text-base font-semibold ${tint}`}
                          />
                          {t.unit && <span dir="ltr" className="shrink-0 text-xs text-muted">{t.unit}</span>}
                        </div>
                        {t.normal.kind === "qual" && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {["Negative", "+", "++", "+++"].map((v) => (
                              <button
                                key={v}
                                type="button"
                                onClick={() => setResults((r) => ({ ...r, [t.id]: v }))}
                                className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${(results[t.id] ?? "") === v ? "border-brand bg-brand-light text-brand-dark" : "border-line text-muted hover:bg-canvas"}`}
                              >
                                {v}
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="mt-1 text-xs text-muted">
                          المعدل الطبيعي: <span dir="ltr">{rangeLabel(t.normal, gender, t.unit)}</span>
                        </div>
                        {derived[t.id] && (() => {
                          const d = derived[t.id];
                          const isAuto = (results[t.id] ?? "") !== "" && results[t.id] === autoVals[t.id];
                          return (
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                              {isAuto ? (
                                <span className="rounded-full bg-violet-50 px-2 py-0.5 font-semibold text-violet-700">محسوب تلقائياً</span>
                              ) : d.value && d.value !== (results[t.id] ?? "") ? (
                                <button type="button" onClick={() => { setResults((r) => ({ ...r, [t.id]: d.value })); setAutoVals((a) => ({ ...a, [t.id]: d.value })); }}
                                  className="rounded-full border border-violet-300 px-2 py-0.5 font-semibold text-violet-700 hover:bg-violet-50">
                                  استعمل المحسوبة: <span dir="ltr">{d.value}</span>
                                </button>
                              ) : null}
                              <span className="text-muted">= {d.formula}</span>
                              {d.note && <span className="text-amber-700">{d.note}</span>}
                            </div>
                          );
                        })()}
                        {showPrev && prev[t.id] && <PrevLine prev={prev[t.id]} current={results[t.id] ?? ""} />}
                      </div>
                    );
                  })}
                </div>
              )}
              {chosen.length > 0 && missingResults.length > 0 && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                  {missingResults.length} فحص بدون نتيجة — أكملها قبل الطباعة.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Printable report (A4/A5) ─────────────────────────────────────────── */}
      <ReportSheet
        className="mt-6"
        settings={settings}
        paper={paper}
        date={today}
        accession={accession || undefined}
        patient={{ name, gender, age, phone }}
        referrer={referrer || undefined}
        rows={chosen.map((t) => ({ key: t.id, name: t.name_ar, value: results[t.id] ?? "", unit: t.unit, test: t }))}
        prev={prev}
        printPrev={printPrev}
      />
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
