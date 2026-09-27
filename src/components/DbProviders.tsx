"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, XCircle } from "lucide-react";
import { PROVIDERS, connAdvice, providerById, type ProviderId } from "@/lib/db/providers";

/**
 * Pieces for linking a lab's database, one interface per provider (Neon, Supabase, Railway, any
 * other PostgreSQL): the picker, the provider's steps, and the connection string with advice.
 */

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

const MARK: Record<ProviderId, string> = {
  neon: "bg-emerald-50 text-emerald-700",
  supabase: "bg-green-50 text-green-700",
  railway: "bg-violet-50 text-violet-700",
  postgres: "bg-sky-50 text-sky-700",
};
const INITIAL: Record<ProviderId, string> = { neon: "N", supabase: "S", railway: "R", postgres: "PG" };

export function ProviderMark({ id, size = "size-9" }: { id: ProviderId; size?: string }) {
  return <span className={`grid ${size} shrink-0 place-items-center rounded-xl text-xs font-bold ${MARK[id]}`}>{INITIAL[id]}</span>;
}

export function ProviderPicker({ value, onChange }: { value: ProviderId; onChange: (p: ProviderId) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-4" role="tablist" aria-label="مزوّد قاعدة البيانات">
      {PROVIDERS.map((p) => (
        <button key={p.id} type="button" role="tab" aria-selected={value === p.id} data-provider={p.id} onClick={() => onChange(p.id)}
          className={`flex items-center gap-2 rounded-xl border p-2.5 text-start transition-colors ${value === p.id ? "border-brand bg-brand/5 ring-1 ring-brand" : "border-line hover:bg-canvas"}`}>
          <ProviderMark id={p.id} size="size-8" />
          <span className="min-w-0 text-sm font-semibold">{p.name}</span>
        </button>
      ))}
    </div>
  );
}

/** The provider's steps to get a connection string, with a link to its console. */
export function ProviderGuide({ id }: { id: ProviderId }) {
  const p = providerById(id);
  return (
    <div data-testid="provider-guide" data-guide={p.id} className="rounded-xl border border-line bg-canvas/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <ProviderMark id={p.id} size="size-8" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">{p.name}</div>
          <div className="text-[11px] text-muted">{p.tagline}</div>
        </div>
        {p.site && (
          <a href={p.site} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2 py-1 text-xs hover:bg-canvas">
            <ExternalLink className="size-3.5" /> فتح {p.siteLabel}
          </a>
        )}
      </div>
      <ol className="mt-2 list-inside list-decimal space-y-1 text-xs leading-relaxed text-muted">
        {p.steps.map((s) => <li key={s}>{s}</li>)}
      </ol>
    </div>
  );
}

export function AdviceList({ conn, provider }: { conn: string; provider: ProviderId }) {
  const list = connAdvice(conn, provider);
  if (!list.length) return null;
  return (
    <ul data-testid="conn-advice" className="space-y-1 text-xs">
      {list.map((a) => (
        <li key={a.text} data-level={a.level} className={`flex items-start gap-1.5 ${a.level === "error" ? "text-red-700" : a.level === "warn" ? "text-amber-700" : "text-teal-700"}`}>
          {a.level === "error" ? <XCircle className="mt-0.5 size-3.5 shrink-0" /> : a.level === "warn" ? <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />}
          <span>{a.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** Any other PostgreSQL: fields that write the connection string. */
function Builder({ onChange }: { onChange: (conn: string) => void }) {
  const [f, setF] = useState({ host: "", port: "5432", db: "", user: "", password: "", ssl: "require" });
  const set = (k: keyof typeof f, v: string) => {
    const n = { ...f, [k]: v };
    setF(n);
    if (n.host && n.user) {
      const q = n.ssl === "require" ? "" : `?sslmode=${n.ssl}`;
      onChange(`postgresql://${encodeURIComponent(n.user)}:${encodeURIComponent(n.password)}@${n.host.trim()}${n.port ? `:${n.port.trim()}` : ""}/${encodeURIComponent(n.db.trim() || "postgres")}${q}`);
    }
  };
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <input dir="ltr" aria-label="الخادم" placeholder="host" value={f.host} onChange={(e) => set("host", e.target.value)} className={`${inp} sm:col-span-2`} />
      <input dir="ltr" aria-label="المنفذ" placeholder="5432" value={f.port} onChange={(e) => set("port", e.target.value)} className={inp} />
      <input dir="ltr" aria-label="اسم القاعدة" placeholder="database" value={f.db} onChange={(e) => set("db", e.target.value)} className={inp} />
      <input dir="ltr" aria-label="اسم المستخدم" placeholder="user" value={f.user} onChange={(e) => set("user", e.target.value)} className={inp} />
      <input dir="ltr" type="password" aria-label="كلمة المرور" placeholder="password" value={f.password} onChange={(e) => set("password", e.target.value)} className={inp} />
      <select aria-label="TLS" value={f.ssl} onChange={(e) => set("ssl", e.target.value)} className={`${inp} sm:col-span-3`}>
        <option value="require">اتصال مشفّر مع التحقق من الشهادة (مستحسن)</option>
        <option value="no-verify">اتصال مشفّر بدون تحقق من الشهادة (شهادة ذاتية)</option>
        <option value="disable">بدون تشفير (شبكة موثوقة فقط)</option>
      </select>
    </div>
  );
}

/** The connection string for the chosen provider, with advice on it as it is typed. */
export function ConnInput({ provider, value, onChange, label, savedHost }: {
  provider: ProviderId; value: string; onChange: (v: string) => void; label: string; savedHost?: string;
}) {
  const [fields, setFields] = useState(false);
  const p = providerById(provider);
  return (
    <div className="space-y-2">
      {provider === "postgres" && (
        <div className="inline-flex rounded-lg border border-line p-0.5 text-xs">
          <button type="button" onClick={() => setFields(false)} className={`rounded-md px-3 py-1 ${!fields ? "bg-brand text-white" : "hover:bg-canvas"}`}>لصق الرابط</button>
          <button type="button" onClick={() => setFields(true)} className={`rounded-md px-3 py-1 ${fields ? "bg-brand text-white" : "hover:bg-canvas"}`}>إدخال الحقول</button>
        </div>
      )}
      {provider === "postgres" && fields && <Builder onChange={onChange} />}
      <input dir="ltr" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={savedHost ? `(محفوظ: ${savedHost} — اتركه فارغاً للإبقاء)` : p.placeholder} className={inp} />
      <AdviceList conn={value} provider={provider} />
    </div>
  );
}
