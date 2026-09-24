"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Printer } from "lucide-react";
import { getTests, getTubes, getTools, getSettings, type TrainingTest, type Tube, type Tool, type TrainingSettings } from "@/lib/training/store";
import { SopSheet, SopPrintStyle, SopFooter, SopLetterhead, sopCode, SOP_INK, SOP_ACCENT, exact } from "@/components/training/SopSheet";

/** Print the whole SOP manual (or one category): cover, contents, then every procedure on its own page. */
export default function ManualPage() {
  const [tests, setTests] = useState<TrainingTest[]>([]);
  const [tubes, setTubes] = useState<Tube[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [settings, setSettings] = useState<TrainingSettings | null>(null);
  const [cat, setCat] = useState("");
  const [withImages, setWithImages] = useState(true);
  const [withCover, setWithCover] = useState(true);

  useEffect(() => { setTests(getTests()); setTubes(getTubes()); setTools(getTools()); setSettings(getSettings()); }, []);

  const cats = useMemo(() => Array.from(new Set(tests.map((t) => t.category?.trim() || "أخرى"))).sort(), [tests]);
  // Ordered by category, then name — the same order as the contents page.
  const chosen = useMemo(
    () => tests
      .filter((t) => !cat || (t.category?.trim() || "أخرى") === cat)
      .sort((a, b) => (a.category || "أخرى").localeCompare(b.category || "أخرى", "ar") || a.name_ar.localeCompare(b.name_ar, "ar")),
    [tests, cat]
  );
  const groups = useMemo(() => {
    const m = new Map<string, TrainingTest[]>();
    chosen.forEach((t) => { const k = t.category?.trim() || "أخرى"; (m.get(k) ?? m.set(k, []).get(k)!).push(t); });
    return Array.from(m.entries());
  }, [chosen]);

  if (!settings) return null;
  let n = 0;

  return (
    <div>
      <div className="no-print">
        <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold"><BookOpen className="size-6 text-brand" /> طباعة الدليل الكامل</h1>
        <p className="mb-5 text-sm text-muted">يطبع كل البروسيجرات (أو تصنيفاً واحداً) في ملف واحد: غلاف وفهرس ثم كل فحص في صفحة جديدة — جاهز للتجليد.</p>

        <div className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
          <label className="text-sm font-medium">التصنيف
            <select value={cat} onChange={(e) => setCat(e.target.value)} className="mt-1 block rounded-lg border border-line bg-surface px-3 py-2 text-sm">
              <option value="">كل التصنيفات ({tests.length})</option>
              {cats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="inline-flex items-center gap-1.5 pb-2 text-sm"><input type="checkbox" checked={withCover} onChange={(e) => setWithCover(e.target.checked)} className="accent-[var(--color-brand)]" /> غلاف وفهرس</label>
          <label className="inline-flex items-center gap-1.5 pb-2 text-sm"><input type="checkbox" checked={withImages} onChange={(e) => setWithImages(e.target.checked)} className="accent-[var(--color-brand)]" /> تضمين الصور</label>
          <button onClick={() => window.print()} disabled={chosen.length === 0} className="ms-auto inline-flex items-center gap-1.5 rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
            <Printer className="size-4" /> طباعة ({chosen.length} بروسيجر)
          </button>
        </div>

        {/* Contents preview */}
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
          <div className="mb-3 text-sm font-bold">محتويات الدليل</div>
          {groups.map(([g, list]) => (
            <div key={g} className="mb-3">
              <div className="mb-1 text-xs font-semibold text-brand-dark">{g}</div>
              <ol className="grid gap-1 text-sm sm:grid-cols-2">
                {list.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 rounded-lg bg-canvas px-3 py-1.5">
                    <span className="flex-1 truncate">{t.name_ar}</span>
                    <span className="text-[11px] text-muted" dir="ltr">{sopCode(t)} · v{t.version ?? 1}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>

      {/* ── Printed document ── */}
      <div className="sop-doc hidden bg-white text-black print:block">
        <SopPrintStyle />
        {withCover && (
          <>
            <section className="flex min-h-[250mm] flex-col">
              <SopLetterhead settings={settings} />
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <div className="text-3xl font-extrabold" style={{ color: SOP_INK }}>دليل إجراءات العمل القياسية</div>
                <div className="mt-1 text-sm tracking-wide text-gray-600" dir="ltr">Standard Operating Procedures Manual</div>
                <div className="mt-6 rounded-full px-5 py-1.5 text-sm font-bold text-white" style={{ background: SOP_ACCENT, ...exact }}>{cat || "جميع التصنيفات"}</div>
                <div className="mt-6 text-sm text-gray-600">عدد الإجراءات: <b>{chosen.length}</b> · تاريخ الطباعة: <span dir="ltr">{new Date().toLocaleDateString("en-CA")}</span></div>
                {settings.preparedBy && <div className="mt-1 text-sm text-gray-600">إعداد: <b>{settings.preparedBy}</b></div>}
              </div>
            </section>
            <section className="sop-page-break">
              <div className="mb-3 text-xl font-extrabold" style={{ color: SOP_INK }}>الفهرس</div>
              {groups.map(([g, list]) => (
                <div key={g} className="sop-keep mb-3">
                  <div className="mb-1 border-b pb-0.5 text-sm font-bold" style={{ color: SOP_ACCENT, borderColor: SOP_ACCENT }}>{g}</div>
                  <table className="w-full text-[12px]">
                    <tbody>
                      {list.map((t) => {
                        n += 1;
                        return (
                          <tr key={t.id}>
                            <td className="w-8 py-0.5 text-gray-500">{n}.</td>
                            <td className="py-0.5">{t.name_ar}{t.abbr && <span className="text-gray-500" dir="ltr"> ({t.abbr})</span>}</td>
                            <td className="py-0.5 text-left text-gray-500" dir="ltr">{sopCode(t)} · v{t.version ?? 1}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </section>
          </>
        )}
        {chosen.map((t, i) => (
          <SopSheet key={t.id} test={t} tubes={tubes} tools={tools} settings={settings} withImages={withImages} breakBefore={withCover || i > 0} />
        ))}
        <SopFooter text={settings.footer} />
      </div>
    </div>
  );
}
