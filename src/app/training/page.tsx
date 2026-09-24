"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Library, Search, FilePlus2, ListOrdered, Link2, Lightbulb } from "lucide-react";
import { getTests, type TrainingTest } from "@/lib/training/store";
import { Img } from "@/components/training/Img";

export default function TrainingLibraryPage() {
  const [tests, setTests] = useState<TrainingTest[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");

  useEffect(() => { setTests(getTests()); }, []);

  const cats = useMemo(() => Array.from(new Set(tests.map((t) => t.category?.trim() || "أخرى"))).sort(), [tests]);
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return tests
      .filter((t) => !cat || (t.category?.trim() || "أخرى") === cat)
      .filter((t) => !term || [t.name_ar, t.name_en, t.abbr, t.category, t.purpose].some((x) => (x ?? "").toLowerCase().includes(term)))
      .sort((a, b) => a.name_ar.localeCompare(b.name_ar, "ar"));
  }, [tests, q, cat]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Library className="size-6 text-brand" /> مكتبة الفحوصات</h1>
          <p className="mt-1 text-sm text-muted">دليل عملي لكل فحص: طريقة العمل، العينة والتيوب، الأدوات، التفسير، والربط مع الفحوصات الأخرى.</p>
        </div>
        <Link href="/training/edit" className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
          <FilePlus2 className="size-4" /> إضافة فحص
        </Link>
      </div>

      <div className="mb-3 relative">
        <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم العربي أو الإنجليزي أو الاختصار…" className="w-full rounded-xl border border-line bg-surface py-2.5 pl-3 pr-9 text-sm outline-none focus:border-brand" />
      </div>
      <div className="mb-5 flex flex-wrap gap-1.5">
        {["", ...cats].map((c) => (
          <button
            key={c || "all"}
            onClick={() => setCat(c)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${cat === c ? "border-brand bg-brand text-white" : "border-line bg-surface text-muted hover:text-ink"}`}
          >
            {c || `الكل (${tests.length})`}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center text-sm text-muted">
          {tests.length === 0 ? "لا توجد فحوصات بعد — أضف أول فحص." : "لا نتائج مطابقة."}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((t) => (
            <Link
              key={t.id}
              href={`/training/test/${t.id}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)] transition-shadow hover:border-brand hover:shadow-[var(--shadow-pop)]"
            >
              <div className="flex items-center gap-3 p-4">
                {t.coverImageId ? (
                  <Img id={t.coverImageId} className="size-14 shrink-0 rounded-xl border border-line bg-white" />
                ) : (
                  <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-dark px-1 text-center text-sm font-extrabold leading-tight text-white" dir="ltr">
                    {(t.abbr || t.name_en || t.name_ar).slice(0, 6)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold group-hover:text-brand-dark">{t.name_ar}</div>
                  {t.name_en && <div className="truncate text-xs text-muted" dir="ltr">{t.name_en}</div>}
                  <span className="mt-1 inline-block rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-medium text-brand-dark">{t.category || "أخرى"}</span>
                </div>
              </div>
              {t.purpose && <p className="line-clamp-2 px-4 text-xs text-muted">{t.purpose}</p>}
              <div className="mt-auto flex items-center gap-4 border-t border-line px-4 py-2.5 text-[11px] text-muted">
                <span className="inline-flex items-center gap-1"><ListOrdered className="size-3.5" /> {t.steps.length} خطوة</span>
                <span className="inline-flex items-center gap-1"><Lightbulb className="size-3.5" /> {t.tips.length} ملاحظة</span>
                <span className="inline-flex items-center gap-1"><Link2 className="size-3.5" /> {t.links.length} ربط</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
