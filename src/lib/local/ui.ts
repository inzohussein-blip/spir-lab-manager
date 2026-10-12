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
export { UI_KEY } from "./uiScript";
import { UI_KEY } from "./uiScript";
const EVT = "lab-ui";

export function getUi(): UiMode {
  return typeof document !== "undefined" && document.documentElement.getAttribute("data-ui") === "new" ? "new" : "classic";
}
export function setUi(mode: UiMode): void {
  try { if (mode === "new") localStorage.setItem(UI_KEY, "new"); else localStorage.removeItem(UI_KEY); } catch { /* ignore */ }
  if (mode === "new") document.documentElement.setAttribute("data-ui", "new"); else document.documentElement.removeAttribute("data-ui");
  window.dispatchEvent(new Event(EVT));
}
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
