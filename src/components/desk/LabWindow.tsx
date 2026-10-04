"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus, ScanLine, Save, ShieldCheck, Printer, Tags, MessageCircle, Send, X, ClipboardList, AlertOctagon, Settings2, RotateCcw, Play, Loader2, BellRing,
} from "lucide-react";
import {
  labLoadOrder, labNewSample, labAddTests, labRemoveTest, labSaveResults, labStart, labVerify, labReopen, deskDeliver, ackCritical, labFind, notifyReady,
} from "@/app/actions/desk";
import { flagFor, rangeLabel, resultDelta, localYmd, type StationSettings, type StationTest } from "@/lib/station/store";
import { computeDerived } from "@/lib/station/derived";
import { isFormCode, decodeForm, encodeForm, formProgress, formOptionsOf, hlCount, type FormCode } from "@/lib/station/templates";
import { FormDialog, fillNormals } from "@/components/station/ReportForms";
import { ReportSheet } from "@/components/station/ReportSheet";
import { TubeLabels } from "@/components/station/TubeLabel";
import { loadBarcode } from "@/components/station/Barcode";
import { sheetPdf, savePdf, openWhatsApp } from "@/lib/station/sharePdf";
import { STATUS_LABEL, SOURCE_LABEL, type DeskPatient, type DeskTest, type LabOrderData, type LabPrint, type LabRules, type QueueRow } from "@/lib/desk/types";
import { PatientBox, TestPicker, EMPTY_PATIENT, field, Elapsed } from "./DeskParts";
import { LabSettingsDialog } from "./LabSettings";

const TABS = [
  { id: "waiting", label: "بانتظار المختبر", match: (r: QueueRow) => r.status === "pending" },
  { id: "work", label: "قيد العمل", match: (r: QueueRow) => r.status === "in_progress" },
  { id: "done", label: "معتمدة اليوم", match: (r: QueueRow) => r.status === "completed" || r.status === "delivered" },
] as const;
const QUAL = ["Positive", "Negative", "+", "++", "+++"];

const toStation = (t: DeskTest): StationTest => ({
  id: t.id, code: t.code || undefined, name_ar: t.name_ar, name_en: t.name_en ?? undefined, category: t.category ?? undefined,
  sample_type: t.sample_type ?? undefined, unit: t.unit ?? undefined, normal: t.normal,
});

function FlagPill({ f }: { f: "H" | "L" | "N" | null }) {
  if (!f) return null;
  const m = { H: "bg-red-50 text-red-600", L: "bg-blue-50 text-blue-600", N: "bg-teal-50 text-brand-dark" }[f];
  return <span className={`grid size-6 place-items-center rounded-full text-xs font-bold ${m}`} data-testid="lab-flag">{f}</span>;
}

