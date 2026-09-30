import type { ReactNode } from "react";
import { Beaker, ShoppingCart, GraduationCap, ShieldCheck, Users, type LucideIcon } from "lucide-react";

/** The stations the sync carries, with their look (the same colours as on the welcome page). */
export const STATION_META: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  station: { label: "محطة المختبر", icon: Beaker, color: "#0d9488" },
  purchasing: { label: "المخزن والمشتريات", icon: ShoppingCart, color: "#d97706" },
  training: { label: "التدريب والمعلومات", icon: GraduationCap, color: "#4f46e5" },
  qc: { label: "الجودة والأجهزة", icon: ShieldCheck, color: "#e11d48" },
  roster: { label: "الكادر والدوام", icon: Users, color: "#0284c7" },
};

/** A page title with its icon and a line under it. */
export function PageHead({ icon, title, sub, children }: { icon: ReactNode; title: string; sub: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-dark text-white shadow-sm [&>svg]:size-5">{icon}</span>
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-0.5 text-sm text-muted">{sub}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

/** One station's number (records, or what a file holds). */
export function StationTile({ id, n, note }: { id: string; n: number; note?: string }) {
  const m = STATION_META[id];
  const Icon = m?.icon ?? Beaker;
  return (
    <li className="flex items-center gap-3 rounded-xl border border-line bg-canvas px-3 py-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg text-white" style={{ background: m?.color ?? "#64748b" }}><Icon className="size-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{m?.label ?? id}</span>
        {note && <span className="block text-[11px] text-muted">{note}</span>}
      </span>
      <b className="text-lg tabular-nums">{n.toLocaleString("en-US")}</b>
    </li>
  );
}

/** A small figure: a number over its label. */
export function Figure({ label, n, tone }: { label: string; n: number; tone?: "ok" | "info" | "bad" | "muted" }) {
  const c = tone === "ok" ? "text-green-600" : tone === "bad" ? "text-red-600" : tone === "info" ? "text-brand-dark" : "text-muted";
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-center">
      <div className={`text-xl font-extrabold tabular-nums ${c}`}>{n}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}
