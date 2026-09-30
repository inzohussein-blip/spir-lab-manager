"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { companySyncOn } from "@/lib/sync/protocol";
import { fmtDateTime } from "@/lib/utils";
import type { SyncStatus } from "@/lib/sync/client";

const ERRORS: Record<string, string> = {
  offline: "لا يوجد اتصال بالإنترنت — تُرسل التعديلات عند عودته.",
  no_code: "هذا الحاسوب غير مفعّل برمز المختبر، أو انتهى رمزه.",
  unreachable: "تعذّر الوصول إلى الخادم — ستُعاد المحاولة تلقائياً.",
  db: "رفض الخادم الطلب — ستُعاد المحاولة تلقائياً.",
  bad_hub_key: "مفتاح خادم الشبكة المحلية غير صحيح.",
  needs_db: "مختبرك لم يربط قاعدة بياناته الخاصة بعد — تُربط من إعدادات لوحة الإدارة أو بمساعدة المزوّد. حتى ذلك الحين: المزامنة بملف أو عبر خادم الشبكة المحلية.",
};
const when = (t?: number) => (t ? fmtDateTime(t) : "—");

/** «المزامنة التلقائية»: this computer exchanges its station records with the lab's other
 *  computers every 30 seconds and after each change — through the lab's own place on the
 *  server, which only computers activated with the lab's code can reach. */
export function CompanySyncCard({ onSynced }: { onSynced?: () => void }) {
  const [on, setOn] = useState(companySyncOn);
  const [coded, setCoded] = useState<boolean | null>(null);
  // This server is the lab's local network hub (its own computer, no lab codes).
  const [hub, setHub] = useState(false);
  const [key, setKey] = useState("");
  const [st, setSt] = useState<SyncStatus | null>(null);
  const [busy, setBusy] = useState(false);
  // The page's refresh, called when records may have arrived (kept aside: it changes every render).
  const synced = useRef(onSynced);
  useEffect(() => { synced.current = onSynced; });

  useEffect(() => {
    let alive = true;
    void import("@/lib/license/client").then((m) => m.licenseIdentity()).then((w) => { if (alive) setCoded(!!w); }).catch(() => alive && setCoded(false));
    void fetch("/api/company-sync", { cache: "no-store" }).then((r) => r.json()).then((d: { hub?: boolean }) => { if (alive) setHub(!!d.hub); }).catch(() => {});
    let off = () => {};
    void import("@/lib/sync/client").then((m) => {
      if (!alive) return;
      setKey(m.hubKey());
      let last = 0;
      const upd = () => {
        const s = m.syncStatus(); setSt({ ...s });
        if (s.state === "ok" && s.lastSync && s.lastSync !== last) { last = s.lastSync; synced.current?.(); }
      };
      window.addEventListener(m.SYNC_EVENT, upd);
      off = () => window.removeEventListener(m.SYNC_EVENT, upd);
      upd();
    });
    return () => { alive = false; off(); };
  }, []);

  async function toggle(next: boolean) {
    setOn(next); setBusy(true);
    try { await (await import("@/lib/sync/client")).setCompanySync(next); } finally { setBusy(false); }
  }
  async function now() {
    setBusy(true);
    try { await (await import("@/lib/sync/client")).syncNow(); } finally { setBusy(false); }
  }

  const hubUi = hub && coded === false;
  if (coded === false && !hub) return (
    <p className="text-sm text-muted" data-testid="company-sync-nocode">
      المزامنة التلقائية لحواسيب مختبر مفعّل برمزه: كل حاسوب يُفعَّل برمز المختبر نفسه، فتتزامن حواسيبه وحدها. حتى ذلك الحين استخدم المزامنة بملف أعلاه.
    </p>
  );
  const state = st?.state ?? "off";
  return (
    <div data-testid="company-sync" data-state={on ? state : "off"}>
      <p className="mb-3 text-sm leading-relaxed text-muted">
        {hubUi
          ? "هذا الخادم هو «خادم الشبكة المحلية» لمختبرك (على أحد حواسيبه، بدون إنترنت). أدخل مفتاحه — تتزامن الحواسيب التي تفتح التطبيق منه وتحمل المفتاح نفسه، كل 30 ثانية وبعد كل تعديل."
          : "تتزامن حواسيب مختبرك وحدها تلقائياً كل 30 ثانية وبعد كل تعديل، عبر مكان المختبر الخاص على الخادم. لا يصل إليه إلا حاسوب مفعّل برمز مختبرك، ولا تصل بيانات مختبر إلى حواسيب مختبر آخر. شغّلها على كل حاسوب تريده أن يشارك."}
      </p>
      {hubUi && (
        <div className="mb-3 flex flex-wrap items-center gap-2" data-testid="hub-key">
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="مفتاح خادم الشبكة المحلية" aria-label="مفتاح الخادم" dir="ltr" className="w-64 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand" />
          <button type="button" disabled={busy} onClick={() => { setBusy(true); void import("@/lib/sync/client").then((m) => m.setHubKey(key.trim())).finally(() => setBusy(false)); }} className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">حفظ المفتاح</button>
        </div>
      )}
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={on} disabled={busy || coded === null} onChange={(e) => void toggle(e.target.checked)} aria-label="المزامنة التلقائية" />
        المزامنة التلقائية لهذا الحاسوب
      </label>
      {on && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-canvas px-3 py-2 text-sm">
          <span data-testid="company-sync-state" className={st?.error && state !== "ok" ? "text-red-700" : state === "ok" ? "text-brand-dark" : "text-muted"}>
            {state === "ok" ? "متزامن" : state === "syncing" ? "جارٍ المزامنة…" : st?.error ? ERRORS[st.error] ?? "تعذّرت المزامنة" : "بانتظار أول مزامنة"}
          </span>
          <span className="text-xs text-muted">آخر مزامنة: {when(st?.lastSync)}</span>
          {!!st?.pending && <span className="text-xs text-amber-700">بانتظار الإرسال: {st.pending}</span>}
          <button type="button" disabled={busy} onClick={() => void now()} className="ms-auto inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-xs hover:bg-surface" data-testid="company-sync-now">
            <RefreshCw className="size-3.5" /> مزامنة الآن
          </button>
        </div>
      )}
    </div>
  );
}
