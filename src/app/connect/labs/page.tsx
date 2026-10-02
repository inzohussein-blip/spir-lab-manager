"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Plus, Copy, Check, BadgeCheck, ShieldQuestion, Trash2, Pencil, Download, IdCard, Link2, Mail, FileLock2 } from "lucide-react";
import QRCode from "qrcode";
import { readCard } from "@/lib/connect/crypto";
import { identity, contacts, contactById, addContact, updateContact, removeContact, myCardText, myFingerprint, unread, messagesOf, useConnect } from "@/lib/connect/store";
import { sendToContact, mailboxOn, useNet } from "@/lib/connect/net";
import { isConnected } from "@/lib/connect/direct";
import { exportFor, fileName } from "@/lib/connect/file";
import { downloadJson } from "@/lib/local/util";
import { Thread, Title, card } from "@/components/connect/Thread";
import { cn } from "@/lib/utils";

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

/** «المختبرات»: the labs this computer knows (each met once by its card), and a conversation with
 *  each — sealed for that lab only, sent directly, by the mailbox, or in a file. */
export default function LabsPage() {
  useConnect();
  useNet();
  const [sel, setSel] = useState<string>("");
  useEffect(() => {
    const fromHash = () => setSel(decodeURIComponent(window.location.hash.slice(1)));
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);
  const open = (id: string) => { setSel(id); try { history.replaceState(null, "", id ? `#${id}` : "#"); } catch { /* ignore */ } };
  const list = contacts();
  const c = sel ? contactById(sel) : undefined;
  return (
    <div className="max-w-6xl">
      <Title icon={<Building2 className="size-6" />} title="المختبرات" sub="تواصل مشفّر مع مختبر آخر: تتبادلان «بطاقة التعارف» مرة واحدة، ثم لا يفتح رسائلكما غيركما." />
      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <div className="flex flex-col gap-4">
          <section className={card} data-testid="contacts">
            <div className="mb-2 font-bold">المختبرات ({list.length})</div>
            {list.length === 0 ? <p className="text-xs text-muted">لا مختبرات بعد — أضف بطاقة مختبر أدناه.</p> : (
              <ul className="flex flex-col gap-1">
                {list.map((x) => (
                  <li key={x.id}>
                    <button onClick={() => open(x.id)} data-contact={x.name} className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start text-sm", sel === x.id ? "bg-brand-light font-semibold text-brand-dark" : "hover:bg-canvas")}>
                      {x.verified ? <BadgeCheck className="size-4 shrink-0 text-brand-dark" /> : <ShieldQuestion className="size-4 shrink-0 text-amber-600" />}
                      <span className="min-w-0 flex-1 truncate">{x.name}</span>
                      {isConnected(x.id) && <span title="متصل مباشرة" className="size-2 rounded-full bg-green-500" />}
                      {unread(`c:${x.id}`) > 0 && <span className="min-w-5 rounded-full bg-red-600 px-1.5 text-center text-[10px] font-bold text-white">{unread(`c:${x.id}`)}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <AddLab onAdded={open} />
          <MyCard />
        </div>
        {c ? <LabChat key={c.id} id={c.id} onRemoved={() => open("")} /> : (
          <div className={cn(card, "grid min-h-[40vh] place-items-center text-center text-sm text-muted")}>
            <div>
              <Building2 className="mx-auto mb-2 size-8 opacity-40" />
              اختر مختبراً من القائمة، أو أضف مختبراً ببطاقته.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LabChat({ id, onRemoved }: { id: string; onRemoved: () => void }) {
  const c = contactById(id)!;
  const direct = isConnected(id);
  const mail = mailboxOn();
  const waiting = messagesOf(`c:${id}`).filter((m) => m.dir === "out" && m.status === "pending").length;
  return (
    <div className="flex flex-col gap-3" data-testid="lab-chat">
      <section className={card}>
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-lg font-bold">{c.name}
              {c.verified
                ? <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-brand-dark"><BadgeCheck className="size-3" /> تم التحقق</span>
                : <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700"><ShieldQuestion className="size-3" /> لم يُتحقق</span>}
            </div>
            <div className="mt-1 text-xs text-muted">البصمة: <span className="font-mono tracking-wider" dir="ltr" data-testid="contact-fp">{c.fp}</span></div>
            {!c.verified && <p className="mt-1 text-xs text-amber-700">اتصل بالمختبر وقارن البصمة مع ما يظهر عنده في «بطاقتي» قبل إرسال معلومات مهمة.</p>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {!c.verified && <button onClick={() => updateContact(id, { verified: true })} className="rounded-lg border border-line px-3 py-1.5 text-xs hover:bg-canvas">البصمة مطابقة</button>}
            <button onClick={() => { const n = window.prompt("اسم المختبر:", c.name); if (n?.trim()) updateContact(id, { name: n.trim().slice(0, 60) }); }} aria-label="تعديل الاسم" className="grid size-8 place-items-center rounded-lg border border-line hover:bg-canvas"><Pencil className="size-3.5" /></button>
            <button onClick={() => { if (window.confirm(`حذف «${c.name}» ورسائله من هذا الحاسوب؟`)) { removeContact(id); onRemoved(); } }} aria-label="حذف المختبر" className="grid size-8 place-items-center rounded-lg border border-line text-red-700 hover:bg-red-50"><Trash2 className="size-3.5" /></button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs" data-testid="lab-route">
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1", direct ? "bg-green-50 text-green-700" : "bg-canvas text-muted")}><Link2 className="size-3" /> {direct ? "متصل مباشرة الآن" : <Link href="/connect/direct" className="underline">اتصال مباشر</Link>}</span>
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1", mail ? "bg-sky-50 text-sky-700" : "bg-canvas text-muted")}><Mail className="size-3" /> {mail ? "صندوق البريد المشفّر مفعّل" : "صندوق البريد غير مفعّل"}</span>
          {waiting > 0 && (
            <button onClick={() => { const r = exportFor(id); if (r) downloadJson(fileName(c), r.file); }} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700 hover:bg-amber-100" data-testid="export-waiting">
              <Download className="size-3" /> {waiting} بانتظار الإرسال — تنزيلها بملف
            </button>
          )}
        </div>
      </section>
      <Thread conv={`c:${id}`} testid="contact-thread"
        note={direct ? "تُرسل مباشرة الآن." : mail ? "تُرسل عبر صندوق البريد المشفّر." : <>تنتظر حتى تتصلا مباشرة، أو نزّلها <span className="inline-flex items-center gap-0.5"><FileLock2 className="size-3" /> بملف</span> وأرسله بأي وسيلة.</>}
        onSend={(text, urgent) => { sendToContact(id, text, urgent); }} />
    </div>
  );
}

function AddLab({ onAdded }: { onAdded: (id: string) => void }) {
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  function add() {
    const card0 = readCard(text);
    if (!card0) { setErr("هذه ليست بطاقة تعارف صحيحة."); return; }
    if (card0.pub === identity().pub) { setErr("هذه بطاقة هذا الحاسوب نفسه."); return; }
    const c = addContact(card0, false);
    setText(""); setErr(""); onAdded(c.id);
  }
  return (
    <section className={card} data-testid="add-lab">
      <div className="mb-1 flex items-center gap-2 font-bold"><Plus className="size-4 text-brand-dark" /> إضافة مختبر</div>
      <p className="mb-2 text-xs text-muted">الصق «بطاقة التعارف» التي أرسلها المختبر الآخر (تبدأ بـ SPIR-CARD).</p>
      <textarea value={text} onChange={(e) => { setText(e.target.value); setErr(""); }} rows={3} aria-label="بطاقة المختبر" dir="ltr" className={cn(inp, "font-mono text-xs")} />
      <button onClick={add} disabled={!text.trim()} className="mt-2 w-full rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">إضافة</button>
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </section>
  );
}

function MyCard() {
  const text = myCardText();
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => { QRCode.toDataURL(text, { margin: 1, width: 180 }).then(setQr).catch(() => setQr("")); }, [text]);
  return (
    <section className={card} data-testid="my-card">
      <div className="mb-1 flex items-center gap-2 font-bold"><IdCard className="size-4 text-brand-dark" /> بطاقتي</div>
      <p className="mb-2 text-xs text-muted">أرسلها للمختبر الآخر ليضيفك، وقارنا البصمة بالهاتف.</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {qr && <img src={qr} alt="بطاقة التعارف" className="mx-auto mb-2 size-36 rounded-lg bg-white p-1" />}
      <div className="mb-2 text-center text-xs">البصمة: <span className="font-mono tracking-wider" dir="ltr" data-testid="my-fp">{myFingerprint()}</span></div>
      <textarea readOnly value={text} rows={3} aria-label="بطاقتي" dir="ltr" className={cn(inp, "font-mono text-xs")} onFocus={(e) => e.target.select()} />
      <button onClick={() => { navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => window.prompt("انسخ البطاقة:", text)); }}
        className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "نُسخت" : "نسخ البطاقة"}
      </button>
    </section>
  );
}
