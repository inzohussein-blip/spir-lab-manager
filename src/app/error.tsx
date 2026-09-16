"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
