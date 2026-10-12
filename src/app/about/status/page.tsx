"use client";

import { useEffect, useState } from "react";
import { Activity, Globe, KeyRound, Archive, WifiOff, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Loader2 } from "lucide-react";
import { evaluate, licenseCheckedAt, cachedEnabled, type LicenseState } from "@/lib/license/client";
import { backupState, type BackupState } from "@/lib/local/fullBackup";
import { fmtDateTime } from "@/lib/utils";

const card = "rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]";
type Tone = "ok" | "warn" | "bad";
type Site = { tone: Tone; text: string };

/** What works when the provider's site is out of reach, and what to use instead. */
const WITHOUT_SITE: [string, string, string][] = [
  ["المحطات كلها (المختبر، المخزن، التدريب، الجودة، الكادر، عن التطبيق)", "تعمل", "—"],
  ["رمز المختبر على هذا الجهاز", "يعمل حتى نهايته", "«ضمان الاستمرارية» إن منحه المزوّد، و«رمز التجديد بلا إنترنت»"],
  ["النسخة الاحتياطية والنسخة الشاملة والحفظ التلقائي", "تعمل", "—"],
  ["المزامنة بين حواسيب المختبر", "التلقائية عبر الإنترنت تتوقف", "«المزامنة بملف»، أو «خادم الشبكة المحلية» على حاسوب المختبر"],
  ["محطة التواصل", "المحادثة العامة والصندوق المشفّر يتوقفان", "المحادثة بين حواسيب المختبر بملف أو على الشبكة المحلية"],
  ["نافذة الأطباء", "تتوقف", "النسخة المحلية من التطبيق على شبكة المختبر"],
  ["تفعيل جهاز جديد", "يتوقف", "انقل البيانات بالنسخة الشاملة إلى النسخة المحلية من التطبيق"],
  ["لوحة الإدارة الكاملة", "تتوقف", "—"],
];

const icon = (t: Tone) => t === "ok" ? <CheckCircle2 className="size-5 shrink-0 text-green-600" /> : t === "warn" ? <AlertTriangle className="size-5 shrink-0 text-amber-600" /> : <XCircle className="size-5 shrink-0 text-red-600" />;

async function checkSite(): Promise<Site> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch("/api/license", { cache: "no-store", signal: ctl.signal });
    const d = (await r.json().catch(() => null)) as { enabled?: unknown } | null;
    if (r.ok && d && typeof d.enabled === "boolean") return { tone: "ok", text: "موقع المزوّد متاح." };
    return { tone: "warn", text: `الموقع يرد بخطأ (${r.status}) — المحطات تعمل كما هي، وما يحتاج الموقع متوقف مؤقتاً.` };
  } catch {
    return { tone: "bad", text: navigator.onLine ? "موقع المزوّد لا يرد — المحطات تعمل بلا إنترنت كما هي." : "لا يوجد اتصال بالإنترنت — المحطات تعمل بلا إنترنت كما هي." };
  } finally { clearTimeout(t); }
}

function licenseLine(s: LicenseState | null): { tone: Tone; text: string } {
  if (!s) return { tone: "warn", text: "…" };
  switch (s.kind) {
    case "off": return { tone: "ok", text: "لا يُطلب رمز مختبر في هذه النسخة." };
    case "need": return { tone: "warn", text: "هذا الجهاز لم يُفعَّل برمز مختبر بعد." };
    case "grace": return { tone: "warn", text: `يعمل بالتفعيل السابق حتى ${fmtDateTime(s.until)}.` };
    case "module_off": return { tone: "ok", text: `رمز «${s.lab}» فعّال.` };
    case "locked": return { tone: "bad", text: "المحطات مقفلة على هذا الجهاز — ألصق «رمز التجديد بلا إنترنت» في شاشة القفل، وبياناتك تبقى ويمكن تنزيلها من الشاشة نفسها." };
    case "ok": return s.cont
      ? { tone: "warn", text: `رمز «${s.lab}» انتهى ويعمل بـ«ضمان الاستمرارية» حتى ${fmtDateTime(s.until)}.` }
      : { tone: "ok", text: `رمز «${s.lab}» فعّال حتى ${fmtDateTime(s.until)}.` };
  }
}

