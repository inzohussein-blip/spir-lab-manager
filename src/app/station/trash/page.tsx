"use client";

import { useMemo, useState } from "react";
import { RotateCcw, Trash2, FileText, User, Search } from "lucide-react";
import { getTrash, restoreTrash, purgeTrash, TRASH_DAYS, type TrashItem } from "@/lib/station/store";

const DAY = 86_400_000;
const fmt = (ms: number) => new Date(ms).toLocaleString("ar-IQ-u-nu-latn");

/** «سلة المحذوفات»: deleted visits and patients, restorable for 30 days. */
export default function StationTrashPage() {
  // The station renders once its data is loaded (LocalDataGate), so the bin can be read at once.
  const [items, setItems] = useState<TrashItem[]>(() => getTrash());
  const [now, setNow] = useState(() => Date.now());
  const [q, setQ] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState("");
  const load = () => { setItems(getTrash()); setChecked(new Set()); setNow(Date.now()); };

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter((x) => {
      const name = x.kind === "visit" ? x.item.patient.name : x.item.name;
      const acc = x.kind === "visit" ? x.item.accession ?? "" : "";
      return name.toLowerCase().includes(t) || acc.toLowerCase().includes(t);
    });
  }, [items, q]);

  function restore(ids: string[]) {
    if (!ids.length) return;
    const n = restoreTrash(ids);
    setMsg(`استُرجع ${n} عنصر.`);
    load();
  }
  function purge(ids?: string[]) {
    const n = ids ? ids.length : items.length;
    if (!n) return;
    if (!window.confirm(ids ? `حذف ${n} عنصر نهائياً؟ لا يمكن استرجاعه بعدها.` : "إفراغ السلة وحذف كل ما فيها نهائياً؟")) return;
    purgeTrash(ids);
    setMsg(ids ? `حُذف ${n} عنصر نهائياً.` : "أُفرغت السلة.");
    load();
  }
  const toggle = (id: string) => setChecked((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Trash2 className="size-6" /> سلة المحذوفات</h1>
        <p className="mt-1 text-sm text-muted">
          الزيارات وسجلات المراجعين المحذوفة تبقى هنا {TRASH_DAYS} يوماً ثم تُحذف نهائياً. عند ربط أجهزة المختبر بقاعدة بيانات تظهر السلة نفسها على كل الأجهزة.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex min-w-56 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3">
          <Search className="size-4 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم أو رقم العيّنة…" className="w-full bg-transparent py-2 text-sm outline-none" />
        </div>
        {checked.size > 0 && (
          <>
            <button onClick={() => restore([...checked])} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
              <RotateCcw className="size-4" /> استرجاع المحدَّد ({checked.size})
            </button>
            <button onClick={() => purge([...checked])} className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50">
              حذف نهائي ({checked.size})
            </button>
          </>
        )}
        {items.length > 0 && (
          <button onClick={() => purge()} className="rounded-lg border border-line px-3 py-2 text-sm text-red-700 hover:bg-red-50">إفراغ السلة</button>
        )}
      </div>
      {msg && <p className="mb-3 text-sm text-brand-dark" role="status">{msg}</p>}

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]" data-testid="trash-list">
        {shown.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">{items.length ? "لا نتائج مطابقة." : "السلة فارغة."}</p>
        ) : (
          <ul>
            {shown.map((x) => {
              const left = Math.max(0, Math.ceil((x.deleted_at + TRASH_DAYS * DAY - now) / DAY));
              const name = x.kind === "visit" ? x.item.patient.name : x.item.name;
              return (
                <li key={x.id} data-trash={name} className={`flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-0 ${checked.has(x.id) ? "bg-brand-light/40" : ""}`}>
                  <input type="checkbox" checked={checked.has(x.id)} onChange={() => toggle(x.id)} className="size-4" aria-label={`تحديد ${name}`} />
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${x.kind === "visit" ? "bg-sky-50 text-sky-700" : "bg-violet-50 text-violet-700"}`}>
                    {x.kind === "visit" ? <FileText className="size-3.5" /> : <User className="size-3.5" />}{x.kind === "visit" ? "زيارة" : "مراجع"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{name || "—"}</div>
                    <div className="text-xs text-muted">
                      {x.kind === "visit" && <><span dir="ltr" className="font-mono">{x.item.accession ?? "—"}</span> · {fmt(x.item.created_at)} · {x.item.results.length} فحص · </>}
                      حُذف {fmt(x.deleted_at)} · يُحذف نهائياً بعد {left} يوم
                    </div>
                  </div>
                  <button onClick={() => restore([x.id])} className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1 text-xs hover:bg-canvas"><RotateCcw className="size-3.5" /> استرجاع</button>
                  <button onClick={() => purge([x.id])} title="حذف نهائي" aria-label="حذف نهائي" className="grid size-7 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50"><Trash2 className="size-4" /></button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
