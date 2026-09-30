"use client";

import { useEffect, useState, type ReactNode } from "react";

/** «حجم الخط» of the about station (this device only). */
export const TEXT_SIZE_KEY = "about.textSize.v1";
export const TEXT_SIZES = [
  { id: "normal", label: "عادي", zoom: 1 },
  { id: "large", label: "كبير", zoom: 1.12 },
  { id: "xlarge", label: "أكبر", zoom: 1.25 },
] as const;
export type TextSizeId = (typeof TEXT_SIZES)[number]["id"];
const EVENT = "about-text-size";

export function readTextSize(): TextSizeId {
  try {
    const v = localStorage.getItem(TEXT_SIZE_KEY);
    return TEXT_SIZES.some((s) => s.id === v) ? (v as TextSizeId) : "normal";
  } catch { return "normal"; }
}
export function saveTextSize(id: TextSizeId) {
  try { localStorage.setItem(TEXT_SIZE_KEY, id); } catch { /* private window */ }
  window.dispatchEvent(new Event(EVENT));
}

/** The station's content, drawn at the chosen text size. */
export function TextSizeMain({ children }: { children: ReactNode }) {
  const [size, setSize] = useState<TextSizeId>("normal");
  useEffect(() => {
    const on = () => setSize(readTextSize());
    on();
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  const zoom = TEXT_SIZES.find((s) => s.id === size)!.zoom;
  return (
    <main className="min-w-0 flex-1 p-4 md:p-7" data-text-size={size} style={zoom !== 1 ? { zoom } : undefined}>{children}</main>
  );
}
