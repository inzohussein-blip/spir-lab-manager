"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookMarked, Printer, Search, Lightbulb, TriangleAlert, ChevronUp } from "lucide-react";
import { getTests, getTubes, getTools, getSettings, type TrainingTest, type Tube, type Tool, type TrainingSettings } from "@/lib/training/store";
import { GUIDE, CATEGORY_WHY, type GuideBlock, type GuideChapter } from "@/lib/training/guide";
import { SopPrintStyle, SopFooter, SopLetterhead, SOP_INK, SOP_ACCENT, exact } from "@/components/training/SopSheet";
import { cn } from "@/lib/utils";

interface Data { tests: TrainingTest[]; tubes: Tube[]; tools: Tool[] }

const TOOL_KINDS = ["جهاز", "أداة", "كاشف", "مستهلكات"];
const KIND_TITLE: Record<string, string> = { "جهاز": "الأجهزة", "أداة": "الأدوات", "كاشف": "الكواشف", "مستهلكات": "المستهلكات" };
const CAT_ORDER = Object.keys(CATEGORY_WHY);
const catOf = (t: TrainingTest) => t.category?.trim() || "أخرى";

/** The station's tests grouped by category, in the guide's order (unknown categories last). */
function byCategory(tests: TrainingTest[]): [string, TrainingTest[]][] {
  const m = new Map<string, TrainingTest[]>();
  tests.forEach((t) => { const k = catOf(t); (m.get(k) ?? m.set(k, []).get(k)!).push(t); });
  const rank = (c: string) => { const i = CAT_ORDER.indexOf(c); return i < 0 ? 999 : i; };
  return Array.from(m.entries())
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b, "ar"))
    .map(([c, list]) => [c, list.sort((a, b) => a.name_ar.localeCompare(b.name_ar, "ar"))]);
}

/** The text a block carries — for the search. */
const blockText = (b: GuideBlock): string =>
  "p" in b ? b.p : "list" in b ? b.list.join(" ") : "steps" in b ? b.steps.join(" ") : "note" in b ? b.note
    : "table" in b ? [...b.table.head, ...b.table.rows.flat()].join(" ") : "";

