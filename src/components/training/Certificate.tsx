"use client";

import type { Trainee, TrainingSettings, TrainingTest } from "@/lib/training/store";
import { Img } from "./Img";
import { exact } from "./SopSheet";

const INK = "#312e81";
const GOLD = "#b8860b";

/** Printable A4-landscape training completion certificate. */
export function Certificate({
  trainee, settings, scopeLabel, tests,
}: { trainee: Trainee; settings: TrainingSettings; scopeLabel: string; tests: TrainingTest[] }) {
  const dates = tests.map((t) => trainee.comp[t.id]?.date).filter(Boolean).sort() as string[];
  const done = dates[dates.length - 1] ?? new Date().toLocaleDateString("en-CA");
  const supervisors = Array.from(new Set(tests.map((t) => trainee.comp[t.id]?.by).filter(Boolean))) as string[];
  const certNo = `CERT-${done.replace(/-/g, "")}-${trainee.id.slice(0, 4).toUpperCase()}`;

  return (
    <div id="cert-sheet" className="hidden bg-white text-black print:block">
      <style>{`@media print {
        @page { size: A4 landscape; margin: 0; }
        #cert-sheet { width: 297mm; height: 209mm; padding: 9mm; }
      }`}</style>
      <div className="flex h-full flex-col rounded-lg p-2" style={{ border: `3px solid ${INK}`, ...exact }}>
        <div className="flex flex-1 flex-col items-center rounded px-12 py-6 text-center" style={{ border: `1.5px solid ${GOLD}`, ...exact }}>
          {settings.logoImageId ? <Img id={settings.logoImageId} className="size-20" /> : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/lab-logo.png" alt="" className="size-20 object-contain" />
          )}
          <div className="mt-1 text-lg font-bold" style={{ color: INK }}>{settings.title}</div>
          <div className="text-xs text-gray-600">{settings.subtitle}</div>

          <div className="mt-5 text-4xl font-extrabold" style={{ color: INK }}>شهادة إتمام تدريب</div>
          <div className="mt-1 text-xs tracking-[0.3em] text-gray-500" dir="ltr">CERTIFICATE OF TRAINING COMPLETION</div>
          <div className="my-4 h-0.5 w-40" style={{ background: GOLD, ...exact }} />

          <div className="text-base text-gray-700">تشهد إدارة {settings.title} بأنّ المتدرّب / المتدرّبة</div>
          <div className="mt-2 text-3xl font-extrabold" style={{ color: GOLD }}>{trainee.name}</div>
          <div className="mt-3 max-w-3xl text-base leading-relaxed text-gray-800">
            قد أتمّ / أتمّت بنجاح التدريب العملي، وأصبح / أصبحت قادراً / قادرةً على الأداء المستقل لفحوصات
            <b style={{ color: INK }}> «{scopeLabel}» </b>
            ({tests.length} فحص){trainee.start ? <> خلال الفترة من <span dir="ltr">{trainee.start}</span> إلى <span dir="ltr">{done}</span></> : null}.
          </div>
          {tests.length <= 16 && (
            <div className="mt-3 max-w-3xl text-[11px] text-gray-500">{tests.map((t) => t.name_ar).join(" · ")}</div>
          )}

          <div className="mt-auto grid w-full grid-cols-3 items-end gap-8 pt-6 text-sm">
            <div>
              <div className="mb-1 h-6 font-semibold">{supervisors.join("، ")}</div>
              <div className="border-t border-gray-500 pt-1 text-gray-600">مشرف التدريب</div>
            </div>
            <div className="text-[11px] text-gray-500">
              <div>رقم الشهادة: <span dir="ltr">{certNo}</span></div>
              <div>تاريخ الإصدار: <span dir="ltr">{done}</span></div>
            </div>
            <div>
              <div className="mb-1 h-6" />
              <div className="border-t border-gray-500 pt-1 text-gray-600">مدير المختبر</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
