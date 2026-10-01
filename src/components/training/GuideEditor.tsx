"use client";

import {
  ArrowUp, ArrowDown, Trash2, Plus, RotateCcw, Type, List, ListOrdered, Lightbulb, Table2, ImageIcon, Database,
} from "lucide-react";
import type { GuideBlock, GuideChapter, GuideSection } from "@/lib/training/guide";
import type { TrainingTest } from "@/lib/training/store";
import { ImagePicker } from "./ImagePicker";
import { byCategory } from "./GuideView";
import { cn } from "@/lib/utils";

/**
 * Editing «الدليل» in place: every chapter, section and block can be changed, moved, removed or
 * added (text, list, steps, note, table, image, or a list filled from the station's data).
 * Text fields are uncontrolled: `sv` (bumped on every move / add / delete) re-creates them.
 */

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
const iconBtn = "grid size-7 place-items-center rounded-md border border-line text-muted hover:bg-canvas hover:text-ink disabled:opacity-40";

const AUTO_LABEL: Record<string, string> = {
  tools: "أدوات المختبر وأجهزته (من «الأدوات والأجهزة»)",
  tubes: "تيوبات المختبر (من «التيوبات والحاويات»)",
  categories: "أقسام الفحوصات وأهميتها (من المكتبة)",
  index: "فهرس الفحوصات (من المكتبة)",
};

const NEW_BLOCKS: { label: string; icon: React.ReactNode; make: () => GuideBlock }[] = [
  { label: "فقرة", icon: <Type className="size-3.5" />, make: () => ({ p: "" }) },
  { label: "قائمة", icon: <List className="size-3.5" />, make: () => ({ list: [""] }) },
  { label: "خطوات", icon: <ListOrdered className="size-3.5" />, make: () => ({ steps: [""] }) },
  { label: "ملاحظة", icon: <Lightbulb className="size-3.5" />, make: () => ({ note: "", tone: "tip" }) },
  { label: "جدول", icon: <Table2 className="size-3.5" />, make: () => ({ table: { head: ["العمود 1", "العمود 2"], rows: [["", ""]] } }) },
  { label: "صورة", icon: <ImageIcon className="size-3.5" />, make: () => ({ img: "" }) },
];
const AUTO_BLOCKS: ("tools" | "tubes" | "categories" | "index")[] = ["tools", "tubes", "categories", "index"];

