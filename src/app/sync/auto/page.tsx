"use client";

import { Network, Wifi, WifiOff, Clock } from "lucide-react";
import { STATION_SYNC } from "@/lib/sync/protocol";
import { CompanySyncCard } from "@/components/local/CompanySyncCard";
import { SyncPanel } from "@/components/local/SyncPanel";
import { card } from "@/components/sync/parts";
import { PageHead } from "@/components/sync/ui";
import { PausedBanner } from "@/components/sync/PausedNotice";

const FACTS = [
  { icon: <Clock className="size-4" />, t: "كل 30 ثانية وبعد كل تعديل" },
  { icon: <WifiOff className="size-4" />, t: "يعمل الحاسوب كالمعتاد بلا إنترنت" },
  { icon: <Wifi className="size-4" />, t: "يرسل ما فاته عند عودة الاتصال" },
];

/** «المزامنة التلقائية»: through the lab's place on the server, or its local network hub. */
export default function SyncAutoPage() {
  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <PausedBanner />
      <PageHead icon={<Network />} title="المزامنة التلقائية" sub="حواسيب المختبر تتبادل تعديلاتها وحدها، عبر الإنترنت أو عبر شبكة المختبر المحلية." />
      <ul className="grid gap-2 sm:grid-cols-3">
        {FACTS.map((f) => (
          <li key={f.t} className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface px-3 py-2.5 text-sm shadow-[var(--shadow-card)]">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-light text-brand-dark">{f.icon}</span>{f.t}
          </li>
        ))}
      </ul>
      <section className={card}>{STATION_SYNC ? <SyncPanel /> : <CompanySyncCard />}</section>
    </div>
  );
}
