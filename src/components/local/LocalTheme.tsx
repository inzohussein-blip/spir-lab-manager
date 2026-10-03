"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

/**
 * Appearance of every window: light by default, dark, or "auto" (the device's setting).
 * Each station keeps its own choice (its Settings); the welcome page's choice («lab-theme»)
 * is for the welcome page, /license and the admin panel. Leaving a station restores that one.
 */
export type ThemeMode = "auto" | "light" | "dark";
const EVENT = "local-theme";

function getMode(key: string): ThemeMode {
  try {
    const t = localStorage.getItem(key);
    return t === "dark" || t === "auto" ? t : "light";
  } catch {
    return "light";
  }
}
function setMode(key: string, mode: ThemeMode): void {
  try {
    localStorage.setItem(key, mode);
  } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVENT));
}

const deviceDark = () => !!window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
/** Dark for a choice: light unless dark, or «تلقائي» on a dark device. */
const isDark = (m: ThemeMode) => m === "dark" || (m === "auto" && deviceDark());
/** The welcome page's choice (same rule as the root layout's pre-paint script). */
const siteDark = () => isDark(getMode("lab-theme"));
function apply(dark: boolean) {
  if (dark) document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.removeAttribute("data-theme");
}

/** Mounted in a station layout: applies its choice, restores the site's on leave. */
export function LocalThemeApplier({ storageKey }: { storageKey: string }) {
  useEffect(() => {
    const run = () => apply(isDark(getMode(storageKey)));
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
  const [mode, setModeState] = useState<ThemeMode>("light");
  useEffect(() => setModeState(getMode(storageKey)), [storageKey]);
  const opts: { m: ThemeMode; label: string; icon: typeof Sun }[] = [
    { m: "light", label: "فاتح", icon: Sun },
    { m: "dark", label: "غامق", icon: Moon },
    { m: "auto", label: "تلقائي (حسب الجهاز)", icon: Monitor },
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

/** The welcome page's appearance (also /license and the admin panel): light by default. */
export function SiteThemeSwitch() {
  const [mode, setModeState] = useState<ThemeMode>("light");
  useEffect(() => setModeState(getMode("lab-theme")), []);
  const opts: { m: ThemeMode; label: string; icon: typeof Sun }[] = [
    { m: "light", label: "فاتح", icon: Sun },
    { m: "dark", label: "غامق", icon: Moon },
    { m: "auto", label: "تلقائي", icon: Monitor },
  ];
  return (
    <div role="radiogroup" aria-label="المظهر" data-testid="site-theme" className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-canvas p-1">
      {opts.map(({ m, label, icon: Icon }) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          onClick={() => { setModeState(m); setMode("lab-theme", m); apply(siteDark()); }}
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
      <p className="mb-3 text-xs text-muted">{note ?? "الفاتح هو الافتراضي، والغامق يريح العين في المناوبات الليلية. يخص هذه المحطة فقط، والطباعة تبقى بيضاء دائماً."}</p>
      <LocalThemeSwitch storageKey={storageKey} />
    </div>
  );
}
