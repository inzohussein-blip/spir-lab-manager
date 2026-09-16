"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
    >
      <Printer className="size-4" /> طباعة A4
    </button>
  );
}
