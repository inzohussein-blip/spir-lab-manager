"use client";

import { syncMasterOn } from "@/lib/sync/protocol";
import { PausedNotice } from "@/components/sync/PausedNotice";
import { useRef, useState } from "react";
import { Download, Upload, FileSearch, FileDown, Send, Inbox, CheckCircle2, Check, Loader2, AlertTriangle } from "lucide-react";
import { exportSync, importSync, isSyncFile, setDeviceName, syncFileName, thisDevice, type ImportResult, type SyncFile } from "@/lib/local/fileSync";
import { card, btn, when } from "@/components/sync/parts";
import { PageHead, StationTile, Figure } from "@/components/sync/ui";

const ERR: Record<string, string> = {
  not_sync: "هذا الملف ليس ملف مزامنة (اختر الملف الذي صدّرته «محطة المزامنة» في الحاسوب الآخر).",
  same_device: "هذا الملف من هذا الحاسوب نفسه — أدخل ملفاً من حاسوب آخر.",
  paused: "المزامنة موقوفة على هذا الحاسوب (الحماية) — شغّلها من «الإعدادات ← الحماية» أولاً.",
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

  const [drag, setDrag] = useState(false);
  const [sent, setSent] = useState(false);
  const [paused] = useState(() => !syncMasterOn());

  return (
    <div className="flex max-w-5xl flex-col gap-5">
      <PageHead icon={<FileDown />} title="المزامنة بملف" sub="بلا إنترنت: صدّر «ملف المزامنة» من حاسوب وأدخله في الآخر (فلاشة، مجلد مشترك، واتساب)، ثم بالعكس." />

      {paused && <PausedNotice />}

      {/* The three steps */}
      <ol className="grid gap-2 sm:grid-cols-3">
        {["على هذا الحاسوب: «تصدير ملف المزامنة».", "على الحاسوب الآخر: «محطة المزامنة» ← «المزامنة بملف» ← «إدخال ملف من حاسوب آخر».", "كرّر بالعكس ليحصل هذا الحاسوب على ما عند الآخر."].map((t, i) => (
          <li key={i} className="flex items-start gap-2.5 rounded-2xl border border-line bg-surface p-3 text-sm shadow-[var(--shadow-card)]">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white">{i + 1}</span>
            <span className="pt-0.5 text-muted">{t}</span>
          </li>
        ))}
      </ol>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Out */}
        <section className={`${card} flex flex-col`}>
          <div className="mb-1 flex items-center gap-2 font-bold"><Send className="size-4 text-brand" /> إرسال من هذا الحاسوب</div>
          <p className="mb-3 text-xs text-muted">ملف واحد فيه بيانات المحطات المشتركة على هذا الحاسوب.</p>
          <label className="mb-3 block text-sm">اسم هذا الحاسوب في الملف
            <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setDeviceName(name)} aria-label="اسم الحاسوب" placeholder="مثلاً: حاسوب الاستقبال"
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand" />
          </label>
          <button type="button" disabled={paused} onClick={() => void download().then(() => setSent(true))} className={`${btn} mt-auto w-full disabled:opacity-50 bg-brand py-3 text-white hover:bg-brand-dark`} data-testid="sync-export">
            <Download className="size-4" /> تصدير ملف المزامنة
          </button>
          {sent && <p className="mt-2 flex items-center gap-1.5 text-xs text-green-700"><CheckCircle2 className="size-3.5" /> صُدّر الملف — انقله إلى الحاسوب الآخر وأدخله هناك.</p>}
        </section>

        {/* In */}
        <section className={card}>
          <div className="mb-1 flex items-center gap-2 font-bold"><Inbox className="size-4 text-brand" /> استقبال من حاسوب آخر</div>
          <p className="mb-3 text-xs text-muted">اختر الملف أو اسحبه إلى هنا. تراه قبل إدخاله.</p>
          <button type="button" disabled={busy || paused} onClick={() => file.current?.click()} data-testid="sync-drop"
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) void read(f); }}
            className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-7 text-sm transition-colors disabled:opacity-60 ${drag ? "border-brand bg-brand-light" : "border-line hover:border-brand hover:bg-canvas"}`}>
            <Upload className="size-7 text-brand" />
            <b>إدخال ملف من حاسوب آخر</b>
            <span className="text-xs text-muted">ملف ‎.json‎ صدّرته «محطة المزامنة»</span>
          </button>
          <input ref={file} type="file" accept="application/json,.json" hidden aria-label="ملف المزامنة" data-testid="sync-file"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = ""; }} />
        </section>
      </div>

      {pending && (
        <section className={`${card} border-2 border-brand`} data-testid="sync-preview">
          <div className="mb-2 flex items-center gap-2 font-bold"><FileSearch className="size-4 text-brand" /> قبل الإدخال: ما في الملف</div>
          <p className="mb-3 text-sm">من «<b>{pending.sum.from}</b>» — صُدّر {when(pending.sum.at)}</p>
          <ul className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {pending.sum.per.map(([st, n]) => <StationTile key={st} id={st} n={n} />)}
          </ul>
          <p className="mb-3 text-xs text-muted">يُضاف الناقص، ويؤخذ الأحدث لكل سجل، ويُحذف ما حُذف لاحقاً في الحاسوب الآخر. لا يُمسّ شيء آخر.</p>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => void bringIn()} className={`${btn} bg-brand text-white hover:bg-brand-dark disabled:opacity-60`} data-testid="sync-apply">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} إدخال الملف
            </button>
            <button type="button" onClick={() => setPending(null)} className={`${btn} border border-line hover:bg-canvas`}>إلغاء</button>
          </div>
        </section>
      )}

      {result && (
        <section data-testid="sync-result" className={`rounded-2xl border p-4 text-sm ${result.ok ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-red-50 text-red-700"}`}>
          {result.ok ? (
            <>
              <div className="mb-3 flex items-center gap-2 font-semibold"><CheckCircle2 className="size-4" />
                <span>تمت المزامنة مع «{result.from}»: أُضيف <b>{result.added}</b>، حُدّث <b>{result.updated}</b>، حُذف <b>{result.removed}</b>، وبقي <b>{result.kept}</b> كما هو.</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-hidden>
                <Figure label="أُضيفت" n={result.added} tone="ok" />
                <Figure label="حُدّثت" n={result.updated} tone="info" />
                <Figure label="حُذفت" n={result.removed} tone="bad" />
                <Figure label="كما هي" n={result.kept} tone="muted" />
              </div>
            </>
          ) : <span className="flex items-center gap-2"><AlertTriangle className="size-4 shrink-0" /> {ERR[result.error ?? ""] ?? "تعذّرت المزامنة."}</span>}
        </section>
      )}
    </div>
  );
}
