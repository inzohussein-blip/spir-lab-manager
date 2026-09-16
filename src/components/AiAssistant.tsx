"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { analyzeOrder } from "@/app/actions/ai";

export function AiAssistant({ orderId }: { orderId: string }) {
  const [pending, start] = useTransition();
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState<string | null>(null);

  function run() {
    setError(null);
    start(async () => {
      const res = await analyzeOrder(orderId);
      setDisclaimer(res.disclaimer);
      if (res.error) {
        setError(res.error);
        setSummary(null);
      } else {
        setSummary(res.summary ?? "");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold">
          <Sparkles className="size-4.5 text-brand" />
          المساعد الذكي — تحليل النتائج
        </div>
        <button
          onClick={run}
          disabled={pending}
          className="rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {pending ? "جارٍ التحليل…" : "تحليل النتائج"}
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {error}
        </p>
      )}

      {summary && (
        <div className="whitespace-pre-wrap rounded-lg bg-canvas p-4 text-sm leading-relaxed">
          {summary}
        </div>
      )}

      {(summary || error) && disclaimer && (
        <p className="mt-3 text-xs text-muted">{disclaimer}</p>
      )}
    </div>
  );
}
