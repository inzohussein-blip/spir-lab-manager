"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { FileLock2, Download, Upload } from "lucide-react";
import { contacts, contactById, useConnect } from "@/lib/connect/store";
import { exportFor, importFile, fileName } from "@/lib/connect/file";
import { downloadJson } from "@/lib/local/util";
import { Title, Notice, card } from "@/components/connect/Thread";

/** «رسالة بملف»: a sealed file for another lab (any carrier), and opening one received. */
export default function FilePage() {
  useConnect();
  const list = contacts();
  const [to, setTo] = useState(list[0]?.id ?? "");
  const [text, setText] = useState("");
  const [out, setOut] = useState("");
  const [inMsg, setInMsg] = useState<{ ok: boolean; text: string; href?: string } | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  function save() {
    const c = contactById(to);
    if (!c) return;
    const r = exportFor(to, text);
    if (!r) { setOut("لا رسائل لإرسالها — اكتب رسالة أولاً."); return; }
    downloadJson(fileName(c), r.file);
    setText(""); setOut(`نُزّل الملف (${r.count} رسالة) — أرسله لـ«${c.name}» بأي وسيلة. لا يفتحه غيره.`);
  }
  async function open(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    let raw: unknown = null;
    try { raw = JSON.parse(await f.text()); } catch { /* not json */ }
    const r = importFile(raw);
    if (!r.ok) { setInMsg({ ok: false, text: r.error === "not_for_me" ? "هذا الملف لمختبر آخر — لا يفتحه هذا الحاسوب." : r.error === "broken" ? "الملف تالف أو عُدّل." : "هذا ليس ملف رسائل." }); return; }
    setInMsg({ ok: true, text: `${r.count} رسالة جديدة من «${r.contact.name}»${r.known ? "" : " (مختبر جديد — قارن بصمته قبل الاعتماد عليه)"}.`, href: `/connect/labs#${r.contact.id}` });
  }
  return (
    <div className="max-w-3xl">
      <Title icon={<FileLock2 className="size-6" />} title="رسالة بملف" sub="رسائل مشفّرة في ملف لمختبر آخر، تُنقل بأي وسيلة (فلاش، واتساب، بريد). من ينقل الملف لا يستطيع قراءته." />
      <section className={card} data-testid="file-out">
        <div className="mb-2 flex items-center gap-2 font-bold"><Download className="size-4 text-brand-dark" /> ملف لمختبر</div>
        {list.length === 0 ? <Notice tone="info">أضف المختبر أولاً من <Link href="/connect/labs" className="underline">«المختبرات»</Link> ببطاقته.</Notice> : (
          <>
            <select value={to} onChange={(e) => { setTo(e.target.value); setOut(""); }} aria-label="المختبر" className="mb-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm">
              {list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} aria-label="نص الرسالة للملف" placeholder="الرسالة (تُضاف إليها الرسائل المنتظرة لهذا المختبر)"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand" />
            <button onClick={save} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"><Download className="size-4" /> تنزيل الملف</button>
            {out && <p className="mt-2 text-xs text-brand-dark" data-testid="file-out-msg">{out}</p>}
          </>
        )}
      </section>
      <section className={`${card} mt-4`} data-testid="file-in">
        <div className="mb-2 flex items-center gap-2 font-bold"><Upload className="size-4 text-brand-dark" /> فتح ملف مستلم</div>
        <button onClick={() => ref.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-sm hover:bg-canvas"><Upload className="size-4" /> اختيار الملف</button>
        <input ref={ref} type="file" accept="application/json,.json" onChange={open} className="hidden" data-testid="file-input" />
        {inMsg && <p className={`mt-2 text-sm ${inMsg.ok ? "text-brand-dark" : "text-red-600"}`} data-testid="file-in-msg">{inMsg.text} {inMsg.href && <Link href={inMsg.href} className="underline">فتح المحادثة</Link>}</p>}
      </section>
    </div>
  );
}
