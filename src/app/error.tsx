"use client";

import { useEffect, useState } from "react";
import { adminDbError } from "@/lib/db/labErrors";
import { reportError } from "@/components/ErrorReporter";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // When the lab's own database stopped answering mid-use, say so plainly.
  const [db, setDb] = useState<{ problem: string; host: string } | null>(null);
  useEffect(() => {
    let alive = true;
    reportError(error?.message || "page error", error?.digest ?? "");
    fetch("/api/labdb/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (alive && d?.problem) setDb({ problem: d.problem, host: d.host ?? "" }); })
      .catch(() => { /* the generic message stays */ });
    return () => { alive = false; };
  }, [error]);

  if (db) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div data-testid="lab-db-down" className="max-w-md rounded-2xl border border-amber-300 bg-surface p-7 text-center shadow-sm">
          <div className="mb-2 text-lg font-bold">قاعدة بيانات المختبر لا تستجيب</div>
          <p className="mb-2 text-sm text-muted">{adminDbError(db.problem)}</p>
          {db.host && <p dir="ltr" className="mb-3 font-mono text-xs text-muted">{db.host}</p>}
          <p className="mb-4 text-xs text-muted">
            لم يُحفظ آخر إجراء. تحقّق من الإنترنت ومن حالة القاعدة لدى مزوّدها، ثم أعد المحاولة. المحطات المحلية تبقى تعمل.
          </p>
          <button onClick={() => { setDb(null); reset(); }} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border border-line bg-surface p-7 text-center shadow-sm">
        <div className="mb-2 text-lg font-bold">حدث خطأ غير متوقّع</div>
        <p className="mb-4 text-sm text-muted">
          تعذّر تحميل هذه الصفحة. حاول مرة أخرى، وإذا تكرّر الأمر فتأكّد من إعداد
          قاعدة البيانات.
        </p>
        {error?.digest && (
          <p className="mb-4 text-xs text-muted">رمز الخطأ: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}
