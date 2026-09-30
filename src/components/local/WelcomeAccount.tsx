"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, CalendarClock, ChevronDown, Clock, Cpu, RefreshCw, ShieldAlert } from "lucide-react";
import { useLicense } from "@/components/local/ActivationGate";
import { WARN_DAYS, cachedContact, deviceId, licenseCheckedAt, refreshLicense } from "@/lib/license/client";
import { LICENSE_MODULES } from "@/lib/license/modules";
import { fmtDateTime } from "@/lib/utils";

const DAY = 86_400_000;
const fmtDate = (ms: number) => new Date(ms).toLocaleDateString("en-CA");
const fmtTime = (ms: number) => fmtDateTime(ms);

/** The Welcome page's account box (top left): this device's lab, its subscription end and, on
 *  opening, the stations it includes, the last check with the server and the device's id. */
export function WelcomeAccount() {
  const { state, recheck } = useLicense();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);
  const [info, setInfo] = useState<{ checked: number | null; device: string; contact: string }>({ checked: null, device: "", contact: "" });
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const read = () => { setNow(Date.now()); setInfo({ checked: licenseCheckedAt(), device: deviceId(), contact: cachedContact() }); };
    read();
    const t = setInterval(read, 60_000);
    return () => clearInterval(t);
  }, [state]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  if (!state || !now || (state.kind !== "ok" && state.kind !== "grace" && state.kind !== "locked")) return null;
  const until = state.until ?? 0;
  const lab = state.kind === "ok" ? state.lab : state.kind === "locked" ? state.lab ?? "" : "";
  const left = until ? Math.ceil((until - now) / DAY) : 0;
  const tone = state.kind === "locked" || left <= 3 ? "red" : left <= WARN_DAYS || state.kind === "grace" ? "amber" : "teal";
  const toneCls = { red: "text-red-700 bg-red-50", amber: "text-amber-700 bg-amber-50", teal: "text-brand-dark bg-teal-50" }[tone];
  const status = state.kind === "locked" ? (state.reason === "stopped" ? "موقوف" : "منتهٍ")
    : state.kind === "grace" ? "تفعيل سابق" : left <= WARN_DAYS ? "ينتهي قريباً" : "فعّال";
  const mods = state.kind === "ok" ? LICENSE_MODULES.filter((m) => state.mods.includes(m.id)) : [];

  async function checkNow() {
    setBusy(true);
    await refreshLicense(true);
    await recheck();
    setBusy(false);
  }

  return (
    <div ref={box} className="relative z-40" data-testid="account">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} data-testid="account-chip"
        className="flex max-w-[20rem] items-center gap-2.5 rounded-2xl border border-line bg-surface px-3 py-2 text-start shadow-[var(--shadow-card)] hover:border-brand/50">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-white"><Building2 className="size-[18px]" /></span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-bold">{lab || "هذا الجهاز"}</span>
          <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
            <CalendarClock className="size-3" />
            {until ? <>ينتهي <span dir="ltr" className="tabular-nums">{fmtDate(until)}</span></> : "بلا تاريخ"}
            <span className={`ms-1 rounded-full px-1.5 py-px font-semibold tabular-nums ${toneCls}`}>
              {state.kind === "locked" ? status : `${Math.max(left, 0)} يوماً`}
            </span>
          </span>
        </span>
        <ChevronDown className={`size-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div role="dialog" aria-label="معلومات الحساب" data-testid="account-panel"
          className="absolute left-0 top-full mt-2 w-80 rounded-2xl border border-line bg-surface p-4 text-sm shadow-[var(--shadow-pop)]">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] text-muted">المختبر</div>
              <div className="truncate font-bold">{lab || "تفعيل سابق (بلا رمز مختبر)"}</div>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${toneCls}`}>{status}</span>
          </div>

          <dl className="mt-3 space-y-2 border-t border-line pt-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <dt className="flex items-center gap-1.5 text-muted"><CalendarClock className="size-3.5" /> انتهاء الاشتراك</dt>
              <dd className="font-semibold tabular-nums" dir="ltr">{until ? fmtDate(until) : "—"}</dd>
            </div>
            {state.kind !== "locked" && until > 0 && (
              <div className="flex items-center justify-between gap-2">
                <dt className="flex items-center gap-1.5 text-muted"><Clock className="size-3.5" /> المتبقي</dt>
                <dd className="font-semibold tabular-nums">{Math.max(left, 0)} يوماً</dd>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <dt className="flex items-center gap-1.5 text-muted"><RefreshCw className="size-3.5" /> آخر تحقق من الخادم</dt>
              <dd className="tabular-nums" dir="ltr">{info.checked ? fmtTime(info.checked) : "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="flex items-center gap-1.5 text-muted"><Cpu className="size-3.5" /> رقم الجهاز</dt>
              <dd className="font-mono text-[11px]" dir="ltr" title={info.device}>{info.device.slice(0, 8)}</dd>
            </div>
          </dl>

          {mods.length > 0 && (
            <div className="mt-3 border-t border-line pt-3">
              <div className="mb-1.5 text-[11px] text-muted">المحطات المفعّلة في رمزك</div>
              <div className="flex flex-wrap gap-1" data-testid="account-mods">
                {mods.map((m) => <span key={m.id} className="rounded-full bg-canvas px-2 py-0.5 text-[11px] ring-1 ring-line">{m.label}</span>)}
              </div>
            </div>
          )}

          {(tone !== "teal") && (
            <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
              <span>{state.kind === "grace" ? "أدخل رمز مختبرك قبل انتهاء التفعيل السابق." : "للتجديد تواصل مع المزوّد."}{info.contact ? ` ${info.contact}` : ""}</span>
            </p>
          )}

          <button onClick={checkNow} disabled={busy} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-semibold hover:bg-canvas disabled:opacity-50">
            <RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} /> تحقق الآن من الاشتراك
          </button>
        </div>
      )}
    </div>
  );
}