const move = <T,>(xs: T[], i: number, d: -1 | 1): T[] => {
  const j = i + d;
  if (j < 0 || j >= xs.length) return xs;
  const next = [...xs];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

/** A table as text: the first line is the header, «|» between the cells. */
const tableText = (t: { head: string[]; rows: string[][] }) => [t.head, ...t.rows].map((r) => r.join(" | ")).join("\n");
const parseTable = (v: string) => {
  const lines = v.split("\n").map((l) => l.split("|").map((c) => c.trim()));
  return { head: lines[0] ?? [""], rows: lines.slice(1) };
};

function Tools({ i, n, onMove, onDelete, what }: { i: number; n: number; onMove: (d: -1 | 1) => void; onDelete: () => void; what: string }) {
  return (
    <div className="flex shrink-0 gap-1">
      <button type="button" className={iconBtn} disabled={i === 0} onClick={() => onMove(-1)} title={`${what} للأعلى`} aria-label={`${what} للأعلى`}><ArrowUp className="size-3.5" /></button>
      <button type="button" className={iconBtn} disabled={i === n - 1} onClick={() => onMove(1)} title={`${what} للأسفل`} aria-label={`${what} للأسفل`}><ArrowDown className="size-3.5" /></button>
      <button type="button" className={cn(iconBtn, "hover:text-red-600")} onClick={onDelete} title={`حذف ${what}`} aria-label={`حذف ${what}`}><Trash2 className="size-3.5" /></button>
    </div>
  );
}

function BlockEdit({ b, onChange, tests, why, onWhy }: {
  b: GuideBlock; onChange: (b: GuideBlock) => void;
  tests: TrainingTest[]; why: Record<string, string>; onWhy: (cat: string, text: string) => void;
}) {
  if ("p" in b) {
    return <textarea rows={3} defaultValue={b.p} onChange={(e) => onChange({ p: e.target.value })} aria-label="نص الفقرة" className={inp} />;
  }
  if ("list" in b || "steps" in b) {
    const steps = "steps" in b;
    const items = steps ? b.steps : b.list;
    return (
      <div>
        <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>سطر لكل بند.</span>
          <button type="button" onClick={() => onChange(steps ? { list: items } : { steps: items })} className="rounded-md border border-line px-2 py-0.5 hover:bg-canvas">
            {steps ? "تحويل إلى قائمة نقطية" : "تحويل إلى خطوات مرقّمة"}
          </button>
        </div>
        <textarea rows={Math.min(10, Math.max(3, items.length + 1))} defaultValue={items.join("\n")} aria-label={steps ? "الخطوات" : "بنود القائمة"}
          onChange={(e) => { const v = e.target.value.split("\n"); onChange(steps ? { steps: v } : { list: v }); }} className={inp} />
      </div>
    );
  }
  if ("note" in b) {
    return (
      <div className="grid gap-1.5">
        <select defaultValue={b.tone ?? "tip"} onChange={(e) => onChange({ ...b, tone: e.target.value as "tip" | "warn" })} aria-label="نوع الملاحظة" className={cn(inp, "w-auto")}>
          <option value="tip">معلومة (أزرق)</option>
          <option value="warn">تحذير (أصفر)</option>
        </select>
        <textarea rows={2} defaultValue={b.note} onChange={(e) => onChange({ ...b, note: e.target.value })} aria-label="نص الملاحظة" className={inp} />
      </div>
    );
  }
  if ("table" in b) {
    return (
      <div>
        <div className="mb-1 text-xs text-muted">السطر الأول عناوين الأعمدة، وكل سطر بعده صف. افصل بين الخانات بـ «|».</div>
        <textarea rows={Math.min(14, b.table.rows.length + 2)} defaultValue={tableText(b.table)} dir="auto" aria-label="الجدول"
          onChange={(e) => onChange({ table: parseTable(e.target.value) })} className={cn(inp, "text-xs leading-6")} />
      </div>
    );
  }
  if ("img" in b) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <ImagePicker value={b.img || undefined} onChange={(id) => onChange({ ...b, img: id ?? "" })} label="صورة الدليل" size="size-24" />
        <input defaultValue={b.caption ?? ""} onChange={(e) => onChange({ ...b, caption: e.target.value })} placeholder="وصف الصورة (اختياري)" aria-label="وصف الصورة" className={cn(inp, "min-w-48 flex-1")} />
      </div>
    );
  }
  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-muted"><Database className="size-4" /> {AUTO_LABEL[b.auto]} — يُملأ تلقائياً ويتغير مع بيانات المحطة.</div>
      {b.auto === "categories" && (
        <div className="mt-2 grid gap-2" data-testid="guide-why">
          {byCategory(tests, Object.keys(why)).map(([c]) => (
            <label key={c} className="text-xs font-semibold">{c}
              <textarea rows={2} defaultValue={why[c] ?? ""} onChange={(e) => onWhy(c, e.target.value)} aria-label={`أهمية ${c}`} className={cn(inp, "mt-0.5 font-normal")} />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function AddBlock({ onAdd }: { onAdd: (b: GuideBlock) => void }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs" data-testid="guide-add-block">
      <span className="text-muted">إضافة:</span>
      {NEW_BLOCKS.map((n) => (
        <button key={n.label} type="button" onClick={() => onAdd(n.make())} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 hover:bg-canvas">
          {n.icon} {n.label}
        </button>
      ))}
      <select value="" onChange={(e) => { if (e.target.value) onAdd({ auto: e.target.value as (typeof AUTO_BLOCKS)[number] }); }} aria-label="من بيانات المحطة"
        className="rounded-md border border-line bg-surface px-2 py-1">
        <option value="">من بيانات المحطة…</option>
        {AUTO_BLOCKS.map((a) => <option key={a} value={a}>{AUTO_LABEL[a]}</option>)}
      </select>
    </div>
  );
}

export function ChapterEditor({ ch, no, count, sv, tests, why, onChange, onWhy, onMove, onDelete, onRestore }: {
  ch: GuideChapter; no: number; count: number; sv: number;
  tests: TrainingTest[]; why: Record<string, string>;
  /** `structural`: a move / add / delete (the fields are re-created). */
  onChange: (ch: GuideChapter, structural?: boolean) => void;
  onWhy: (cat: string, text: string) => void;
  onMove: (d: -1 | 1) => void; onDelete: () => void;
  /** Bring back the built-in text of this chapter (built-in chapters only). */
  onRestore?: () => void;
}) {
  const setSec = (i: number, s: GuideSection, structural = false) => onChange({ ...ch, sections: ch.sections.map((x, j) => (j === i ? s : x)) }, structural);
  return (
    <section id={`ch-${ch.id}`} data-chapter={ch.id} data-editing="1" className="scroll-mt-4 rounded-2xl border-2 border-dashed border-brand/40 bg-surface p-5 shadow-[var(--shadow-card)]">
      <div className="mb-3 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-lg font-extrabold text-white">{no}</span>
        <div className="grid min-w-0 flex-1 gap-1.5">
          <input key={`t${sv}`} defaultValue={ch.title} onChange={(e) => onChange({ ...ch, title: e.target.value })} aria-label="عنوان الفصل" className={cn(inp, "text-base font-bold")} />
          <textarea key={`i${sv}`} rows={2} defaultValue={ch.intro} onChange={(e) => onChange({ ...ch, intro: e.target.value })} aria-label="مقدمة الفصل" className={inp} />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Tools i={no - 1} n={count} onMove={onMove} onDelete={onDelete} what="الفصل" />
          {onRestore && (
            <button type="button" onClick={onRestore} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs text-muted hover:bg-canvas hover:text-ink" data-testid="guide-chapter-restore">
              <RotateCcw className="size-3.5" /> النص الأصلي
            </button>
          )}
        </div>
      </div>

      {ch.sections.map((s, i) => (
        <div key={`${sv}-${i}`} className="mt-3 rounded-xl border border-line bg-canvas/60 p-3" data-testid="guide-section-edit">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-5 w-1.5 shrink-0 rounded bg-brand" />
            <input defaultValue={s.title} onChange={(e) => setSec(i, { ...s, title: e.target.value })} placeholder="عنوان القسم" aria-label="عنوان القسم" className={cn(inp, "font-semibold")} />
            <Tools i={i} n={ch.sections.length} what="القسم"
              onMove={(d) => onChange({ ...ch, sections: move(ch.sections, i, d) }, true)}
              onDelete={() => { if (confirm(`حذف القسم «${s.title || "بلا عنوان"}» بكل ما فيه؟`)) onChange({ ...ch, sections: ch.sections.filter((_, j) => j !== i) }, true); }} />
          </div>
          <div className="grid gap-2">
            {s.blocks.map((b, j) => (
              <div key={j} className="flex items-start gap-2 rounded-lg border border-line bg-surface p-2" data-testid="guide-block-edit">
                <div className="min-w-0 flex-1">
                  <BlockEdit b={b} tests={tests} why={why} onWhy={onWhy}
                    onChange={(nb) => setSec(i, { ...s, blocks: s.blocks.map((x, k) => (k === j ? nb : x)) }, ("list" in b && "steps" in nb) || ("steps" in b && "list" in nb))} />
                </div>
                <Tools i={j} n={s.blocks.length} what="الفقرة"
                  onMove={(d) => setSec(i, { ...s, blocks: move(s.blocks, j, d) }, true)}
                  onDelete={() => setSec(i, { ...s, blocks: s.blocks.filter((_, k) => k !== j) }, true)} />
              </div>
            ))}
          </div>
          <AddBlock onAdd={(b) => setSec(i, { ...s, blocks: [...s.blocks, b] }, true)} />
        </div>
      ))}
      <button type="button" onClick={() => onChange({ ...ch, sections: [...ch.sections, { title: "قسم جديد", blocks: [{ p: "" }] }] }, true)}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-brand/50 px-3 py-1.5 text-sm text-brand-dark hover:bg-brand-light" data-testid="guide-add-section">
        <Plus className="size-4" /> إضافة قسم
      </button>
    </section>
  );
}
