"use client";

import { LockGate } from "@/components/training/LockGate";
import { useEffect, useMemo, useState } from "react";
import { Users, Plus, Trash2, Printer, UserRound, Award } from "lucide-react";
import { Certificate } from "@/components/training/Certificate";
import {
  getTests, getTrainees, saveTrainees, setCompetency, getSettings, uid, today, COMP_LEVELS,
  type TrainingTest, type Trainee, type CompLevel, type TrainingSettings,
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
    const t: Trainee = { id: uid(), name: name.trim(), start: start || undefined, comp: {}, quiz: [] };
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
  const [printMode, setPrintMode] = useState<"record" | "cert">("record");
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
  function printCert() {
    setPrintMode("cert");
    setTimeout(() => window.print(), 60);
  }

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
              <div className="mb-2 text-sm font-semibold">متدرب جديد</div>
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
                <button onClick={() => { setPrintMode("record"); setTimeout(() => window.print(), 60); }} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas"><Printer className="size-4" /> طباعة السجل</button>
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

export default function TraineesPage() {
  return (
    <LockGate>
      <TraineesInner />
    </LockGate>
  );
}
