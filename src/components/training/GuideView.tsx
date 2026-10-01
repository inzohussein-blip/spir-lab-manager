"use client";

import { Fragment } from "react";
import Link from "next/link";
import { Lightbulb, TriangleAlert } from "lucide-react";
import type { TrainingTest, Tube, Tool } from "@/lib/training/store";
import { CATEGORY_WHY, type GuideBlock, type GuideChapter } from "@/lib/training/guide";
import { SOP_INK, SOP_ACCENT, exact } from "./SopSheet";
import { Img } from "./Img";
import { cn } from "@/lib/utils";

/** How «الدليل» is drawn — on screen and on paper (the page and its print share it). */

export interface GuideSource { tests: TrainingTest[]; tubes: Tube[]; tools: Tool[]; why: Record<string, string> }
type Data = GuideSource;

const TOOL_KINDS = ["جهاز", "أداة", "كاشف", "مستهلكات"];
const KIND_TITLE: Record<string, string> = { "جهاز": "الأجهزة", "أداة": "الأدوات", "كاشف": "الكواشف", "مستهلكات": "المستهلكات" };
const catOf = (t: TrainingTest) => t.category?.trim() || "أخرى";

/** The station's tests grouped by category, in the guide's order (unknown categories last). */
export function byCategory(tests: TrainingTest[], order: string[] = Object.keys(CATEGORY_WHY)): [string, TrainingTest[]][] {
  const m = new Map<string, TrainingTest[]>();
  tests.forEach((t) => { const k = catOf(t); (m.get(k) ?? m.set(k, []).get(k)!).push(t); });
  const rank = (c: string) => { const i = order.indexOf(c); return i < 0 ? 999 : i; };
  return Array.from(m.entries())
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b, "ar"))
    .map(([c, list]) => [c, list.sort((a, b) => a.name_ar.localeCompare(b.name_ar, "ar"))]);
}

/** The text a block carries — for the search. */
export const blockText = (b: GuideBlock): string =>
  "p" in b ? b.p : "list" in b ? b.list.join(" ") : "steps" in b ? b.steps.join(" ") : "note" in b ? b.note
    : "table" in b ? [...b.table.head, ...b.table.rows.flat()].join(" ") : "img" in b ? b.caption ?? "" : "";

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

export function Auto({ kind, data, print }: { kind: "tools" | "tubes" | "categories" | "index"; data: Data; print: boolean }) {
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

  const groups = byCategory(data.tests, Object.keys(data.why));
  if (kind === "categories") {
    return (
      <div data-testid="guide-auto-categories" className="grid gap-2.5">
        {groups.map(([c, list]) => (
          <div key={c} className={cn("guide-keep rounded-xl p-3", print ? "border border-gray-300" : "border border-line")}>
            <div className="flex items-baseline justify-between gap-2">
              <div className="font-bold" style={{ color: print ? SOP_INK : undefined }}>{c}</div>
              <span className={cn("text-xs", muted)}>{list.length} فحص</span>
            </div>
            {data.why[c] && <p className={cn("mt-0.5 text-sm", muted)}>{data.why[c]}</p>}
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

const filled = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean);

export function Block({ b, data, print }: { b: GuideBlock; data: Data; print: boolean }) {
  if ("p" in b) return <p className="my-1.5 whitespace-pre-line">{b.p}</p>;
  if ("list" in b) return <ul className="my-1.5 list-disc space-y-1 ps-5">{filled(b.list).map((x, i) => <li key={i}>{x}</li>)}</ul>;
  if ("steps" in b) {
    return (
      <ol className="my-2 space-y-1.5">
        {filled(b.steps).map((x, i) => (
          <li key={i} className="flex gap-2">
            <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold", print ? "text-white" : "bg-brand text-white")}
              style={print ? { background: SOP_ACCENT, ...exact } : undefined}>{i + 1}</span>
            <span className="pt-0.5">{x}</span>
          </li>
        ))}
      </ol>
    );
  }
  if ("table" in b) return <Table print={print} head={b.table.head} rows={b.table.rows.filter((r) => r.some((c) => c.trim()))} />;
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
  if ("img" in b) {
    if (!b.img) return null;
    return (
      <figure className="guide-keep my-3 text-center">
        <Img id={b.img} className={cn("mx-auto max-h-80 w-auto max-w-full rounded-lg", print ? "border border-gray-200" : "border border-line bg-white")} />
        {b.caption && <figcaption className={cn("mt-1 text-xs", print ? "text-gray-600" : "text-muted")}>{b.caption}</figcaption>}
      </figure>
    );
  }
  return <Auto kind={b.auto} data={data} print={print} />;
}

export function Chapter({ ch, no, data, print, q, head }: {
  ch: GuideChapter; no: number; data: Data; print: boolean; q?: string;
  /** Printed above the chapter (the lab's letterhead). */
  head?: React.ReactNode;
}) {
  const sections = q ? ch.sections.filter((s) => `${ch.title} ${s.title} ${s.blocks.map(blockText).join(" ")}`.includes(q)) : ch.sections;
  if (q && !sections.length) return null;
  return (
    <section id={print ? undefined : `ch-${ch.id}`} data-chapter={ch.id}
      className={cn(print ? "sop-page-break" : "scroll-mt-4 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]")}>
      {head}
      <div className={cn("guide-keep mb-3 flex items-center gap-3", head ? "mt-4" : undefined)}>
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

