"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ListPlus } from "lucide-react";
import { importDefaultTests } from "@/app/actions/labdb";

/** Settings → «قائمة الفحوصات»: add the built-in test list (a new lab database starts empty). */
export function ImportTestsCard({ count }: { count: number }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const router = useRouter();
  async function run() {
    setBusy(true); setMsg("");
    const r = await importDefaultTests();
    setBusy(false);
    if (r.ok) router.refresh();
    setMsg(r.ok ? `✓ أُضيف ${r.added} فحصاً (من ${r.total})${r.added < r.total ? " — الموجودة سابقاً بنفس الرمز بقيت كما هي" : ""}.` : "للمدير فقط.");
  }
  return (
    <div data-testid="import-tests-card" className="mb-4 rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <div className="mb-1 flex items-center gap-2 font-semibold"><ListPlus className="size-4 text-brand" /> قائمة الفحوصات</div>
      <p className="mb-3 text-xs leading-relaxed text-muted">
        في القائمة الآن {count} فحصاً. أضف القائمة الافتراضية (الأسماء والوحدات والمعدلات الطبيعية) ثم عدّل الأسعار من «الفحوصات».
        الفحوصات الموجودة بنفس الرمز لا تتغيّر.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={busy} onClick={run} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">استيراد قائمة الفحوصات الافتراضية</button>
        {msg && <span data-testid="import-tests-msg" className="text-sm text-teal-700">{msg}</span>}
      </div>
    </div>
  );
}
