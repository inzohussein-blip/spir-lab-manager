"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Link2, Copy, Check, X, ArrowLeft, Circle } from "lucide-react";
import QRCode from "qrcode";
import { createInvite, answerInvite, acceptAnswer, closePeer, listPeers, directSupported } from "@/lib/connect/direct";
import { getSettings, useConnect } from "@/lib/connect/store";
import { Title, Notice, card } from "@/components/connect/Thread";
import { cn } from "@/lib/utils";

const area = "w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[11px] outline-none focus:border-brand";
const STATE: Record<string, string> = { inviting: "بانتظار رمز الرد", answering: "يُجهَّز الرد", connecting: "يتصل…", open: "متصل", closed: "انقطع" };

/** «اتصال مباشر»: two computers, nothing in between — a code from one to the other and back. */
export default function DirectPage() {
  useConnect();
  const [mode, setMode] = useState<"" | "invite" | "join">("");
  if (!directSupported()) return <div className="max-w-3xl"><Title icon={<Link2 className="size-6" />} title="اتصال مباشر" sub="" /><Notice>هذا المتصفح لا يدعم الاتصال المباشر.</Notice></div>;
  const peers = listPeers();
  return (
    <div className="max-w-4xl">
      <Title icon={<Link2 className="size-6" />} title="اتصال مباشر" sub="حاسوب لحاسوب بلا أي وسيط: ينشئ أحدهما «رمز دعوة» ويرسله للآخر، فيرد الآخر بـ«رمز رد»، ثم يتصلان. الاتصال مشفّر، ويبقى ما دامت المحطة مفتوحة عند الطرفين." />
      {!getSettings().stun && (
        <Notice tone="info">يعمل الآن داخل شبكة المختبر فقط. لتتصل بمختبر آخر عبر الإنترنت فعّل «المساعدة في إيجاد الطريق (STUN)» من <Link href="/connect/settings#labs" className="underline">الإعدادات</Link>.</Notice>
      )}
      <div className="my-4 flex flex-wrap gap-2">
        <button onClick={() => setMode("invite")} aria-pressed={mode === "invite"} className={cn("rounded-xl px-4 py-2.5 text-sm font-semibold", mode === "invite" ? "bg-brand text-white" : "border border-line bg-surface hover:bg-canvas")}>إنشاء رمز دعوة</button>
        <button onClick={() => setMode("join")} aria-pressed={mode === "join"} className={cn("rounded-xl px-4 py-2.5 text-sm font-semibold", mode === "join" ? "bg-brand text-white" : "border border-line bg-surface hover:bg-canvas")}>لديّ رمز دعوة</button>
      </div>
      {mode === "invite" && <Invite />}
      {mode === "join" && <Join />}

      <section className={cn(card, "mt-4")} data-testid="peers">
        <div className="mb-2 font-bold">الاتصالات ({peers.length})</div>
        {peers.length === 0 ? <p className="text-sm text-muted">لا اتصالات بعد.</p> : (
          <ul className="divide-y divide-line text-sm">
            {peers.map((p) => (
              <li key={p.id} className="flex items-center gap-2 py-2" data-peer-state={p.state}>
                <Circle className={cn("size-2.5", p.state === "open" ? "fill-green-500 text-green-500" : "fill-slate-300 text-slate-300")} />
                <span className="flex-1">{p.name ?? "—"} <span className="text-xs text-muted">· {STATE[p.state]}</span></span>
                {p.state === "open" && p.contactId && <Link href={`/connect/labs#${p.contactId}`} className="inline-flex items-center gap-1 text-xs text-brand-dark hover:underline">المحادثة <ArrowLeft className="size-3" /></Link>}
                <button onClick={() => closePeer(p.id)} aria-label="إنهاء الاتصال" className="grid size-7 place-items-center rounded-md hover:bg-canvas"><X className="size-3.5" /></button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CodeBox({ code, label, testid }: { code: string; label: string; testid: string }) {
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => { QRCode.toDataURL(code, { margin: 1, width: 220, errorCorrectionLevel: "L" }).then(setQr).catch(() => setQr("")); }, [code]);
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
      <div>
        <textarea readOnly value={code} rows={5} aria-label={label} dir="ltr" data-testid={testid} className={area} onFocus={(e) => e.target.select()} />
        <button onClick={() => navigator.clipboard?.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => window.prompt("انسخ الرمز:", code))}
          className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs hover:bg-canvas">{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? "نُسخ" : "نسخ الرمز"}</button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {qr && <img src={qr} alt={label} className="size-44 rounded-lg bg-white p-1" />}
    </div>
  );
}

function Invite() {
  const [inv, setInv] = useState<{ peer: string; code: string } | null>(null);
  const [answer, setAnswer] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => { void createInvite().then(setInv); }, []);
  if (!inv) return <div className={card}>يُجهَّز رمز الدعوة…</div>;
  return (
    <section className={card} data-testid="invite">
      <div className="mb-2 font-bold">1. أرسل رمز الدعوة للحاسوب الآخر</div>
      <CodeBox code={inv.code} label="رمز الدعوة" testid="invite-code" />
      <div className="mb-2 mt-4 font-bold">2. الصق رمز الرد الذي يعطيك إياه</div>
      <textarea value={answer} onChange={(e) => { setAnswer(e.target.value); setMsg(""); }} rows={4} aria-label="رمز الرد" dir="ltr" className={area} />
      <button disabled={!answer.trim()} onClick={async () => { const r = await acceptAnswer(inv.peer, answer); setMsg(r.ok ? "يتصل… سيظهر «متصل» في القائمة أدناه." : "رمز الرد غير صحيح."); }}
        className="mt-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">اتصال</button>
      {msg && <p className="mt-1.5 text-xs text-muted">{msg}</p>}
    </section>
  );
}

function Join() {
  const [code, setCode] = useState("");
  const [answer, setAnswer] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className={card} data-testid="join">
      <div className="mb-2 font-bold">1. الصق رمز الدعوة</div>
      <textarea value={code} onChange={(e) => { setCode(e.target.value); setErr(""); }} rows={4} aria-label="رمز الدعوة المستلم" dir="ltr" className={area} disabled={!!answer} />
      {!answer && (
        <button disabled={!code.trim() || busy} onClick={async () => { setBusy(true); const r = await answerInvite(code); setBusy(false); if (r.ok) setAnswer(r.code); else setErr("رمز الدعوة غير صحيح."); }}
          className="mt-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">{busy ? "يُجهَّز…" : "إنشاء رمز الرد"}</button>
      )}
      {err && <p className="mt-1.5 text-xs text-red-600">{err}</p>}
      {answer && (
        <>
          <div className="mb-2 mt-4 font-bold">2. أعطِ رمز الرد للحاسوب الذي دعاك</div>
          <CodeBox code={answer} label="رمز الرد" testid="answer-code" />
        </>
      )}
    </section>
  );
}
