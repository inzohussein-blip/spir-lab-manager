"use client";

import { useState } from "react";
import { Server } from "lucide-react";
import { saveLabDb, testLabDb } from "@/app/actions/labdb";
import { adminDbError } from "@/lib/db/labErrors";
import { providerOf, type ProviderId } from "@/lib/db/providers";
import { ConnInput, ProviderGuide, ProviderPicker } from "@/components/DbProviders";

/** Settings → «قاعدة بيانات المختبر الخاصة»: the admin panel on the lab's own PostgreSQL. */
export function LabDbCard({ host, by }: { host: string; by: "owner" | "lab" | "" }) {
  const [conn, setConn] = useState("");
  const [provider, setProvider] = useState<ProviderId>(host ? providerOf(host) : "neon");
  const [copy, setCopy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const locked = by === "owner";

  async function run(op: "test" | "save" | "site") {
    if (op === "save" && !confirm("نقل لوحة الإدارة إلى هذه القاعدة؟ ستحتاج لتسجيل الدخول من جديد. البيانات الحالية لا تُنقل تلقائياً.")) return;
    if (op === "site" && !confirm("إرجاع لوحة الإدارة إلى قسم مختبرك في قاعدة الموقع؟ ستحتاج لتسجيل الدخول من جديد، وتبقى بيانات قاعدتك كما هي.")) return;
    setBusy(true); setMsg(null);
    const r = op === "test" ? await testLabDb(conn) : await saveLabDb(op === "site" ? null : conn, op === "save" && copy);
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: adminDbError(r.error) }); return; }
    if (op === "test") { setMsg({ ok: true, text: `✓ الاتصال يعمل والجداول جاهزة — المستخدمون فيها: ${r.users}${r.users ? "" : " (سيُنسخ حسابك إليها عند الحفظ)"}` }); return; }
    window.location.href = "/login";
  }

  return (
    <div data-testid="lab-db-card" className="mb-4 rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <div className="mb-1 flex items-center gap-2 font-semibold"><Server className="size-4 text-brand" /> قاعدة بيانات المختبر الخاصة</div>
      <p className="mb-3 text-xs leading-relaxed text-muted">
        شغّل لوحة الإدارة على قاعدة PostgreSQL خاصة بمختبرك (Neon أو Supabase أو Railway أو خادمك): المرضى والطلبات والنتائج والفواتير والمستخدمون فيها وحدها.
        تُنشأ الجداول تلقائياً، ويُنسخ حسابك إليها إن كانت فارغة. يُحفظ الرابط مشفّراً على الخادم ولا يُعرض مرة أخرى.
      </p>
      <div className="mb-3 rounded-lg bg-canvas px-3 py-2 text-xs">
        الحالية: {host ? <b dir="ltr">{host}</b> : <b>قسم مستقل لمختبرك في قاعدة الموقع</b>}
        {by === "owner" && <span className="text-muted"> — ضبطها صاحب الرموز</span>}
      </div>
      {locked ? (
        <p className="text-xs text-muted">لتغييرها تواصل مع صاحب الرموز.</p>
      ) : (
        <>
          <div className="space-y-3">
            <ProviderPicker value={provider} onChange={setProvider} />
            <ProviderGuide id={provider} />
            <ConnInput provider={provider} value={conn} onChange={setConn} label="رابط قاعدة المختبر" savedHost={host || undefined} />
            <label className="flex items-start gap-2 rounded-lg border border-line p-3 text-xs">
              <input type="checkbox" checked={copy} onChange={(e) => setCopy(e.target.checked)} aria-label="نسخ بيانات قاعدة الموقع" className="mt-0.5" />
              <span><b className="text-sm">انسخ بيانات لوحتي الحالية إليها</b> — ليكمل المختبر من حيث توقّف. السجلات الموجودة في القاعدة الجديدة لا تتغيّر.</span>
            </label>
          </div>
          {msg && <p data-testid="lab-db-msg" className={`mt-2 text-sm ${msg.ok ? "text-teal-700" : "text-red-700"}`}>{msg.text}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={busy || (!conn.trim() && !host)} onClick={() => run("test")} className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-canvas disabled:opacity-50">اختبار الاتصال</button>
            <button disabled={busy || !conn.trim()} onClick={() => run("save")} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">حفظ ونقل اللوحة إليها</button>
            {host && <button disabled={busy} onClick={() => run("site")} className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50">إرجاع لقسم المختبر في قاعدة الموقع</button>}
          </div>
        </>
      )}
    </div>
  );
}
