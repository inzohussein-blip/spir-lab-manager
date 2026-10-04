"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Pencil, Check } from "lucide-react";
import { setTestLimits } from "@/app/actions/tests";

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-label="حفظ القيم الحرجة"
      className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand text-white hover:bg-brand-dark disabled:opacity-60">
      <Check className="size-4" />
    </button>
  );
}

const box = "w-16 rounded-lg border border-line bg-surface px-1.5 py-1 text-sm tabular-nums outline-none focus:border-brand";

/** Inline editor for a test's critical limits and its turnaround time (minutes). */
export function TestLimitsCell({ id, low, high, tat }: { id: string; low: number | null; high: number | null; tat: number | null }) {
  const [editing, setEditing] = useState(false);
  if (!editing) {
    const crit = low != null || high != null ? `${low != null ? `< ${low}` : ""}${low != null && high != null ? " · " : ""}${high != null ? `> ${high}` : ""}` : "";
    return (
      <button type="button" onClick={() => setEditing(true)} title="القيم الحرجة ومدة الإنجاز" data-testid="test-limits"
        className="group inline-flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 text-start hover:bg-canvas">
        <span className="text-xs">
          {crit ? <span className="font-semibold text-red-600" dir="ltr">{crit}</span> : <span className="text-muted">—</span>}
          {tat != null && <span className="ms-1 text-muted">· {tat} د</span>}
        </span>
        <Pencil className="size-3.5 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
    );
  }
  return (
    <form action={(fd) => { void setTestLimits(fd).then(() => setEditing(false)); }} className="flex flex-wrap items-center gap-1">
      <input type="hidden" name="test_id" value={id} />
      <input name="critical_low" type="number" step="any" defaultValue={low ?? ""} placeholder="أقل من" aria-label="الحد الحرج الأدنى" className={box} autoFocus />
      <input name="critical_high" type="number" step="any" defaultValue={high ?? ""} placeholder="أعلى من" aria-label="الحد الحرج الأعلى" className={box} />
      <input name="tat_minutes" type="number" min="0" defaultValue={tat ?? ""} placeholder="دقيقة" aria-label="مدة الإنجاز بالدقائق" className={box} />
      <SaveBtn />
    </form>
  );
}
