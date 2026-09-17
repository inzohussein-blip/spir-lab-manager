"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Pencil, Check } from "lucide-react";
import { setTestPrice } from "@/app/actions/tests";
import { money, CURRENCY } from "@/lib/utils";

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand text-white hover:bg-brand-dark disabled:opacity-60"
      disabled={pending}
      aria-label="حفظ السعر"
    >
      <Check className="size-4" />
    </button>
  );
}

/** Inline price editor for a test. Blank = unpriced (shown as "بدون سعر"). */
export function TestPriceCell({ id, price }: { id: string; price: number }) {
  const [editing, setEditing] = useState(false);
  const priced = Number(price) > 0;

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="group inline-flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 hover:bg-canvas"
        title="تعديل السعر"
      >
        {priced ? (
          <span className="tabular-nums font-medium">{money(price)} {CURRENCY}</span>
        ) : (
          <span className="text-xs text-muted">بدون سعر</span>
        )}
        <Pencil className="size-3.5 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
    );
  }

  return (
    <form action={setTestPrice} className="flex items-center gap-1.5">
      <input type="hidden" name="test_id" value={id} />
      <input
        name="price"
        type="number"
        step="any"
        min="0"
        defaultValue={priced ? String(price) : ""}
        placeholder="بدون سعر"
        autoFocus
        className="w-24 rounded-lg border border-line bg-surface px-2 py-1 text-sm tabular-nums outline-none focus:border-brand"
      />
      <SaveBtn />
    </form>
  );
}
