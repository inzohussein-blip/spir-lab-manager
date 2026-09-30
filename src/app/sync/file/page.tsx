"use client";

import { useRef, useState } from "react";
import { Download, Upload, RefreshCw, FileSearch } from "lucide-react";
import { exportSync, importSync, isSyncFile, setDeviceName, syncFileName, thisDevice, type ImportResult, type SyncFile } from "@/lib/local/fileSync";
import { STATION_LABEL, card, btn, when } from "@/components/sync/parts";

const ERR: Record<string, string> = {
  not_sync: "هذا الملف ليس ملف مزامنة (اختر الملف الذي صدّرته «محطة المزامنة» في الحاسوب الآخر).",
  same_device: "هذا الملف من هذا الحاسوب نفسه — أدخل ملفاً من حاسوب آخر.",
  bad_json: "تعذّرت قراءة الملف.",
  other_company: "هذا الملف من حاسوب مختبر آخر (أو حاسوب غير مفعّل برمز مختبرك) — لا يُدخل هنا.",
};

/** What a sync file holds, per station (for the check before bringing it in). */
function fileSummary(f: SyncFile): { from: string; at: number; per: [string, number][] } {
  const per = new Map<string, number>();
  for (const [coll, recs] of Object.entries(f.colls)) {
    const st = coll.split(".")[0];
    per.set(st, (per.get(st) ?? 0) + Object.keys(recs ?? {}).length);
  }
  return { from: f.device?.name || f.device?.id || "?", at: f.at, per: [...per] };
}

/** «المزامنة بملف»: this computer's file out; another computer's file checked, then brought in. */
export default function SyncFilePage() {
  const [name, setName] = useState(() => thisDevice().name);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, setPending] = useState<{ raw: unknown; sum: ReturnType<typeof fileSummary> } | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  async function download() {
    if (name.trim() !== thisDevice().name) setDeviceName(name);
    const blob = new Blob([JSON.stringify(await exportSync())], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = syncFileName(); a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  async function read(f: File) {
    setResult(null); setPending(null);
    let raw: unknown;
    try { raw = JSON.parse(await f.text()); } catch { setResult({ ok: false, added: 0, updated: 0, removed: 0, kept: 0, error: "bad_json" }); return; }
    if (!isSyncFile(raw)) { setResult({ ok: false, added: 0, updated: 0, removed: 0, kept: 0, error: "not_sync" }); return; }
    setPending({ raw, sum: fileSummary(raw) });
  }
  async function bringIn() {
    if (!pending) return;
    setBusy(true);
    try { setResult(await importSync(pending.raw)); setPending(null); } finally { setBusy(false); }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">المزامنة بملف</h1>
        <p className="mt-1 text-sm text-muted">بلا إنترنت: صدّر «ملف المزامنة» من حاسوب وأدخله في الآخر (فلاشة، مجلد مشترك، واتساب)، ثم بالعكس.</p>
      </div>

      <section className={card}>
        <div className="mb-3 flex items-center gap-2 font-bold"><RefreshCw className="size-4 text-brand" /> الخطوات</div>
        <ol className="mb-4 list-inside list-decimal space-y-1 text-sm text-muted">
          <li>على هذا الحاسوب: «تصدير ملف المزامنة».</li>
          <li>على الحاسوب الآخر: «محطة المزامنة» ← «المزامنة بملف» ← «إدخال ملف من حاسوب آخر».</li>
          <li>كرّر بالعكس ليحصل هذا الحاسوب على ما عند الآخر.</li>
        </ol>
        <label className="mb-3 block text-sm">اسم هذا الحاسوب في الملف
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setDeviceName(name)} aria-label="اسم الحاسوب" placeholder="مثلاً: حاسوب الاستقبال"
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void download()} className={`${btn} bg-brand text-white hover:bg-brand-dark`} data-testid="sync-export"><Download className="size-4" /> تصدير ملف المزامنة</button>
          <button type="button" disabled={busy} onClick={() => file.current?.click()} className={`${btn} border border-line hover:bg-canvas disabled:opacity-60`}><Upload className="size-4" /> إدخال ملف من حاسوب آخر</button>
          <input ref={file} type="file" accept="application/json,.json" hidden aria-label="ملف المزامنة" data-testid="sync-file"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = ""; }} />
        </div>
      </section>

      {pending && (
        <section className={`${card} border-brand`} data-testid="sync-preview">
          <div className="mb-2 flex items-center gap-2 font-bold"><FileSearch className="size-4 text-brand" /> قبل الإدخال: ما في الملف</div>
          <p className="mb-2 text-sm">من «<b>{pending.sum.from}</b>» — صُدّر {when(pending.sum.at)}</p>
          <ul className="mb-3 grid grid-cols-2 gap-2 text-sm">
            {pending.sum.per.map(([st, n]) => (
              <li key={st} className="flex justify-between rounded-lg bg-canvas px-3 py-1.5"><span>{STATION_LABEL[st] ?? st}</span><b className="tabular-nums">{n}</b></li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => void bringIn()} className={`${btn} bg-brand text-white hover:bg-brand-dark disabled:opacity-60`} data-testid="sync-apply">إدخال الملف</button>
            <button type="button" onClick={() => setPending(null)} className={`${btn} border border-line hover:bg-canvas`}>إلغاء</button>
          </div>
        </section>
      )}

      {result && (
        <div data-testid="sync-result" className={`rounded-lg px-3 py-2 text-sm ${result.ok ? "bg-teal-50 text-brand-dark" : "bg-red-50 text-red-700"}`}>
          {result.ok
            ? <>تمت المزامنة مع «{result.from}»: أُضيف <b>{result.added}</b>، حُدّث <b>{result.updated}</b>، حُذف <b>{result.removed}</b>، وبقي <b>{result.kept}</b> كما هو.</>
            : ERR[result.error ?? ""] ?? "تعذّرت المزامنة."}
        </div>
      )}
    </div>
  );
}
