"use client";

import { useState } from "react";
import Link from "next/link";
import { Monitor, FileDown, Network, History, AlertTriangle, ArrowLeft } from "lucide-react";
import { recordCounts, sameNameRecords, setDeviceName, syncLog, thisDevice } from "@/lib/local/fileSync";
import { companySyncOn, syncExcluded, SYNC_STATIONS } from "@/lib/sync/protocol";
import { STATION_LABEL, card, when, daysSince } from "@/components/sync/parts";

/** «محطة المزامنة ← نظرة عامة»: this computer, what it holds, and how it last synced. */
export default function SyncOverview() {
  // Rendered once the station data is loaded (LocalDataGate), so it is read right away.
  const [device, setDevice] = useState(thisDevice);
  const [name, setName] = useState(() => device.name);
  const [counts] = useState<Record<string, number>>(recordCounts);
  const [dupes] = useState(sameNameRecords);
  const [log] = useState(syncLog);
  const [auto] = useState(companySyncOn);
  const [excluded] = useState(syncExcluded);
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  const lastIn = log.find((e) => e.dir === "in");
  const lastOut = log.find((e) => e.dir === "out");
  const last = [lastIn?.at, lastOut?.at].filter((x): x is number => !!x).sort((a, b) => b - a)[0];
  // No sync by file for a week and no automatic sync: remind.
  const stale = !auto && (!last || daysSince(last) >= 7);
  const anyDupes = dupes.patients.length > 0 || dupes.stock.length > 0 || dupes.tests.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">محطة المزامنة</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          تجمع بيانات المحطات بين حواسيب مختبرك: بملف مزامنة يُنقل بين الحواسيب، أو تلقائياً عبر الإنترنت. يُضاف ما ينقص، ويؤخذ الأحدث، ويُحذف ما حُذف لاحقاً.
        </p>
      </div>

      {stale && (
        <div data-testid="sync-reminder" className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="flex-1">{last ? `آخر مزامنة قبل ${daysSince(last)} يوم.` : "لم يُزامَن هذا الحاسوب بعد."} صدّر ملف مزامنة أو شغّل المزامنة التلقائية.</span>
          <Link href="/sync/file" className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700">المزامنة بملف</Link>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={card} data-testid="sync-device">
          <div className="mb-3 flex items-center gap-2 font-bold"><Monitor className="size-4 text-brand" /> هذا الحاسوب</div>
          <label className="text-sm">اسم الحاسوب (يظهر في الحواسيب الأخرى)
            <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => { setDeviceName(name); setDevice(thisDevice()); }} placeholder="مثلاً: حاسوب الاستقبال" aria-label="اسم الحاسوب"
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand" />
          </label>
          <div className="mt-2 text-xs text-muted">المعرّف: <span className="font-mono" dir="ltr">{device.id}</span></div>
          <ul className="mt-3 grid grid-cols-2 gap-2 text-sm" data-testid="sync-counts">
            {Object.entries(STATION_LABEL).filter(([k]) => counts[k]).map(([k, label]) => (
              <li key={k} className="flex justify-between rounded-lg bg-canvas px-3 py-1.5"><span>{label}</span><b className="tabular-nums">{counts[k]}</b></li>
            ))}
            {total === 0 && <li className="col-span-2 text-xs text-muted">لا بيانات بعد على هذا الحاسوب.</li>}
          </ul>
          {excluded.length > 0 && (
            <p className="mt-2 text-xs text-muted">على هذا الحاسوب وحده: {SYNC_STATIONS.filter(([p]) => excluded.includes(p)).map(([, l]) => l).join("، ")}</p>
          )}
        </section>

        <section className={card} data-testid="sync-status">
          <div className="mb-3 font-bold">الحالة</div>
          <ul className="flex flex-col gap-2 text-sm">
            <li className="flex items-center justify-between gap-2 rounded-lg bg-canvas px-3 py-2">
              <span className="flex items-center gap-2"><Network className="size-4 text-muted" /> المزامنة التلقائية</span>
              <b className={auto ? "text-brand-dark" : "text-muted"}>{auto ? "مفعّلة" : "موقوفة"}</b>
            </li>
            <li className="flex items-center justify-between gap-2 rounded-lg bg-canvas px-3 py-2">
              <span className="flex items-center gap-2"><FileDown className="size-4 text-muted" /> آخر تصدير ملف</span>
              <span className="text-xs text-muted">{lastOut ? when(lastOut.at) : "—"}</span>
            </li>
            <li className="flex items-center justify-between gap-2 rounded-lg bg-canvas px-3 py-2">
              <span className="flex items-center gap-2"><History className="size-4 text-muted" /> آخر ملف أُدخل</span>
              <span className="text-xs text-muted">{lastIn ? `${when(lastIn.at)} — من «${lastIn.device}»` : "—"}</span>
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/sync/file" className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark">المزامنة بملف <ArrowLeft className="size-4" /></Link>
            <Link href="/sync/auto" className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">المزامنة التلقائية <ArrowLeft className="size-4" /></Link>
          </div>
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
    </div>
  );
}
