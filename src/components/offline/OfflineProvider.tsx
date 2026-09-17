"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { saveResult } from "@/app/actions/orders";
import {
  enqueue,
  getOutbox,
  remove,
  subscribe,
  toFormData,
  type OutboxItem,
} from "@/lib/offline/outbox";

interface OfflineCtx {
  online: boolean;
  pending: OutboxItem[];
  syncing: boolean;
  /** Save a result: now if online, else queue (auto-synced on reconnect). */
  submitResult: (fields: Record<string, string>, label: string) => Promise<"synced" | "queued">;
  flush: () => Promise<void>;
}

const Ctx = createContext<OfflineCtx | null>(null);

async function replay(item: OutboxItem): Promise<void> {
  if (item.kind === "result") {
    await saveResult(toFormData(item.fields));
  }
}

export function OfflineProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState<OutboxItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const flushing = useRef(false);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    const items = getOutbox();
    if (items.length === 0 || !navigator.onLine) return;
    flushing.current = true;
    setSyncing(true);
    try {
      for (const item of items) {
        try {
          await replay(item);
          remove(item.id);
        } catch {
          break; // stop on first failure; retry later
        }
      }
      router.refresh();
    } finally {
      flushing.current = false;
      setSyncing(false);
    }
  }, [router]);

  useEffect(() => {
    setOnline(navigator.onLine);
    setPending(getOutbox());
    const unsub = subscribe(setPending);
    const goOnline = () => {
      setOnline(true);
      flush();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    if (navigator.onLine) flush();

    // Register the PWA service worker (offline app shell).
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    return () => {
      unsub();
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [flush]);

  const submitResult = useCallback(
    async (fields: Record<string, string>, label: string): Promise<"synced" | "queued"> => {
      if (navigator.onLine) {
        try {
          await saveResult(toFormData(fields));
          router.refresh();
          return "synced";
        } catch {
          enqueue("result", fields, label);
          return "queued";
        }
      }
      enqueue("result", fields, label);
      return "queued";
    },
    [router]
  );

  return (
    <Ctx.Provider value={{ online, pending, syncing, submitResult, flush }}>
      {children}
    </Ctx.Provider>
  );
}

export function useOffline(): OfflineCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useOffline must be used within OfflineProvider");
  return c;
}
