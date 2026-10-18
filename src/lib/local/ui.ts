"use client";

import { useSyncExternalStore } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * Which look the site wears: the classic one (the default — the project exactly as it was), or the
 * new green dashboard style. Kept on this device; `data-ui="new"` on <html> switches the CSS (set
 * before the first paint by `uiScript` in the root layout). Every rule of the new look is scoped to
 * `:root[data-ui="new"]`, so the classic look is the untouched original.
 */
export type UiMode = "classic" | "new";
export { UI_KEY, UI_COLOR_KEY } from "./uiScript";
import { UI_KEY, UI_COLOR_KEY } from "./uiScript";
const EVT = "lab-ui";

export function getUi(): UiMode {
  return typeof document !== "undefined" && document.documentElement.getAttribute("data-ui") === "new" ? "new" : "classic";
}
export function setUi(mode: UiMode): void {
  try { if (mode === "new") localStorage.setItem(UI_KEY, "new"); else localStorage.removeItem(UI_KEY); } catch { /* ignore */ }
  const d = document.documentElement;
  if (mode === "new") {
    d.setAttribute("data-ui", "new");
    const c = readColor();
    if (c !== "green") d.setAttribute("data-ui-color", c); else d.removeAttribute("data-ui-color");
  } else { d.removeAttribute("data-ui"); d.removeAttribute("data-ui-color"); }
  window.dispatchEvent(new Event(EVT));
}

// ── The new look's accent: green (the default), another colour, or each station's own ──
export type UiColor = "green" | "blue" | "violet" | "teal" | "rose" | "orange" | "slate" | "stations";
export const UI_COLORS: { c: UiColor; label: string; swatch: string[] }[] = [
  { c: "green", label: "أخضر", swatch: ["#14733f"] },
  { c: "blue", label: "أزرق", swatch: ["#1d4ed8"] },
  { c: "violet", label: "بنفسجي", swatch: ["#6d28d9"] },
  { c: "teal", label: "فيروزي", swatch: ["#0f766e"] },
  { c: "rose", label: "وردي", swatch: ["#be123c"] },
  { c: "orange", label: "برتقالي", swatch: ["#c2410c"] },
  { c: "slate", label: "رمادي", swatch: ["#334155"] },
  { c: "stations", label: "ألوان المحطات", swatch: ["#0d9488", "#d97706", "#4f46e5", "#e11d48"] },
];
const isColor = (v: string | null): v is UiColor => !!v && UI_COLORS.some((x) => x.c === v);
function readColor(): UiColor {
  try { const v = localStorage.getItem(UI_COLOR_KEY); return isColor(v) ? v : "green"; } catch { return "green"; }
}
export function getUiColor(): UiColor {
  if (typeof document === "undefined") return "green";
  const v = document.documentElement.getAttribute("data-ui-color");
  return isColor(v) ? v : "green";
}
/** Keep the accent on this device (applied at once when the new look is on). */
export function setUiColor(c: UiColor): void {
  try { if (c === "green") localStorage.removeItem(UI_COLOR_KEY); else localStorage.setItem(UI_COLOR_KEY, c); } catch { /* ignore */ }
  const d = document.documentElement;
  if (d.getAttribute("data-ui") === "new" && c !== "green") d.setAttribute("data-ui-color", c); else d.removeAttribute("data-ui-color");
  window.dispatchEvent(new Event(EVT));
}
/** The current accent (green while the page is first rendered on the server). */
export const useUiColor = (): UiColor => useSyncExternalStore(subscribe, getUiColor, () => "green" as UiColor);
const subscribe = (cb: () => void) => {
  window.addEventListener(EVT, cb); window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); };
};
/** The current look (the classic one while the page is first rendered on the server). */
export const useUi = (): UiMode => useSyncExternalStore(subscribe, getUi, () => "classic" as UiMode);

// ── The station's menu, shared with the new look's top bar (search ⌘K and alerts) ──
export interface ShellLink { href: string; label: string; hint?: string; icon: LucideIcon; n?: number }
export interface ShellNav { app: string; links: ShellLink[] }
let nav: ShellNav = { app: "", links: [] };
const NAV_EVT = "lab-ui-nav";
/** Set by the station's sidebar: its name and links (with the numbers beside them). */
export function setShellNav(next: ShellNav): void {
  if (nav.app === next.app && nav.links.length === next.links.length && nav.links.every((l, i) => l.href === next.links[i].href && l.n === next.links[i].n)) return;
  nav = next;
  window.dispatchEvent(new Event(NAV_EVT));
}
const subNav = (cb: () => void) => { window.addEventListener(NAV_EVT, cb); return () => window.removeEventListener(NAV_EVT, cb); };
const EMPTY: ShellNav = { app: "", links: [] };
export const useShellNav = (): ShellNav => useSyncExternalStore(subNav, () => nav, () => EMPTY);