/** «حالة الخدمة»: what works on this device now, and what keeps working if the provider's site stops. */
export default function ServiceStatus() {
  const [site, setSite] = useState<Site | null>(null);
  const [lic, setLic] = useState<LicenseState | null>(null);
  const [checked, setChecked] = useState<number | null>(null);
  const [bk, setBk] = useState<BackupState>({});
  const [offline, setOffline] = useState<{ sw: boolean; kept: boolean | null } | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    setBk(backupState()); setChecked(licenseCheckedAt());
    // Only read a license this device holds: evaluating a device on its old activation would start its grace period from here.
    const has = (() => { try { return !!localStorage.getItem("local.license.v1"); } catch { return false; } })();
    const [s, l] = await Promise.all([checkSite(), has ? evaluate().catch(() => null) : Promise.resolve<LicenseState>(cachedEnabled() ? { kind: "need" } : { kind: "off" })]);
    setSite(s); setLic(l);
    let kept: boolean | null = null;
    try { kept = (await navigator.storage?.persisted?.()) ?? null; } catch { /* unknown */ }
    setOffline({ sw: !!navigator.serviceWorker?.controller, kept });
    setBusy(false);
  }
  useEffect(() => { void load(); }, []);

  const l = licenseLine(lic);
  const now = Date.now(); // eslint-disable-line react-hooks/purity
  const days = bk.last ? Math.floor((now - bk.last) / 86_400_000) : null;
  const backup: { tone: Tone; text: string } = days == null ? { tone: "warn", text: "لم تُؤخذ نسخة شاملة على هذا الجهاز بعد — من «محطة المزامنة ← النسخة الشاملة»." }
    : days >= 7 ? { tone: "warn", text: `آخر نسخة شاملة قبل ${days} يوم.` }
    : { tone: "ok", text: `آخر نسخة شاملة: ${fmtDateTime(bk.last!)}${bk.folder && bk.every ? ` — والحفظ التلقائي في «${bk.folder}» مفعّل` : ""}.` };
  const off: { tone: Tone; text: string } = !offline ? { tone: "warn", text: "…" }
    : !offline.sw ? { tone: "warn", text: "النسخة المحفوظة للعمل بلا إنترنت لم تُجهَّز بعد على هذا الجهاز — افتح المحطات مرة والإنترنت متاح." }
    : offline.kept === false ? { tone: "warn", text: "تعمل بلا إنترنت، لكن المتصفح لم يسمح بالحفظ الدائم — ثبّت التطبيق وخذ نسخة شاملة." }
    : { tone: "ok", text: "تعمل بلا إنترنت، والبيانات محفوظة على هذا الجهاز." };

  const rows: { icon: React.ReactNode; title: string; line: { tone: Tone; text: string } | null; id: string; sub?: string }[] = [
    { id: "site", icon: <Globe className="size-4" />, title: "موقع المزوّد", line: site },
    { id: "license", icon: <KeyRound className="size-4" />, title: "رمز المختبر", line: l, sub: checked ? `آخر اتصال بالموقع: ${fmtDateTime(checked)}` : undefined },
    { id: "offline", icon: <WifiOff className="size-4" />, title: "العمل بلا إنترنت", line: off },
    { id: "backup", icon: <Archive className="size-4" />, title: "النسخة الشاملة", line: backup },
  ];

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Activity className="size-6 text-brand" /> حالة الخدمة</h1>
        <button onClick={() => void load()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas disabled:opacity-60">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} فحص من جديد
        </button>
      </div>
      <p className="-mt-2 text-sm text-muted">ما يعمل على هذا الجهاز الآن، وما يبقى يعمل إن توقف موقع المزوّد.</p>

      <section className={`${card} grid gap-3`}>
        {rows.map((r) => (
          <div key={r.id} data-testid={`status-${r.id}`} data-tone={r.line?.tone ?? ""} className="flex items-start gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
            {r.line ? icon(r.line.tone) : <Loader2 className="size-5 shrink-0 animate-spin text-muted" />}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-sm font-bold">{r.icon} {r.title}</div>
              <p className="mt-0.5 text-sm text-muted">{r.line?.text ?? "جارٍ الفحص…"}</p>
              {r.sub && <p className="mt-0.5 text-xs text-muted">{r.sub}</p>}
            </div>
          </div>
        ))}
      </section>

      <section className={card}>
        <div className="mb-3 font-bold">إذا توقف موقع المزوّد</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="status-table">
            <thead><tr className="border-b border-line text-right text-xs text-muted"><th className="py-2 pe-3">الميزة</th><th className="py-2 pe-3">بدون الموقع</th><th className="py-2">البديل</th></tr></thead>
            <tbody>
              {WITHOUT_SITE.map(([a, b, c]) => (
                <tr key={a} className="border-b border-line last:border-0 align-top"><td className="py-2 pe-3">{a}</td><td className="py-2 pe-3">{b}</td><td className="py-2 text-muted">{c}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">بيانات المختبر على أجهزته، لا على الموقع: لا تضيع بتوقفه. احتفظ بنسخة شاملة حديثة خارج الحاسوب.</p>
      </section>
    </div>
  );
}