export function LabWindow({ queue, tests, referrers, print, rules, letterhead, isAdmin }: {
  queue: QueueRow[]; tests: DeskTest[]; referrers: { id: string; name: string }[]; print: LabPrint; rules: LabRules;
  letterhead: { name: string; subtitle: string; footer: string; logo: string }; isAdmin: boolean;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const byId = useMemo(() => new Map(tests.map((t) => [t.id, t])), [tests]);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>(() => (queue.some((r) => r.status === "pending") ? "waiting" : "work"));
  const [scan, setScan] = useState("");
  const [order, setOrder] = useState<LabOrderData | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
  const [hl, setHl] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [formFor, setFormFor] = useState<string | null>(null);
  const [adding, setAdding] = useState<string[] | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [setOpen, setSetOpen] = useState(false);
  const [labelJob, setLabelJob] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [told, setTold] = useState<Record<string, string>>({});

  const settings: StationSettings = useMemo(() => ({
    labName: letterhead.name, labSubtitle: letterhead.subtitle, footer: letterhead.footer || undefined, logo: letterhead.logo || "/lab-logo.png",
    ...print,
  }), [letterhead, print]);
  const paper = print.paper === "A5" ? "A5" : "A4";
  const opts = formOptionsOf(settings);

  function show(o: LabOrderData | null) {
    setOrder(o);
    setDirty(false);
    if (!o) return;
    setResults(Object.fromEntries(o.items.map((it) => [it.testId, it.value])));
    setHl(new Set(o.items.filter((it) => it.hl).map((it) => it.testId)));
  }
  function open(id: string) {
    if (dirty && !confirm("في النتائج تغييرات لم تُحفظ. تجاهلها؟")) return;
    start(async () => {
      const o = await labLoadOrder(id);
      if (!o) { toast.error("تعذّر فتح العيّنة."); return; }
      show(o);
      // On a phone the sample is under the list.
      if (window.innerWidth < 1024) requestAnimationFrame(() => document.querySelector("[data-testid=lab-order]")?.scrollIntoView({ block: "start" }));
    });
  }
  async function reload() {
    if (!order) return;
    show(await labLoadOrder(order.id));
    router.refresh();
  }
  useEffect(() => {
    if (!labelJob) return;
    const done = () => setLabelJob(false);
    window.addEventListener("afterprint", done);
    return () => window.removeEventListener("afterprint", done);
  }, [labelJob]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const chosen = useMemo(() => (order?.items ?? []).map((it) => byId.get(it.testId)).filter((t): t is DeskTest => !!t), [order, byId]);
  const stationTests = useMemo(() => chosen.map(toStation), [chosen]);
  const gender = order?.patient.gender ?? "";
  const age = order?.patient.age ?? "";
  const derived = useMemo(
    () => (print.autoDerived ? computeDerived(stationTests, results, { egfr: print.derivedEgfr === true, sampson: print.derivedSampson === true, age, gender }) : {}),
    [print.autoDerived, print.derivedEgfr, print.derivedSampson, stationTests, results, age, gender]
  );
  const locked = order?.status === "completed" || order?.status === "delivered";
  const missing = chosen.filter((t) => !(results[t.id] ?? "").trim());
  const setValue = (id: string, v: string) => { setResults((r) => ({ ...r, [id]: v })); setDirty(true); };

  function save(then?: () => Promise<void>) {
    if (!order) return;
    start(async () => {
      const rows = order.items.map((it) => {
        const t = byId.get(it.testId);
        const value = results[it.testId] ?? "";
        const flag = t && !isFormCode(t.code) ? flagFor(value, t.normal, gender, age) : null;
        return { itemId: it.itemId, value, flag, hl: hl.has(it.testId) };
      });
      const r = await labSaveResults(order.id, rows);
      if (!r.ok) { toast.error(r.error); return; }
      if (r.critical) toast.warning(`${r.critical} قيمة حرجة — أبلغ الطبيب وسجّل ذلك.`);
      else if (!then) toast.success("حُفظت النتائج");
      setDirty(false);
      if (then) await then(); else await reload();
    });
  }
  function verify() {
    if (!order) return;
    const go = async () => {
      const v = await labVerify(order.id);
      if (!v.ok) toast.error(v.error);
      else toast.success(v.final ? "اعتُمدت النتائج" : "سُجّل الاعتماد الأول — بانتظار اعتماد شخص آخر");
      await reload();
    };
    if (dirty) save(go); else start(go);
  }
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) => start(async () => {
    const r = await fn();
    if (!r.ok) toast.error(r.error ?? "تعذّر"); else if (ok) toast.success(ok);
    await reload();
  });

  async function onShare() {
    if (!order || sharing) return;
    openWhatsApp(order.patient.phone, `نتائج التحاليل — ${order.patient.name} — ${letterhead.name}`);
    setSharing(true);
    try {
      await Promise.race([loadBarcode(), new Promise((r) => setTimeout(r, 3000))]);
      const el = document.getElementById("report-sheet");
      if (el) savePdf(await sheetPdf(el, paper), `${order.accession || "report"}.pdf`);
      toast.success("فُتح واتساب — أرفق ملف PDF المحفوظ في المحادثة");
    } catch {
      toast.error("تعذّر إنشاء ملف PDF — استعمل الطباعة");
    } finally {
      setSharing(false);
    }
  }

  const rows = TABS.map((t) => ({ ...t, list: queue.filter(t.match) }));
  const list = rows.find((r) => r.id === tab)!.list;

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      {/* ── The queue ─────────────────────────────────────────────────────── */}
      <div className="no-print flex flex-col gap-3 lg:sticky lg:top-20 lg:self-start">
        <div className="flex gap-2">
          <button type="button" onClick={() => setNewOpen(true)} data-testid="lab-new"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
            <Plus className="size-4" /> عيّنة جديدة
          </button>
          {isAdmin && (
            <button type="button" onClick={() => setSetOpen(true)} title="إعدادات نافذة المختبر" aria-label="إعدادات نافذة المختبر" data-testid="lab-settings"
              className="rounded-lg border border-line bg-surface px-2.5 hover:bg-canvas"><Settings2 className="size-4" /></button>
          )}
        </div>
        <form className="relative" onSubmit={(e) => {
          e.preventDefault();
          const a = scan.trim();
          if (!a) return;
          setScan("");
          void labFind(a).then((id) => (id ? open(id) : toast.error("لا توجد عيّنة بهذا الرقم.")));
        }}>
          <ScanLine className="pointer-events-none absolute inset-y-0 start-2.5 my-auto size-4 text-muted" />
          <input value={scan} onChange={(e) => setScan(e.target.value)} dir="ltr" aria-label="رقم العيّنة" placeholder="امسح أو اكتب رقم العيّنة" className={`${field} ps-8`} data-testid="lab-scan" />
        </form>
        <div className="flex gap-1 rounded-lg bg-canvas p-1 text-xs">
          {rows.map((r) => (
            <button key={r.id} type="button" onClick={() => setTab(r.id)} aria-pressed={tab === r.id}
              className={`flex-1 rounded-md px-2 py-1.5 font-semibold ${tab === r.id ? "bg-surface text-brand-dark shadow-sm" : "text-muted"}`}>
              {r.label} <span className="tabular-nums">({r.list.length})</span>
            </button>
          ))}
        </div>
        <div className="flex max-h-[65vh] flex-col gap-1.5 overflow-auto" data-testid="lab-queue">
          {list.length === 0 && <div className="rounded-lg border border-dashed border-line p-5 text-center text-sm text-muted">لا توجد عيّنات هنا.</div>}
          {list.map((r) => (
            <button key={r.id} type="button" onClick={() => open(r.id)} data-testid="lab-queue-row"
              className={`rounded-xl border px-3 py-2 text-start text-sm ${order?.id === r.id ? "border-brand bg-brand-light/50" : "border-line bg-surface hover:bg-canvas"}`}>
              <div className="flex items-center justify-between gap-2">
                <b className="truncate">{r.name}</b>
                {r.critical > 0 && <span className="rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white" title="قيمة حرجة لم يُبلَّغ عنها">حرجة</span>}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center justify-between gap-x-2 text-[11px]">
                <span className="font-mono text-muted" dir="ltr">{r.accession}</span>
                <span className="text-muted">{SOURCE_LABEL[r.source] ?? ""} · <span className="tabular-nums">{r.done}/{r.tests}</span></span>
              </div>
              <div className="mt-0.5 flex items-center justify-between text-[11px]">
                {r.awaiting2 ? <span className="font-semibold text-violet-700">بانتظار الاعتماد الثاني</span> : <span className="text-muted">{STATUS_LABEL[r.status]}</span>}
                {(r.status === "pending" || r.status === "in_progress") && <Elapsed from={r.created_at} limit={r.tat} />}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── The sample ────────────────────────────────────────────────────── */}
      <div className="min-w-0">
        {!order ? (
          <div className="no-print grid min-h-80 place-items-center rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">
            {busy ? <Loader2 className="size-6 animate-spin" /> : "اختر عيّنة من القائمة، أو امسح رقمها، أو أضف عيّنة جديدة."}
          </div>
        ) : (
          <>
            <div className="no-print rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]" data-testid="lab-order">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-bold" data-testid="lab-patient">{order.patient.name}</div>
                  <div className="text-xs text-muted">
                    {[order.patient.gender === "male" ? "ذكر" : order.patient.gender === "female" ? "أنثى" : "", order.patient.age && `${order.patient.age} سنة`, order.referrer && `د. ${order.referrer.replace(/^د\.\s*/, "")}`].filter(Boolean).join(" · ")}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono" dir="ltr">{order.accession}</span>
                    <span className="rounded-full bg-canvas px-2 py-0.5">{SOURCE_LABEL[order.source] ?? ""}</span>
                    <span className="rounded-full bg-brand-light px-2 py-0.5 font-semibold text-brand-dark" data-testid="lab-status">{order.awaiting2 ? "بانتظار الاعتماد الثاني" : STATUS_LABEL[order.status]}</span>
                    {!locked && <Elapsed from={order.created_at} limit={rules.tat} />}
                  </div>
                  {(order.verifiedBy || order.verified2By) && (
                    <div className="mt-1 text-[11px] text-muted">
                      اعتمد: {order.verifiedBy}{order.verified2By && ` · الاعتماد الثاني: ${order.verified2By}`}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {order.status === "pending" && (
                    <button type="button" disabled={busy} onClick={() => act(() => labStart(order.id))} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-sm hover:bg-canvas" data-testid="lab-start">
                      <Play className="size-4" /> استلام وبدء العمل
                    </button>
                  )}
                  {!locked && (
                    <button type="button" disabled={busy} onClick={() => setAdding([])} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-sm hover:bg-canvas" data-testid="lab-add-tests">
                      <Plus className="size-4" /> إضافة فحص
                    </button>
                  )}
                </div>
              </div>

              {order.criticalOpen.length > 0 && (
                <div className="mt-3 rounded-xl border border-red-300 bg-red-50 p-3" data-testid="lab-critical">
                  <div className="mb-2 flex items-center gap-1.5 text-sm font-bold text-red-700"><AlertOctagon className="size-4" /> قيم حرجة — أبلغ الطبيب أو المراجع فوراً وسجّل ذلك</div>
                  {order.criticalOpen.map((c) => (
                    <div key={c.id} className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                      <span className="min-w-40 font-semibold">{c.test}: <span dir="ltr">{c.value}</span></span>
                      <input value={told[c.id] ?? ""} onChange={(e) => setTold((x) => ({ ...x, [c.id]: e.target.value }))} placeholder="من أُبلغ؟ (مثلاً: د. أحمد هاتفياً)" aria-label="من أُبلغ"
                        className="min-w-48 flex-1 rounded-lg border border-red-200 bg-white px-2 py-1 text-sm" />
                      <button type="button" disabled={busy} onClick={() => act(() => ackCritical(c.id, told[c.id] ?? ""), "سُجّل الإبلاغ")}
                        className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white">سُجّل الإبلاغ</button>
                    </div>
                  ))}
                </div>
              )}

              {adding && (
                <div className="mt-3 rounded-xl border border-line p-3" data-testid="lab-adding">
                  <TestPicker tests={tests} chosen={adding} onChange={setAdding} prices={false} exclude={order.items.map((i) => i.testId)} />
                  <div className="mt-2 flex justify-end gap-2">
                    <button type="button" onClick={() => setAdding(null)} className="rounded-lg border border-line px-3 py-1.5 text-sm">إلغاء</button>
                    <button type="button" disabled={busy || !adding.length} onClick={() => { const ids = adding; setAdding(null); act(() => labAddTests(order.id, ids)); }}
                      className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50" data-testid="lab-add-confirm">إضافة ({adding.length})</button>
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-col gap-3" data-testid="lab-results">
                {chosen.map((t) => {
                  const it = order.items.find((x) => x.testId === t.id)!;
                  const removable = order.source === "lab" && !locked && !it.value;
                  const remove = removable ? (
                    <button type="button" onClick={() => act(() => labRemoveTest(order.id, it.itemId))} title="إزالة الفحص" aria-label={`إزالة ${t.name_ar}`}
                      className="grid size-6 place-items-center rounded-md text-muted hover:bg-red-50 hover:text-red-600"><X className="size-3.5" /></button>
                  ) : null;
                  if (isFormCode(t.code)) {
                    const code = t.code as FormCode;
                    const vals = decodeForm(results[t.id]);
                    const pr = formProgress(code, vals);
                    return (
                      <div key={t.id} className="rounded-xl border border-line p-2.5" data-testid="lab-form-row">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{t.name_ar}</span>
                          <span className="flex items-center gap-1">
                            {hlCount(vals) > 0 && <span className="rounded-full bg-yellow-200 px-2 py-0.5 text-[11px] font-semibold text-yellow-900">مميّز {hlCount(vals)}</span>}
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${pr.filled === pr.total ? "bg-teal-50 text-brand-dark" : pr.filled ? "bg-amber-50 text-amber-700" : "bg-canvas text-muted"}`}><span dir="ltr">{pr.filled}/{pr.total}</span></span>
                            {remove}
                          </span>
                        </div>
                        {!locked && (
                          <div className="flex flex-wrap gap-1.5">
                            <button type="button" onClick={() => setFormFor(t.id)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
                              <ClipboardList className="size-4" /> {pr.filled ? "تعديل الاستمارة" : "فتح الاستمارة"}
                            </button>
                            <button type="button" onClick={() => setValue(t.id, encodeForm(fillNormals(code, decodeForm(results[t.id]))))} className="rounded-lg border border-line px-2.5 py-2 text-xs hover:bg-canvas">ملء الطبيعي</button>
                          </div>
                        )}
                      </div>
                    );
                  }
                  const v = results[t.id] ?? "";
                  const f = flagFor(v, t.normal, gender, age);
                  const tint = f === "H" ? "!border-red-300 bg-red-50/50 text-red-700" : f === "L" ? "!border-blue-300 bg-blue-50/50 text-blue-700" : f === "N" ? "!border-teal-300" : "";
                  const p = order.prev[t.id];
                  const d = p ? resultDelta(v, p.value) : null;
                  const dv = derived[t.id];
                  const crit = (t.critical_low != null || t.critical_high != null) && /^-?\d+(\.\d+)?$/.test(v.trim()) &&
                    ((t.critical_low != null && Number(v) < t.critical_low) || (t.critical_high != null && Number(v) > t.critical_high));
                  return (
                    <div key={t.id} data-testid="lab-row">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{t.name_ar}</span>
                        <span className="flex items-center gap-1">
                          {crit && <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white" data-testid="lab-critical-pill">حرجة</span>}
                          {print.entryHighlight !== false && (
                            <label className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${hl.has(t.id) ? "bg-yellow-200 text-yellow-900" : "text-muted hover:bg-canvas"}`}>
                              <input type="checkbox" checked={hl.has(t.id)} disabled={locked} aria-label={`تمييز ${t.name_ar}`} className="size-3.5 accent-yellow-500"
                                onChange={() => { setHl((s) => { const n = new Set(s); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n; }); setDirty(true); }} />
                              تمييز
                            </label>
                          )}
                          <FlagPill f={f} />
                          {remove}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input value={v} disabled={locked} onChange={(e) => setValue(t.id, e.target.value)} aria-label={`نتيجة ${t.name_ar}`} placeholder="النتيجة"
                          data-lab-input=""
                          onKeyDown={(e) => {
                            if (e.key !== "Enter") return;
                            e.preventDefault();
                            const all = Array.from(document.querySelectorAll<HTMLInputElement>("input[data-lab-input]"));
                            all[all.indexOf(e.currentTarget) + 1]?.focus();
                          }}
                          className={`${field} text-base font-semibold ${tint} ${hl.has(t.id) ? "ring-2 ring-yellow-300" : ""} disabled:bg-canvas`} />
                        {t.unit && <span dir="ltr" className="shrink-0 text-xs text-muted">{t.unit}</span>}
                      </div>
                      {!locked && t.normal.kind === "qual" && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {QUAL.map((q) => (
                            <button key={q} type="button" onClick={() => setValue(t.id, q)}
                              className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${v === q ? "border-brand bg-brand-light text-brand-dark" : "border-line text-muted hover:bg-canvas"}`}>{q}</button>
                          ))}
                        </div>
                      )}
                      <div className="mt-1 text-xs text-muted">المعدل الطبيعي: <span dir="ltr">{rangeLabel(t.normal, gender, t.unit ?? undefined, age)}</span></div>
                      {dv && !locked && dv.value && dv.value !== v && (
                        <button type="button" onClick={() => setValue(t.id, dv.value)} className="mt-1 rounded-full border border-violet-300 px-2 py-0.5 text-xs font-semibold text-violet-700 hover:bg-violet-50">
                          استعمل المحسوبة: <span dir="ltr">{dv.value}</span> <span className="font-normal text-muted">= {dv.formula}</span>
                        </button>
                      )}
                      {p && (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs" data-testid="lab-prev">
                          <span className="rounded-full border border-dashed border-line bg-canvas px-2.5 py-0.5 text-muted">
                            <b className="text-ink">السابق:</b> <b className="tabular-nums text-ink">{p.value}</b> · <span className="tabular-nums">{localYmd(p.at)}</span>
                          </span>
                          {d != null && d !== 0 && (
                            <span dir="ltr" className={`rounded-full px-2 py-0.5 font-bold tabular-nums ${d > 0 ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"}`}>{d > 0 ? `+${d} ▲` : `${d} ▼`}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {missing.length > 0 && !locked && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">{missing.length} فحص بدون نتيجة.</p>
              )}

              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
                {!locked && (
                  <>
                    <button type="button" disabled={busy} onClick={() => save()} data-testid="lab-save"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
                      <Save className="size-4" /> حفظ النتائج
                    </button>
                    <button type="button" disabled={busy || missing.length > 0} onClick={verify} data-testid="lab-verify"
                      title={missing.length ? "أكمل النتائج أولاً" : ""}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
                      <ShieldCheck className="size-4" /> {order.awaiting2 ? "الاعتماد الثاني" : "اعتماد النتائج"}
                    </button>
                  </>
                )}
                <button type="button" onClick={() => window.print()} data-testid="lab-print" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-canvas">
                  <Printer className="size-4" /> طباعة
                </button>
                {print.tubeLabel && (
                  <button type="button" onClick={() => setLabelJob(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">
                    <Tags className="size-4" /> ملصق الأنبوب
                  </button>
                )}
                {print.entryWhatsApp !== false && (
                  <button type="button" onClick={() => void onShare()} disabled={sharing} className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
                    <MessageCircle className="size-4" /> واتساب PDF
                  </button>
                )}
                {locked && order.patient.phone && (
                  <button type="button" disabled={busy} data-testid="lab-notify"
                    onClick={() => start(async () => { const r = await notifyReady(order.id); if (!r.ok) toast.error(r.error); else window.open(r.link, "_blank", "noopener,noreferrer"); })}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-green-600 px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-50">
                    <BellRing className="size-4" /> إشعار المراجع
                  </button>
                )}
                {order.status === "completed" && (
                  <button type="button" disabled={busy} onClick={() => act(() => deskDeliver(order.id), "سُلّمت النتائج")} data-testid="lab-deliver"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">
                    <Send className="size-4" /> تسليم
                  </button>
                )}
                {locked && isAdmin && (
                  <button type="button" disabled={busy} onClick={() => confirm("إعادة فتح النتائج المعتمدة لتعديلها؟") && act(() => labReopen(order.id))} data-testid="lab-reopen"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-muted hover:bg-canvas">
                    <RotateCcw className="size-4" /> إعادة فتح
                  </button>
                )}
              </div>
            </div>

            <ReportSheet
              className="mt-6"
              settings={settings}
              paper={paper}
              date={localYmd(order.created_at)}
              at={order.created_at}
              accession={order.accession}
              patient={{ name: order.patient.name, gender, age, phone: order.patient.phone }}
              referrer={order.referrer || undefined}
              rows={chosen.map((t) => ({ key: t.id, name: t.name_ar, value: results[t.id] ?? "", unit: t.unit ?? undefined, test: toStation(t), hl: hl.has(t.id) && !isFormCode(t.code) }))}
              prev={order.prev}
              printPrev={print.printPrevious === true && chosen.some((t) => order.prev[t.id] && !isFormCode(t.code))}
              printable={!labelJob}
            />
          </>
        )}
      </div>

      {formFor && order && (() => {
        const t = byId.get(formFor);
        if (!t || !isFormCode(t.code)) return null;
        return (
          <FormDialog code={t.code as FormCode} testName={t.name_ar} values={decodeForm(results[t.id])}
            onChange={(v) => setValue(t.id, encodeForm(v))} onClose={() => setFormFor(null)} opts={opts} />
        );
      })()}
      {labelJob && order && (
        <TubeLabels name={order.patient.name} accession={order.accession} date={localYmd(order.created_at)}
          size={print.labelSize ?? "50x25"} copies={print.labelCopies ?? 1} onReady={() => setTimeout(() => window.print(), 60)} />
      )}
      {newOpen && (
        <NewSample tests={tests} referrers={referrers} onClose={() => setNewOpen(false)}
          onSaved={(id) => { setNewOpen(false); setTab("work"); router.refresh(); open(id); }} />
      )}
      {setOpen && <LabSettingsDialog print={print} rules={rules} onClose={() => setSetOpen(false)} />}
    </div>
  );
}

/** «عيّنة جديدة»: entered at the lab, like the lab station — no prices. */
function NewSample({ tests, referrers, onClose, onSaved }: {
  tests: DeskTest[]; referrers: { id: string; name: string }[]; onClose: () => void; onSaved: (id: string) => void;
}) {
  const [busy, start] = useTransition();
  const [patient, setPatient] = useState<DeskPatient>({ ...EMPTY_PATIENT });
  const [chosen, setChosen] = useState<string[]>([]);
  const [referrer, setReferrer] = useState("");
  return (
    <div className="no-print fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-label="عيّنة جديدة">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl bg-surface p-5 shadow-[var(--shadow-pop)]" data-testid="lab-new-dialog">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-bold">عيّنة جديدة</div>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="rounded p-1 hover:bg-canvas"><X className="size-5" /></button>
        </div>
        <PatientBox value={patient} onChange={setPatient} />
        <select value={referrer} onChange={(e) => setReferrer(e.target.value)} aria-label="الطبيب المحيل" className={`${field} mt-2`}>
          <option value="">بلا طبيب محيل</option>
          {referrers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <div className="mt-3"><TestPicker tests={tests} chosen={chosen} onChange={setChosen} prices={false} /></div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm">إلغاء</button>
          <button type="button" disabled={busy || !chosen.length || !patient.name.trim()} data-testid="lab-new-save"
            onClick={() => start(async () => {
              const r = await labNewSample({ patient, testIds: chosen, referrerId: referrer || null });
              if (!r.ok) { toast.error(r.error); return; }
              onSaved(r.orderId);
            })}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">بدء إدخال النتائج</button>
        </div>
      </div>
    </div>
  );
}
