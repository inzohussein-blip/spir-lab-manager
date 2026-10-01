"use client";

import { LockGate } from "@/components/training/LockGate";
import { useEffect, useMemo, useState } from "react";
import { Users, Plus, Trash2, Printer, UserRound, Award, GraduationCap, FileSignature, Wand2, Save } from "lucide-react";
import { Certificate } from "@/components/training/Certificate";
import { CompletionCertificate, RecommendationLetter, suggestRecommendation, completionNo } from "@/components/training/Letters";
import {
  getTests, getTrainees, saveTrainees, setCompetency, getSettings, uid, today, COMP_LEVELS, updateTrainee,
  type TrainingTest, type Trainee, type CompLevel, type TrainingSettings, type TrainingCompletion, type Recommendation,
} from "@/lib/training/store";
import { SopLetterhead, SopPrintStyle, SopFooter, SOP_INK, exact } from "@/components/training/SopSheet";

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
const LEVEL_STYLE: Record<CompLevel, string> = {
  1: "border-sky-300 bg-sky-50 text-sky-700",
  2: "border-amber-300 bg-amber-50 text-amber-700",
  3: "border-green-400 bg-green-50 text-green-700",
};

function TraineesInner() {
  const [tests, setTests] = useState<TrainingTest[]>([]);
  const [list, setList] = useState<Trainee[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [start, setStart] = useState(today());
  const [by, setBy] = useState("");
  const [role, setRole] = useState<"trainee" | "employee">("trainee");
  const [settings, setSettings] = useState<TrainingSettings | null>(null);

  const reload = () => setList(getTrainees());
  useEffect(() => {
    setTests(getTests()); setSettings(getSettings());
    const l = getTrainees(); setList(l); setSel(l[0]?.id ?? null);
  }, []);

  const tr = list.find((x) => x.id === sel) ?? null;
  const groups = useMemo(() => {
    const m = new Map<string, TrainingTest[]>();
    [...tests].sort((a, b) => a.name_ar.localeCompare(b.name_ar, "ar"))
      .forEach((t) => { const k = t.category?.trim() || "أخرى"; (m.get(k) ?? m.set(k, []).get(k)!).push(t); });
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0], "ar"));
  }, [tests]);

  function add() {
    if (!name.trim()) return;
    const t: Trainee = { id: uid(), name: name.trim(), start: start || undefined, comp: {}, quiz: [], ...(role === "employee" ? { role } : {}) };
    saveTrainees([...getTrainees(), t]);
    reload(); setSel(t.id); setName("");
  }
  function remove(t: Trainee) {
    if (!window.confirm(`حذف سجل «${t.name}» نهائياً؟`)) return;
    saveTrainees(getTrainees().filter((x) => x.id !== t.id));
    const l = getTrainees(); setList(l); setSel(l[0]?.id ?? null);
  }
  function level(testId: string, lv: CompLevel | 0) {
    if (!tr) return;
    const cur = tr.comp[testId]?.level ?? 0;
    setCompetency(tr.id, testId, cur === lv ? 0 : lv, by);
    reload();
  }

  const done = tr ? tests.filter((t) => tr.comp[t.id]?.level === 3).length : 0;
  const started = tr ? tests.filter((t) => tr.comp[t.id]).length : 0;
  const pct = tests.length ? Math.round((done / tests.length) * 100) : 0;
  // Certificate scopes: categories (or everything) the trainee is independent in.
  const [printMode, setPrintMode] = useState<"record" | "cert" | "done" | "rec">("record");
  const [certScope, setCertScope] = useState("");
  const scopes = tr ? [
    ...(tests.length && tests.every((t) => tr.comp[t.id]?.level === 3) ? [{ key: "__all", label: "كل الفحوصات", tests }] : []),
    ...groups.filter(([, items]) => items.length && items.every((t) => tr.comp[t.id]?.level === 3)).map(([g, items]) => ({ key: g, label: g, tests: items })),
  ] : [];
  const scope = scopes.find((x) => x.key === certScope) ?? scopes[0];
  useEffect(() => {
    const back = () => setPrintMode("record");
    window.addEventListener("afterprint", back);
    return () => window.removeEventListener("afterprint", back);
  }, []);
  /** Print one of the sheets, from the top of the page (a scrolled page loses its fixed footer). */
  function printAs(mode: "record" | "cert" | "done" | "rec") {
    setPrintMode(mode);
    setTimeout(() => { const y = window.scrollY; window.scrollTo(0, 0); window.print(); window.scrollTo(0, y); }, 60);
  }
  function printCert() { printAs("cert"); }
  function saveTr(patch: Partial<Trainee>) { if (tr) { updateTrainee(tr.id, patch); reload(); } }

  const best = tr?.quiz.length ? Math.max(...tr.quiz.map((q) => Math.round((q.score / q.total) * 100))) : null;

  return (
    <div>
      <div className="no-print">
        <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold"><Users className="size-6 text-brand" /> سجل كفاءة المتدربين</h1>
        <p className="mb-5 text-sm text-muted">لكل فحص: شاهد ← نفّذ تحت إشراف ← مستقل. يُسجَّل التاريخ تلقائياً ويمكن طباعة سجل كل متدرب.</p>

        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          {/* Trainees list */}
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
              <div className="mb-2 text-sm font-semibold">متدرب أو موظف جديد</div>
              <div className="mb-2 flex overflow-hidden rounded-lg border border-line text-xs" role="group" aria-label="الصفة">
                {([["trainee", "متدرب"], ["employee", "موظف"]] as const).map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setRole(k)} aria-pressed={role === k}
                    className={`flex-1 px-2 py-1.5 ${role === k ? "bg-brand font-semibold text-white" : "text-muted hover:bg-canvas"}`}>{l}</button>
                ))}
              </div>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم" className={`mb-2 ${inp}`} />
              <label className="mb-2 block text-xs text-muted">تاريخ البدء<input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={`mt-1 ${inp}`} /></label>
              <button onClick={add} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark"><Plus className="size-4" /> إضافة</button>
            </div>
            <div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-2 shadow-[var(--shadow-card)]">
              {list.length === 0 && <p className="p-3 text-center text-xs text-muted">لا يوجد متدربون بعد.</p>}
              {list.map((t) => {
                const d = tests.filter((x) => t.comp[x.id]?.level === 3).length;
                return (
                  <button key={t.id} onClick={() => setSel(t.id)} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-right text-sm ${sel === t.id ? "bg-brand-light font-semibold text-brand-dark" : "hover:bg-canvas"}`}>
                    <UserRound className="size-4 shrink-0" />
                    <span className="flex-1 truncate">{t.name}</span>
                    {t.role === "employee" && <span className="rounded-full bg-canvas px-1.5 text-[10px] text-muted">موظف</span>}
                    <span className="text-[11px] tabular-nums text-muted">{d}/{tests.length}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected trainee */}
          {!tr ? (
            <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-line text-sm text-muted">أضف متدرباً أو اختره من القائمة.</div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
                <div className="min-w-0 flex-1">
                  <div className="text-xl font-bold">{tr.name}</div>
                  {tr.start && <div className="text-xs text-muted">بدأ التدريب: <span dir="ltr">{tr.start}</span></div>}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-2 w-40 shrink-0 overflow-hidden rounded-full bg-canvas"><div className="h-full rounded-full bg-green-500" style={{ width: `${pct}%` }} /></div>
                    <span className="whitespace-nowrap text-xs tabular-nums text-muted">{done} مستقل · {started} بدأ · {pct}%</span>
                  </div>
                  {best !== null && <div className="mt-1 text-xs text-muted">أفضل نتيجة اختبار: <b className="tabular-nums">{best}%</b> ({tr.quiz.length} محاولة)</div>}
                </div>
                <label className="text-xs text-muted">اسم المشرف (يُسجَّل مع كل تقييم)<input value={by} onChange={(e) => setBy(e.target.value)} className={`mt-1 ${inp} w-44`} /></label>
                <button onClick={() => printAs("record")} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas"><Printer className="size-4" /> طباعة السجل</button>
                <button onClick={() => remove(tr)} title="حذف المتدرب" className="grid size-9 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50"><Trash2 className="size-4" /></button>
              </div>

              {/* Completion certificate */}
              <div className={`flex flex-wrap items-center gap-3 rounded-2xl border p-4 ${scopes.length ? "border-amber-300 bg-amber-50/60" : "border-dashed border-line"}`}>
                <Award className={`size-6 ${scopes.length ? "text-amber-500" : "text-muted"}`} />
                {scopes.length ? (
                  <>
                    <div className="flex-1 text-sm"><b>شهادة إتمام تدريب</b> — المتدرب مستقل في كل فحوصات {scopes.length > 1 ? "عدة تصنيفات" : `«${scopes[0].label}»`}.</div>
                    {scopes.length > 1 && (
                      <select value={scope?.key} onChange={(e) => setCertScope(e.target.value)} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
                        {scopes.map((x) => <option key={x.key} value={x.key}>{x.label} ({x.tests.length})</option>)}
                      </select>
                    )}
                    <button onClick={printCert} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"><Printer className="size-4" /> طباعة الشهادة</button>
                  </>
                ) : (
                  <div className="flex-1 text-xs text-muted">تظهر شهادة الإتمام عندما يصبح المتدرب «مستقلاً» في كل فحوصات تصنيف واحد على الأقل.</div>
                )}
              </div>

              <CompletionCard key={`done-${tr.id}`} tr={tr} onSave={(c) => saveTr({ completion: c })} onPrint={(c) => { saveTr({ completion: c }); printAs("done"); }} />
              <RecommendationCard key={`rec-${tr.id}`} tr={tr} lab={settings?.title ?? "المختبر"} onSave={(r) => saveTr({ recommendation: r })} onPrint={(r) => { saveTr({ recommendation: r }); printAs("rec"); }} />

              {groups.map(([g, items]) => (
                <div key={g} className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
                  <div className="mb-2 text-sm font-bold text-brand-dark">{g}</div>
                  <div className="flex flex-col divide-y divide-line">
                    {items.map((t) => {
                      const c = tr.comp[t.id];
                      return (
                        <div key={t.id} className="flex flex-wrap items-center gap-2 py-2">
                          <span className="min-w-40 flex-1 text-sm">{t.name_ar}</span>
                          {c && <span className="text-[11px] text-muted" dir="ltr">{c.date}{c.by ? ` · ${c.by}` : ""}</span>}
                          <div className="flex gap-1">
                            {COMP_LEVELS.map((l) => (
                              <button
                                key={l.level}
                                onClick={() => level(t.id, l.level)}
                                className={`rounded-lg border px-2.5 py-1 text-xs ${c?.level === l.level ? `${LEVEL_STYLE[l.level]} font-semibold` : "border-line text-muted hover:bg-canvas"}`}
                              >
                                {l.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {tr && settings && printMode === "cert" && scope && (
        <Certificate trainee={tr} settings={settings} scopeLabel={scope.label} tests={scope.tests} />
      )}

      {tr && settings && printMode === "done" && tr.completion && <CompletionCertificate trainee={tr} settings={settings} c={tr.completion} />}
      {tr && settings && printMode === "rec" && tr.recommendation && <RecommendationLetter trainee={tr} settings={settings} r={tr.recommendation} />}

      {/* Printed competency record */}
      {tr && settings && printMode === "record" && (
        <div className="sop-doc hidden bg-white text-[12px] text-black print:block">
          <SopPrintStyle />
          <SopLetterhead settings={settings} right={<><div className="font-bold" style={{ color: SOP_INK }}>سجل كفاءة متدرب</div><div>تاريخ الطباعة: <span dir="ltr">{today()}</span></div></>} />
          <div className="mt-4 grid grid-cols-3 gap-3 rounded-lg border border-gray-300 p-3">
            <div><b>المتدرب:</b> {tr.name}</div>
            <div><b>بدء التدريب:</b> <span dir="ltr">{tr.start ?? "—"}</span></div>
            <div><b>المنجز باستقلالية:</b> {done} من {tests.length} ({pct}%)</div>
          </div>
          {groups.map(([g, items]) => (
            <div key={g} className="mt-3">
              <div className="sop-keep mb-1 text-sm font-bold" style={{ color: SOP_INK }}>{g}</div>
              <table className="w-full border-collapse text-[11px]">
                <thead><tr style={{ background: "#eef2ff", ...exact }}>
                  <th className="border border-gray-300 px-2 py-1 text-right">الفحص</th>
                  {COMP_LEVELS.map((l) => <th key={l.level} className="w-20 border border-gray-300 px-2 py-1">{l.label}</th>)}
                  <th className="w-24 border border-gray-300 px-2 py-1">التاريخ</th>
                  <th className="w-28 border border-gray-300 px-2 py-1">المشرف</th>
                </tr></thead>
                <tbody>
                  {items.map((t) => {
                    const c = tr.comp[t.id];
                    return (
                      <tr key={t.id}>
                        <td className="border border-gray-300 px-2 py-1">{t.name_ar}</td>
                        {COMP_LEVELS.map((l) => <td key={l.level} className="border border-gray-300 px-2 py-1 text-center">{c && c.level >= l.level ? "✓" : ""}</td>)}
                        <td className="border border-gray-300 px-2 py-1 text-center" dir="ltr">{c?.date ?? ""}</td>
                        <td className="border border-gray-300 px-2 py-1 text-center">{c?.by ?? ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
          {tr.quiz.length > 0 && (
            <div className="sop-keep mt-3">
              <div className="mb-1 text-sm font-bold" style={{ color: SOP_INK }}>نتائج الاختبارات</div>
              <div className="flex flex-wrap gap-2">
                {tr.quiz.slice(0, 12).map((q, k) => <span key={k} className="rounded border border-gray-300 px-2 py-0.5" dir="ltr">{new Date(q.at).toLocaleDateString("en-CA")}: {q.score}/{q.total}</span>)}
              </div>
            </div>
          )}
          <div className="sop-keep mt-8 grid grid-cols-3 gap-4 text-center text-[11px] text-gray-600">
            {["توقيع المتدرب", "توقيع المشرف", "مدير المختبر"].map((k) => <div key={k}><div className="h-8" /><div className="border-t border-gray-400 pt-1">{k}</div></div>)}
          </div>
          <SopFooter text={settings.footer} />
        </div>
      )}
    </div>
  );
}

const GRADES = ["امتياز", "جيد جداً", "جيد", "متوسط", "مقبول"];

/** «شهادة انتهاء التدريب»: the end of the training period, whatever the competency record. */
function CompletionCard({ tr, onSave, onPrint }: { tr: Trainee; onSave: (c: TrainingCompletion) => void; onPrint: (c: TrainingCompletion) => void }) {
  const [c, setC] = useState<TrainingCompletion>(() => tr.completion ?? { end: today() });
  const set = (patch: Partial<TrainingCompletion>) => setC((x) => ({ ...x, ...patch }));
  const final = (): TrainingCompletion => ({ ...c, certNo: c.certNo ?? completionNo(tr, c.end) });
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]" data-testid="completion-card">
      <div className="mb-1 flex items-center gap-2 text-sm font-bold"><GraduationCap className="size-5 text-brand" /> شهادة انتهاء التدريب</div>
      <p className="mb-3 text-xs text-muted">تُمنح عند انتهاء فترة التدريب، مستقلة عن سجل الكفاءة.{tr.completion?.certNo ? <> رقمها: <span dir="ltr">{tr.completion.certNo}</span></> : null}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-muted">تاريخ انتهاء التدريب<input type="date" value={c.end} onChange={(e) => set({ end: e.target.value })} aria-label="تاريخ انتهاء التدريب" className={`mt-1 ${inp}`} /></label>
        <label className="text-xs text-muted sm:col-span-2">البرنامج / القسم<input value={c.program ?? ""} onChange={(e) => set({ program: e.target.value })} aria-label="البرنامج" placeholder="مثلاً: التحليلات المرضية العامة" className={`mt-1 ${inp}`} /></label>
        <label className="text-xs text-muted">عدد الساعات (اختياري)<input value={c.hours ?? ""} onChange={(e) => set({ hours: e.target.value })} aria-label="عدد الساعات" inputMode="numeric" className={`mt-1 ${inp}`} /></label>
        <label className="text-xs text-muted">التقدير
          <select value={c.grade ?? ""} onChange={(e) => set({ grade: e.target.value || undefined })} aria-label="التقدير" className={`mt-1 ${inp}`}>
            <option value="">— بلا تقدير —</option>
            {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted">مشرف التدريب<input value={c.supervisor ?? ""} onChange={(e) => set({ supervisor: e.target.value })} aria-label="مشرف التدريب" className={`mt-1 ${inp}`} /></label>
        <label className="text-xs text-muted sm:col-span-3">ملاحظة تُطبع على الشهادة (اختياري)<input value={c.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} aria-label="ملاحظة الشهادة" className={`mt-1 ${inp}`} /></label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => onSave(final())} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas"><Save className="size-4" /> حفظ</button>
        <button onClick={() => onPrint(final())} disabled={!c.end} data-testid="completion-print-btn" className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"><Printer className="size-4" /> طباعة الشهادة</button>
      </div>
    </div>
  );
}

/** «كتاب توصية» for a trainee or a former employee. */
function RecommendationCard({ tr, lab, onSave, onPrint }: { tr: Trainee; lab: string; onSave: (r: Recommendation) => void; onPrint: (r: Recommendation) => void }) {
  const [r, setR] = useState<Recommendation>(() => tr.recommendation ?? {
    kind: tr.role === "employee" ? "employee" : "trainee", from: tr.start, to: tr.completion?.end, text: "", date: today(),
  });
  const set = (patch: Partial<Recommendation>) => setR((x) => ({ ...x, ...patch }));
  const suggest = () => set({ text: suggestRecommendation(tr, r, lab) });
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]" data-testid="recommendation-card">
      <div className="mb-1 flex items-center gap-2 text-sm font-bold"><FileSignature className="size-5 text-brand" /> كتاب توصية</div>
      <p className="mb-3 text-xs text-muted">للمتدرب أو للموظف السابق، يُطبع على ترويسة المحطة.</p>
      <div className="mb-3 flex w-fit overflow-hidden rounded-lg border border-line text-sm" role="group" aria-label="التوصية لـ">
        {([["trainee", "متدرب"], ["employee", "موظف سابق"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => set({ kind: k })} aria-pressed={r.kind === k}
            className={`px-4 py-1.5 ${r.kind === k ? "bg-brand font-semibold text-white" : "text-muted hover:bg-canvas"}`}>{l}</button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {r.kind === "employee" && <label className="text-xs text-muted">المسمى الوظيفي<input value={r.position ?? ""} onChange={(e) => set({ position: e.target.value })} aria-label="المسمى الوظيفي" placeholder="مثلاً: محلل مختبر" className={`mt-1 ${inp}`} /></label>}
        <label className="text-xs text-muted">من<input type="date" value={r.from ?? ""} onChange={(e) => set({ from: e.target.value || undefined })} aria-label="الفترة من" className={`mt-1 ${inp}`} /></label>
        <label className="text-xs text-muted">إلى<input type="date" value={r.to ?? ""} onChange={(e) => set({ to: e.target.value || undefined })} aria-label="الفترة إلى" className={`mt-1 ${inp}`} /></label>
        <label className="text-xs text-muted sm:col-span-3">موجّه إلى<input value={r.addressee ?? ""} onChange={(e) => set({ addressee: e.target.value })} aria-label="موجه إلى" placeholder="إلى من يهمه الأمر" className={`mt-1 ${inp}`} /></label>
      </div>
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-xs text-muted">
          <span>نص التوصية</span>
          <button type="button" onClick={suggest} data-testid="recommendation-suggest" className="inline-flex items-center gap-1 text-brand hover:underline"><Wand2 className="size-3.5" /> نص مقترح</button>
        </div>
        <textarea rows={6} value={r.text} onChange={(e) => set({ text: e.target.value })} aria-label="نص التوصية" placeholder="اكتب التوصية، أو اضغط «نص مقترح» ثم عدّله…" className={`${inp} leading-relaxed`} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-muted">اسم الموصي<input value={r.by ?? ""} onChange={(e) => set({ by: e.target.value })} aria-label="اسم الموصي" className={`mt-1 ${inp}`} /></label>
        <label className="text-xs text-muted">منصبه<input value={r.byTitle ?? ""} onChange={(e) => set({ byTitle: e.target.value })} aria-label="منصب الموصي" placeholder="مدير المختبر" className={`mt-1 ${inp}`} /></label>
        <label className="text-xs text-muted">تاريخ الكتاب<input type="date" value={r.date} onChange={(e) => set({ date: e.target.value })} aria-label="تاريخ الكتاب" className={`mt-1 ${inp}`} /></label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => onSave(r)} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas"><Save className="size-4" /> حفظ</button>
        <button onClick={() => onPrint(r.text.trim() ? r : { ...r, text: suggestRecommendation(tr, r, lab) })} data-testid="recommendation-print-btn"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"><Printer className="size-4" /> طباعة كتاب التوصية</button>
      </div>
    </div>
  );
}

export default function TraineesPage() {
  return (
    <LockGate>
      <TraineesInner />
    </LockGate>
  );
}
