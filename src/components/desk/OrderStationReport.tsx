"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Printer, MessageCircle, Tags } from "lucide-react";
import { localYmd, type StationSettings } from "@/lib/station/store";
import { isFormCode } from "@/lib/station/templates";
import { ReportSheet } from "@/components/station/ReportSheet";
import { TubeLabels } from "@/components/station/TubeLabel";
import { loadBarcode } from "@/components/station/Barcode";
import { sheetPdf, savePdf, openWhatsApp } from "@/lib/station/sharePdf";
import { toStation, type DeskTest, type LabOrderData, type LabPrint } from "@/lib/desk/types";

/**
 * «سجل العيّنات ← التقرير» with the lab station's print options («نافذة المختبر ← الإعدادات»): the
 * same sheet as the lab window prints — page fill, pre-printed paper, header, fonts, QR, previous
 * results, signature — with its print, tube labels and WhatsApp PDF.
 */
export function OrderStationReport({ order, tests, print, letterhead }: {
  order: LabOrderData; tests: DeskTest[]; print: LabPrint;
  letterhead: { name: string; subtitle: string; footer: string; logo: string };
}) {
  const [sharing, setSharing] = useState(false);
  const [labelJob, setLabelJob] = useState(false);
  const settings: StationSettings = useMemo(() => ({
    labName: letterhead.name, labSubtitle: letterhead.subtitle, footer: letterhead.footer || undefined, logo: letterhead.logo || "/lab-logo.png",
    ...print,
  }), [letterhead, print]);
  const paper = print.paper === "A5" ? "A5" : "A4";
  const byId = useMemo(() => new Map(tests.map((t) => [t.id, t])), [tests]);
  const chosen = order.items.map((it) => byId.get(it.testId)).filter((t): t is DeskTest => !!t);
  const values = Object.fromEntries(order.items.map((it) => [it.testId, it.value]));
  const hl = new Set(order.items.filter((it) => it.hl).map((it) => it.testId));
  const gender = order.patient.gender, age = order.patient.age;
  // The saved results, as the lab window prints them (derived values are only offered while entering).
  const value = (id: string) => values[id] ?? "";

  async function share() {
    if (sharing) return;
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

  return (
    <div data-testid="order-station-report">
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => window.print()} data-testid="station-report-print"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
          <Printer className="size-4" /> طباعة
        </button>
        {print.tubeLabel && (
          <button type="button" onClick={() => setLabelJob(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">
            <Tags className="size-4" /> ملصق الأنبوب
          </button>
        )}
        {print.entryWhatsApp !== false && order.patient.phone && (
          <button type="button" onClick={() => void share()} disabled={sharing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
            <MessageCircle className="size-4" /> واتساب PDF
          </button>
        )}
      </div>
      <ReportSheet
        settings={settings}
        paper={paper}
        date={localYmd(order.created_at)}
        at={order.created_at}
        accession={order.accession}
        patient={{ name: order.patient.name, gender, age, phone: order.patient.phone }}
        referrer={order.referrer || undefined}
        rows={chosen.map((t) => ({ key: t.id, name: t.name_ar, value: value(t.id), unit: t.unit ?? undefined, test: toStation(t), hl: hl.has(t.id) && !isFormCode(t.code) }))}
        prev={order.prev}
        printPrev={print.printPrevious === true && chosen.some((t) => order.prev[t.id] && !isFormCode(t.code))}
        printable={!labelJob}
      />
      {labelJob && (
        <TubeLabels name={order.patient.name} accession={order.accession} date={localYmd(order.created_at)}
          size={print.labelSize ?? "50x25"} copies={print.labelCopies ?? 1}
          onReady={() => { const done = () => { setLabelJob(false); window.removeEventListener("afterprint", done); }; window.addEventListener("afterprint", done); setTimeout(() => window.print(), 60); }} />
      )}
    </div>
  );
}
