"use client";

import { useState, type InputHTMLAttributes } from "react";

/** Arabic-Indic (٠١٢) and Persian (۰۱۲) digits → 1 2 3; the Arabic decimal mark → «.»; group marks dropped. */
export function latinDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0))
    .replace(/٫/g, ".")
    .replace(/[٬،,\s]/g, "");
}
/** Only digits and one decimal point. */
function cleanNumber(s: string): string {
  const t = latinDigits(s).replace(/[^\d.]/g, "");
  const i = t.indexOf(".");
  return i < 0 ? t : t.slice(0, i + 1) + t.slice(i + 1).replace(/\./g, "");
}
const grouped = (s: string) => {
  if (!s) return "";
  const [a, b] = s.split(".");
  return a.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (b !== undefined ? "." + b : "");
};
const shown = (v: number | string, group: boolean, zeroEmpty: boolean) => {
  const s = cleanNumber(String(v ?? ""));
  if (zeroEmpty && Number(s) === 0 && !s.includes(".")) return "";
  return group ? grouped(s) : s;
};

/**
 * A number field that always accepts typing: Arabic-keyboard digits turn into 1 2 3 as they are
 * typed, the field can be emptied (no stuck 0), and amounts show as 25,000 once you leave it.
 * `onValue` gets the plain number text ("25000", "" when empty).
 */
export function NumberInput({ value, onValue, group = false, zeroEmpty = false, className, onFocus, onBlur, ...rest }: {
  value: number | string;
  onValue: (clean: string) => void;
  /** Show thousands separators when the field is not being edited (amounts). */
  group?: boolean;
  /** Show 0 as an empty field (so the placeholder shows). */
  zeroEmpty?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "inputMode">) {
  const [text, setText] = useState(() => shown(value, group, zeroEmpty));
  const [focused, setFocused] = useState(false);
  const [last, setLast] = useState(value);
  // The parent changed the value (form reset, edit another row): show it, unless it is what is being typed.
  if (value !== last) {
    setLast(value);
    if (Number(cleanNumber(text)) !== Number(cleanNumber(String(value ?? ""))) || cleanNumber(String(value ?? "")) === "") {
      setText(shown(value, group && !focused, zeroEmpty));
    }
  }
  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      dir="ltr"
      value={text}
      onChange={(e) => { const c = cleanNumber(e.target.value); setText(c); onValue(c); }}
      onFocus={(e) => { setFocused(true); if (group) setText(cleanNumber(text)); onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); if (group) setText(grouped(cleanNumber(text))); onBlur?.(e); }}
      className={`${className ?? ""} tabular-nums text-right`}
    />
  );
}
