"use client";

import { useState } from "react";
import { HardDrive } from "lucide-react";
import { connectFromGate } from "@/app/actions/labdb";
import { adminDbError } from "@/lib/db/labErrors";
import type { ProviderId } from "@/lib/db/providers";
import { ConnInput, ProviderGuide, ProviderPicker } from "@/components/DbProviders";

/** A paid code without a database of its own: the panel stays closed until one is linked — by
 *  the owner in /licenses, or here by the lab (then it creates its first admin). */
export function NeedsDbGate() {
  const [provider, setProvider] = useState<ProviderId>("neon");
  const [conn, setConn] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function save() {
    setBusy(true); setMsg("");
    const r = await connectFromGate(conn);
    setBusy(false);
    if (!r.ok) { setMsg(adminDbError(r.error)); return; }
    // A full load on purpose: the panel now reads another database, so nothing old may stay in memory.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <div data-testid="needs-db" className="w-full max-w-2xl rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-700"><HardDrive className="size-6" /></span>
          <div>
            <h1 className="text-lg font-bold">لوحة الإدارة تحتاج قاعدة بيانات خاصة بمختبرك</h1>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              بيانات لوحة الإدارة الكاملة (المرضى والطلبات والنتائج والفواتير) تُحفظ في قاعدة بيانات لمختبرك وحده.
              يربطها لك المزوّد، أو اربطها الآن بنفسك من أحد المزوّدين أدناه ثم أنشئ حساب المدير.
              المحطات المحلية تعمل كالمعتاد دون ذلك.
            </p>
          </div>
        </div>
        <div className="space-y-3">
          <ProviderPicker value={provider} onChange={setProvider} />
          <ProviderGuide id={provider} />
          <ConnInput provider={provider} value={conn} onChange={(v) => { setConn(v); setMsg(""); }} label="رابط قاعدة المختبر" />
        </div>
        {msg && <p data-testid="needs-db-msg" className="mt-3 text-sm text-red-700">{msg}</p>}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <a href="/welcome" className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-canvas">الصفحة الرئيسية</a>
          <button disabled={busy || !conn.trim()} onClick={save} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
            {busy ? "جارٍ الربط وتجهيز الجداول…" : "ربط القاعدة"}
          </button>
        </div>
      </div>
    </div>
  );
}
