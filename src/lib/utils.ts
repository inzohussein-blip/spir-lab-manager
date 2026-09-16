import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as SAR-style currency for the daily/financial views. */
export function money(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return v.toLocaleString("ar-EG", { maximumFractionDigits: 2 });
}
