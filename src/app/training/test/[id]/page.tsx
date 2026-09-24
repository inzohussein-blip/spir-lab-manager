"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRouteId } from "@/lib/local/useRouteId";
import {
  IdCard, TestTubes, ListOrdered, Microscope, Network, Pencil, Printer, Trash2, Lightbulb, AlertTriangle,
  ArrowRight, ArrowLeftRight, X, ShieldCheck, Star, Wrench, History, CalendarClock, Share2, Presentation as PresentIcon, type LucideIcon,
} from "lucide-react";
import {
  getTest, getTests, getTubes, getTools, getSettings, backlinks, deleteTest, getFavs, toggleFav, pushRecent, reviewStatus, exportTestPackage,
  type TrainingTest, type Tube, type Tool, type TrainingSettings,
} from "@/lib/training/store";
import { Img } from "@/components/training/Img";
import { RichText } from "@/components/training/RichText";
import { useEditLock } from "@/lib/training/lock";
import { SopSheet, SopPrintStyle, SopFooter, sopCode } from "@/components/training/SopSheet";
import { Presentation } from "@/components/training/Presentation";

type Tab = "card" | "sample" | "procedure" | "results" | "links";
const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "card", label: "البطاقة التعريفية", icon: IdCard },
  { id: "sample", label: "العينة والأدوات", icon: TestTubes },
  { id: "procedure", label: "طريقة العمل", icon: ListOrdered },
  { id: "results", label: "النتائج والتفسير", icon: Microscope },
  { id: "links", label: "شبكة الربط", icon: Network },
];

