"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookMarked, Printer, Search, ChevronUp, Pencil, Check, Plus, RotateCcw, Info } from "lucide-react";
import {
  getTests, getTubes, getTools, getSettings, getGuide, uid, saveGuide, resetGuide, defaultGuide, defaultChapter, guideEdited,
  type TrainingTest, type Tube, type Tool, type TrainingSettings, type GuideData,
} from "@/lib/training/store";
import type { GuideChapter } from "@/lib/training/guide";
import { useEditLock } from "@/lib/training/lock";
import { SopPrintStyle, SOP_INK, SOP_ACCENT, exact } from "@/components/training/SopSheet";
import { Chapter, blockText } from "@/components/training/GuideView";
import { ChapterEditor } from "@/components/training/GuideEditor";
import { Img } from "@/components/training/Img";
import { cn } from "@/lib/utils";

interface Data { tests: TrainingTest[]; tubes: Tube[]; tools: Tool[] }

const chapterText = (c: GuideChapter) => `${c.title} ${c.intro} ${c.sections.map((s) => `${s.title} ${s.blocks.map(blockText).join(" ")}`).join(" ")}`;

/** The lab's logo, name and details on the printed guide (every chapter; large on the cover). */
function LabHead({ s, big, right }: { s: TrainingSettings; big?: boolean; right?: React.ReactNode }) {
  const logo = s.logoImageId ? <Img id={s.logoImageId} className={big ? "size-28" : "size-14"} /> : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/lab-logo.png" alt="" className={cn("object-contain", big ? "size-28" : "size-14")} />
  );
  if (big) {
    return (
      <div className="flex flex-col items-center text-center" data-testid="guide-cover-head">
        {logo}
        <div className="mt-3 text-3xl font-extrabold" style={{ color: SOP_INK }}>{s.title}</div>
        {s.subtitle && <div className="mt-1 text-sm text-gray-600">{s.subtitle}</div>}
        {s.contact && <div className="mt-1 text-sm text-gray-600">{s.contact}</div>}
      </div>
    );
  }
  return (
    <div className="guide-keep flex items-center justify-between gap-4 border-b-2 pb-2" style={{ borderColor: SOP_ACCENT }} data-testid="guide-page-head">
      <div className="flex items-center gap-3">
        {logo}
        <div>
          <div className="text-lg font-extrabold" style={{ color: SOP_INK }}>{s.title}</div>
          {s.subtitle && <div className="text-[11px] text-gray-600">{s.subtitle}</div>}
          {s.contact && <div className="text-[11px] text-gray-600">{s.contact}</div>}
        </div>
      </div>
      {right && <div className="text-left text-[11px] text-gray-600">{right}</div>}
    </div>
  );
}

/** «الدليل»: the training station's guide from scratch — browsed on screen, edited by the lab,
 *  printed as a book on the lab's letterhead. */
