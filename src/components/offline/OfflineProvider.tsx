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
import { saveResult, createOrder } from "@/app/actions/orders";
import { createPatient } from "@/app/actions/patients";
import {
  enqueue,
  getOutbox,
  remove,
  subscribe,
  toFormData,
  type OutboxItem,
  type OutboxFields,
} from "@/lib/offline/outbox";

interface OfflineCtx {
  online: boolean;
  pending: OutboxItem[];
  syncing: boolean;
  /** Save a result: now if online, else queue (auto-synced on reconnect). */
  submitResult: (fields: OutboxFields, label: string) => Promise<"synced" | "queued">;
  /** Create a patient online (returns id) or queue offline. */
  submitPatient: (fields: OutboxFields, label: string) => Promise<{ status: "synced"; id: string } | { status: "queued" }>;
  /** Create an order online (returns id) or queue offline. */
  submitOrder: (fields: OutboxFields, label: string) => Promise<{ status: "synced"; orderId: string } | { status: "queued" }>;
  flush: () => Promise<void>;
}

const Ctx = createContext<OfflineCtx | null>(null);

async function replay(item: OutboxItem): Promise<void> {
  const fd = toFormData(item.fields);
  if (item.kind === "result") await saveResult(fd);
  else if (item.kind === "patient") await createPatient(fd);
  else if (item.kind === "order") await createOrder(fd);
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
          // keep this item and try the rest; it retries on the next flush
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
    async (fields: OutboxFields, label: string): Promise<"synced" | "queued"> => {
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

  const submitPatient = useCallback(
    async (fields: OutboxFields, label: string) => {
      if (navigator.onLine) {
        try {
          const r = await createPatient(toFormData(fields));
          if (r?.id) return { status: "synced" as const, id: r.id };
        } catch {
          /* fall through to queue */
        }
      }
      enqueue("patient", fields, label);
      return { status: "queued" as const };
    },
    []
  );

  const submitOrder = useCallback(
    async (fields: OutboxFields, label: string) => {
      if (navigator.onLine) {
        try {
          const r = await createOrder(toFormData(fields));
          if (r?.orderId) return { status: "synced" as const, orderId: r.orderId };
        } catch {
          /* fall through to queue */
        }
      }
      enqueue("order", fields, label);
      return { status: "queued" as const };
    },
    []
  );

  return (
    <Ctx.Provider value={{ online, pending, syncing, submitResult, submitPatient, submitOrder, flush }}>
      {children}
    </Ctx.Provider>
  );
}

export function useOffline(): OfflineCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useOffline must be used within OfflineProvider");
  return c;
}
