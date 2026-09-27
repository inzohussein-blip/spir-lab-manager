import Link from "next/link";
import { DatabaseZap } from "lucide-react";
import { adminDbError } from "@/lib/db/labErrors";

/** Shown instead of the admin panel while the lab's own database does not answer. */
export function LabDbProblem({ code, host }: { code: string; host: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <div data-testid="lab-db-problem" className="w-full max-w-md rounded-2xl border border-line bg-surface p-7 text-center shadow-sm">
        <DatabaseZap className="mx-auto mb-3 size-10 text-amber-600" />
        <div className="mb-2 text-lg font-bold">تعذّر فتح قاعدة بيانات المختبر</div>
        <p className="mb-2 text-sm text-muted">{adminDbError(code)}</p>
        {host && <p dir="ltr" className="mb-4 font-mono text-xs text-muted">{host}</p>}
        <p className="mb-5 text-xs text-muted">
          لوحة الإدارة لهذا المختبر تعمل على قاعدة بياناته الخاصة. تحقّق منها، أو اطلب من صاحب الرموز تعديل الربط.
          المحطات المحلية تبقى تعمل كالمعتاد.
        </p>
        <div className="flex justify-center gap-2">
          <a href="" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">إعادة المحاولة</a>
          <Link href="/welcome" className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-canvas">الصفحة الرئيسية</Link>
        </div>
      </div>
    </div>
  );
}
