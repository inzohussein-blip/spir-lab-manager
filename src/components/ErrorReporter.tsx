"use client";

import { useEffect } from "react";

/** Sends errors seen in this browser to the owner's «سجل الأخطاء» (kept only while it is on).
 *  At most a few per page, never in the way of the page. */
let sent = 0;
export function reportError(message: string, digest = "") {
  if (sent >= 5 || !message) return;
  sent++;
  (async () => {
    let lid: string | null = null;
    try { lid = (await (await import("@/lib/license/client")).licenseIdentity())?.lid ?? null; } catch { /* none */ }
    await fetch("/api/errors", {
      method: "POST", headers: { "content-type": "application/json" }, keepalive: true,
      body: JSON.stringify({ path: location.pathname, message: message.slice(0, 500), digest, lid }),
    });
  })().catch(() => undefined);
}

export function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => reportError(e.message || String(e.error ?? ""));
    const onReject = (e: PromiseRejectionEvent) => reportError(e.reason instanceof Error ? e.reason.message : String(e.reason ?? ""));
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onReject);
    return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onReject); };
  }, []);
  return null;
}
