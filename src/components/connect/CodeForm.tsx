"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { setRoomCode } from "@/lib/connect/store";
import { pollNow } from "@/lib/connect/net";
import { card } from "./Thread";

/** «رمز المحادثة» on this computer (the same on each of the lab's computers, not the sync's). */
export function CodeForm({ compact }: { compact?: boolean }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  function save() {
    const r = setRoomCode(code);
    if (!r.ok) { setErr(r.error === "short" ? "الرمز 8 أحرف أو أكثر." : "هذا رمز المزامنة — رمز المحادثة يجب أن يكون مختلفاً عنه."); return; }
    setCode(""); setErr(""); setOk(true); void pollNow();
  }
  return (
    <div className={compact ? "" : card} data-testid="room-code-form">
      {!compact && <div className="mb-1 flex items-center gap-2 font-bold"><KeyRound className="size-4 text-brand-dark" /> رمز المحادثة</div>}
      <p className="mb-3 text-xs text-muted">اختر رمزاً (8 أحرف أو أكثر) وأدخله على كل حواسيب المختبر. لا يُحفظ الرمز نفسه ولا يصل إلى الخادم، ويجب أن يختلف عن رمز المزامنة.</p>
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-wrap gap-2">
        <input type="password" value={code} onChange={(e) => { setCode(e.target.value); setErr(""); setOk(false); }} autoComplete="new-password" aria-label="رمز المحادثة"
          placeholder="رمز المحادثة" className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand" />
        <button disabled={!code} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">حفظ الرمز</button>
      </form>
      {err && <p className="mt-1.5 text-xs text-red-600" data-testid="room-code-error">{err}</p>}
      {ok && <p className="mt-1.5 text-xs text-brand-dark">حُفظ الرمز على هذا الحاسوب.</p>}
    </div>
  );
}
