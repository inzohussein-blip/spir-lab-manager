"use client";

import Link from "next/link";
import { Users, Circle } from "lucide-react";
import { getSettings, useConnect } from "@/lib/connect/store";
import { sendRoom, useNet, errorText, pollNow } from "@/lib/connect/net";
import { Thread, Notice, Title, card } from "@/components/connect/Thread";
import { CodeForm } from "@/components/connect/CodeForm";

/** «المحادثة الداخلية»: the lab's own computers, with the same «رمز المحادثة» on each. */
export default function RoomPage() {
  useConnect();
  const net = useNet();
  const s = getSettings();
  const off = net.info && !net.info.room;
  return (
    <div className="max-w-4xl">
      <Title icon={<Users className="size-6" />} title="المحادثة الداخلية" sub="بين حواسيب مختبرك: كل حاسوب أُدخل فيه «رمز المحادثة» نفسه يرى الرسائل. الخادم يحفظها مشفّرة ولا يعرف الرمز." />
      {off && (
        <Notice testid="room-off">
          {net.info?.licensing
            ? <>المحادثة الداخلية عبر موقع المزوّد موقوفة (صندوق البريد المشفّر مطفأ لدى المزوّد). يمكنك التواصل بين حاسوبين بـ<Link href="/connect/direct" className="font-semibold underline">الاتصال المباشر</Link>، أو اطلب من المزوّد تفعيلها.</>
            : "هذا الخادم لا يتيح المحادثة الداخلية."}
        </Notice>
      )}
      {!s.room ? <CodeForm /> : (
        <div className="grid gap-4 lg:grid-cols-[1fr_15rem]">
          <Thread conv="room" testid="room-thread"
            disabled={off ? "غير متاحة الآن" : undefined}
            note={<>تكتب باسم: <b>{s.name || "حاسوب"}</b> — غيّره من <Link href="/connect/settings#device" className="underline">الإعدادات</Link>.</>}
            onSend={(text, urgent) => { sendRoom(text, urgent); void pollNow(); }} />
          <aside className={card} data-testid="room-online">
            <div className="mb-2 text-sm font-bold">متصل الآن ({net.online.length})</div>
            {net.online.length === 0 ? <p className="text-xs text-muted">لا أحد بعد.</p> : (
              <ul className="space-y-1.5 text-sm">
                {net.online.map((o, i) => <li key={i} className="flex items-center gap-1.5"><Circle className="size-2.5 fill-green-500 text-green-500" /> {o.name}{o.me && <span className="text-xs text-muted">(هذا الحاسوب)</span>}</li>)}
              </ul>
            )}
            {net.roomError && <p className="mt-3 text-xs text-red-600" data-testid="room-error">{errorText(net.roomError)}</p>}
          </aside>
        </div>
      )}
    </div>
  );
}
