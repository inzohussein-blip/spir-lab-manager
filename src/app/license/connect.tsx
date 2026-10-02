"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, Globe2, Trash2, Ban, RotateCcw, RefreshCw, BadgeCheck } from "lucide-react";
import { fmtDateTime } from "@/lib/utils";

/** «محطة التواصل» in the code manager: what the provider's server carries, and the public chat's
 *  moderation (the lab behind each name, delete a message, stop a lab from posting). */
interface PubMsg { id: number; at: number; lid: string; name: string; lab: boolean; text: string; labName: string }
interface Blocked { lid: string; labName: string }
type Prefs = { connectRelay: boolean; connectPublic: boolean } & Record<string, unknown>;

async function post(body: unknown) {
  const r = await fetch("/api/license/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return r.json().catch(() => ({ ok: false }));
}
const card = "rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]";

export function ConnectOwner({ prefs, onSaved }: { prefs: Prefs; onSaved: () => void }) {
  const [list, setList] = useState<PubMsg[] | null>(null);
  const [blocked, setBlocked] = useState<Blocked[]>([]);
  const load = useCallback(async () => {
    const d = await post({ op: "connect_list" });
    if (d.ok) { setList(d.messages); setBlocked(d.blocked); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function toggle(k: "connectRelay" | "connectPublic", v: boolean) {
    await post({ op: "prefs", prefs: { ...prefs, [k]: v } });
    onSaved();
  }
  return (
    <div className="flex flex-col gap-4" data-testid="connect-owner">
      <section className={card}>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={prefs.connectRelay} onChange={(e) => void toggle("connectRelay", e.target.checked)} aria-label="صندوق البريد المشفّر" className="mt-1 size-4" />
          <span>
            <b className="inline-flex items-center gap-1"><Mail className="size-4" /> صندوق البريد المشفّر (موقوف افتراضياً)</b>
            <span className="mt-0.5 block text-xs text-muted">
              يحمل خادمك رسائل المختبرات وهي مشفّرة: المحادثة الداخلية لحواسيب المختبر على الموقع (بـ«رمز المحادثة» الذي لا يصل إليك)، والرسائل بين مختبرين (لا يفتحها إلا المختبر المقصود).
              لا تستطيع قراءتها، وتُحذف بعد 30 يوماً أو عند استلامها. موقوف: يتواصل المختبرون مباشرة أو بملف فقط.
            </span>
          </span>
        </label>
      </section>
      <section className={card}>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={prefs.connectPublic} onChange={(e) => void toggle("connectPublic", e.target.checked)} aria-label="المحادثة العامة" className="mt-1 size-4" />
          <span>
            <b className="inline-flex items-center gap-1"><Globe2 className="size-4" /> المحادثة العامة</b>
            <span className="mt-0.5 block text-xs text-muted">محادثة مشتركة بين كل المختبرات التي فيها «محطة التواصل». يظهر للمختبرات اسم مستعار أو اسم المختبر فقط؛ أنت ترى المختبر وراء كل اسم.</span>
          </span>
        </label>
      </section>

      <section className={card} data-testid="connect-public-list">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-bold">رسائل المحادثة العامة</div>
          <button onClick={() => void load()} aria-label="تحديث" className="grid size-8 place-items-center rounded-lg border border-line hover:bg-canvas"><RefreshCw className="size-4" /></button>
        </div>
        {blocked.length > 0 && (
          <div className="mb-3 rounded-xl bg-red-50 p-3 text-xs text-red-800" data-testid="connect-blocked">
            <div className="mb-1 font-semibold">مختبرات موقوفة عن الكتابة:</div>
            <ul className="flex flex-wrap gap-1.5">
              {blocked.map((b) => (
                <li key={b.lid} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 ring-1 ring-red-200">
                  {b.labName || b.lid.slice(0, 8)}
                  <button onClick={async () => { await post({ op: "connect_block", lid: b.lid, on: false }); void load(); }} aria-label={`إلغاء إيقاف ${b.labName}`} className="text-red-700"><RotateCcw className="size-3" /></button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!list ? <p className="text-sm text-muted">جارٍ التحميل…</p> : list.length === 0 ? <p className="text-sm text-muted">لا رسائل بعد.</p> : (
          <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto text-sm">
            {list.map((m) => {
              const isBlocked = blocked.some((b) => b.lid === m.lid);
              return (
                <li key={m.id} className="flex items-start gap-3 py-2" data-public-msg={m.id}>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-muted">
                      <b className="text-ink">{m.name}</b> {m.lab ? <BadgeCheck className="inline size-3 text-brand-dark" /> : "(مستعار)"} — المختبر: <b className="text-ink">{m.labName || "؟"}</b> · <span className="tabular-nums">{fmtDateTime(m.at)}</span>
                    </div>
                    <div className="whitespace-pre-wrap break-words">{m.text}</div>
                  </div>
                  <button onClick={async () => { if (window.confirm("حذف هذه الرسالة من المحادثة العامة؟")) { await post({ op: "connect_delete", id: m.id }); void load(); } }} aria-label="حذف الرسالة" className="grid size-8 place-items-center rounded-lg border border-line text-red-700 hover:bg-red-50"><Trash2 className="size-3.5" /></button>
                  {!isBlocked && <button onClick={async () => { if (window.confirm(`إيقاف «${m.labName || m.name}» عن الكتابة في المحادثة العامة؟`)) { await post({ op: "connect_block", lid: m.lid, on: true }); void load(); } }} aria-label="إيقاف المختبر" className="grid size-8 place-items-center rounded-lg border border-line text-red-700 hover:bg-red-50"><Ban className="size-3.5" /></button>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
