"use client";

import { useEffect, useState } from "react";
import { getSettings, saveSettings } from "./store";

/**
 * Optional read-only mode for the Training station. When enabled in settings,
 * trainees can read, study and take quizzes, but adding/editing/deleting needs
 * the PIN. Unlocking lasts for the browser tab session. This is a guard against
 * accidental edits on a shared computer — not strong security.
 */

const K_UNLOCK = "training.unlocked";
const EVT = "training-lock";

async function sha256(text: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // Fallback for non-secure contexts: simple FNV-1a.
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return "f" + (h >>> 0).toString(16);
  }
}
export const hashPin = (pin: string) => sha256(`spir-training-pin:${pin.trim()}`);

export function lockEnabled(): boolean {
  const s = getSettings();
  return !!(s.lockEnabled && s.pinHash);
}
function isUnlocked(): boolean {
  try { return sessionStorage.getItem(K_UNLOCK) === "1"; } catch { return false; }
}
function notify() { window.dispatchEvent(new Event(EVT)); }

export async function tryUnlock(pin: string): Promise<boolean> {
  const ok = (await hashPin(pin)) === getSettings().pinHash;
  if (ok) { try { sessionStorage.setItem(K_UNLOCK, "1"); } catch { /* ignore */ } notify(); }
  return ok;
}
export function lockNow(): void {
  try { sessionStorage.removeItem(K_UNLOCK); } catch { /* ignore */ }
  notify();
}
/** Turn read-only mode on (with a new PIN) or off. */
export async function setLock(enabled: boolean, pin?: string): Promise<void> {
  const s = getSettings();
  if (enabled && pin) {
    saveSettings({ ...s, lockEnabled: true, pinHash: await hashPin(pin) });
    try { sessionStorage.setItem(K_UNLOCK, "1"); } catch { /* ignore */ } // the person who set it stays unlocked
  } else {
    saveSettings({ ...s, lockEnabled: false, pinHash: undefined });
  }
  notify();
}

/** { ready, lockOn, canEdit } — re-renders when the lock state changes. */
export function useEditLock() {
  const [state, setState] = useState({ ready: false, lockOn: false, canEdit: true });
  useEffect(() => {
    const update = () => {
      const on = lockEnabled();
      setState({ ready: true, lockOn: on, canEdit: !on || isUnlocked() });
    };
    update();
    window.addEventListener(EVT, update);
    return () => window.removeEventListener(EVT, update);
  }, []);
  return state;
}
