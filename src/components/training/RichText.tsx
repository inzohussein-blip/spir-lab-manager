"use client";

import { Fragment, useRef, type ReactNode } from "react";
import { Bold, Highlighter, List } from "lucide-react";

/**
 * Minimal formatting for the Training station (no HTML stored):
 *   **bold**   ==highlighted warning==   lines starting with "- " or "• " → bullet list
 */
function inline(text: string, keyBase: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|==[^=]+==)/g).map((part, i) => {
    const k = `${keyBase}-${i}`;
    if (/^\*\*[^*]+\*\*$/.test(part)) return <b key={k}>{part.slice(2, -2)}</b>;
    if (/^==[^=]+==$/.test(part)) return <mark key={k} className="rounded bg-amber-100 px-0.5 font-semibold text-red-700">{part.slice(2, -2)}</mark>;
    return <Fragment key={k}>{part}</Fragment>;
  });
}

export function RichText({ text, className = "" }: { text?: string; className?: string }) {
  if (!text?.trim()) return null;
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = (key: string) => {
    if (!bullets.length) return;
    blocks.push(<ul key={key} className="my-0.5 list-disc ps-5">{bullets.map((b, i) => <li key={i}>{inline(b, `${key}-${i}`)}</li>)}</ul>);
    bullets = [];
  };
  lines.forEach((ln, i) => {
    const m = /^\s*[-•]\s+(.*)$/.exec(ln);
    if (m) { bullets.push(m[1]); return; }
    flush(`ul-${i}`);
    blocks.push(ln.trim() ? <div key={`p-${i}`}>{inline(ln, `p-${i}`)}</div> : <div key={`p-${i}`} className="h-2" />);
  });
  flush("ul-end");
  return <div className={className}>{blocks}</div>;
}

/** Textarea with a tiny toolbar: bold, highlight, bullet list. */
export function RichTextarea({
  value, onChange, rows = 3, placeholder, className = "",
}: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; className?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function wrap(mark: string) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const sel = value.slice(a, b) || "نص";
    const next = value.slice(0, a) + mark + sel + mark + value.slice(b);
    onChange(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + mark.length, a + mark.length + sel.length); });
  }
  function bullets() {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const start = value.lastIndexOf("\n", a - 1) + 1;
    const block = value.slice(start, b);
    const out = block.split("\n").map((l) => (/^\s*[-•]\s+/.test(l) ? l : `- ${l}`)).join("\n");
    onChange(value.slice(0, start) + out + value.slice(b));
    requestAnimationFrame(() => el.focus());
  }

  const btn = "grid size-7 place-items-center rounded-md text-muted hover:bg-canvas hover:text-ink";
  return (
    <div className={`overflow-hidden rounded-lg border border-line bg-surface focus-within:border-brand ${className}`}>
      <div className="flex items-center gap-0.5 border-b border-line px-1 py-0.5">
        <button type="button" title="عريض — **نص**" onClick={() => wrap("**")} className={btn}><Bold className="size-3.5" /></button>
        <button type="button" title="تنبيه ملوّن — ==نص==" onClick={() => wrap("==")} className={btn}><Highlighter className="size-3.5" /></button>
        <button type="button" title="قائمة نقطية" onClick={bullets} className={btn}><List className="size-3.5" /></button>
      </div>
      <textarea
        ref={ref}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="block w-full resize-y bg-transparent px-3 py-2 text-sm outline-none"
      />
    </div>
  );
}
