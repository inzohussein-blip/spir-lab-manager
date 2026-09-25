"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

/**
 * Station appearance (each station's Settings): "auto" follows the computer, or
 * force light / dark. The choice belongs to one station only — leaving it restores
 * the site-wide behaviour, and every other station keeps its own choice.
 */
export type ThemeMode = "auto" | "light" | "dark";
const EVENT = "local-theme";

function getMode(key: string): ThemeMode {
  try {
    const t = localStorage.getItem(key);
    return t === "dark" || t === "light" ? t : "auto";
  } catch {
    return "auto";
  }
}
function setMode(key: string, mode: ThemeMode): void {
  try {
    if (mode === "auto") localStorage.removeItem(key);
    else localStorage.setItem(key, mode);
  } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVENT));
}

/** The site-wide choice (same rule as the root layout's pre-paint script). */
function siteDark(): boolean {
  try {
    const t = localStorage.getItem("lab-theme");
    if (t === "dark") return true;
    if (t === "light") return false;
  } catch { /* ignore */ }
  return !!window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
}
function apply(dark: boolean) {
  if (dark) document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.removeAttribute("data-theme");
}

/** Mounted in a station layout: applies its choice, restores the site's on leave. */
export function LocalThemeApplier({ storageKey }: { storageKey: string }) {
  useEffect(() => {
    const run = () => { const m = getMode(storageKey); apply(m === "auto" ? siteDark() : m === "dark"); };
    run();
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    window.addEventListener(EVENT, run);
    mq?.addEventListener?.("change", run);
    return () => {
      window.removeEventListener(EVENT, run);
      mq?.removeEventListener?.("change", run);
      apply(siteDark());
    };
  }, [storageKey]);
  return null;
}

/** Three-way switch for a station's settings page. */
export function LocalThemeSwitch({ storageKey }: { storageKey: string }) {
  const [mode, setModeState] = useState<ThemeMode>("auto");
  useEffect(() => setModeState(getMode(storageKey)), [storageKey]);
  const opts: { m: ThemeMode; label: string; icon: typeof Sun }[] = [
    { m: "auto", label: "تلقائي (حسب الجهاز)", icon: Monitor },
    { m: "light", label: "فاتح", icon: Sun },
    { m: "dark", label: "غامق", icon: Moon },
  ];
  return (
    <div role="radiogroup" aria-label="مظهر المحطة" className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-canvas p-1">
      {opts.map(({ m, label, icon: Icon }) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          onClick={() => { setModeState(m); setMode(storageKey, m); }}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${mode === m ? "bg-brand font-semibold text-white" : "text-muted hover:bg-surface hover:text-ink"}`}
        >
          <Icon className="size-4" /> {label}
        </button>
      ))}
    </div>
  );
}

/** Settings card with the switch (same look in every station). */
export function ThemeCard({ storageKey, note }: { storageKey: string; note?: string }) {
  return (
    <div className="mb-4 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
      <div className="mb-1 text-sm font-semibold">مظهر المحطة</div>
      <p className="mb-3 text-xs text-muted">{note ?? "الوضع الغامق يريح العين في المناوبات الليلية. يخص هذه المحطة فقط، والطباعة تبقى بيضاء دائماً."}</p>
      <LocalThemeSwitch storageKey={storageKey} />
    </div>
  );
}