export default function TrainingTestPage() {
  const id = useRouteId();
  const router = useRouter();
  const [test, setTest] = useState<TrainingTest | null | undefined>(undefined);
  const [all, setAll] = useState<TrainingTest[]>([]);
  const [tubes, setTubes] = useState<Tube[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [settings, setSettings] = useState<TrainingSettings | null>(null);
  const [back, setBack] = useState<{ test: TrainingTest; note?: string }[]>([]);
  const [tab, setTab] = useState<Tab>("card");
  const [zoom, setZoom] = useState<string | null>(null);
  const [withImages, setWithImages] = useState(true);
  const [fav, setFav] = useState(false);
  const [present, setPresent] = useState(false);
  const { canEdit } = useEditLock();

  useEffect(() => {
    if (!id) return;
    setTest(getTest(id));
    setAll(getTests()); setTubes(getTubes()); setTools(getTools()); setSettings(getSettings());
    setBack(backlinks(id));
    setTab("card");
    setFav(getFavs().includes(id));
    if (getTest(id)) pushRecent(id);
  }, [id]);

  if (test === undefined) return null;
  if (!test) return <p className="text-sm text-muted">لم يتم العثور على هذا الفحص.</p>;

  const myTubes = test.tubeIds.map((x) => tubes.find((t) => t.id === x)).filter(Boolean) as Tube[];
  const myTools = test.toolIds.map((x) => tools.find((t) => t.id === x)).filter(Boolean) as Tool[];
  const rs = reviewStatus(test);
  const troubles = (test.troubles ?? []).filter((r) => r.problem.trim());
  const outLinks = test.links.map((l) => ({ ...l, t: all.find((x) => x.id === l.id) })).filter((l) => l.t);

  async function share() {
    const pkg = await exportTestPackage(test!.id);
    if (!pkg) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(pkg)], { type: "application/json" }));
    a.download = `training-test-${((test!.abbr || test!.name_en || "test").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "test")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000); // let the download start first
  }

  function remove() {
    if (!window.confirm(`حذف «${test!.name_ar}» نهائياً؟ ستُزال روابطه من الفحوصات الأخرى أيضاً.`)) return;
    deleteTest(test!.id);
    router.push("/training");
  }

  const Card = ({ title, icon: Icon, children }: { title: string; icon?: LucideIcon; children: React.ReactNode }) => (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold">{Icon && <Icon className="size-4 text-brand" />}{title}</div>
      {children}
    </div>
  );
  const Row = ({ k, v }: { k: string; v?: string }) =>
    v ? <div className="grid grid-cols-[120px_1fr] gap-2 border-b border-line py-2 text-sm last:border-0"><span className="text-muted">{k}</span><RichText text={v} /></div> : null;

  return (
    <div>
      <div className="no-print">
        <Link href="/training" className="mb-3 inline-flex items-center gap-1 text-xs text-muted hover:text-ink"><ArrowRight className="size-3.5" /> مكتبة الفحوصات</Link>

        {/* Header */}
        <div className="mb-4 flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
          {test.coverImageId ? (
            <Img id={test.coverImageId} className="size-20 cursor-zoom-in rounded-xl border border-line bg-white" onClick={() => setZoom(test.coverImageId!)} />
          ) : (
            <span className="grid size-20 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-lg font-extrabold text-white" dir="ltr">{(test.abbr || test.name_ar).slice(0, 6)}</span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">{test.name_ar}</h1>
            {(test.name_en || test.abbr) && <div className="text-sm text-muted" dir="ltr" style={{ textAlign: "right" }}>{test.name_en}{test.abbr ? ` (${test.abbr})` : ""}</div>}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-medium text-brand-dark">{test.category || "أخرى"}</span>
              <span className="rounded-full bg-canvas px-2.5 py-0.5 text-xs text-muted" dir="ltr">{sopCode(test)} · v{test.version ?? 1}</span>
              {rs === "overdue" && <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700"><CalendarClock className="size-3.5" /> المراجعة متأخرة</span>}
              {rs === "soon" && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700"><CalendarClock className="size-3.5" /> المراجعة قريباً</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFav(toggleFav(test.id))}
              title={fav ? "إزالة من المفضّلة" : "إضافة إلى المفضّلة"}
              aria-pressed={fav}
              className={`grid size-9 place-items-center rounded-lg border ${fav ? "border-amber-300 bg-amber-50 text-amber-500" : "border-line text-muted hover:bg-canvas"}`}
            >
              <Star className={`size-4 ${fav ? "fill-current" : ""}`} />
            </button>
            <label className="inline-flex items-center gap-1.5 text-xs text-muted">
              <input type="checkbox" checked={withImages} onChange={(e) => setWithImages(e.target.checked)} className="accent-[var(--color-brand)]" /> الصور في الطباعة
            </label>
            <button
              onClick={() => { document.documentElement.requestFullscreen?.().catch(() => {}); setPresent(true); }}
              title="عرض البطاقة كشرائح على الشاشة للتدريس الجماعي"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas"
            >
              <PresentIcon className="size-4" /> وضع العرض
            </button>
            <button onClick={share} title="تصدير هذا الفحص مع صوره في ملف لمشاركته" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">
              <Share2 className="size-4" /> مشاركة
            </button>
            <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
              <Printer className="size-4" /> طباعة البروسيجر
            </button>
            {canEdit && (
              <>
                <Link href={`/training/edit?id=${test.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">
                  <Pencil className="size-4" /> تعديل
                </Link>
                <button onClick={remove} title="حذف الفحص" className="grid size-9 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50"><Trash2 className="size-4" /></button>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm ${tab === t.id ? "bg-brand text-white font-semibold" : "text-muted hover:bg-canvas hover:text-ink"}`}>
                <Icon className="size-4" /> {t.label}
              </button>
            );
          })}
        </div>

        {tab === "card" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="لماذا يُطلب هذا الفحص؟" icon={IdCard}>{test.purpose ? <RichText text={test.purpose} className="text-sm" /> : <p className="text-sm">—</p>}</Card>
            <Card title="ملخّص ومبدأ الفحص" icon={Microscope}>{test.summary ? <RichText text={test.summary} className="text-sm" /> : <p className="text-sm">—</p>}</Card>
            <div className="lg:col-span-2">
              <Card title="ضبط الوثيقة" icon={History}>
                <div className="grid gap-2 text-sm sm:grid-cols-4">
                  <div className="rounded-lg bg-canvas px-3 py-2"><div className="text-[11px] text-muted">الإصدار</div><b dir="ltr">v{test.version ?? 1}</b></div>
                  <div className="rounded-lg bg-canvas px-3 py-2"><div className="text-[11px] text-muted">آخر تعديل</div><b dir="ltr">{new Date(test.updated_at).toLocaleDateString("en-CA")}</b></div>
                  <div className="rounded-lg bg-canvas px-3 py-2"><div className="text-[11px] text-muted">راجعه</div><b>{test.reviewedBy || "—"}</b>{test.reviewedAt && <span className="block text-[11px] text-muted" dir="ltr">{test.reviewedAt}</span>}</div>
                  <div className={`rounded-lg px-3 py-2 ${rs === "overdue" ? "bg-red-50 text-red-700" : rs === "soon" ? "bg-amber-50 text-amber-700" : "bg-canvas"}`}><div className="text-[11px] opacity-70">المراجعة القادمة</div><b dir="ltr">{test.nextReview || "—"}</b></div>
                </div>
                {(test.history?.length ?? 0) > 0 && (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer text-xs font-semibold text-brand-dark">سجل الإصدارات ({test.history!.length})</summary>
                    <ul className="mt-2 flex flex-col gap-1">
                      {[...test.history!].reverse().map((h) => (
                        <li key={h.version} className="flex gap-2 text-xs"><b dir="ltr" className="w-8">v{h.version}</b><span className="text-muted" dir="ltr">{new Date(h.at).toLocaleDateString("en-CA")}</span><span>{h.note ?? ""}</span></li>
                      ))}
                    </ul>
                  </details>
                )}
              </Card>
            </div>
            {test.tips.length > 0 && (
              <div className="lg:col-span-2">
                <Card title="ملاحظات من ذهب (الخبرة العملية)" icon={Lightbulb}>
                  <ul className="flex flex-col gap-2">
                    {test.tips.map((t, i) => <li key={i} className="rounded-lg border-r-4 border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-950"><RichText text={t} /></li>)}
                  </ul>
                </Card>
              </div>
            )}
          </div>
        )}

        {tab === "sample" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="العينة وتحضير المريض" icon={TestTubes}>
              <Row k="نوع العينة" v={test.sampleType} /><Row k="الحجم" v={test.volume} /><Row k="تحضير المريض" v={test.patientPrep} /><Row k="الثبات والحفظ" v={test.storage} />
              {!test.sampleType && !test.volume && !test.patientPrep && !test.storage && <p className="text-sm text-muted">—</p>}
            </Card>
            <Card title="التيوبات / الحاويات" icon={TestTubes}>
              {myTubes.length === 0 ? <p className="text-sm text-muted">—</p> : (
                <div className="flex flex-col gap-2">
                  {myTubes.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 rounded-xl border border-line p-2.5">
                      {t.imageId ? <Img id={t.imageId} className="size-12 cursor-zoom-in rounded-lg bg-white" onClick={() => setZoom(t.imageId!)} /> : <span className="h-12 w-4 rounded-full border border-black/10" style={{ background: t.color }} />}
                      <div className="min-w-0 flex-1 text-sm">
                        <div className="flex items-center gap-1.5 font-semibold"><span className="size-3 rounded-full border border-black/10" style={{ background: t.color }} />{t.name}</div>
                        {t.additive && <div className="text-xs text-muted">{t.additive}</div>}
                        {t.notes && <div className="mt-0.5 text-xs">{t.notes}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <div className="lg:col-span-2">
              <Card title="الأدوات والأجهزة والكواشف" icon={Microscope}>
                {myTools.length === 0 ? <p className="text-sm text-muted">—</p> : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {myTools.map((t) => (
                      <div key={t.id} className="flex items-start gap-3 rounded-xl border border-line p-2.5">
                        {t.imageId && <Img id={t.imageId} className="size-12 shrink-0 cursor-zoom-in rounded-lg bg-white" onClick={() => setZoom(t.imageId!)} />}
                        <div className="min-w-0 text-sm">
                          <div className="font-semibold">{t.name} <span className="rounded-full bg-canvas px-1.5 text-[10px] font-normal text-muted">{t.kind}</span></div>
                          {t.description && <div className="text-xs text-muted">{t.description}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {tab === "procedure" && (
          <div className="grid gap-4">
            <Card title="خطوات العمل (Procedure)" icon={ListOrdered}>
              {test.steps.length === 0 ? <p className="text-sm text-muted">لم تُضف خطوات بعد.</p> : (
                <ol className="flex flex-col gap-2.5">
                  {test.steps.map((s, i) => (
                    <li key={s.id} className={`flex gap-3 rounded-xl border p-3 ${s.warn ? "border-red-200 bg-red-50/60" : "border-line"}`}>
                      <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${s.warn ? "bg-red-600" : "bg-brand"}`}>{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        {s.warn && <div className="mb-0.5 inline-flex items-center gap-1 text-xs font-bold text-red-700"><AlertTriangle className="size-3.5" /> تنبيه</div>}
                        <RichText text={s.text} className="text-sm" />
                        {s.imageId && <Img id={s.imageId} className="mt-2 h-40 cursor-zoom-in rounded-lg border border-line bg-white" onClick={() => setZoom(s.imageId!)} />}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
            {troubles.length > 0 && (
              <Card title="حل المشاكل" icon={Wrench}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead className="text-right text-xs text-muted"><tr className="border-b border-line"><th className="py-2 font-medium">المشكلة</th><th className="py-2 font-medium">السبب المحتمل</th><th className="py-2 font-medium">الحل</th></tr></thead>
                    <tbody>
                      {troubles.map((r) => (
                        <tr key={r.id} className="border-b border-line align-top last:border-0">
                          <td className="py-2 pe-3 font-semibold text-red-700"><RichText text={r.problem} /></td>
                          <td className="py-2 pe-3"><RichText text={r.cause} /></td>
                          <td className="py-2 text-brand-dark"><RichText text={r.fix} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
            <Card title="تعليمات السلامة والجودة" icon={ShieldCheck}>
              <ul className="list-inside list-disc text-sm">
                {(test.safety?.trim() || settings?.defaultSafety || "").split("\n").filter((x) => x.trim()).map((x, i) => <li key={i}>{x}</li>)}
              </ul>
              {!test.safety?.trim() && <p className="mt-2 text-[11px] text-muted">(التعليمات العامة من الإعدادات)</p>}
            </Card>
          </div>
        )}

        {tab === "results" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="القيم الطبيعية" icon={Microscope}>
              {test.normals.length === 0 ? <p className="text-sm text-muted">—</p> : test.normals.map((n, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto] gap-2 border-b border-line py-2 text-sm last:border-0"><span className="text-muted">{n.label}</span><b dir="ltr">{n.value}</b></div>
              ))}
            </Card>
            <Card title="التفسير" icon={IdCard}>
              {test.high && <div className="mb-2 text-sm"><b className="text-red-600">▲ الارتفاع:</b> <RichText text={test.high} /></div>}
              {test.low && <div className="text-sm"><b className="text-blue-600">▼ الانخفاض:</b> <RichText text={test.low} /></div>}
              {!test.high && !test.low && <p className="text-sm text-muted">—</p>}
            </Card>
            {test.resultNotes && (
              <div className="lg:col-span-2"><Card title="شكل العينة والنتيجة" icon={Microscope}><RichText text={test.resultNotes} className="text-sm" /></Card></div>
            )}
            <div className="lg:col-span-2">
              <Card title="معرض الصور (أشكال العينات والنتائج)" icon={Microscope}>
                {test.gallery.length === 0 ? <p className="text-sm text-muted">لا صور — أضفها من «تعديل».</p> : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {test.gallery.map((g) => (
                      <figure key={g.id} className="overflow-hidden rounded-xl border border-line">
                        <Img id={g.imageId} className="aspect-square w-full cursor-zoom-in bg-white" onClick={() => setZoom(g.imageId)} />
                        <figcaption className="px-2 py-1.5 text-xs">{g.caption || "—"}</figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {tab === "links" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="يرتبط بـ" icon={Network}>
              {outLinks.length === 0 ? <p className="text-sm text-muted">لا روابط — أضفها من «تعديل».</p> : (
                <div className="flex flex-col gap-2">
                  {outLinks.map((l) => (
                    <Link key={l.id} href={`/training/test/${l.id}`} className="rounded-xl border border-line p-3 hover:border-brand">
                      <div className="flex items-center gap-2 text-sm font-semibold text-brand-dark"><ArrowLeftRight className="size-4" /> {l.t!.name_ar} {l.t!.abbr && <span className="text-xs font-normal text-muted" dir="ltr">({l.t!.abbr})</span>}</div>
                      {l.note && <div className="mt-1 text-xs text-muted">{l.note}</div>}
                    </Link>
                  ))}
                </div>
              )}
            </Card>
            <Card title="فحوصات تشير إلى هذا الفحص" icon={Network}>
              {back.length === 0 ? <p className="text-sm text-muted">—</p> : (
                <div className="flex flex-col gap-2">
                  {back.map((b) => (
                    <Link key={b.test.id} href={`/training/test/${b.test.id}`} className="rounded-xl border border-line p-3 hover:border-brand">
                      <div className="text-sm font-semibold">{b.test.name_ar}</div>
                      {b.note && <div className="mt-1 text-xs text-muted">{b.note}</div>}
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      {present && <Presentation test={test} all={all} tubes={tubes} tools={tools} onClose={() => setPresent(false)} />}

      {/* Lightbox */}
      {zoom && (
        <div className="no-print fixed inset-0 z-50 grid place-items-center bg-black/80 p-6" onClick={() => setZoom(null)}>
          <button className="absolute left-4 top-4 grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="إغلاق"><X className="size-5" /></button>
          <Img id={zoom} className="max-h-[85vh] max-w-[90vw] rounded-lg" />
        </div>
      )}

      {settings && (
        <div className="sop-doc hidden bg-white text-black print:block">
          <SopPrintStyle />
          <SopSheet test={test} tubes={tubes} tools={tools} settings={settings} withImages={withImages} />
          <SopFooter text={settings.footer} />
        </div>
      )}
    </div>
  );
}
