"use client";

import { useEffect, useState, type DragEvent } from "react";
import Link from "next/link";
import { PenLine, PackageCheck, Undo2, Info } from "lucide-react";
import { getVisits, getSettings, setDelivered, type StationVisit } from "@/lib/station/store";
import { isPending, isReady, ago } from "@/lib/station/insights";
import { Avatar } from "@/components/charts/NewCharts";

const DAY = 86_400_000;
type Col = "pending" | "ready" | "delivered";

/**
 * «لوحة المهام» (the new look, as in spir-supply-manager): the visits as cards in stages — results to
 * write, ready to hand over, handed over today. A card goes from «جاهزة» to «سُلّمت» (and back) by
 * dragging it or with its button; a card still waiting for results opens on the entry screen.
 * Handing over follows «حالة التسليم» (Settings → شاشة الإدخال); without it, the second column is
 * the visits completed today.
 */
export default function StationTasks() {
  const [visits, setVisits] = useState<StationVisit[]>([]);
  const [delivery, setDeliveryOn] = useState(false);
  const [over, setOver] = useState<Col | null>(null);
  const [msg, setMsg] = useState("");
  // The clock is read when the data is, not while drawing.
  const [now, setNow] = useState(0);
  const load = () => { setVisits(getVisits()); setDeliveryOn(getSettings().deliveryStatus === true); setNow(Date.now()); };
  useEffect(() => { load(); }, []);

  const today0 = new Date(new Date(now).toDateString()).getTime();
  const recent = visits.filter((v) => v.created_at >= now - 60 * DAY);
  const cols: Record<Col, StationVisit[]> = {
    pending: recent.filter(isPending).sort((a, b) => a.created_at - b.created_at),
    ready: delivery ? recent.filter(isReady).sort((a, b) => a.created_at - b.created_at)
      : recent.filter((v) => !isPending(v) && v.created_at >= today0).sort((a, b) => b.created_at - a.created_at),
    delivered: visits.filter((v) => (v.delivered_at ?? 0) >= today0).sort((a, b) => (b.delivered_at ?? 0) - (a.delivered_at ?? 0)),
  };
  const move = (id: string, to: Col) => {
    const v = visits.find((x) => x.id === id);
    if (!v) return;
    if (to === "delivered" && !isPending(v)) setDelivered([id], true);
    else if (to === "ready" && v.delivered_at) setDelivered([id], false);
    else if (isPending(v) && to !== "pending") { setMsg(`«${v.patient.name}»: اكتب نتائجها أولاً — افتحها بزر «كتابة النتائج».`); return; }
    setMsg(""); load();
  };
  const drop = (to: Col) => (e: DragEvent) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData("text/plain"); if (id) move(id, to); };
  const zone = (to: Col) => ({
    onDragOver: (e: DragEvent) => { e.preventDefault(); setOver(to); },
    onDragLeave: () => setOver((o) => (o === to ? null : o)),
    onDrop: drop(to),
  });

  const card = (v: StationVisit, col: Col) => {
    const missing = v.results.filter((r) => !String(r.value ?? "").trim()).length;
    const draggable = delivery && col !== "pending";
    return (
      <li key={v.id} draggable={draggable} onDragStart={(e) => e.dataTransfer.setData("text/plain", v.id)} data-card={v.id}
        className={`rounded-2xl border border-line bg-surface p-3 shadow-[var(--shadow-card)] ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}>
        <div className="flex items-center gap-2.5">
          <Avatar name={v.patient.name} className="size-8" />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-semibold">{v.patient.name || "—"}</div>
            <div className="truncate text-[11px] text-muted"><span dir="ltr">{v.accession ?? ""}</span> · {ago(col === "delivered" ? v.delivered_at ?? v.created_at : v.created_at, now)}</div>
          </div>
        </div>
        <div className="mt-2 text-[11px] text-muted">{col === "pending" ? `${missing} من ${v.results.length} فحص بلا نتيجة` : `${v.results.length} فحص`}{v.referrer ? ` · ${v.referrer}` : ""}</div>
        <div className="mt-2.5 flex gap-1.5">
          {col === "pending" && <Link href={`/station?edit=${v.id}`} className="inline-flex flex-1 items-center justify-center gap-1 rounded-full bg-gradient-to-b from-brand to-brand-dark px-3 py-1.5 text-xs font-semibold text-white"><PenLine className="size-3.5" /> كتابة النتائج</Link>}
          {col === "ready" && delivery && <button type="button" onClick={() => move(v.id, "delivered")} data-testid="task-deliver" className="inline-flex flex-1 items-center justify-center gap-1 rounded-full bg-gradient-to-b from-brand to-brand-dark px-3 py-1.5 text-xs font-semibold text-white"><PackageCheck className="size-3.5" /> تسليم</button>}
          {col === "ready" && !delivery && <Link href={`/station/visits?open=${v.id}`} className="inline-flex flex-1 items-center justify-center rounded-full border border-line px-3 py-1.5 text-xs font-semibold">فتح</Link>}
          {col === "delivered" && <button type="button" onClick={() => move(v.id, "ready")} data-testid="task-undeliver" className="inline-flex flex-1 items-center justify-center gap-1 rounded-full border border-line px-3 py-1.5 text-xs font-semibold"><Undo2 className="size-3.5" /> إرجاع</button>}
        </div>
      </li>
    );
  };

  const column = (col: Col, title: string, hint: string) => (
    <section key={col} {...zone(col)} data-col={col}
      className={`flex min-h-64 flex-col rounded-3xl p-3 transition-colors ${over === col ? "bg-brand-light ring-2 ring-brand/40" : "bg-canvas"}`}>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-bold">{title}</h2>
        <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-bold tabular-nums shadow-[var(--shadow-card)]">{cols[col].length}</span>
      </div>
      <p className="mb-2 px-1 text-[11px] text-muted">{hint}</p>
      {/* A long column scrolls inside itself, so the three stay side by side on screen. */}
      <ul className="-me-1 flex max-h-[70vh] flex-col gap-2 overflow-y-auto pe-1">
        {cols[col].length === 0 && <li className="rounded-2xl border border-dashed border-line px-3 py-6 text-center text-xs text-muted">لا شيء هنا</li>}
        {cols[col].slice(0, 40).map((v) => card(v, col))}
      </ul>
    </section>
  );

  return (
    <div data-testid="tasks-page">
      <div className="mb-5">
        <h1 className="text-3xl font-extrabold tracking-tight">لوحة المهام</h1>
        <p className="mt-1 text-sm text-muted">كل زيارة بطاقة في مرحلتها — آخر 60 يوماً، من بيانات هذا الجهاز.</p>
      </div>
      {!delivery && (
        <p className="mb-4 flex items-start gap-2 rounded-2xl bg-sky-50 px-4 py-3 text-xs text-sky-900" data-testid="tasks-delivery-off">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>لمتابعة تسليم النتائج للمراجعين (جاهزة ← سُلّمت) شغّل «حالة التسليم» من «الإعدادات ← شاشة الإدخال». حتى ذلك يعرض العمود الثاني ما اكتمل اليوم.</span>
        </p>
      )}
      {msg && <p role="status" className="mb-3 rounded-2xl bg-amber-50 px-4 py-2.5 text-xs text-amber-900" data-testid="tasks-msg">{msg}</p>}
      <div className={`grid gap-4 ${delivery ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
        {column("pending", "بانتظار النتائج", "فيها فحص بلا نتيجة — افتحها لكتابة النتائج.")}
        {column("ready", delivery ? "جاهزة للتسليم" : "مكتملة اليوم", delivery ? "كل النتائج مكتوبة — اسحبها إلى «سُلّمت» أو اضغط «تسليم»." : "زيارات اليوم بنتائج كاملة.")}
        {delivery && column("delivered", "سُلّمت اليوم", "اسحبها إلى «جاهزة» أو اضغط «إرجاع» إن سُلّمت خطأً.")}
      </div>
    </div>
  );
}