export default function GuidePage() {
  const [data, setData] = useState<Data>({ tests: [], tubes: [], tools: [] });
  const [settings, setSettings] = useState<TrainingSettings | null>(null);
  const [guide, setGuide] = useState<GuideData>(() => defaultGuide());
  const [edited, setEdited] = useState(false);
  const [q, setQ] = useState("");
  const [only, setOnly] = useState(""); // print one chapter ("" = the whole guide)
  const [active, setActive] = useState("");
  const [editing, setEditing] = useState(false);
  const [sv, setSv] = useState(0); // bumped on moves / adds / deletes (re-creates the edit fields)
  const [saved, setSaved] = useState<"" | "saving" | "saved">("");
  const pending = useRef<GuideData | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { canEdit } = useEditLock();

  useEffect(() => {
    setData({ tests: getTests(), tubes: getTubes(), tools: getTools() });
    setSettings(getSettings());
    setGuide(getGuide());
    setEdited(guideEdited());
  }, []);

  // Edits are saved a moment after typing stops (and before leaving the page).
  const flush = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (pending.current) { saveGuide(pending.current); pending.current = null; setEdited(true); setSaved("saved"); }
  }, []);
  useEffect(() => {
    window.addEventListener("beforeunload", flush);
    return () => { window.removeEventListener("beforeunload", flush); flush(); };
  }, [flush]);
  const update = (next: GuideData, structural = false) => {
    setGuide(next);
    if (structural) setSv((v) => v + 1);
    pending.current = next;
    setSaved("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 400);
  };
  const setChapter = (i: number, ch: GuideChapter, structural = false) =>
    update({ ...guide, chapters: guide.chapters.map((c, j) => (j === i ? ch : c)) }, structural);

  const chapters = guide.chapters;
  const source = useMemo(() => ({ ...data, why: guide.why }), [data, guide.why]);

  // The contents highlight the chapter being read.
  useEffect(() => {
    if (!settings) return;
    const els = chapters.map((c) => document.getElementById(`ch-${c.id}`)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver((es) => {
      const vis = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (vis) setActive(vis.target.getAttribute("data-chapter") ?? "");
    }, { rootMargin: "0px 0px -70% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [settings, q, chapters, editing]);

  const query = editing ? "" : q.trim();
  const printed = useMemo(() => chapters.map((c, i) => ({ c, no: i + 1 })).filter(({ c }) => !only || c.id === only), [chapters, only]);
  const visible = useMemo(() => chapters.map((c, i) => ({ c, no: i + 1 })).filter(({ c }) => !query || chapterText(c).includes(query)), [chapters, query]);

  if (!settings) return null;

  const print = () => {
    flush();
    const y = window.scrollY;
    window.scrollTo(0, 0); // fixed elements (the footer) print from the top of the page
    setTimeout(() => { window.print(); window.scrollTo(0, y); }, 60);
  };
  const addChapter = () => {
    const id = `c-${uid().slice(0, 8)}`;
    update({ ...guide, chapters: [...chapters, { id, title: "فصل جديد", intro: "", sections: [{ title: "", blocks: [{ p: "" }] }] }] }, true);
    setTimeout(() => document.getElementById(`ch-${id}`)?.scrollIntoView({ behavior: "smooth" }), 80);
  };
  const restoreAll = () => {
    if (!confirm("إرجاع الدليل إلى نصه الأصلي؟ ستُحذف كل التعديلات والفصول المضافة.")) return;
    if (timer.current) clearTimeout(timer.current);
    pending.current = null;
    resetGuide();
    setGuide(defaultGuide()); setEdited(false); setSv((v) => v + 1); setSaved("saved");
  };
  const footer = [settings.footer, settings.contact].filter(Boolean).join(" — ");

  return (
    <div>
      <div className="no-print">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold"><BookMarked className="size-6 text-brand" /> الدليل</h1>
            <p className="mt-1 text-sm text-muted">دليل كامل من الصفر: الأجهزة والتيوبات ، سحب العينة وفصلها ، أقسام الفحوص وطرقها ، ضبط الجودة ، قراءة النتيجة والتشخيص.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <button onClick={() => { flush(); setEditing(!editing); setSv((v) => v + 1); }} data-testid="guide-edit"
                className={cn("inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-semibold",
                  editing ? "border-green-600 bg-green-600 text-white hover:bg-green-700" : "border-line bg-surface hover:bg-canvas")}>
                {editing ? <><Check className="size-4" /> إنهاء التعديل</> : <><Pencil className="size-4" /> تعديل الدليل</>}
              </button>
            )}
            <select value={only} onChange={(e) => setOnly(e.target.value)} aria-label="ما يُطبع" data-testid="guide-print-what"
              className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
              <option value="">الدليل كاملاً ({chapters.length} فصلاً)</option>
              {chapters.map((c, i) => <option key={c.id} value={c.id}>{i + 1}. {c.title}</option>)}
            </select>
            <button onClick={print} data-testid="guide-print" className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
              <Printer className="size-4" /> طباعة
            </button>
          </div>
        </div>

        {editing && (
          <div className="sticky top-2 z-20 mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-brand/30 bg-brand-light px-4 py-2.5 text-sm shadow-[var(--shadow-card)]" data-testid="guide-edit-bar">
            <Pencil className="size-4 text-brand-dark" />
            <span className="font-semibold text-brand-dark">وضع التعديل</span>
            <span className="text-xs text-muted">عدّل أي نص، أو أضف فصلاً أو قسماً أو فقرة أو جدولاً أو صورة. يُحفظ تلقائياً.</span>
            <span className="ms-auto text-xs text-muted" data-testid="guide-saved">{saved === "saving" ? "جارٍ الحفظ…" : saved === "saved" ? "حُفظ ✓" : ""}</span>
            <button onClick={addChapter} data-testid="guide-add-chapter" className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark"><Plus className="size-3.5" /> فصل جديد</button>
            {edited && (
              <button onClick={restoreAll} data-testid="guide-restore" className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs hover:bg-canvas"><RotateCcw className="size-3.5" /> النص الأصلي للدليل كله</button>
            )}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[15rem_1fr]">
          <aside className="lg:sticky lg:top-4 lg:self-start">
            {!editing && (
              <label className="relative mb-2 block">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث في الدليل" data-testid="guide-search"
                  className="w-full rounded-lg border border-line bg-surface py-2 pe-3 ps-9 text-sm" />
              </label>
            )}
            <nav data-testid="guide-toc" className="max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border border-line bg-surface p-2 shadow-[var(--shadow-card)]">
              {chapters.map((c, i) => (
                <a key={c.id} href={`#ch-${c.id}`}
                  className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm",
                    active === c.id ? "bg-brand-light font-semibold text-brand-dark" : "hover:bg-canvas",
                    query && !visible.some((v) => v.c.id === c.id) && "opacity-40")}>
                  <span className="w-5 text-center text-xs text-muted tabular-nums">{i + 1}</span>{c.title || "بلا عنوان"}
                </a>
              ))}
            </nav>
            {edited && !editing && <p className="mt-2 px-1 text-[11px] text-muted">عدّل المختبر هذا الدليل.</p>}
          </aside>

          <div className="grid min-w-0 gap-5 text-[15px] leading-relaxed">
            {!editing && (
              <p className="flex items-start gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-xs text-muted" data-testid="guide-disclaimer">
                <Info className="mt-0.5 size-4 shrink-0" />
                الدليل مرجع تعليمي عام قابل للتعديل من المختبر، وليس بديلاً عن نشرات الكواشف والأجهزة وتعليمات الجهات الصحية. المختبر مسؤول عن مراجعة محتواه واعتماده.
              </p>
            )}
            {query && !visible.length && <p className="rounded-2xl border border-line bg-surface p-5 text-sm text-muted">لا توجد نتائج لـ «{query}».</p>}
            {editing
              ? chapters.map((c, i) => (
                <ChapterEditor key={c.id} ch={c} no={i + 1} count={chapters.length} sv={sv} tests={data.tests} why={guide.why}
                  onChange={(ch, structural) => setChapter(i, ch, structural)}
                  onWhy={(cat, text) => update({ ...guide, why: { ...guide.why, [cat]: text } })}
                  onMove={(d) => {
                    const j = i + d;
                    const next = [...chapters];
                    [next[i], next[j]] = [next[j], next[i]];
                    update({ ...guide, chapters: next }, true);
                  }}
                  onDelete={() => { if (confirm(`حذف الفصل «${c.title}» بكل ما فيه؟`)) update({ ...guide, chapters: chapters.filter((_, j) => j !== i) }, true); }}
                  onRestore={defaultChapter(c.id) ? () => { if (confirm(`إرجاع الفصل «${c.title}» إلى نصه الأصلي؟`)) setChapter(i, defaultChapter(c.id)!, true); } : undefined} />
              ))
              : visible.map(({ c, no }) => <Chapter key={c.id} ch={c} no={no} data={source} print={false} q={query || undefined} />)}
            {editing && (
              <button onClick={addChapter} className="inline-flex items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-brand/40 py-4 text-sm font-semibold text-brand-dark hover:bg-brand-light">
                <Plus className="size-4" /> إضافة فصل جديد
              </button>
            )}
            <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className="inline-flex items-center gap-1 justify-self-center text-xs text-muted hover:text-ink"><ChevronUp className="size-4" /> إلى الأعلى</a>
          </div>
        </div>
      </div>

      {/* ── Printed book, on the lab's letterhead ── */}
      <div className="sop-doc hidden bg-white text-[12px] leading-relaxed text-black print:block" data-testid="guide-doc">
        <SopPrintStyle />
        <style>{`@media print { .sop-doc .guide-keep { break-inside: avoid; break-after: avoid; } .sop-doc > .sop-page-break:first-of-type { break-before: auto; } }`}</style>
        {!only && (
          <>
            <section className="flex min-h-[250mm] flex-col items-center justify-between py-6 text-center" data-testid="guide-cover">
              <LabHead s={settings} big />
              <div>
                <div className="mx-auto mb-4 h-1 w-24 rounded" style={{ background: SOP_ACCENT, ...exact }} />
                <div className="text-5xl font-extrabold" style={{ color: SOP_INK }}>الدليل</div>
                <div className="mt-1 text-sm tracking-wide text-gray-600" dir="ltr">Laboratory Training Guide</div>
                <div className="mx-auto mt-4 max-w-md text-sm text-gray-700">من الصفر: الأجهزة والتيوبات ، سحب العينة وفصلها ، أقسام الفحوص وطرقها ، ضبط الجودة ، قراءة النتيجة والتشخيص.</div>
              </div>
              <div className="text-sm text-gray-600">
                <div>{chapters.length} فصلاً · {data.tests.length} فحصاً · تاريخ الطباعة: <span dir="ltr">{new Date().toLocaleDateString("en-CA")}</span></div>
                {settings.preparedBy && <div className="mt-1">إعداد: <b>{settings.preparedBy}</b></div>}
                <div className="mx-auto mt-3 max-w-lg text-[10px] text-gray-500">مرجع تعليمي داخلي قابل للتعديل من المختبر؛ يُراجع ويُعتمد من إدارة المختبر، ولا يغني عن نشرات الكواشف والأجهزة.</div>
              </div>
            </section>
            <section className="sop-page-break">
              <LabHead s={settings} right={<b style={{ color: SOP_INK }}>الدليل — المحتويات</b>} />
              <div className="mb-3 mt-4 text-xl font-extrabold" style={{ color: SOP_INK }}>المحتويات</div>
              <ol className="space-y-1.5 text-[13px]">
                {chapters.map((c, i) => (
                  <li key={c.id} className="flex gap-2 border-b border-dotted border-gray-300 pb-1">
                    <b className="w-6" style={{ color: SOP_ACCENT }}>{i + 1}.</b>
                    <span className="flex-1"><b>{c.title}</b> <span className="text-gray-500">— {c.sections.map((s) => s.title).filter(Boolean).join(" ، ") || c.intro}</span></span>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}
        {printed.map(({ c, no }) => (
          <Chapter key={c.id} ch={c} no={no} data={source} print
            head={<LabHead s={settings} right={<><b style={{ color: SOP_INK }}>الدليل</b><div>الفصل {no}</div></>} />} />
        ))}
        {footer && <div className="sop-footer mt-4 rounded-md px-3 py-1.5 text-center text-[10px] text-white" style={{ background: SOP_INK, ...exact }} data-testid="guide-footer">{footer}</div>}
      </div>
    </div>
  );
}
