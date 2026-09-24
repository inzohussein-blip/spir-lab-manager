"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRouteId } from "@/lib/local/useRouteId";
import { FileText, Trash2, Check } from "lucide-react";
import { getPages, savePages, type StationPage } from "@/lib/station/store";

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

/** A user-created custom interface (a titled notes page), stored locally. Lets
 *  the lab add its own sidebar pages without touching code. */
export default function CustomPage() {
  const id = useRouteId();
  const router = useRouter();
  const [page, setPage] = useState<StationPage | null | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    const p = getPages().find((x) => x.id === id) ?? null;
    setPage(p);
    if (p) { setTitle(p.title); setContent(p.content); }
  }, [id]);

  function save() {
    const next = getPages().map((p) => (p.id === id ? { ...p, title: title.trim() || "بدون عنوان", content } : p));
    savePages(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }
  function del() {
    if (!window.confirm("حذف هذه الواجهة؟")) return;
    savePages(getPages().filter((p) => p.id !== id));
    router.push("/station");
  }

  if (page === undefined) return null;
  if (!page) {
    return <p className="text-sm text-muted">لم يتم العثور على هذه الواجهة.</p>;
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="size-5 text-brand-dark" />
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-lg border border-transparent bg-transparent px-2 py-1 text-xl font-bold outline-none hover:border-line focus:border-brand" />
        </div>
        <button onClick={del} className="grid size-9 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50" title="حذف الواجهة"><Trash2 className="size-4" /></button>
      </div>
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={16}
          placeholder="اكتب هنا… (ملاحظات، إجراءات، قوائم تشغيلية…)"
          className={`${inp} font-normal leading-relaxed`}
        />
        <div className="mt-3 flex items-center gap-2">
          <button onClick={save} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
            <Check className="size-4" /> حفظ
          </button>
          {saved && <span className="text-xs text-brand-dark">تم الحفظ.</span>}
        </div>
      </div>
    </div>
  );
}
