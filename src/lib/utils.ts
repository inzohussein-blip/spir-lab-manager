import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Currency label used across the app (Iraqi Dinar). */
export const CURRENCY = "د.ع";

/** Format a number for the financial views. The Iraqi Dinar is used in whole
 *  units (no fils in practice), so amounts are grouped with no decimals.
 *  Uses Latin numerals (1,2,3) rather than Arabic-Indic. */
export function money(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return v.toLocaleString("ar-IQ-u-nu-latn", { maximumFractionDigits: 0 });
}
