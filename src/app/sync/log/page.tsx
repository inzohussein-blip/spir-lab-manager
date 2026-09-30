"use client";

import { useMemo, useState } from "react";
import { History, Trash2, Upload, Download } from "lucide-react";
import { clearSyncLog, syncLog, type SyncLogEntry } from "@/lib/local/fileSync";
import { card, when } from "@/components/sync/parts";
import { PageHead, Figure } from "@/components/sync/ui";
import { cn } from "@/lib/utils";

type Filter = "all" | "out" | "in";
const day = (t: number) => new Date(t).toLocaleDateString("en-CA");

/** «سجل المزامنة»: the files this computer exported and brought in (the last 30), by day. */
export default function SyncLogPage() {
  const [log, setLog] = useState(syncLog);
  const [filter, setFilter] = useState<Filter>("all");
  const shown = useMemo(() => log.filter((e) => filter === "all" || e.dir === filter), [log, filter]);
  const days = useMemo(() => {
    const m = new Map<string, SyncLogEntry[]>();
    shown.forEach((e) => { const k = day(e.at); (m.get(k) ?? m.set(k, []).get(k)!).push(e); });
    return [...m];
  }, [shown]);
  const ins = log.filter((e) => e.dir === "in");
  const sum = (k: "added" | "updated" | "removed") => ins.reduce((s, e) => s + e[k], 0);

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <PageHead icon={<History />} title="سجل المزامنة" sub="آخر 30 عملية على هذا الحاسوب.">
        <button type="button" disabled={!log.length} onClick={() => { if (confirm("مسح سجل المزامنة؟ البيانات لا تتأثر.")) { clearSyncLog(); setLog([]); } }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas disabled:opacity-50"><Trash2 className="size-4" /> مسح السجل</button>
      </PageHead>

      {log.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Figure label="ملفات صُدّرت" n={log.length - ins.length} tone="info" />
          <Figure label="سجلات أُضيفت" n={sum("added")} tone="ok" />
          <Figure label="سجلات حُدّثت" n={sum("updated")} tone="info" />
          <Figure label="سجلات حُذفت" n={sum("removed")} tone="bad" />
        </div>
      )}

      <section className={card} data-testid="sync-log">
        <div className="mb-3 flex flex-wrap gap-1.5" role="tablist">
          {([["all", "الكل"], ["out", "تصدير"], ["in", "إدخال"]] as [Filter, string][]).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}
              className={cn("rounded-full border px-3 py-1 text-xs", filter === k ? "border-brand bg-brand-light font-semibold text-brand-dark" : "border-line hover:bg-canvas")}>{l}</button>
          ))}
        </div>
        {shown.length === 0 ? <p className="text-sm text-muted">{log.length ? "لا عمليات من هذا النوع." : "لم تتم مزامنة بعد."}</p> : (
          <div className="flex flex-col gap-4">
            {days.map(([d, list]) => (
              <div key={d}>
                <div className="mb-1.5 text-xs font-semibold text-muted" dir="ltr" style={{ textAlign: "right" }}>{d}</div>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {list.map((e, i) => (
                    <li key={i} className="flex items-center gap-3 rounded-xl bg-canvas px-3 py-2">
                      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg text-white", e.dir === "out" ? "bg-sky-500" : "bg-green-500")}>
                        {e.dir === "out" ? <Upload className="size-4" /> : <Download className="size-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        {e.dir === "out"
                          ? <>تصدير ملف ({e.records} سجل)</>
                          : <>إدخال ملف من «{e.device}»: +{e.added} · تحديث {e.updated} · حذف {e.removed}</>}
                      </span>
                      <span className="shrink-0 text-xs text-muted">{when(e.at)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
