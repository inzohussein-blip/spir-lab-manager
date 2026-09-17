"use client";

/**
 * A tiny offline outbox (adapted from Spir-Margin). Queued writes are stored in
 * localStorage as flat form-field maps and replayed through their server action
 * when connectivity returns. Survives reloads; scoped to this browser.
 */

export type OutboxKind = "result" | "patient" | "order";

export type OutboxFields = Record<string, string | string[]>;

export interface OutboxItem {
  id: string;
  kind: OutboxKind;
  /** Map of the server action's FormData fields (arrays for multi-value). */
  fields: OutboxFields;
  /** Human label for the pending list. */
  label: string;
  ts: number;
}

const KEY = "lab-outbox";
type Listener = (items: OutboxItem[]) => void;
const listeners = new Set<Listener>();

function read(): OutboxItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function write(items: OutboxItem[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // storage unavailable (private mode) — nothing we can do
  }
  listeners.forEach((l) => l(items));
}

export function getOutbox(): OutboxItem[] {
  return read();
}

export function enqueue(kind: OutboxKind, fields: OutboxFields, label: string): OutboxItem {
  const item: OutboxItem = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    kind,
    fields,
    label,
    ts: Date.now(),
  };
  write([...read(), item]);
  return item;
}

export function remove(id: string): void {
  write(read().filter((i) => i.id !== id));
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function toFormData(fields: OutboxFields): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v)) v.forEach((x) => fd.append(k, x));
    else fd.append(k, v);
  }
  return fd;
}
