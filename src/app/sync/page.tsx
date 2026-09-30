"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Download, Upload, Monitor, RefreshCw, History, Network, Settings } from "lucide-react";
import { exportSync, importSync, recordCounts, sameNameRecords, setDeviceName, syncFileName, syncLog, thisDevice, type ImportResult, type SyncLogEntry } from "@/lib/local/fileSync";
import { STATION_SYNC } from "@/lib/sync/protocol";
import { CompanySyncCard } from "@/components/local/CompanySyncCard";
import { SyncPanel } from "@/components/local/SyncPanel";

const STATIONS: Record<string, string> = {
  station: "محطة المختبر", purchasing: "المشتريات", training: "التدريب والمعلومات", qc: "الجودة والأجهزة", roster: "الكادر والدوام",
};
const card = "rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]";
const btn = "inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold";
const when = (t: number) => new Date(t).toLocaleString("ar-IQ-u-nu-latn", { dateStyle: "medium", timeStyle: "short" });
const ERR: Record<string, string> = {
  not_sync: "هذا الملف ليس ملف مزامنة (اختر الملف الذي صدّرته «محطة المزامنة» في الحاسوب الآخر).",
  same_device: "هذا الملف من هذا الحاسوب نفسه — أدخل ملفاً من حاسوب آخر.",
  bad_json: "تعذّرت قراءة الملف.",
  other_company: "هذا الملف من حاسوب مختبر آخر (أو حاسوب غير مفعّل برمز مختبرك) — لا يُدخل هنا.",
};

