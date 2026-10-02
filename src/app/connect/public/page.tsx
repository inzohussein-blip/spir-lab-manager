"use client";

import { useState } from "react";
import { Globe2 } from "lucide-react";
import { getSettings, saveSettings, useConnect } from "@/lib/connect/store";
import { sendPublic, useNet, errorText, pollNow } from "@/lib/connect/net";
import { Thread, Notice, Title } from "@/components/connect/Thread";
import { cn } from "@/lib/utils";

/** «المحادثة العامة»: every lab with «محطة التواصل», by a chosen name or its own name — nothing
 *  else about a lab is shown. */
export default function PublicPage() {
  useConnect();
  const net = useNet();
  const s = getSettings();
  const [alias, setAlias] = useState(s.alias);
  const info = net.info;
  const off = !info ? "" : !info.licensing ? "المحادثة العامة متاحة على موقع المزوّد فقط (مع رمز المختبر)." : !info.public ? "أوقف المزوّد المحادثة العامة." : "";
  const needAlias = s.publicAs === "alias" && !s.alias.trim();
  return (
    <div className="max-w-4xl">
      <Title icon={<Globe2 className="size-6" />} title="المحادثة العامة" sub="محادثة مشتركة بين كل المختبرات. يظهر اسمك المستعار أو اسم مختبرك فقط، دون أي معلومة أخرى." />
      {off ? <Notice testid="public-off">{off}</Notice> : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-3 text-sm shadow-[var(--shadow-card)]" data-testid="public-as">
            <span className="font-semibold">أظهر باسم:</span>
            {(["alias", "lab"] as const).map((k) => (
              <button key={k} type="button" aria-pressed={s.publicAs === k} onClick={() => saveSettings({ publicAs: k })}
                className={cn("rounded-full border px-3 py-1 text-xs", s.publicAs === k ? "border-brand bg-brand-light font-semibold text-brand-dark" : "border-line hover:bg-canvas")}>
                {k === "alias" ? "اسم مستعار" : "اسم المختبر"}
              </button>
            ))}
            {s.publicAs === "alias" && (
              <input value={alias} onChange={(e) => setAlias(e.target.value.slice(0, 40))} onBlur={() => saveSettings({ alias: alias.trim() })} aria-label="الاسم المستعار"
                placeholder="مثلاً: مختبر الشمال" className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand" />
            )}
            {s.publicAs === "lab" && <span className="text-xs text-muted">يُكتب اسم مختبرك كما في رمزه، مع علامة «مختبر».</span>}
          </div>
          <Thread conv="public" publicNames testid="public-thread"
            disabled={needAlias ? "اكتب اسماً مستعاراً أعلاه أولاً" : undefined}
            note="لا تشارك هنا بيانات مرضى أو معلومات خاصة — المحادثة يراها كل المختبرات. المزوّد يستطيع حذف الرسائل المسيئة."
            onSend={async (text) => { const r = await sendPublic(text); if (!r.ok) return errorText(r.error ?? ""); void pollNow(); }} />
          {net.publicError && <p className="mt-2 text-xs text-red-600">{errorText(net.publicError)}</p>}
        </>
      )}
    </div>
  );
}