/** A table shared by the written tables and the ones filled from the station. */
function Table({ head, rows, print }: { head: string[]; rows: React.ReactNode[][]; print: boolean }) {
  return (
    <div className={cn("my-2 overflow-x-auto", print && "overflow-visible")}>
      <table className={cn("w-full border-collapse text-start", print ? "text-[11px]" : "text-sm")}>
        <thead>
          <tr>{head.map((h, i) => (
            <th key={i} className={cn("border px-2 py-1.5 text-start font-bold", print ? "border-gray-300 text-white" : "border-line bg-brand-light text-brand-dark")}
              style={print ? { background: SOP_INK, ...exact } : undefined}>{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={cn(i % 2 === 1 && (print ? "bg-gray-50" : "bg-canvas"))} style={print ? exact : undefined}>
              {r.map((c, j) => <td key={j} className={cn("border px-2 py-1 align-top", print ? "border-gray-300" : "border-line", j === 0 && "font-semibold")}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Auto({ kind, data, print }: { kind: "tools" | "tubes" | "categories" | "index"; data: Data; print: boolean }) {
  const muted = print ? "text-gray-600" : "text-muted";
  const testLink = (t: TrainingTest, label: React.ReactNode) =>
    print ? <>{label}</> : <Link href={`/training/test/${t.id}`} className="text-brand-dark hover:underline">{label}</Link>;

  if (kind === "tools") {
    if (!data.tools.length) return <p className={cn("text-sm", muted)}>لا توجد أدوات مسجّلة بعد — أضفها من «الأدوات والأجهزة».</p>;
    const kinds = [...TOOL_KINDS, ...Array.from(new Set(data.tools.map((t) => t.kind))).filter((k) => !TOOL_KINDS.includes(k))];
    return (
      <div data-testid="guide-auto-tools">
        {kinds.map((k) => {
          const list = data.tools.filter((t) => t.kind === k);
          if (!list.length) return null;
          return (
            <div key={k} className="guide-keep mb-3">
              <div className="mb-1 text-sm font-bold" style={{ color: print ? SOP_ACCENT : undefined }}>{KIND_TITLE[k] ?? k} ({list.length})</div>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {list.map((t) => (
                  <li key={t.id} className={cn("rounded-lg px-3 py-1.5", print ? "border border-gray-200" : "bg-canvas")}>
                    <div className="font-semibold">{t.name}</div>
                    {t.description && <div className={cn("text-xs", muted)}>{t.description}</div>}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {!print && <Link href="/training/tools" className="text-xs text-brand-dark hover:underline">كل الأدوات بالصور ←</Link>}
      </div>
    );
  }

  if (kind === "tubes") {
    if (!data.tubes.length) return <p className={cn("text-sm", muted)}>لا توجد تيوبات مسجّلة بعد.</p>;
    return (
      <div data-testid="guide-auto-tubes">
        <Table print={print} head={["التيوب", "المادة", "الاستعمال", "ملاحظات"]} rows={data.tubes.map((t) => [
          <span key="n" className="inline-flex items-center gap-2">
            <span className="size-4 shrink-0 rounded-full border border-black/20" style={{ background: t.color, ...exact }} />{t.name}
          </span>,
          t.additive ?? "", t.uses ?? "", t.notes ?? "",
        ])} />
        {!print && <Link href="/training/tubes" className="text-xs text-brand-dark hover:underline">التيوبات بالصور ←</Link>}
      </div>
    );
  }

  const groups = byCategory(data.tests);
  if (kind === "categories") {
    return (
      <div data-testid="guide-auto-categories" className="grid gap-2.5">
        {groups.map(([c, list]) => (
          <div key={c} className={cn("guide-keep rounded-xl p-3", print ? "border border-gray-300" : "border border-line")}>
            <div className="flex items-baseline justify-between gap-2">
              <div className="font-bold" style={{ color: print ? SOP_INK : undefined }}>{c}</div>
              <span className={cn("text-xs", muted)}>{list.length} فحص</span>
            </div>
            {CATEGORY_WHY[c] && <p className={cn("mt-0.5 text-sm", muted)}>{CATEGORY_WHY[c]}</p>}
            <div className="mt-1.5 flex flex-wrap gap-1">
              {list.map((t) => (
                <span key={t.id} className={cn("rounded-md px-1.5 py-0.5 text-xs", print ? "border border-gray-200" : "bg-canvas")}>
                  {testLink(t, <span dir="ltr">{t.abbr || t.name_ar}</span>)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // index
  const tubeName = (t: TrainingTest) => t.tubeIds.map((id) => data.tubes.find((x) => x.id === id)?.name).filter(Boolean).join(" ، ");
  let n = 0;
  return (
    <div data-testid="guide-auto-index">
      {groups.map(([c, list]) => (
        <div key={c} className="mb-3">
          <div className="guide-keep mb-1 border-b pb-0.5 text-sm font-bold" style={{ color: SOP_ACCENT, borderColor: SOP_ACCENT }}>{c}</div>
          <Table print={print} head={["#", "الفحص", "العينة", "التيوب"]} rows={list.map((t) => [
            String(++n),
            testLink(t, <>{t.name_ar}{t.abbr && <span className={muted} dir="ltr"> ({t.abbr})</span>}</>),
            t.sampleType ?? "", tubeName(t),
          ])} />
        </div>
      ))}
    </div>
  );
}

function Block({ b, data, print }: { b: GuideBlock; data: Data; print: boolean }) {
  if ("p" in b) return <p className="my-1.5">{b.p}</p>;
  if ("list" in b) return <ul className="my-1.5 list-disc space-y-1 ps-5">{b.list.map((x, i) => <li key={i}>{x}</li>)}</ul>;
  if ("steps" in b) {
    return (
      <ol className="my-2 space-y-1.5">
        {b.steps.map((x, i) => (
          <li key={i} className="flex gap-2">
            <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold", print ? "text-white" : "bg-brand text-white")}
              style={print ? { background: SOP_ACCENT, ...exact } : undefined}>{i + 1}</span>
            <span className="pt-0.5">{x}</span>
          </li>
        ))}
      </ol>
    );
  }
  if ("table" in b) return <Table print={print} head={b.table.head} rows={b.table.rows} />;
  if ("note" in b) {
    const warn = b.tone === "warn";
    const Icon = warn ? TriangleAlert : Lightbulb;
    return (
      <div className={cn("guide-keep my-2 flex gap-2 rounded-xl border px-3 py-2",
        warn ? "border-amber-300 bg-amber-50 text-amber-900" : "border-sky-200 bg-sky-50 text-sky-900")} style={exact} data-tone={b.tone ?? "tip"}>
        <Icon className="mt-0.5 size-4 shrink-0" /><span>{b.note}</span>
      </div>
    );
  }
  return <Auto kind={b.auto} data={data} print={print} />;
}

function Chapter({ ch, no, data, print, q }: { ch: GuideChapter; no: number; data: Data; print: boolean; q?: string }) {
  const sections = q ? ch.sections.filter((s) => `${ch.title} ${s.title} ${s.blocks.map(blockText).join(" ")}`.includes(q)) : ch.sections;
  if (q && !sections.length) return null;
  return (
    <section id={print ? undefined : `ch-${ch.id}`} data-chapter={ch.id}
      className={cn(print ? "sop-page-break" : "scroll-mt-4 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]")}>
      <div className="guide-keep mb-3 flex items-center gap-3">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl text-lg font-extrabold text-white", !print && "bg-gradient-to-br from-brand to-brand-dark")}
          style={print ? { background: SOP_INK, ...exact } : undefined}>{no}</span>
        <div>
          <h2 className={cn("font-extrabold", print ? "text-xl" : "text-lg")} style={print ? { color: SOP_INK } : undefined}>{ch.title}</h2>
          <p className={cn("text-sm", print ? "text-gray-600" : "text-muted")}>{ch.intro}</p>
        </div>
      </div>
      {sections.map((s, i) => (
        <div key={i} className="mt-4">
          {s.title && (
            <h3 className="guide-keep mb-1 flex items-center gap-2 font-bold" style={print ? { color: SOP_INK } : undefined}>
              <span className={cn("h-4 w-1.5 rounded", !print && "bg-brand")} style={print ? { background: SOP_ACCENT, ...exact } : undefined} />
              {s.title}
            </h3>
          )}
          {s.blocks.map((b, j) => <Fragment key={j}><Block b={b} data={data} print={print} /></Fragment>)}
        </div>
      ))}
    </section>
  );
}

/** «الدليل»: the training station's guide from scratch — browsed on screen, printed as a book. */
export default function GuidePage() {
  const [data, setData] = useState<Data>({ tests: [], tubes: [], tools: [] });
  const [settings, setSettings] = useState<TrainingSettings | null>(null);
  const [q, setQ] = useState("");
  const [only, setOnly] = useState(""); // print one chapter ("" = the whole guide)
  const [active, setActive] = useState(GUIDE[0].id);

  useEffect(() => { setData({ tests: getTests(), tubes: getTubes(), tools: getTools() }); setSettings(getSettings()); }, []);

  // The contents highlight the chapter being read.
  useEffect(() => {
    if (!settings) return;
    const els = GUIDE.map((c) => document.getElementById(`ch-${c.id}`)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver((es) => {
      const vis = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (vis) setActive(vis.target.getAttribute("data-chapter") ?? GUIDE[0].id);
    }, { rootMargin: "0px 0px -70% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [settings, q]);

  const query = q.trim();
  const printed = useMemo(() => GUIDE.map((c, i) => ({ c, no: i + 1 })).filter(({ c }) => !only || c.id === only), [only]);
  const visible = useMemo(
    () => GUIDE.map((c, i) => ({ c, no: i + 1 })).filter(({ c }) => !query || `${c.title} ${c.sections.map((s) => `${s.title} ${s.blocks.map(blockText).join(" ")}`).join(" ")}`.includes(query)),
    [query]
  );

  if (!settings) return null;

  const print = () => {
    const y = window.scrollY;
    window.scrollTo(0, 0); // fixed elements (the footer) print from the top of the page
    setTimeout(() => { window.print(); window.scrollTo(0, y); }, 60);
  };

  return (
    <div>
      <div className="no-print">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold"><BookMarked className="size-6 text-brand" /> الدليل</h1>
            <p className="mt-1 text-sm text-muted">دليل كامل من الصفر: الأجهزة والتيوبات ، سحب العينة وفصلها ، أقسام الفحوص وطرقها ، ضبط الجودة ، قراءة النتيجة والتشخيص.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={only} onChange={(e) => setOnly(e.target.value)} aria-label="ما يُطبع" data-testid="guide-print-what"
              className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
              <option value="">الدليل كاملاً ({GUIDE.length} فصلاً)</option>
              {GUIDE.map((c, i) => <option key={c.id} value={c.id}>{i + 1}. {c.title}</option>)}
            </select>
            <button onClick={print} data-testid="guide-print" className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
              <Printer className="size-4" /> طباعة
            </button>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[15rem_1fr]">
          <aside className="lg:sticky lg:top-4 lg:self-start">
            <label className="relative mb-2 block">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث في الدليل" data-testid="guide-search"
                className="w-full rounded-lg border border-line bg-surface py-2 pe-3 ps-9 text-sm" />
            </label>
            <nav data-testid="guide-toc" className="rounded-2xl border border-line bg-surface p-2 shadow-[var(--shadow-card)]">
              {GUIDE.map((c, i) => (
                <a key={c.id} href={`#ch-${c.id}`}
                  className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm",
                    active === c.id ? "bg-brand-light font-semibold text-brand-dark" : "hover:bg-canvas",
                    query && !visible.some((v) => v.c.id === c.id) && "opacity-40")}>
                  <span className="w-5 text-center text-xs text-muted tabular-nums">{i + 1}</span>{c.title}
                </a>
              ))}
            </nav>
          </aside>

          <div className="grid min-w-0 gap-5 text-[15px] leading-relaxed">
            {query && !visible.length && <p className="rounded-2xl border border-line bg-surface p-5 text-sm text-muted">لا توجد نتائج لـ «{query}».</p>}
            {visible.map(({ c, no }) => <Chapter key={c.id} ch={c} no={no} data={data} print={false} q={query || undefined} />)}
            <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className="inline-flex items-center gap-1 justify-self-center text-xs text-muted hover:text-ink"><ChevronUp className="size-4" /> إلى الأعلى</a>
          </div>
        </div>
      </div>

      {/* ── Printed book ── */}
      <div className="sop-doc hidden bg-white text-[12px] leading-relaxed text-black print:block" data-testid="guide-doc">
        <SopPrintStyle />
        <style>{`@media print { .sop-doc .guide-keep { break-inside: avoid; break-after: avoid; } .sop-doc > .sop-page-break:first-of-type { break-before: auto; } }`}</style>
        {!only && (
          <>
            <section className="flex min-h-[250mm] flex-col">
              <SopLetterhead settings={settings} />
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <div className="text-4xl font-extrabold" style={{ color: SOP_INK }}>الدليل</div>
                <div className="mt-1 text-sm tracking-wide text-gray-600" dir="ltr">Laboratory Training Guide</div>
                <div className="mt-4 max-w-md text-sm text-gray-700">من الصفر: الأجهزة والتيوبات ، سحب العينة وفصلها ، أقسام الفحوص وطرقها ، ضبط الجودة ، قراءة النتيجة والتشخيص.</div>
                <div className="mt-6 text-sm text-gray-600">{GUIDE.length} فصلاً · {data.tests.length} فحصاً · تاريخ الطباعة: <span dir="ltr">{new Date().toLocaleDateString("en-CA")}</span></div>
                {settings.preparedBy && <div className="mt-1 text-sm text-gray-600">إعداد: <b>{settings.preparedBy}</b></div>}
              </div>
            </section>
            <section className="sop-page-break">
              <div className="mb-3 text-xl font-extrabold" style={{ color: SOP_INK }}>المحتويات</div>
              <ol className="space-y-1.5 text-[13px]">
                {GUIDE.map((c, i) => (
                  <li key={c.id} className="flex gap-2 border-b border-dotted border-gray-300 pb-1">
                    <b className="w-6" style={{ color: SOP_ACCENT }}>{i + 1}.</b>
                    <span className="flex-1"><b>{c.title}</b> <span className="text-gray-500">— {c.sections.map((s) => s.title).filter(Boolean).join(" ، ") || c.intro}</span></span>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}
        {printed.map(({ c, no }) => <Chapter key={c.id} ch={c} no={no} data={data} print />)}
        <SopFooter text={settings.footer} />
      </div>
    </div>
  );
}