/** «محطة المزامنة»: this computer, its sync file out, another computer's file in. */
export default function SyncStation() {
  // Rendered once the station data is loaded (LocalDataGate), so it is read right away.
  const [device, setDevice] = useState(thisDevice);
  const [name, setName] = useState(() => device.name);
  const [counts, setCounts] = useState<Record<string, number>>(recordCounts);
  const [log, setLog] = useState<SyncLogEntry[]>(syncLog);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dupes, setDupes] = useState(sameNameRecords);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const refresh = () => { setDevice(thisDevice()); setCounts(recordCounts()); setLog(syncLog()); setDupes(sameNameRecords()); };

  async function download() {
    if (name.trim() !== device.name) setDeviceName(name);
    const blob = new Blob([JSON.stringify(await exportSync())], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = syncFileName(); a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    refresh();
  }
  async function bringIn(f: File) {
    setBusy(true); setResult(null);
    try {
      let raw: unknown;
      try { raw = JSON.parse(await f.text()); } catch { setResult({ ok: false, added: 0, updated: 0, removed: 0, kept: 0, error: "bad_json" }); return; }
      setResult(await importSync(raw));
      refresh();
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  const anyDupes = dupes.patients.length > 0 || dupes.stock.length > 0 || dupes.tests.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/welcome" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowRight className="size-4" /> الرئيسية</Link>
        <h1 className="flex-1 text-xl font-bold">محطة المزامنة</h1>
        <Link href="/sync/settings" className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-surface" data-testid="sync-settings-link"><Settings className="size-4" /> الإعدادات</Link>
      </div>
      <p className="text-sm leading-relaxed text-muted">
        تجمع بيانات المحطات بين حواسيب مختبرك. صدّر «ملف المزامنة» من حاسوب وأدخله في الآخر (عبر فلاشة أو مجلد مشترك أو واتساب)، ثم بالعكس — فيصبح لدى الحاسوبين كل السجلات.
        يُضاف ما ينقص، ويؤخذ الأحدث عند تعديل السجل نفسه في الحاسوبين، ويُحذف ما حُذف في الآخر لاحقاً. أو شغّل «المزامنة التلقائية» أدناه لتتزامن حواسيب المختبر وحدها عبر الإنترنت.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={card} data-testid="sync-device">
          <div className="mb-3 flex items-center gap-2 font-bold"><Monitor className="size-4 text-brand" /> هذا الحاسوب</div>
          <label className="text-sm">اسم الحاسوب (يظهر في الحاسوب الآخر)
            <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => { setDeviceName(name); refresh(); }} placeholder="مثلاً: حاسوب الاستقبال" aria-label="اسم الحاسوب"
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand" />
          </label>
          <div className="mt-2 text-xs text-muted">المعرّف: <span className="font-mono" dir="ltr">{device.id}</span></div>
          <ul className="mt-3 grid grid-cols-2 gap-2 text-sm" data-testid="sync-counts">
            {Object.entries(STATIONS).filter(([k]) => counts[k]).map(([k, label]) => (
              <li key={k} className="flex justify-between rounded-lg bg-canvas px-3 py-1.5"><span>{label}</span><b className="tabular-nums">{counts[k]}</b></li>
            ))}
            {total === 0 && <li className="col-span-2 text-xs text-muted">لا بيانات بعد على هذا الحاسوب.</li>}
          </ul>
        </section>

        <section className={card}>
          <div className="mb-3 flex items-center gap-2 font-bold"><RefreshCw className="size-4 text-brand" /> المزامنة بملف</div>
          <ol className="mb-4 list-inside list-decimal space-y-1 text-sm text-muted">
            <li>على هذا الحاسوب: «تصدير ملف المزامنة».</li>
            <li>على الحاسوب الآخر: افتح «محطة المزامنة» ← «إدخال ملف من حاسوب آخر».</li>
            <li>كرّر بالعكس ليحصل هذا الحاسوب على ما عند الآخر.</li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void download()} className={`${btn} bg-brand text-white hover:bg-brand-dark`} data-testid="sync-export"><Download className="size-4" /> تصدير ملف المزامنة</button>
            <button type="button" disabled={busy} onClick={() => file.current?.click()} className={`${btn} border border-line hover:bg-canvas disabled:opacity-60`}><Upload className="size-4" /> إدخال ملف من حاسوب آخر</button>
            <input ref={file} type="file" accept="application/json,.json" hidden aria-label="ملف المزامنة" data-testid="sync-file" onChange={(e) => { const f = e.target.files?.[0]; if (f) void bringIn(f); }} />
          </div>
          {result && (
            <div data-testid="sync-result" className={`mt-4 rounded-lg px-3 py-2 text-sm ${result.ok ? "bg-teal-50 text-brand-dark" : "bg-red-50 text-red-700"}`}>
              {result.ok
                ? <>تمت المزامنة مع «{result.from}»: أُضيف <b>{result.added}</b>، حُدّث <b>{result.updated}</b>، حُذف <b>{result.removed}</b>، وبقي <b>{result.kept}</b> كما هو.</>
                : ERR[result.error ?? ""] ?? "تعذّرت المزامنة."}
            </div>
          )}
        </section>
      </div>

      {anyDupes && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" data-testid="sync-dupes">
          <div className="mb-1 font-bold">سجلات بالاسم نفسه</div>
          <p className="mb-2 text-xs">أُدخلت في حاسوبين كلٌّ على حدة قبل المزامنة، فبقيت نسختان. وحّدها يدوياً: احذف إحداهما (المراجعون من «سجل المراجعين»، أصناف المخزن من «المخزن» في المشتريات، الفحوصات من «إدارة الفحوصات») بعد نقل ما يلزم إلى الأخرى.</p>
          {dupes.patients.length > 0 && <div>المراجعون: <b>{dupes.patients.join("، ")}</b></div>}
          {dupes.stock.length > 0 && <div>أصناف المخزن: <b>{dupes.stock.join("، ")}</b></div>}
          {dupes.tests.length > 0 && <div>الفحوصات: <b>{dupes.tests.join("، ")}</b></div>}
        </section>
      )}

      <section className={card} data-testid="sync-log">
        <div className="mb-3 flex items-center gap-2 font-bold"><History className="size-4 text-brand" /> سجل المزامنة</div>
        {log.length === 0 ? <p className="text-xs text-muted">لم تتم مزامنة بعد.</p> : (
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

      <section className={card}>
        <div className="mb-2 flex items-center gap-2 font-bold"><Network className="size-4 text-brand" /> المزامنة عبر الشبكة</div>
        {STATION_SYNC ? <SyncPanel /> : <CompanySyncCard onSynced={refresh} />}
      </section>
    </div>
  );
}
