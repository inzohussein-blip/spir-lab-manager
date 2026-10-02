"use client";

import Link from "next/link";
import { MessagesSquare, Users, Globe2, Building2, Link2, FileLock2, ArrowLeft, ShieldCheck } from "lucide-react";
import { conversations, contacts, getSettings, useConnect } from "@/lib/connect/store";
import { useNet } from "@/lib/connect/net";
import { listPeers } from "@/lib/connect/direct";
import { card } from "@/components/connect/Thread";
import { cn, fmtDateTime } from "@/lib/utils";

const hrefOf = (conv: string) => (conv === "room" ? "/connect/room" : conv === "public" ? "/connect/public" : `/connect/labs#${conv.slice(2)}`);

/** «محطة التواصل ← الرئيسية»: where each kind of conversation stands, and the latest ones. */
export default function ConnectHome() {
  useConnect();
  const net = useNet();
  const s = getSettings();
  const convs = conversations().filter((c) => c.last);
  const peers = listPeers().filter((p) => p.state === "open").length;
  const info = net.info;
  const tiles = [
    { href: "/connect/room", icon: Users, title: "المحادثة الداخلية", tone: "from-emerald-500 to-emerald-700",
      sub: !s.room ? "عيّن «رمز المحادثة» على حواسيب المختبر" : info && !info.room ? "غير متاحة على هذا الخادم" : `${net.online.length} حاسوب متصل الآن` },
    { href: "/connect/public", icon: Globe2, title: "المحادثة العامة", tone: "from-sky-500 to-sky-700",
      sub: !info ? "…" : !info.licensing ? "على موقع المزوّد فقط" : info.public ? "مع كل المختبرات" : "أوقفها المزوّد" },
    { href: "/connect/labs", icon: Building2, title: "المختبرات", tone: "from-violet-500 to-violet-700", sub: `${contacts().length} مختبر معروف` },
    { href: "/connect/direct", icon: Link2, title: "اتصال مباشر", tone: "from-amber-500 to-orange-600", sub: peers ? `${peers} اتصال مفتوح` : "حاسوب لحاسوب برمز ربط" },
  ];
  return (
    <div className="flex max-w-5xl flex-col gap-5">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-emerald-600 to-teal-700 p-6 text-white shadow-[var(--shadow-card)]" data-testid="connect-hero">
        <MessagesSquare className="pointer-events-none absolute -left-6 -top-6 size-40 opacity-10" />
        <div className="relative">
          <div className="text-xs font-medium opacity-80">محطة التواصل</div>
          <h1 className="text-2xl font-extrabold">تواصل داخل المختبر ومع المختبرات الأخرى</h1>
          <p className="mt-1 max-w-2xl text-sm opacity-90">
            محادثة بين حواسيب مختبرك، ورسائل مشفّرة لمختبر آخر لا يفتحها غيره (مباشرة أو بملف أو بصندوق بريد مشفّر)، و«المحادثة العامة» مع كل المختبرات.
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs"><ShieldCheck className="size-3.5" /> الرسائل محفوظة على هذا الحاسوب فقط</div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.href} href={t.href} className={cn(card, "group flex items-start gap-3 p-4 hover:border-brand")}>
              <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white", t.tone)}><Icon className="size-5" /></span>
              <span className="min-w-0">
                <span className="block font-bold">{t.title}</span>
                <span className="block text-xs text-muted">{t.sub}</span>
              </span>
            </Link>
          );
        })}
      </div>

      <section className={card}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">آخر المحادثات</h2>
          <Link href="/connect/file" className="inline-flex items-center gap-1 text-xs text-brand-dark hover:underline"><FileLock2 className="size-3.5" /> رسالة بملف</Link>
        </div>
        {convs.length === 0 ? <p className="text-sm text-muted">لا رسائل بعد. ابدأ من «المحادثة الداخلية» أو أضف مختبراً من «المختبرات».</p> : (
          <ul className="divide-y divide-line" data-testid="recent-convs">
            {convs.slice(0, 12).map((c) => (
              <li key={c.conv}>
                <Link href={hrefOf(c.conv)} className="flex items-center gap-3 py-2.5 hover:bg-canvas">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{c.title}</span>
                    <span className="block truncate text-xs text-muted">{c.last!.dir === "out" ? "أنت: " : `${c.last!.from}: `}{c.last!.text}</span>
                  </span>
                  <span className="text-[11px] text-muted tabular-nums">{fmtDateTime(c.last!.at)}</span>
                  {c.unread > 0 && <span className="min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">{c.unread}</span>}
                  <ArrowLeft className="size-4 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
