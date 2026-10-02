"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Monitor, FileDown, Network, History, AlertTriangle, ArrowLeft, RefreshCw, CheckCircle2, Upload, Download, Copy, Check, Lock,
} from "lucide-react";
import { recordCounts, sameNameRecords, setDeviceName, syncLog, thisDevice } from "@/lib/local/fileSync";
import { companySyncOn, syncExcluded, syncMasterOn, SYNC_STATIONS } from "@/lib/sync/protocol";
import { PausedNotice } from "@/components/sync/PausedNotice";
import { card, when, daysSince } from "@/components/sync/parts";
import { STATION_META, StationTile } from "@/components/sync/ui";
import { cn } from "@/lib/utils";

/** «محطة المزامنة ← نظرة عامة»: the state at a glance, this computer, what it holds, and the latest syncs. */
export default function SyncOverview() {
  // Rendered once the station data is loaded (LocalDataGate), so it is read right away.
  const [device, setDevice] = useState(thisDevice);
  const [name, setName] = useState(() => device.name);
  const [copied, setCopied] = useState(false);
  const [counts] = useState<Record<string, number>>(recordCounts);
  const [dupes] = useState(sameNameRecords);
  const [log] = useState(syncLog);
  const [auto] = useState(companySyncOn);
  const [excluded] = useState(syncExcluded);
  const [paused] = useState(() => !syncMasterOn());

  const total = useMemo(() => Object.values(counts).reduce((s, n) => s + n, 0), [counts]);
  const lastIn = log.find((e) => e.dir === "in");
  const lastOut = log.find((e) => e.dir === "out");
  const last = [lastIn?.at, lastOut?.at].filter((x): x is number => !!x).sort((a, b) => b - a)[0];
  // No sync by file for a week and no automatic sync: remind.
  const stale = !auto && (!last || daysSince(last) >= 7);
  const anyDupes = dupes.patients.length > 0 || dupes.stock.length > 0 || dupes.tests.length > 0;
  const excludedOf = (id: string) => SYNC_STATIONS.some(([p]) => p === `${id}.` && excluded.includes(p));

  const state = auto
    ? { tone: "ok", icon: <CheckCircle2 className="size-7" />, title: "المزامنة التلقائية تعمل", sub: "يُرسل هذا الحاسوب تعديلاته ويستقبل تعديلات الحواسيب الأخرى وحده." }
    : !last
      ? { tone: "warn", icon: <AlertTriangle className="size-7" />, title: "لم يُزامَن هذا الحاسوب بعد", sub: "صدّر ملف مزامنة وأدخله في الحاسوب الآخر، أو شغّل المزامنة التلقائية." }
      : stale
        ? { tone: "warn", icon: <AlertTriangle className="size-7" />, title: `آخر مزامنة قبل ${daysSince(last)} يوم`, sub: "صدّر ملف مزامنة أو شغّل المزامنة التلقائية." }
        : { tone: "ok", icon: <CheckCircle2 className="size-7" />, title: "تمت المزامنة مؤخراً", sub: `آخر مزامنة بملف: ${when(last)}` };

  return (
    <div className="flex max-w-5xl flex-col gap-5">
      {paused && <PausedNotice />}
      {/* The state at a glance */}
      <section className={cn("relative overflow-hidden rounded-3xl p-6 text-white shadow-[var(--shadow-card)]",
        state.tone === "ok" ? "bg-gradient-to-l from-violet-600 to-indigo-600" : "bg-gradient-to-l from-amber-500 to-orange-600")} data-testid={stale ? "sync-reminder" : "sync-hero"}>
        <RefreshCw className="pointer-events-none absolute -left-6 -top-6 size-40 opacity-10" />
        <div className="relative flex flex-wrap items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/20">{state.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium opacity-80">محطة المزامنة — بين حواسيب مختبرك</div>
            <h1 className="text-2xl font-extrabold">{state.title}</h1>
            <p className="mt-0.5 text-sm opacity-90">{state.sub}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/sync/file" className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-violet-700 hover:bg-violet-50">
              <FileDown className="size-4" /> المزامنة بملف
            </Link>
            <Link href="/sync/auto" className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/40 hover:bg-white/25">
              <Network className="size-4" /> التلقائية
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.25fr]">
        {/* This computer */}
        <section className={card} data-testid="sync-device">
          <div className="mb-3 flex items-center gap-2 font-bold"><Monitor className="size-4 text-brand" /> هذا الحاسوب</div>
          <label className="text-sm">اسم الحاسوب (يظهر في الحواسيب الأخرى)
            <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => { setDeviceName(name); setDevice(thisDevice()); }} placeholder="مثلاً: حاسوب الاستقبال" aria-label="اسم الحاسوب"
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand" />
          </label>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted">
            المعرّف: <span className="truncate font-mono" dir="ltr">{device.id}</span>
            <button type="button" onClick={() => { void navigator.clipboard?.writeText(device.id); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="grid size-6 shrink-0 place-items-center rounded-md border border-line hover:bg-canvas" aria-label="نسخ المعرّف" title="نسخ المعرّف">
              {copied ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center" data-testid="sync-status">
            <div className="rounded-xl bg-canvas px-2 py-2.5">
              <Network className={cn("mx-auto size-4", auto ? "text-green-600" : "text-muted")} />
              <div className="mt-1 text-[11px] text-muted">المزامنة التلقائية</div>
              <b className={cn("text-sm", auto ? "text-green-600" : "text-muted")}>{auto ? "مفعّلة" : "موقوفة"}</b>
            </div>
            <div className="rounded-xl bg-canvas px-2 py-2.5">
              <Upload className="mx-auto size-4 text-muted" />
              <div className="mt-1 text-[11px] text-muted">آخر تصدير ملف</div>
              <b className="block truncate text-xs">{lastOut ? when(lastOut.at) : "—"}</b>
            </div>
            <div className="rounded-xl bg-canvas px-2 py-2.5">
              <Download className="mx-auto size-4 text-muted" />
              <div className="mt-1 text-[11px] text-muted">آخر ملف أُدخل</div>
              <b className="block truncate text-xs" title={lastIn ? `من «${lastIn.device}»` : undefined}>{lastIn ? when(lastIn.at) : "—"}</b>
            </div>
          </div>
          {lastIn && <p className="mt-2 text-xs text-muted">آخر ملف أُدخل من «{lastIn.device}».</p>}
        </section>

        {/* What it holds */}
        <section className={card}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="font-bold">ما على هذا الحاسوب</span>
            <span className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-bold text-brand-dark tabular-nums">{total.toLocaleString("en-US")} سجل</span>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2" data-testid="sync-counts">
            {Object.keys(STATION_META).map((k) => (
              <StationTile key={k} id={k} n={counts[k] ?? 0} note={excludedOf(k) ? "على هذا الحاسوب وحده" : undefined} />
            ))}
          </ul>
          {excluded.length > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted"><Lock className="size-3.5" /> لا تُشارك: {SYNC_STATIONS.filter(([p]) => excluded.includes(p)).map(([, l]) => l).join("، ")} — من <Link href="/sync/settings#shared" className="text-brand-dark hover:underline">الإعدادات</Link>.</p>
          )}
        </section>
      </div>

      {anyDupes && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" data-testid="sync-dupes">
          <div className="mb-1 flex items-center gap-2 font-bold"><AlertTriangle className="size-4" /> سجلات بالاسم نفسه</div>
          <p className="mb-2 text-xs">أُدخلت في حاسوبين كلٌّ على حدة قبل المزامنة، فبقيت نسختان. وحّدها يدوياً: احذف إحداهما (المراجعون من «سجل المراجعين»، أصناف المخزن من «المخزن» في المشتريات، الفحوصات من «إدارة الفحوصات») بعد نقل ما يلزم إلى الأخرى.</p>
          {dupes.patients.length > 0 && <div>المراجعون: <b>{dupes.patients.join("، ")}</b></div>}
          {dupes.stock.length > 0 && <div>أصناف المخزن: <b>{dupes.stock.join("، ")}</b></div>}
          {dupes.tests.length > 0 && <div>الفحوصات: <b>{dupes.tests.join("، ")}</b></div>}
        </section>
      )}

      {/* The latest syncs */}
      <section className={card}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-bold"><History className="size-4 text-brand" /> آخر العمليات</span>
          <Link href="/sync/log" className="inline-flex items-center gap-1 text-xs text-brand-dark hover:underline">السجل كاملاً <ArrowLeft className="size-3.5" /></Link>
        </div>
        {log.length === 0 ? <p className="text-sm text-muted">لم تتم مزامنة بعد.</p> : (
          <ol className="relative ms-2 border-s-2 border-line ps-4">
            {log.slice(0, 5).map((e, i) => (
              <li key={i} className="relative pb-3 last:pb-0">
                <span className={cn("absolute -start-[1.4rem] top-1 grid size-4 place-items-center rounded-full ring-4 ring-surface", e.dir === "out" ? "bg-sky-500" : "bg-green-500")} />
                <div className="text-sm">{e.dir === "out" ? <>تصدير ملف <span className="text-muted">({e.records} سجل)</span></> : <>إدخال ملف من «<b>{e.device}</b>» <span className="text-muted">+{e.added} · تحديث {e.updated} · حذف {e.removed}</span></>}</div>
                <div className="text-[11px] text-muted">{when(e.at)}</div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
