"use client";

import { useCallback, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";

type Tone = "ok" | "warn" | "info";
interface ToastMsg { id: number; text: string; tone: Tone }

/** Minimal toast queue for the station — no dependencies. */
export function useToast() {
  const [items, setItems] = useState<ToastMsg[]>([]);
  const seq = useRef(0);

  const show = useCallback((text: string, tone: Tone = "ok") => {
    const id = ++seq.current;
    setItems((xs) => [...xs.slice(-2), { id, text, tone }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 2600);
  }, []);

  const node = (
    <div className="no-print pointer-events-none fixed bottom-5 left-5 z-50 flex flex-col gap-2">
      {items.map((t) => {
        const Icon = t.tone === "ok" ? CheckCircle2 : t.tone === "warn" ? AlertTriangle : Info;
        const tone =
          t.tone === "ok" ? "border-teal-200 text-brand-dark"
          : t.tone === "warn" ? "border-amber-200 text-amber-700"
          : "border-line text-ink";
        return (
          <div key={t.id} role="status" className={`station-toast flex items-center gap-2 rounded-xl border bg-surface px-4 py-2.5 text-sm font-medium shadow-[var(--shadow-pop)] ${tone}`}>
            <Icon className="size-4 shrink-0" /> {t.text}
          </div>
        );
      })}
    </div>
  );

  return { show, node };
}
