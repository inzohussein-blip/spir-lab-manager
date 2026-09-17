"use client";

import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { useOffline } from "./OfflineProvider";

export function SyncStatus() {
  const { online, pending, syncing, flush } = useOffline();

  if (online && pending.length === 0) {
    return (
      <span className="hidden items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted md:inline-flex">
        <Cloud className="size-3.5" /> متصل
      </span>
    );
  }

  return (
    <button
      onClick={() => flush()}
      title={online ? "مزامنة الآن" : "غير متصل — سيُزامن تلقائياً عند العودة"}
      className={
        "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold " +
        (online ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600")
      }
    >
      {online ? <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} /> : <CloudOff className="size-3.5" />}
      {online ? (pending.length ? `مزامنة (${pending.length})` : "مزامنة") : `دون اتصال${pending.length ? ` · ${pending.length}` : ""}`}
    </button>
  );
}
