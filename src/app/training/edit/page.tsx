"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Save, IdCard, TestTubes, ListOrdered, Microscope, Network, Plus, Trash2, ArrowUp, ArrowDown, AlertTriangle,
  Lightbulb, ShieldCheck, X, Check, Wrench, History, type LucideIcon,
} from "lucide-react";
import {
  getTest, getTests, getTubes, getTools, saveTest, blankTest, uid, getSettings, addMonths, today,
  type TrainingTest, type Tube, type Tool,
} from "@/lib/training/store";
import { ImagePicker } from "@/components/training/ImagePicker";

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
const SAMPLE_TYPES = ["مصل (Serum)", "بلازما (Plasma)", "دم كامل (Whole blood)", "إدرار (Urine)", "براز (Stool)", "مسحة (Swab)", "سائل شوكي (CSF)", "سائل جسمي"];

function Section({ id, title, icon: Icon, children }: { id: string; title: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-lg bg-brand-light text-brand-dark"><Icon className="size-4" /></span>
        <h2 className="text-base font-bold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Editor() {
  const params = useSearchParams();
  const router = useRouter();
  const [t, setT] = useState<TrainingTest | null>(null);
  const [isNew, setIsNew] = useState(true);
  const [all, setAll] = useState<TrainingTest[]>([]);
  const [tubes, setTubes] = useState<Tube[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [linkPick, setLinkPick] = useState("");
  const [err, setErr] = useState("");
  const [changeNote, setChangeNote] = useState("");

  useEffect(() => {
    const id = params.get("id");
    const existing = id ? getTest(id) : null;
    setT(existing ?? { ...blankTest(), nextReview: addMonths(getSettings().reviewMonths ?? 12) });
    setIsNew(!existing);
    setAll(getTests()); setTubes(getTubes()); setTools(getTools());
  }, [params]);

  const cats = useMemo(() => Array.from(new Set(all.map((x) => x.category?.trim()).filter(Boolean))) as string[], [all]);
  if (!t) return null;

  const set = <K extends keyof TrainingTest>(k: K, v: TrainingTest[K]) => setT((cur) => (cur ? { ...cur, [k]: v } : cur));
  const toggleIn = (k: "tubeIds" | "toolIds", id: string) =>
    set(k, t[k].includes(id) ? t[k].filter((x) => x !== id) : [...t[k], id]);
  const move = <T,>(arr: T[], i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= arr.length) return arr;
    const n = [...arr]; [n[i], n[j]] = [n[j], n[i]]; return n;
  };

  function save() {
    if (!t!.name_ar.trim()) { setErr("اسم الفحص بالعربي مطلوب."); document.getElementById("card")?.scrollIntoView({ behavior: "smooth" }); return; }
    const clean: TrainingTest = {
      ...t!,
      name_ar: t!.name_ar.trim(),
      steps: t!.steps.filter((s) => s.text.trim() || s.imageId),
      tips: t!.tips.map((x) => x.trim()).filter(Boolean),
      normals: t!.normals.filter((n) => n.label.trim() || n.value.trim()),
      gallery: t!.gallery.filter((g) => g.imageId),
      troubles: (t!.troubles ?? []).filter((r) => r.problem.trim() || r.cause.trim() || r.fix.trim()),
      reviewedBy: t!.reviewedBy?.trim() || undefined,
    };
    saveTest(clean, changeNote);
    router.push(`/training/test/${clean.id}`);
  }

  const others = all.filter((x) => x.id !== t.id && !t.links.some((l) => l.id === x.id));

  return (
    <div className="pb-24">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{isNew ? "إضافة فحص جديد" : `تعديل: ${t.name_ar}`}</h1>
          <p className="mt-1 text-sm text-muted">كل الحقول اختيارية عدا الاسم — اكتب خبرتك بطريقتك.</p>
        </div>
        <nav className="flex flex-wrap gap-1 text-xs">
          {[["card", "البطاقة"], ["sample", "العينة والأدوات"], ["procedure", "طريقة العمل"], ["results", "النتائج"], ["links", "الربط"], ["doc", "الإصدار"]].map(([id, l]) => (
            <a key={id} href={`#${id}`} className="rounded-full border border-line bg-surface px-2.5 py-1 text-muted hover:text-ink">{l}</a>
          ))}
        </nav>
      </div>

      <div className="flex flex-col gap-4">
        {/* ── Card ── */}
        <Section id="card" title="البطاقة التعريفية" icon={IdCard}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-medium lg:col-span-2">اسم الفحص (عربي) *<input value={t.name_ar} onChange={(e) => { set("name_ar", e.target.value); setErr(""); }} className={`mt-1 ${inp}`} /></label>
            <label className="text-sm font-medium">الاسم العلمي (إنجليزي)<input dir="ltr" value={t.name_en ?? ""} onChange={(e) => set("name_en", e.target.value)} className={`mt-1 ${inp}`} /></label>
            <label className="text-sm font-medium">الاختصار<input dir="ltr" value={t.abbr ?? ""} onChange={(e) => set("abbr", e.target.value)} placeholder="ALT" className={`mt-1 ${inp}`} /></label>
            <label className="text-sm font-medium">التصنيف
              <input list="cats" value={t.category ?? ""} onChange={(e) => set("category", e.target.value)} placeholder="وظائف الكبد…" className={`mt-1 ${inp}`} />
              <datalist id="cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
            </label>
            <div className="text-sm font-medium sm:col-span-2 lg:col-span-3">صورة الفحص (اختياري)<div className="mt-1"><ImagePicker value={t.coverImageId} onChange={(v) => set("coverImageId", v)} label={t.name_ar || "صورة فحص"} size="size-16" /></div></div>
            <label className="text-sm font-medium sm:col-span-2">لماذا يطلبه الطبيب؟<textarea rows={3} value={t.purpose ?? ""} onChange={(e) => set("purpose", e.target.value)} className={`mt-1 ${inp}`} /></label>
            <label className="text-sm font-medium sm:col-span-2">ملخّص ومبدأ الفحص<textarea rows={3} value={t.summary ?? ""} onChange={(e) => set("summary", e.target.value)} className={`mt-1 ${inp}`} /></label>
          </div>
          {err && <p className="mt-2 text-sm font-medium text-red-600">{err}</p>}
        </Section>

        {/* ── Sample & tools ── */}
        <Section id="sample" title="العينة والتيوبات والأدوات" icon={TestTubes}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">نوع العينة
              <input list="samples" value={t.sampleType ?? ""} onChange={(e) => set("sampleType", e.target.value)} className={`mt-1 ${inp}`} />
              <datalist id="samples">{SAMPLE_TYPES.map((s) => <option key={s} value={s} />)}</datalist>
            </label>
            <label className="text-sm font-medium">الحجم المطلوب<input value={t.volume ?? ""} onChange={(e) => set("volume", e.target.value)} placeholder="2–3 مل" className={`mt-1 ${inp}`} /></label>
            <label className="text-sm font-medium">تحضير المريض<textarea rows={2} value={t.patientPrep ?? ""} onChange={(e) => set("patientPrep", e.target.value)} placeholder="صيام، توقيت…" className={`mt-1 ${inp}`} /></label>
            <label className="text-sm font-medium">الثبات والحفظ والنقل<textarea rows={2} value={t.storage ?? ""} onChange={(e) => set("storage", e.target.value)} className={`mt-1 ${inp}`} /></label>
          </div>

          <div className="mt-4 text-sm font-medium">التيوبات / الحاويات <Link href="/training/tubes" className="text-xs font-normal text-brand-dark hover:underline">(إدارة القائمة)</Link></div>
          <div className="mt-2 flex flex-wrap gap-2">
            {tubes.map((tb) => {
              const on = t.tubeIds.includes(tb.id);
              return (
                <button key={tb.id} type="button" onClick={() => toggleIn("tubeIds", tb.id)} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${on ? "border-brand bg-brand-light font-semibold text-brand-dark" : "border-line hover:bg-canvas"}`}>
                  <span className="size-3 rounded-full border border-black/10" style={{ background: tb.color }} /> {tb.name} {on && <Check className="size-3.5" />}
                </button>
              );
            })}
          </div>

          <div className="mt-4 text-sm font-medium">الأدوات والأجهزة والكواشف <Link href="/training/tools" className="text-xs font-normal text-brand-dark hover:underline">(إدارة القائمة)</Link></div>
          <div className="mt-2 flex flex-wrap gap-2">
            {tools.map((tl) => {
              const on = t.toolIds.includes(tl.id);
              return (
                <button key={tl.id} type="button" onClick={() => toggleIn("toolIds", tl.id)} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${on ? "border-brand bg-brand-light font-semibold text-brand-dark" : "border-line hover:bg-canvas"}`}>
                  {tl.name} {on && <Check className="size-3.5" />}
                </button>
              );
            })}
          </div>
        </Section>

        {/* ── Procedure builder ── */}
        <Section id="procedure" title="طريقة العمل — منشئ البروسيجر" icon={ListOrdered}>
          <div className="flex flex-col gap-3">
            {t.steps.map((s, i) => (
              <div key={s.id} className={`flex gap-3 rounded-xl border p-3 ${s.warn ? "border-red-200 bg-red-50/50" : "border-line"}`}>
                <div className="flex flex-col items-center gap-1">
                  <span className={`grid size-7 place-items-center rounded-full text-xs font-bold text-white ${s.warn ? "bg-red-600" : "bg-brand"}`}>{i + 1}</span>
                  <button type="button" title="أعلى" onClick={() => set("steps", move(t.steps, i, -1))} className="grid size-6 place-items-center rounded text-muted hover:bg-canvas"><ArrowUp className="size-3.5" /></button>
                  <button type="button" title="أسفل" onClick={() => set("steps", move(t.steps, i, 1))} className="grid size-6 place-items-center rounded text-muted hover:bg-canvas"><ArrowDown className="size-3.5" /></button>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <textarea rows={2} value={s.text} onChange={(e) => set("steps", t.steps.map((x) => (x.id === s.id ? { ...x, text: e.target.value } : x)))} placeholder={`الخطوة ${i + 1}…`} className={inp} />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <ImagePicker value={s.imageId} onChange={(v) => set("steps", t.steps.map((x) => (x.id === s.id ? { ...x, imageId: v } : x)))} label={`${t.name_ar} — خطوة ${i + 1}`} size="size-14" />
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center gap-1 text-xs text-red-700">
                        <input type="checkbox" checked={!!s.warn} onChange={(e) => set("steps", t.steps.map((x) => (x.id === s.id ? { ...x, warn: e.target.checked } : x)))} className="accent-red-600" />
                        <AlertTriangle className="size-3.5" /> خطوة تحذيرية
                      </label>
                      <button type="button" title="حذف الخطوة" onClick={() => set("steps", t.steps.filter((x) => x.id !== s.id))} className="grid size-8 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50"><Trash2 className="size-4" /></button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => set("steps", [...t.steps, { id: uid(), text: "" }])} className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-dashed border-brand px-3 py-2 text-sm font-medium text-brand-dark hover:bg-brand-light">
              <Plus className="size-4" /> إضافة خطوة
            </button>
          </div>

          <div className="mt-6 flex items-center gap-2 text-sm font-bold"><Lightbulb className="size-4 text-amber-500" /> ملاحظات من ذهب (الخبرة العملية)</div>
          <p className="mb-2 text-xs text-muted">أخطاء شائعة، حيل لتسريع العمل، تداخلات دوائية…</p>
          <div className="flex flex-col gap-2">
            {t.tips.map((tip, i) => (
              <div key={i} className="flex gap-2">
                <textarea rows={2} value={tip} onChange={(e) => set("tips", t.tips.map((x, j) => (j === i ? e.target.value : x)))} className={`${inp} border-r-4 border-r-amber-400`} />
                <button type="button" onClick={() => set("tips", t.tips.filter((_, j) => j !== i))} className="grid size-9 shrink-0 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50"><Trash2 className="size-4" /></button>
              </div>
            ))}
            <button type="button" onClick={() => set("tips", [...t.tips, ""])} className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-dashed border-amber-400 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50">
              <Plus className="size-4" /> إضافة ملاحظة
            </button>
          </div>

          <div className="mt-6 flex items-center gap-2 text-sm font-bold"><Wrench className="size-4 text-red-500" /> حل المشاكل</div>
          <p className="mb-2 text-xs text-muted">المشكلة ← السبب المحتمل ← الحل (مثال: الـ QC خارج الحدود ← كاشف منتهي ← …).</p>
          <div className="flex flex-col gap-2">
            {(t.troubles ?? []).map((r) => {
              const upd = (k: "problem" | "cause" | "fix", v: string) => set("troubles", (t.troubles ?? []).map((x) => (x.id === r.id ? { ...x, [k]: v } : x)));
              return (
                <div key={r.id} className="grid gap-2 rounded-xl border border-line p-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                  <input value={r.problem} onChange={(e) => upd("problem", e.target.value)} placeholder="المشكلة" className={`${inp} border-r-4 border-r-red-400`} />
                  <input value={r.cause} onChange={(e) => upd("cause", e.target.value)} placeholder="السبب المحتمل" className={inp} />
                  <input value={r.fix} onChange={(e) => upd("fix", e.target.value)} placeholder="الحل" className={inp} />
                  <button type="button" onClick={() => set("troubles", (t.troubles ?? []).filter((x) => x.id !== r.id))} className="grid size-9 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50"><Trash2 className="size-4" /></button>
                </div>
              );
            })}
            <button type="button" onClick={() => set("troubles", [...(t.troubles ?? []), { id: uid(), problem: "", cause: "", fix: "" }])} className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-dashed border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
              <Plus className="size-4" /> إضافة مشكلة وحلّها
            </button>
          </div>

          <label className="mt-6 block text-sm font-bold"><span className="inline-flex items-center gap-2"><ShieldCheck className="size-4 text-green-600" /> تعليمات السلامة والجودة لهذا الفحص</span>
            <textarea rows={3} value={t.safety ?? ""} onChange={(e) => set("safety", e.target.value)} placeholder="اتركه فارغاً لاستعمال التعليمات العامة من الإعدادات. كل سطر = بند." className={`mt-1 font-normal ${inp}`} />
          </label>
        </Section>

        {/* ── Results ── */}
        <Section id="results" title="النتائج والتفسير وشكل العينات" icon={Microscope}>
          <div className="text-sm font-medium">القيم الطبيعية (حسب العمر / الجنس)</div>
          <div className="mt-2 flex flex-col gap-2">
            {t.normals.map((n, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <input value={n.label} onChange={(e) => set("normals", t.normals.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="الفئة (ذكور، أطفال…)" className={inp} />
                <input dir="ltr" value={n.value} onChange={(e) => set("normals", t.normals.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} placeholder="13 – 17 g/dL" className={inp} />
                <button type="button" onClick={() => set("normals", t.normals.filter((_, j) => j !== i))} className="grid size-9 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50"><Trash2 className="size-4" /></button>
              </div>
            ))}
            <button type="button" onClick={() => set("normals", [...t.normals, { label: "", value: "" }])} className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-1.5 text-xs hover:bg-canvas"><Plus className="size-3.5" /> إضافة قيمة</button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium"><span className="text-red-600">▲</span> أسباب الارتفاع<textarea rows={3} value={t.high ?? ""} onChange={(e) => set("high", e.target.value)} className={`mt-1 ${inp}`} /></label>
            <label className="text-sm font-medium"><span className="text-blue-600">▼</span> أسباب الانخفاض<textarea rows={3} value={t.low ?? ""} onChange={(e) => set("low", e.target.value)} className={`mt-1 ${inp}`} /></label>
            <label className="text-sm font-medium sm:col-span-2">شكل العينة والنتيجة والتداخلات<textarea rows={3} value={t.resultNotes ?? ""} onChange={(e) => set("resultNotes", e.target.value)} placeholder="متحلل، دهني، شكل الراسب والبلورات…" className={`mt-1 ${inp}`} /></label>
          </div>

          <div className="mt-4 text-sm font-medium">معرض الصور (أشكال العينات حسب النتائج)</div>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {t.gallery.map((g) => (
              <div key={g.id} className="flex items-start gap-2 rounded-xl border border-line p-2">
                <ImagePicker value={g.imageId} onChange={(v) => set("gallery", v ? t.gallery.map((x) => (x.id === g.id ? { ...x, imageId: v } : x)) : t.gallery.filter((x) => x.id !== g.id))} label={g.caption || t.name_ar} size="size-16" />
                <input value={g.caption} onChange={(e) => set("gallery", t.gallery.map((x) => (x.id === g.id ? { ...x, caption: e.target.value } : x)))} placeholder="وصف الصورة (عينة متحللة…)" className={inp} />
              </div>
            ))}
            <GalleryAdd onAdd={(imageId) => set("gallery", [...t.gallery, { id: uid(), imageId, caption: "" }])} name={t.name_ar} />
          </div>
        </Section>

        {/* ── Links ── */}
        <Section id="links" title="شبكة الربط مع الفحوصات الأخرى" icon={Network}>
          <div className="flex flex-col gap-2">
            {t.links.map((l) => {
              const other = all.find((x) => x.id === l.id);
              return (
                <div key={l.id} className="grid gap-2 rounded-xl border border-line p-2.5 sm:grid-cols-[200px_1fr_auto] sm:items-center">
                  <span className="text-sm font-semibold">{other?.name_ar ?? "فحص محذوف"}</span>
                  <input value={l.note ?? ""} onChange={(e) => set("links", t.links.map((x) => (x.id === l.id ? { ...x, note: e.target.value } : x)))} placeholder="سبب الربط (مثال: يُفسَّران معاً…)" className={inp} />
                  <button type="button" onClick={() => set("links", t.links.filter((x) => x.id !== l.id))} className="grid size-9 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50"><X className="size-4" /></button>
                </div>
              );
            })}
            <div className="flex flex-wrap gap-2">
              <select value={linkPick} onChange={(e) => setLinkPick(e.target.value)} className={`${inp} max-w-xs`}>
                <option value="">اختر فحصاً للربط…</option>
                {others.map((o) => <option key={o.id} value={o.id}>{o.name_ar}{o.abbr ? ` (${o.abbr})` : ""}</option>)}
              </select>
              <button type="button" disabled={!linkPick} onClick={() => { set("links", [...t.links, { id: linkPick }]); setLinkPick(""); }} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
                <Plus className="size-4" /> ربط
              </button>
            </div>
            <p className="text-xs text-muted">يظهر الربط في صفحة الفحصين: هنا تحت «يرتبط بـ»، وفي الفحص الآخر تحت «فحوصات تشير إليه».</p>
          </div>
        </Section>

        {/* ── Document control ── */}
        <Section id="doc" title="ضبط الوثيقة (الإصدار والمراجعة)" icon={History}>
          <div className="mb-3 text-xs text-muted">
            الإصدار الحالي: <b dir="ltr">v{t.version ?? 1}</b> — يرتفع تلقائياً عند حفظ أي تعديل على المحتوى.
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-medium">راجعه واعتمده<input value={t.reviewedBy ?? ""} onChange={(e) => set("reviewedBy", e.target.value)} className={`mt-1 ${inp}`} /></label>
            <label className="text-sm font-medium">تاريخ المراجعة
              <div className="mt-1 flex gap-1"><input type="date" value={t.reviewedAt ?? ""} onChange={(e) => set("reviewedAt", e.target.value || undefined)} className={inp} />
                <button type="button" onClick={() => set("reviewedAt", today())} className="shrink-0 rounded-lg border border-line px-2 text-xs hover:bg-canvas">اليوم</button></div>
            </label>
            <label className="text-sm font-medium">المراجعة القادمة<input type="date" value={t.nextReview ?? ""} onChange={(e) => set("nextReview", e.target.value || undefined)} className={`mt-1 ${inp}`} /></label>
            <label className="text-sm font-medium">ملاحظة التغيير (اختياري)<input value={changeNote} onChange={(e) => setChangeNote(e.target.value)} placeholder="ما الذي تغيّر؟" className={`mt-1 ${inp}`} /></label>
          </div>
        </Section>
      </div>

      {/* Sticky save bar */}
      <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur md:start-72">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-2">
          <Link href={isNew ? "/training" : `/training/test/${t.id}`} className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-canvas">إلغاء</Link>
          <button onClick={save} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
            <Save className="size-4" /> حفظ الفحص
          </button>
        </div>
      </div>
    </div>
  );
}

function GalleryAdd({ onAdd, name }: { onAdd: (id: string) => void; name: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-line p-2 text-xs text-muted">
      <ImagePicker value={undefined} onChange={(v) => v && onAdd(v)} label={name || "صورة نتيجة"} size="size-16" />
      <span>أضف صورة جديدة للمعرض</span>
    </div>
  );
}

export default function TrainingEditPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted">جارٍ التحميل…</div>}>
      <Editor />
    </Suspense>
  );
}
