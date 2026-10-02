"use client";

import { useEffect, useRef, useState } from "react";
import { Send, AlertTriangle, Clock, Check, X, BadgeCheck, Zap } from "lucide-react";
import { getSettings, messagesOf, markRead, useConnect, type Msg } from "@/lib/connect/store";
import { cn } from "@/lib/utils";

export const card = "rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]";
const time = (t: number) => {
  const d = new Date(t), now = new Date();
  const hm = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return d.toDateString() === now.toDateString() ? hm : `${d.toLocaleDateString("en-CA")} ${hm}`;
};
const VIA: Record<string, string> = { direct: "مباشر", mailbox: "صندوق البريد", file: "بملف", room: "", public: "" };

/** A conversation: its messages (newest at the bottom) and the box to write in. */
export function Thread({ conv, onSend, disabled, note, publicNames, testid = "thread" }: {
  conv: string;
  /** Send a message; return an error text to show it under the box. */
  onSend: (text: string, urgent: boolean) => Promise<string | void> | string | void;
  /** Writing is not possible now (the reason). */
  disabled?: string;
  note?: React.ReactNode;
  /** Public chat: show who is a checked lab name and who a chosen name. */
  publicNames?: boolean;
  testid?: string;
}) {
  useConnect();
  const list = messagesOf(conv);
  const [text, setText] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const quick = getSettings().quick;
  const last = list.at(-1)?.id;
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); markRead(conv); }, [conv, last]);

  async function send(t = text) {
    const v = t.trim();
    if (!v || busy || disabled) return;
    setBusy(true); setErr("");
    try {
      const e = await onSend(v.slice(0, publicNames ? 500 : 4000), urgent);
      if (e) setErr(e); else { setText(""); setUrgent(false); }
    } finally { setBusy(false); }
  }
  return (
    <div className="flex min-h-[60vh] flex-col rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]" data-testid={testid}>
      {note && <div className="border-b border-line px-4 py-2 text-xs text-muted">{note}</div>}
      <div className="flex max-h-[60vh] flex-1 flex-col gap-2 overflow-y-auto p-4" data-testid="messages">
        {list.length === 0 && <p className="m-auto text-sm text-muted">لا رسائل بعد.</p>}
        {list.map((m) => <Bubble key={m.id} m={m} publicNames={publicNames} />)}
        <div ref={end} />
      </div>
      <div className="border-t border-line p-3">
        {quick.length > 0 && !disabled && (
          <div className="mb-2 flex flex-wrap gap-1.5" data-testid="quick-replies">
            {quick.map((q) => (
              <button key={q} type="button" onClick={() => void send(q)} className="rounded-full border border-line bg-canvas px-2.5 py-1 text-xs hover:border-brand hover:text-brand-dark">{q}</button>
            ))}
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex items-end gap-2">
          <textarea value={text} onChange={(e) => { setText(e.target.value); setErr(""); }} rows={2} disabled={!!disabled} aria-label="نص الرسالة"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            placeholder={disabled || "اكتب رسالة… (Enter للإرسال، Shift+Enter لسطر جديد)"}
            className="min-h-11 flex-1 resize-y rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand disabled:opacity-60" />
          {!publicNames && (
            <button type="button" onClick={() => setUrgent((u) => !u)} aria-pressed={urgent} title="رسالة عاجلة" aria-label="رسالة عاجلة"
              className={cn("grid size-11 place-items-center rounded-xl border", urgent ? "border-red-500 bg-red-600 text-white" : "border-line text-muted hover:bg-canvas")}>
              <Zap className="size-4" />
            </button>
          )}
          <button disabled={!text.trim() || busy || !!disabled} className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
            <Send className="size-4" /> إرسال
          </button>
        </form>
        {err && <p className="mt-1.5 text-xs text-red-600" data-testid="send-error">{err}</p>}
      </div>
    </div>
  );
}

function Bubble({ m, publicNames }: { m: Msg; publicNames?: boolean }) {
  const mine = m.dir === "out";
  return (
    <div className={cn("flex", mine ? "justify-start" : "justify-end")} data-msg={m.dir}>
      <div className={cn("max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
        m.urgent ? "border-2 border-red-500" : "",
        mine ? "rounded-ss-sm bg-brand-light text-ink" : "rounded-se-sm bg-canvas ring-1 ring-line")}>
        <div className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold text-muted">
          {m.urgent && <span className="rounded bg-red-600 px-1 text-[10px] text-white">عاجل</span>}
          <span>{m.from || (mine ? "أنا" : "")}</span>
          {publicNames && (m.labName
            ? <span title="اسم المختبر كما في رمزه" className="inline-flex items-center gap-0.5 text-brand-dark"><BadgeCheck className="size-3" /> مختبر</span>
            : <span className="text-[10px] font-normal">(اسم مستعار)</span>)}
        </div>
        <div className="whitespace-pre-wrap break-words">{m.text}</div>
        <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-muted tabular-nums" dir="ltr">
          {VIA[m.via] && m.status !== "pending" && <span dir="rtl">{VIA[m.via]} ·</span>}
          {time(m.at)}
          {mine && (m.status === "pending" ? <Clock className="size-3" aria-label="بانتظار الإرسال" />
            : m.status === "failed" ? <X className="size-3 text-red-600" aria-label="لم تُرسل" />
            : <Check className="size-3 text-brand-dark" aria-label="أُرسلت" />)}
        </div>
      </div>
    </div>
  );
}

export function Notice({ tone = "warn", children, testid }: { tone?: "warn" | "info"; children: React.ReactNode; testid?: string }) {
  return (
    <div data-testid={testid} className={cn("flex items-start gap-2 rounded-xl px-4 py-3 text-sm", tone === "warn" ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200" : "bg-canvas text-muted ring-1 ring-line")}>
      <AlertTriangle className="mt-0.5 size-4 shrink-0" /> <div className="min-w-0">{children}</div>
    </div>
  );
}
export function Title({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="mb-5">
      <h1 className="flex items-center gap-2 text-2xl font-bold">{icon} {title}</h1>
      <p className="mt-1 text-sm text-muted">{sub}</p>
    </div>
  );
}
