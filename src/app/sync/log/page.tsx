"use client";

import { useState } from "react";
import { History, Trash2 } from "lucide-react";
import { clearSyncLog, syncLog } from "@/lib/local/fileSync";
import { card, when } from "@/components/sync/parts";

/** «سجل المزامنة»: the files this computer exported and brought in (the last 30). */
export default function SyncLogPage() {
  const [log, setLog] = useState(syncLog);
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><History className="size-6 text-brand" /> سجل المزامنة</h1>
          <p className="mt-1 text-sm text-muted">آخر 30 عملية على هذا الحاسوب.</p>
        </div>
        <button type="button" disabled={!log.length} onClick={() => { if (confirm("مسح سجل المزامنة؟ البيانات لا تتأثر.")) { clearSyncLog(); setLog([]); } }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas disabled:opacity-50"><Trash2 className="size-4" /> مسح السجل</button>
      </div>
      <section className={card} data-testid="sync-log">
        {log.length === 0 ? <p className="text-sm text-muted">لم تتم مزامنة بعد.</p> : (
          <ul className="flex flex-col gap-1 text-sm">
            {log.map((e, i) => (
              <li key={i} className="flex flex-wrap gap-x-3 rounded-lg bg-canvas px-3 py-1.5">
                <span className="text-xs text-muted">{when(e.at)}</span>
                {e.dir === "out"
                  ? <span className="flex-1">تصدير ملف ({e.records} سجل)</span>
                  : <span className="flex-1">إدخال ملف من «{e.device}»: +{e.added} · تحديث {e.updated} · حذف {e.removed}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
