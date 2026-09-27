"use client";

import { useState } from "react";
import { Server } from "lucide-react";
import { saveLabDb, testLabDb } from "@/app/actions/labdb";
import { adminDbError } from "@/lib/db/labErrors";

const field = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

/** Settings → «قاعدة بيانات المختبر الخاصة»: the admin panel on the lab's own PostgreSQL. */
export function LabDbCard({ host, by }: { host: string; by: "owner" | "lab" | "" }) {
  const [conn, setConn] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const locked = by === "owner";

  async function run(op: "test" | "save" | "site") {
    if (op === "save" && !confirm("نقل لوحة الإدارة إلى هذه القاعدة؟ ستحتاج لتسجيل الدخول من جديد. البيانات الحالية لا تُنقل تلقائياً.")) return;
    if (op === "site" && !confirm("إرجاع لوحة الإدارة إلى قاعدة الموقع؟ ستحتاج لتسجيل الدخول من جديد، وتبقى بيانات قاعدتك كما هي.")) return;
    setBusy(true); setMsg(null);
    const r = op === "test" ? await testLabDb(conn) : await saveLabDb(op === "site" ? null : conn);
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
        الحالية: {host ? <b dir="ltr">{host}</b> : <b>قاعدة الموقع المشتركة</b>}
        {by === "owner" && <span className="text-muted"> — ضبطها صاحب الرموز</span>}
      </div>
      {locked ? (
        <p className="text-xs text-muted">لتغييرها تواصل مع صاحب الرموز.</p>
      ) : (
        <>
          <input dir="ltr" aria-label="رابط قاعدة المختبر" value={conn} onChange={(e) => setConn(e.target.value)}
            placeholder={host ? `(محفوظ: ${host} — اتركه فارغاً للإبقاء)` : "postgresql://user:password@host:5432/db"} className={field} />
          {msg && <p data-testid="lab-db-msg" className={`mt-2 text-sm ${msg.ok ? "text-teal-700" : "text-red-700"}`}>{msg.text}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={busy || (!conn.trim() && !host)} onClick={() => run("test")} className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-canvas disabled:opacity-50">اختبار الاتصال</button>
            <button disabled={busy || !conn.trim()} onClick={() => run("save")} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">حفظ ونقل اللوحة إليها</button>
            {host && <button disabled={busy} onClick={() => run("site")} className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50">إرجاع لقاعدة الموقع</button>}
          </div>
        </>
      )}
    </div>
  );
}
