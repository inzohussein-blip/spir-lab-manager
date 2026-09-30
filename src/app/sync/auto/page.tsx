"use client";

import { STATION_SYNC } from "@/lib/sync/protocol";
import { CompanySyncCard } from "@/components/local/CompanySyncCard";
import { SyncPanel } from "@/components/local/SyncPanel";
import { card } from "@/components/sync/parts";

/** «المزامنة التلقائية»: through the lab's place on the server, or its local network hub. */
export default function SyncAutoPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">المزامنة التلقائية</h1>
        <p className="mt-1 text-sm text-muted">كل 30 ثانية وبعد كل تعديل، والحاسوب يعمل كالمعتاد بلا إنترنت ويرسل ما فاته عند عودته.</p>
      </div>
      <section className={card}>{STATION_SYNC ? <SyncPanel /> : <CompanySyncCard />}</section>
    </div>
  );
}
