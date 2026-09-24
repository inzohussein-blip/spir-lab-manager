"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Library, Search, FilePlus2, ListOrdered, Link2, Lightbulb, Star, Clock, CalendarClock, ListPlus, X } from "lucide-react";
import { getTests, getFavs, getRecent, reviewStatus, bulkCreate, toggleFav, type TrainingTest } from "@/lib/training/store";
import { Img } from "@/components/training/Img";

type Filter = "" | "fav" | "review";

export default function TrainingLibraryPage() {
  const [tests, setTests] = useState<TrainingTest[]>([]);
  const [favs, setFavs] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [filter, setFilter] = useState<Filter>("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkMsg, setBulkMsg] = useState("");

  const load = () => { setTests(getTests()); setFavs(getFavs()); setRecent(getRecent()); };
  useEffect(load, []);

  const byId = useMemo(() => new Map(tests.map((t) => [t.id, t])), [tests]);
  const cats = useMemo(() => Array.from(new Set(tests.map((t) => t.category?.trim() || "أخرى"))).sort(), [tests]);
  const needReview = tests.filter((t) => { const r = reviewStatus(t); return r === "overdue" || r === "soon"; }).length;

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return tests
      .filter((t) => !cat || (t.category?.trim() || "أخرى") === cat)
      .filter((t) => filter !== "fav" || favs.includes(t.id))
      .filter((t) => { if (filter !== "review") return true; const r = reviewStatus(t); return r === "overdue" || r === "soon"; })
      .filter((t) => !term || [t.name_ar, t.name_en, t.abbr, t.category, t.purpose].some((x) => (x ?? "").toLowerCase().includes(term)))
      .sort((a, b) => a.name_ar.localeCompare(b.name_ar, "ar"));
  }, [tests, q, cat, filter, favs]);

  function star(e: React.MouseEvent, id: string) {
    e.preventDefault();
    toggleFav(id);
    setFavs(getFavs());
  }
  function runBulk() {
    const n = bulkCreate(bulkText);
    setBulkMsg(n ? `تم إنشاء ${n} بطاقة فحص.` : "لم يُنشأ شيء — الأسماء فارغة أو موجودة مسبقاً.");
    if (n) { setBulkText(""); load(); }
  }

  const Chip = ({ id }: { id: string }) => {
    const t = byId.get(id);
    if (!t) return null;
    return (
      <Link href={`/training/test/${t.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs hover:border-brand hover:text-brand-dark">
        {t.abbr && <b dir="ltr">{t.abbr}</b>} {t.name_ar}
      </Link>
    );
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Library className="size-6 text-brand" /> مكتبة الفحوصات</h1>
          <p className="mt-1 text-sm text-muted">دليل عملي لكل فحص: طريقة العمل، العينة والتيوب، الأدوات، التفسير، والربط مع الفحوصات الأخرى.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setBulkOpen(true); setBulkMsg(""); }} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">
            <ListPlus className="size-4" /> إنشاء سريع
          </button>
          <Link href="/training/edit" className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
            <FilePlus2 className="size-4" /> إضافة فحص
          </Link>
        </div>
      </div>

      {/* Favourites + recently viewed */}
      {(favs.some((id) => byId.has(id)) || recent.some((id) => byId.has(id))) && (
        <div className="mb-4 grid gap-3 lg:grid-cols-2">
          {favs.some((id) => byId.has(id)) && (
            <div className="rounded-2xl border border-line bg-surface p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-600"><Star className="size-3.5 fill-current" /> المفضّلة</div>
              <div className="flex flex-wrap gap-1.5">{favs.map((id) => <Chip key={id} id={id} />)}</div>
            </div>
          )}
          {recent.some((id) => byId.has(id)) && (
            <div className="rounded-2xl border border-line bg-surface p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted"><Clock className="size-3.5" /> آخر ما فُتح</div>
              <div className="flex flex-wrap gap-1.5">{recent.slice(0, 6).map((id) => <Chip key={id} id={id} />)}</div>
            </div>
          )}
        </div>
      )}

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم العربي أو الإنجليزي أو الاختصار…" className="w-full rounded-xl border border-line bg-surface py-2.5 pl-3 pr-9 text-sm outline-none focus:border-brand" />
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        {["", ...cats].map((c) => (
          <button
            key={c || "all"}
            onClick={() => setCat(c)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${cat === c ? "border-brand bg-brand text-white" : "border-line bg-surface text-muted hover:text-ink"}`}
          >
            {c || `الكل (${tests.length})`}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-line" />
        <button onClick={() => setFilter(filter === "fav" ? "" : "fav")} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${filter === "fav" ? "border-amber-400 bg-amber-50 text-amber-700" : "border-line bg-surface text-muted hover:text-ink"}`}>
          <Star className="size-3.5" /> المفضّلة
        </button>
        <button onClick={() => setFilter(filter === "review" ? "" : "review")} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${filter === "review" ? "border-red-300 bg-red-50 text-red-700" : "border-line bg-surface text-muted hover:text-ink"}`}>
          <CalendarClock className="size-3.5" /> تحتاج مراجعة{needReview > 0 && <b className="tabular-nums"> ({needReview})</b>}
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center text-sm text-muted">
          {tests.length === 0 ? "لا توجد فحوصات بعد — أضف أول فحص." : "لا نتائج مطابقة."}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((t) => {
            const rs = reviewStatus(t);
            const isFav = favs.includes(t.id);
            return (
              <Link
                key={t.id}
                href={`/training/test/${t.id}`}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)] transition-shadow hover:border-brand hover:shadow-[var(--shadow-pop)]"
              >
                <button onClick={(e) => star(e, t.id)} title={isFav ? "إزالة من المفضّلة" : "إضافة إلى المفضّلة"} className={`absolute left-3 top-3 grid size-7 place-items-center rounded-full ${isFav ? "text-amber-500" : "text-line hover:text-amber-400"}`}>
                  <Star className={`size-4 ${isFav ? "fill-current" : ""}`} />
                </button>
                <div className="flex items-center gap-3 p-4">
                  {t.coverImageId ? (
                    <Img id={t.coverImageId} className="size-14 shrink-0 rounded-xl border border-line bg-white" />
                  ) : (
                    <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-dark px-1 text-center text-sm font-extrabold leading-tight text-white" dir="ltr">
                      {(t.abbr || t.name_en || t.name_ar).slice(0, 6)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1 pe-6">
                    <div className="truncate font-bold group-hover:text-brand-dark">{t.name_ar}</div>
                    {t.name_en && <div className="truncate text-xs text-muted" dir="ltr">{t.name_en}</div>}
                    <div className="mt-1 flex flex-wrap gap-1">
                      <span className="rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-medium text-brand-dark">{t.category || "أخرى"}</span>
                      {rs === "overdue" && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">مراجعة متأخرة</span>}
                      {rs === "soon" && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">مراجعة قريبة</span>}
                    </div>
                  </div>
                </div>
                {t.purpose && <p className="line-clamp-2 px-4 text-xs text-muted">{t.purpose}</p>}
                <div className="mt-auto flex items-center gap-4 border-t border-line px-4 py-2.5 text-[11px] text-muted">
                  <span className="inline-flex items-center gap-1"><ListOrdered className="size-3.5" /> {t.steps.length} خطوة</span>
                  <span className="inline-flex items-center gap-1"><Lightbulb className="size-3.5" /> {t.tips.length} ملاحظة</span>
                  <span className="inline-flex items-center gap-1"><Link2 className="size-3.5" /> {t.links.length} ربط</span>
                  <span className="ms-auto tabular-nums" dir="ltr">v{t.version ?? 1}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Bulk create */}
      {bulkOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={() => setBulkOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-pop)]">
            <div className="mb-2 flex items-center gap-2">
              <ListPlus className="size-5 text-brand" />
              <div className="flex-1 text-base font-bold">إنشاء سريع لعدة فحوصات</div>
              <button onClick={() => setBulkOpen(false)} className="grid size-8 place-items-center rounded-lg hover:bg-canvas"><X className="size-4" /></button>
            </div>
            <p className="mb-2 text-xs text-muted">
              فحص في كل سطر. يمكن إضافة الاسم الإنجليزي والاختصار والتصنيف مفصولة بـ <b>|</b> — مثال:
              <span className="mt-1 block rounded-lg bg-canvas px-2 py-1 font-mono text-[11px]" dir="rtl">اليوريا | Urea | UREA | وظائف الكلى</span>
              تُنشأ بطاقات فارغة لتكملها لاحقاً، والأسماء الموجودة تُتجاهل.
            </p>
            <textarea rows={8} value={bulkText} onChange={(e) => setBulkText(e.target.value)} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand" />
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-xs text-brand-dark">{bulkMsg}</span>
              <button onClick={runBulk} disabled={!bulkText.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
                <ListPlus className="size-4" /> إنشاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
