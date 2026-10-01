"use client";

import {
  Beaker, ShoppingCart, GraduationCap, ShieldCheck, Users, LayoutDashboard, RefreshCw, Info, ExternalLink, Lock, Globe, KeyRound,
  type LucideIcon,
} from "lucide-react";
import { LICENSE_MODULES, type LicenseModule } from "@/lib/license/modules";

/** «المحطات» in the code manager: every station of the system, how each is switched on, and how
 *  many codes use it (the stations switched on per code, plus the ones every code or everyone has). */

export const MODULE_META: Record<LicenseModule, { icon: LucideIcon; color: string; desc: string }> = {
  station: { icon: Beaker, color: "#0d9488", desc: "إدخال النتائج وطباعتها وإرسالها بواتساب، الاستمارات، الزيارات وسجل المراجعين." },
  purchasing: { icon: ShoppingCart, color: "#d97706", desc: "المشتريات والموردون والمخزن والجرد، ويُحسم منه ما يُستعمل في الفحوص والسيطرة." },
  training: { icon: GraduationCap, color: "#4f46e5", desc: "«الدليل» من الصفر (قابل للتعديل والطباعة بشعار المختبر)، مكتبة الفحوصات، الاختبارات، المتدربون والشهادات." },
  qc: { icon: ShieldCheck, color: "#e11d48", desc: "السيطرة النوعية ومخطط Levey-Jennings وقواعد Westgard، الحرارة، صيانة الأجهزة." },
  roster: { icon: Users, color: "#0284c7", desc: "المناوبات والحضور والإجازات والسلف وكشف الرواتب." },
  admin: { icon: LayoutDashboard, color: "#7c3aed", desc: "النسخة الكاملة على الإنترنت: المرضى والطلبات والفواتير، بقاعدة بيانات لكل مختبر." },
};

/** Stations that are not switched on per code. */
export const ALWAYS_STATIONS: { id: string; label: string; short: string; note: string; path: string; icon: LucideIcon; color: string; desc: string; scope: "code" | "all" }[] = [
  {
    id: "sync", label: "محطة المزامنة", short: "مع كل رمز", note: "تعمل على كل حاسوب مفعّل برمز", path: "/sync", icon: RefreshCw, color: "#7c3aed", scope: "code",
    desc: "نقل البيانات بين حواسيب المختبر نفسه: بملف، أو تلقائياً عبر الإنترنت أو الشبكة المحلية.",
  },
  {
    id: "about", label: "عن التطبيق", short: "للجميع", note: "مفتوحة بلا رمز — شرح فقط ولا تحفظ بيانات", path: "/about", icon: Info, color: "#9333ea", scope: "all",
    desc: "شرح التطبيق وكل محطة بصور مبسّطة، البدء السريع، الأسئلة الشائعة، والدعم.",
  },
];

interface CodeLike { status: string; modules: LicenseModule[]; activated_at: number | null; expires_at: number | null; last_seen_at: number | null }
const DAY = 86_400_000;
const working = (r: CodeLike, now: number) => r.status === "active" && (!r.expires_at || r.expires_at > now);

function Bar({ n, of, color }: { n: number; of: number; color: string }) {
  const pct = of ? Math.round((n / of) * 100) : 0;
  return (
    <div className="mt-2">
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/70" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export function StationsOverview({ rows, now, defaults, onSettings }: { rows: CodeLike[]; now: number; defaults: LicenseModule[]; onSettings: () => void }) {
  const live = rows.filter((r) => working(r, now));
  const online = (m?: LicenseModule) => rows.filter((r) => r.last_seen_at && now - r.last_seen_at < DAY && (!m || r.modules.includes(m))).length;
  const card = "flex flex-col rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]";

  return (
    <div className="flex flex-col gap-6" data-testid="stations-overview">
      <section>
        <div className="mb-2 flex items-center gap-2 text-sm font-bold"><KeyRound className="size-4 text-brand" /> تُفعَّل لكل رمز</div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {LICENSE_MODULES.map((m) => {
            const meta = MODULE_META[m.id];
            const Icon = meta.icon;
            const n = live.filter((r) => r.modules.includes(m.id)).length;
            return (
              <div key={m.id} className={card} data-station={m.id}>
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl text-white shadow-sm" style={{ background: meta.color }}><Icon className="size-5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 font-bold">
                      {m.label}
                      {defaults.includes(m.id) && <span className="rounded-full bg-brand-light px-1.5 py-0.5 text-[10px] font-semibold text-brand-dark">افتراضية</span>}
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">{meta.desc}</p>
                  </div>
                </div>
                <div className="mt-auto pt-3">
                  <div className="flex items-baseline justify-between text-xs text-muted">
                    <span>في <b className="font-mono text-base tabular-nums text-ink" data-testid={`station-count-${m.id}`}>{n}</b> من {live.length} رمز فعّال</span>
                    <span>اتصل اليوم: <b className="tabular-nums text-ink">{online(m.id)}</b></span>
                  </div>
                  <Bar n={n} of={live.length} color={meta.color} />
                  <a href={m.path} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-dark hover:underline">فتح المحطة <ExternalLink className="size-3.5" /></a>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted">«افتراضية»: تُختار تلقائياً للرمز الجديد — تُغيَّر من <button type="button" onClick={onSettings} className="font-semibold text-brand-dark hover:underline">الإعدادات العامة</button>. وتُفعَّل أو توقف لأي رمز من بطاقته في «الرموز».</p>
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2 text-sm font-bold"><Lock className="size-4 text-brand" /> تأتي دائماً</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {ALWAYS_STATIONS.map((a) => {
            const Icon = a.icon;
            return (
              <div key={a.id} className={card} data-station={a.id}>
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl text-white shadow-sm" style={{ background: a.color }}><Icon className="size-5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 font-bold">
                      {a.label}
                      <span className="inline-flex items-center gap-1 rounded-full bg-canvas px-1.5 py-0.5 text-[10px] font-semibold text-muted ring-1 ring-line">
                        {a.scope === "all" ? <Globe className="size-3" /> : <KeyRound className="size-3" />} {a.short}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">{a.desc}</p>
                    <p className="mt-1 text-[11px] text-muted">{a.note}.</p>
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between pt-3 text-xs text-muted">
                  <span>{a.scope === "all" ? "لا تحتاج رمزاً" : <>متاحة في <b className="font-mono tabular-nums text-ink">{live.length}</b> رمز فعّال</>}</span>
                  <a href={a.path} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-dark hover:underline">فتح <ExternalLink className="size-3.5" /></a>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
