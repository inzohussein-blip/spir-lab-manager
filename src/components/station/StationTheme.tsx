"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { STATION_THEME_KEY as KEY } from "@/lib/station/theme";

/**
 * Lab Station appearance (Settings): "auto" follows the computer, or force light /
 * dark. Scoped to the station — other stations keep the site-wide behaviour, which
 * is restored when leaving the station.
 */
export type StationThemeMode = "auto" | "light" | "dark";
const EVENT = "station-theme";

export function getStationTheme(): StationThemeMode {
  try {
    const t = localStorage.getItem(KEY);
    return t === "dark" || t === "light" ? t : "auto";
  } catch {
    return "auto";
  }
}
export function setStationTheme(mode: StationThemeMode): void {
  try {
    if (mode === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, mode);
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

/** Mounted in the station layout: applies the station's choice, restores the site's on leave. */
export function StationThemeApplier() {
  useEffect(() => {
    const run = () => { const m = getStationTheme(); apply(m === "auto" ? siteDark() : m === "dark"); };
    run();
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    window.addEventListener(EVENT, run);
    mq?.addEventListener?.("change", run);
    return () => {
      window.removeEventListener(EVENT, run);
      mq?.removeEventListener?.("change", run);
      apply(siteDark());
    };
  }, []);
  return null;
}

/** Three-way switch for the settings page. */
export function StationThemeSwitch() {
  const [mode, setMode] = useState<StationThemeMode>("auto");
  useEffect(() => setMode(getStationTheme()), []);
  const opts: { m: StationThemeMode; label: string; icon: typeof Sun }[] = [
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
          onClick={() => { setMode(m); setStationTheme(m); }}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${mode === m ? "bg-brand font-semibold text-white" : "text-muted hover:bg-surface hover:text-ink"}`}
        >
          <Icon className="size-4" /> {label}
        </button>
      ))}
    </div>
  );
}
