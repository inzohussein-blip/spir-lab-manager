"use client";

import { useState } from "react";
import { Building2, Plus, Trash2, RefreshCw, KeyRound, CheckCircle2, AlertTriangle } from "lucide-react";
import { labs, addLab, removeLab, refreshAll, useDoctor, FETCH_ERRORS } from "@/lib/doctors/viewer";
import { WINDOW_LABEL } from "@/lib/doctors/code";
import { card, btn } from "@/components/sync/parts";
import { PageHead } from "@/components/sync/ui";
import { cn, fmtDateTime } from "@/lib/utils";

/** «المختبرات»: the codes the labs gave this doctor (several labs on one device). */
export default function DoctorLabs() {
  useDoctor();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const list = labs();

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await addLab(code);
    setBusy(false);
    if (r.ok) { setCode(""); setMsg({ ok: true, text: `أُضيف «${r.lab.name}» — ${r.lab.snap?.visits.length ?? 0} نتيجة.` }); }
    else setMsg({ ok: false, text: FETCH_ERRORS[r.error] ?? FETCH_ERRORS.unreachable });
  }

  return (
    <div className="space-y-5">
      <PageHead icon={<Building2 />} title="المختبرات" sub="أضف «رمز الطبيب» الذي أعطاك إياه كل مختبر">
        {list.length > 0 && (
          <button onClick={async () => { setRefreshing(true); await refreshAll(); setRefreshing(false); }} disabled={refreshing} className={cn(btn, "border border-line bg-surface hover:bg-canvas")}>
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} /> تحديث الكل
          </button>
        )}
      </PageHead>

      <form onSubmit={add} className={cn(card, "space-y-3")} data-testid="add-lab">
        <div className="flex items-center gap-2 font-bold"><KeyRound className="size-5 text-brand" /> إضافة رمز مختبر</div>
        <div className="flex flex-wrap gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value)} aria-label="رمز الطبيب" placeholder="XXXX-XXXX-XXXX" dir="ltr" autoComplete="off" spellCheck={false}
            className="min-w-56 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-center font-mono text-base uppercase tracking-widest outline-none focus:border-brand" />
          <button disabled={busy || code.trim().length < 12} className={cn(btn, "bg-brand text-white hover:bg-brand-dark")}>
            {busy ? <RefreshCw className="size-4 animate-spin" /> : <Plus className="size-4" />} إضافة
          </button>
        </div>
        {msg && (
          <p role="status" data-testid="add-lab-msg" className={cn("flex items-center gap-1.5 text-sm", msg.ok ? "text-emerald-700" : "text-red-700")}>
            {msg.ok ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />} {msg.text}
          </p>
        )}
        <p className="text-xs text-muted">الرمز يفتح نتائجك على هذا الجهاز فقط؛ الخادم لا يعرفه ولا يستطيع قراءة النتائج.</p>
      </form>

      {list.length > 0 && (
        <ul className="space-y-2" data-testid="doctor-labs">
          {list.map((l) => (
            <li key={l.id} className={cn(card, "flex flex-wrap items-center gap-3 p-4")} data-testid="doctor-lab" data-lab={l.name}>
              <span className="grid size-10 place-items-center rounded-xl bg-brand-light text-brand-dark"><Building2 className="size-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{l.name}</span>
                <span className="block text-xs text-muted">
                  {l.snap ? `${l.snap.visits.length} نتيجة · يعرض ${WINDOW_LABEL[l.snap.window]} · رُفعت ${fmtDateTime(l.snap.at)}` : "لا نتائج الآن"}
                </span>
                {l.error && l.error !== "offline" && (
                  <span className="mt-0.5 block text-xs text-amber-700" data-testid="lab-status">
                    {l.error === "not_found" ? "أوقف المختبر هذا الرمز أو لم يرفع النتائج بعد." : FETCH_ERRORS[l.error] ?? FETCH_ERRORS.unreachable}
                  </span>
                )}
              </span>
              <button onClick={() => { if (window.confirm(`إزالة «${l.name}» ونتائجه من هذا الجهاز؟`)) removeLab(l.id); }}
                className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-xs text-red-700 hover:bg-red-50">
                <Trash2 className="size-3.5" /> إزالة
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
