"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, X, Maximize2, Minimize2, AlertTriangle, Lightbulb } from "lucide-react";
import type { TrainingTest, Tube, Tool } from "@/lib/training/store";
import { Img } from "./Img";
import { RichText } from "./RichText";

/**
 * Presentation mode for group teaching: a test card as full-screen slides.
 * Keyboard: ← / Space / PageDown = next, → / PageUp = previous, Home / End, Esc = close.
 * Slides are always light (projector friendly) whatever the app theme.
 */

interface Slide { title: string; body: ReactNode }

const chunk = <T,>(a: T[], n: number): T[][] => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

export function Presentation({ test, all, tubes, tools, onClose }: {
  test: TrainingTest; all: TrainingTest[]; tubes: Tube[]; tools: Tool[]; onClose: () => void;
}) {
  const [i, setI] = useState(0);
  const [full, setFull] = useState(false);

  const slides = useMemo<Slide[]>(() => {
    const s: Slide[] = [];
    const myTubes = test.tubeIds.map((x) => tubes.find((t) => t.id === x)).filter(Boolean) as Tube[];
    const myTools = test.toolIds.map((x) => tools.find((t) => t.id === x)).filter(Boolean) as Tool[];

    // 1. Title
    s.push({
      title: "",
      body: (
        <div className="flex h-full flex-col items-center justify-center gap-[1em] text-center">
          {test.coverImageId ? (
            <Img id={test.coverImageId} className="h-[34%] max-w-[50%] rounded-[0.6em] border border-slate-200 bg-white" />
          ) : (
            <span className="grid size-[5em] place-items-center rounded-[0.8em] bg-brand text-[1.6em] font-extrabold text-white" dir="ltr">{(test.abbr || test.name_ar).slice(0, 6)}</span>
          )}
          <div className="text-[2.6em] font-extrabold leading-tight">{test.name_ar}</div>
          {(test.name_en || test.abbr) && <div className="text-[1.3em] text-slate-500" dir="ltr">{test.name_en}{test.abbr ? ` (${test.abbr})` : ""}</div>}
          {test.category && <span className="rounded-full bg-brand-light px-[1em] py-[0.25em] text-[1em] font-semibold text-brand-dark">{test.category}</span>}
        </div>
      ),
    });

    // 2. Why & principle
    if (test.purpose?.trim() || test.summary?.trim()) {
      s.push({
        title: "لماذا يُطلب؟ ومبدأ الفحص",
        body: (
          <div className="grid h-full gap-[1em] md:grid-cols-2">
            {test.purpose?.trim() && <Box label="لماذا يُطلب هذا الفحص؟"><RichText text={test.purpose} /></Box>}
            {test.summary?.trim() && <Box label="الملخّص والمبدأ"><RichText text={test.summary} /></Box>}
          </div>
        ),
      });
    }

    // 3. Sample, tubes, tools
    const sampleRows = ([["نوع العينة", test.sampleType], ["الحجم", test.volume], ["تحضير المريض", test.patientPrep], ["الثبات والحفظ", test.storage]] as const).filter(([, v]) => v?.trim());
    if (sampleRows.length || myTubes.length || myTools.length) {
      s.push({
        title: "العينة والتيوبات والأدوات",
        body: (
          <div className="grid h-full gap-[1em] md:grid-cols-2">
            <Box label="العينة">
              {sampleRows.length === 0 ? "—" : sampleRows.map(([k, v]) => (
                <div key={k} className="mb-[0.5em]"><span className="font-bold text-brand-dark">{k}: </span><RichText text={v} className="inline" /></div>
              ))}
            </Box>
            <div className="flex flex-col gap-[1em]">
              {myTubes.length > 0 && (
                <Box label="التيوبات / الحاويات">
                  <div className="flex flex-wrap gap-[0.6em]">
                    {myTubes.map((t) => (
                      <span key={t.id} className="inline-flex items-center gap-[0.4em] rounded-full border border-slate-200 px-[0.7em] py-[0.2em]">
                        <span className="size-[0.9em] rounded-full border border-black/10" style={{ background: t.color }} />{t.name}
                      </span>
                    ))}
                  </div>
                </Box>
              )}
              {myTools.length > 0 && (
                <Box label="الأدوات والأجهزة والكواشف">
                  <ul className="list-disc ps-[1.2em]">{myTools.map((t) => <li key={t.id}>{t.name}</li>)}</ul>
                </Box>
              )}
            </div>
          </div>
        ),
      });
    }

    // 4. Steps — a step with an image gets its own slide; text-only steps are grouped by 4.
    const steps = test.steps.filter((x) => x.text.trim() || x.imageId).map((x, n) => ({ ...x, n: n + 1 }));
    let group: typeof steps = [];
    const flush = () => {
      if (!group.length) return;
      const g = group;
      s.push({
        title: "خطوات العمل",
        body: <div className="flex flex-col gap-[0.7em]">{g.map((x) => <Step key={x.id} n={x.n} warn={x.warn} text={x.text} />)}</div>,
      });
      group = [];
    };
    for (const st of steps) {
      if (st.imageId) {
        flush();
        s.push({
          title: "خطوات العمل",
          body: (
            <div className="grid h-full gap-[1em] md:grid-cols-[1fr_1.2fr]">
              <div className="self-center"><Step n={st.n} warn={st.warn} text={st.text} /></div>
              <Img id={st.imageId} className="h-full max-h-full w-full rounded-[0.6em] border border-slate-200 bg-white" />
            </div>
          ),
        });
      } else {
        group.push(st);
        if (group.length === 4) flush();
      }
    }
    flush();

    // 5. Golden notes
    for (const g of chunk(test.tips.filter((t) => t.trim()), 4)) {
      s.push({
        title: "ملاحظات من ذهب",
        body: (
          <ul className="flex flex-col gap-[0.7em]">
            {g.map((t, n) => (
              <li key={n} className="flex gap-[0.6em] rounded-[0.5em] border-r-[0.3em] border-amber-400 bg-amber-50 px-[0.8em] py-[0.5em] text-amber-950">
                <Lightbulb className="mt-[0.2em] size-[1.1em] shrink-0 text-amber-500" /><RichText text={t} />
              </li>
            ))}
          </ul>
        ),
      });
    }

    // 6. Troubleshooting
    for (const g of chunk((test.troubles ?? []).filter((r) => r.problem.trim()), 4)) {
      s.push({
        title: "حل المشاكل",
        body: (
          <table className="w-full border-collapse">
            <thead><tr className="bg-slate-100 text-right"><th className="p-[0.5em]">المشكلة</th><th className="p-[0.5em]">السبب المحتمل</th><th className="p-[0.5em]">الحل</th></tr></thead>
            <tbody>
              {g.map((r) => (
                <tr key={r.id} className="border-b border-slate-200 align-top">
                  <td className="p-[0.5em] font-semibold text-red-700"><RichText text={r.problem} /></td>
                  <td className="p-[0.5em]"><RichText text={r.cause} /></td>
                  <td className="p-[0.5em] text-brand-dark"><RichText text={r.fix} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ),
      });
    }

    // 7. Normals & interpretation
    const normals = test.normals.filter((n) => n.value.trim());
    if (normals.length || test.high?.trim() || test.low?.trim() || test.resultNotes?.trim()) {
      s.push({
        title: "النتائج والتفسير",
        body: (
          <div className="grid h-full gap-[1em] md:grid-cols-2">
            <Box label="القيم الطبيعية">
              {normals.length === 0 ? "—" : normals.map((n, k) => (
                <div key={k} className="flex justify-between gap-[1em] border-b border-slate-200 py-[0.35em] last:border-0">
                  <span className="text-slate-600">{n.label || "—"}</span><b dir="ltr">{n.value}</b>
                </div>
              ))}
            </Box>
            <Box label="التفسير">
              {test.high?.trim() && <div className="mb-[0.6em]"><b className="text-red-600">▲ الارتفاع: </b><RichText text={test.high} className="inline" /></div>}
              {test.low?.trim() && <div className="mb-[0.6em]"><b className="text-blue-600">▼ الانخفاض: </b><RichText text={test.low} className="inline" /></div>}
              {test.resultNotes?.trim() && <div className="mt-[0.6em] border-t border-slate-200 pt-[0.6em] text-[0.9em]"><RichText text={test.resultNotes} /></div>}
              {!test.high?.trim() && !test.low?.trim() && !test.resultNotes?.trim() && "—"}
            </Box>
          </div>
        ),
      });
    }

    // 8. Gallery — one image per slide
    for (const g of test.gallery) {
      s.push({
        title: "معرض الصور",
        body: (
          <div className="flex h-full flex-col items-center justify-center gap-[0.6em]">
            <Img id={g.imageId} className="min-h-0 w-full flex-1 rounded-[0.6em] bg-white" />
            {g.caption && <div className="text-[1.2em] font-semibold">{g.caption}</div>}
          </div>
        ),
      });
    }

    // 9. Correlations
    const links = test.links.map((l) => ({ ...l, t: all.find((x) => x.id === l.id) })).filter((l) => l.t);
    for (const g of chunk(links, 5)) {
      s.push({
        title: "يرتبط بـ",
        body: (
          <div className="flex flex-col gap-[0.6em]">
            {g.map((l) => (
              <div key={l.id} className="rounded-[0.5em] border border-slate-200 px-[0.8em] py-[0.5em]">
                <b className="text-brand-dark">{l.t!.name_ar}</b>{l.t!.abbr && <span className="text-slate-500" dir="ltr"> ({l.t!.abbr})</span>}
                {l.note && <div className="text-[0.85em] text-slate-600">{l.note}</div>}
              </div>
            ))}
          </div>
        ),
      });
    }
    return s;
  }, [test, all, tubes, tools]);

  const last = slides.length - 1;
  const go = useCallback((n: number) => setI(Math.max(0, Math.min(last, n))), [last]);

  const exitFull = () => { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); };
  const close = useCallback(() => { exitFull(); onClose(); }, [onClose]);
  const toggleFull = () => {
    if (document.fullscreenElement) exitFull();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  useEffect(() => {
    const onFs = () => setFull(!!document.fullscreenElement);
    onFs();
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) { e.preventDefault(); setI((x) => Math.min(last, x + 1)); }
      else if (["ArrowRight", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
      else if (e.key === "Home") setI(0);
      else if (e.key === "End") setI(last);
      else if (e.key === "Escape") close();
      else if (e.key === "f" || e.key === "F") toggleFull();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [last, close]);

  const slide = slides[i];
  return (
    <div className="no-print fixed inset-0 z-[60] flex flex-col bg-slate-950 text-white" role="dialog" aria-label="وضع العرض">
      <div className="flex items-center justify-between gap-3 px-4 py-2 text-sm text-white/70">
        <span className="truncate">{test.name_ar}</span>
        <div className="flex items-center gap-1">
          <button onClick={toggleFull} title="ملء الشاشة (F)" className="grid size-9 place-items-center rounded-lg hover:bg-white/10">{full ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}</button>
          <button onClick={close} title="إغلاق (Esc)" aria-label="إغلاق العرض" className="grid size-9 place-items-center rounded-lg hover:bg-white/10"><X className="size-5" /></button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-4">
        <div
          className="slide-light relative flex aspect-video w-full flex-col overflow-hidden rounded-2xl bg-white text-slate-900 shadow-2xl"
          style={{ maxWidth: "min(96vw, calc((100vh - 120px) * 16 / 9))", fontSize: "clamp(12px, min(1.55vw, 2.75vh), 30px)" }}
        >
          {slide.title && (
            <div className="flex items-center gap-[0.6em] border-b-[0.2em] border-brand px-[1.6em] pb-[0.5em] pt-[0.9em]">
              <span className="text-[1.7em] font-extrabold text-brand-dark">{slide.title}</span>
              <span className="ms-auto text-[0.8em] text-slate-400">{test.abbr || test.name_ar}</span>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-hidden px-[1.6em] py-[1em] text-[1.15em] leading-relaxed">{slide.body}</div>
          <div className="h-[0.35em] bg-slate-100"><div className="h-full bg-brand transition-all" style={{ width: `${((i + 1) / slides.length) * 100}%` }} /></div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 py-3">
        <button onClick={() => go(i - 1)} disabled={i === 0} aria-label="السابقة" className="grid size-10 place-items-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30"><ChevronRight className="size-5" /></button>
        <span className="min-w-16 text-center text-sm tabular-nums" dir="ltr">{i + 1} / {slides.length}</span>
        <button onClick={() => go(i + 1)} disabled={i === last} aria-label="التالية" className="grid size-10 place-items-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30"><ChevronLeft className="size-5" /></button>
      </div>
    </div>
  );
}

function Box({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-[0.7em] border border-slate-200 bg-slate-50 px-[1em] py-[0.7em]">
      <div className="mb-[0.4em] text-[0.85em] font-bold text-brand-dark">{label}</div>
      {children}
    </div>
  );
}

function Step({ n, text, warn }: { n: number; text: string; warn?: boolean }) {
  return (
    <div className={`flex gap-[0.7em] rounded-[0.6em] border px-[0.8em] py-[0.5em] ${warn ? "border-red-200 bg-red-50" : "border-slate-200"}`}>
      <span className={`grid size-[1.8em] shrink-0 place-items-center rounded-full text-[0.9em] font-bold text-white ${warn ? "bg-red-600" : "bg-brand"}`}>{n}</span>
      <div className="min-w-0">
        {warn && <div className="inline-flex items-center gap-[0.3em] text-[0.8em] font-bold text-red-700"><AlertTriangle className="size-[1em]" /> تنبيه</div>}
        <RichText text={text} />
      </div>
    </div>
  );
}
