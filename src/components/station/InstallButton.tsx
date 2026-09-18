"use client";

import { useEffect, useState } from "react";
import { Download, Check } from "lucide-react";

/** "Install as app" (PWA) button — only meaningful in the Lab Station. It
 *  captures the browser's install prompt and triggers it on click. */
export function InstallButton() {
  const [deferred, setDeferred] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    // Already running as an installed app?
    if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch { /* ignore */ }
    setDeferred(null);
  }

  if (installed) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-lg bg-teal-50 px-3 py-2 text-sm font-medium text-brand-dark">
        <Check className="size-4" /> التطبيق مثبَّت على هذا الجهاز
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={install}
        disabled={!deferred}
        className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
      >
        <Download className="size-4" /> تثبيت المحطة كتطبيق
      </button>
      {!deferred && (
        <p className="text-xs text-muted">
          إن لم يظهر التثبيت: افتح قائمة المتصفح ← «تثبيت التطبيق» / «Install app». (يتطلّب Chrome/Edge)
        </p>
      )}
    </div>
  );
}
