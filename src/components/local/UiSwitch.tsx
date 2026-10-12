"use client";

import { Check } from "lucide-react";
import { setUi, useUi, type UiMode } from "@/lib/local/ui";

/** Little pictures of the two looks: the classic one (as the project has always been) and the new green style. */
function Preview({ mode }: { mode: UiMode }) {
  return mode === "new" ? (
    <svg viewBox="0 0 120 70" className="w-full rounded-xl" aria-hidden>
      <rect width="120" height="70" fill="#f2f5f3" /><rect x="86" y="6" width="28" height="58" rx="7" fill="#fff" /><rect x="90" y="12" width="20" height="3" rx="1.5" fill="#14733f" /><rect x="90" y="20" width="20" height="3" rx="1.5" fill="#cfd8d3" /><rect x="90" y="27" width="20" height="3" rx="1.5" fill="#cfd8d3" />
      <rect x="90" y="50" width="20" height="10" rx="4" fill="#0e5530" />
      <rect x="6" y="6" width="74" height="8" rx="4" fill="#fff" /><rect x="6" y="20" width="22" height="20" rx="6" fill="#14733f" /><rect x="31" y="20" width="22" height="20" rx="6" fill="#fff" /><rect x="56" y="20" width="24" height="20" rx="6" fill="#fff" />
      <rect x="6" y="44" width="46" height="20" rx="6" fill="#fff" /><rect x="56" y="44" width="24" height="20" rx="6" fill="#0e5530" />
    </svg>
  ) : (
    <svg viewBox="0 0 120 70" className="w-full rounded-xl" aria-hidden>
      <rect width="120" height="70" fill="#f8fafc" /><rect x="84" width="36" height="70" fill="#fff" stroke="#e2e8f0" /><rect x="90" y="8" width="8" height="8" rx="2" fill="#0d9488" /><rect x="101" y="9" width="14" height="3" rx="1.5" fill="#0f172a" />
      {[24, 36, 48].map((y, i) => <g key={y}><rect x="90" y={y} width="8" height="8" rx="2" fill={i === 0 ? "#0d9488" : "#e2e8f0"} /><rect x="101" y={y + 2} width="14" height="3" rx="1.5" fill="#94a3b8" /></g>)}
      <rect x="6" y="8" width="40" height="5" rx="2" fill="#0f172a" /><rect x="6" y="20" width="34" height="22" rx="4" fill="#fff" stroke="#d97706" /><rect x="44" y="20" width="34" height="22" rx="4" fill="#fff" stroke="#7c3aed" />
      <rect x="6" y="46" width="72" height="18" rx="4" fill="#fff" stroke="#e2e8f0" />
    </svg>
  );
}

/** The look of the whole site (this device): the classic one — the default — or the new green style. */
export function UiSwitch() {
  const ui = useUi();
  const opts: { m: UiMode; label: string; hint: string }[] = [
    { m: "classic", label: "التصميم القديم (الافتراضي)", hint: "كما كان المشروع دائماً، بألوان المحطات" },
    { m: "new", label: "الأخضر الجديد", hint: "قائمة عائمة، شريط بحث ⌘K، بطاقات مستديرة" },
  ];
  return (
    <div role="radiogroup" aria-label="الثيم" data-testid="ui-switch" className="grid gap-3 sm:grid-cols-2">
      {opts.map((o) => {
        const on = ui === o.m;
        return (
          <button key={o.m} type="button" role="radio" aria-checked={on} data-testid={`ui-${o.m}`} onClick={() => setUi(o.m)}
            className={`rounded-2xl border-2 p-2.5 text-start transition-colors ${on ? "border-brand bg-brand-light" : "border-line hover:bg-canvas"}`}>
            <Preview mode={o.m} />
            <span className="mt-2 flex items-center gap-1.5 text-sm font-semibold">{on && <Check className="size-4 text-brand-dark" />}{o.label}</span>
            <span className="block text-[11px] leading-5 text-muted">{o.hint}</span>
          </button>
        );
      })}
    </div>
  );
}
