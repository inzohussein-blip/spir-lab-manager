"use client";

import type { Recommendation, Trainee, TrainingCompletion, TrainingSettings } from "@/lib/training/store";
import { Img } from "./Img";
import { SopLetterhead, SopFooter, SOP_INK, exact } from "./SopSheet";

const GOLD = "#b8860b";

/** The certificate number: CERT-END-<date>-<id>. */
export const completionNo = (tr: Trainee, end: string): string => `TRN-${end.replace(/-/g, "")}-${tr.id.slice(0, 4).toUpperCase()}`;

/** «شهادة انتهاء التدريب» — printable A4 landscape, issued at the end of the training period. */
export function CompletionCertificate({ trainee, settings, c }: { trainee: Trainee; settings: TrainingSettings; c: TrainingCompletion }) {
  const no = c.certNo ?? completionNo(trainee, c.end);
  return (
    <div id="done-sheet" className="hidden bg-white text-black print:block" data-testid="completion-print">
      <style>{`@media print {
        @page { size: A4 landscape; margin: 0; }
        #done-sheet { width: 297mm; height: 209mm; padding: 9mm; }
      }`}</style>
      <div className="flex h-full flex-col rounded-lg p-2" style={{ border: `3px solid ${SOP_INK}`, ...exact }}>
        <div className="flex flex-1 flex-col items-center rounded px-12 py-6 text-center" style={{ border: `1.5px solid ${GOLD}`, ...exact }}>
          {settings.logoImageId ? <Img id={settings.logoImageId} className="size-20" /> : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/lab-logo.png" alt="" className="size-20 object-contain" />
          )}
          <div className="mt-1 text-lg font-bold" style={{ color: SOP_INK }}>{settings.title}</div>
          <div className="text-xs text-gray-600">{settings.subtitle}</div>

          <div className="mt-5 text-4xl font-extrabold" style={{ color: SOP_INK }}>شهادة انتهاء تدريب</div>
          <div className="mt-1 text-xs tracking-[0.3em] text-gray-500" dir="ltr">CERTIFICATE OF TRAINING</div>
          <div className="my-4 h-0.5 w-40" style={{ background: GOLD, ...exact }} />

          <div className="text-base text-gray-700">تشهد إدارة {settings.title} بأنّ السيد / السيدة</div>
          <div className="mt-2 text-3xl font-extrabold" style={{ color: GOLD }}>{trainee.name}</div>
          <div className="mt-3 max-w-3xl text-base leading-relaxed text-gray-800">
            قد أنهى / أنهت فترة التدريب العملي{c.program ? <> في <b style={{ color: SOP_INK }}>«{c.program}»</b></> : null}
            {trainee.start ? <> خلال الفترة من <span dir="ltr">{trainee.start}</span> إلى <span dir="ltr">{c.end}</span></> : <> بتاريخ <span dir="ltr">{c.end}</span></>}
            {c.hours ? <> بواقع <b>{c.hours}</b> ساعة تدريبية</> : null}
            {c.grade ? <>، بتقدير <b style={{ color: SOP_INK }}>{c.grade}</b></> : null}.
          </div>
          {c.notes && <div className="mt-3 max-w-3xl text-sm text-gray-600">{c.notes}</div>}
          <div className="mt-2 text-sm text-gray-600">وقد مُنحت هذه الشهادة بناءً على طلبه / طلبها دون أدنى مسؤولية على المختبر.</div>

          <div className="mt-auto grid w-full grid-cols-3 items-end gap-8 pt-6 text-sm">
            <div>
              <div className="mb-1 h-6 font-semibold">{c.supervisor ?? ""}</div>
              <div className="border-t border-gray-500 pt-1 text-gray-600">مشرف التدريب</div>
            </div>
            <div className="text-[11px] text-gray-500">
              <div>رقم الشهادة: <span dir="ltr">{no}</span></div>
              <div>تاريخ الإصدار: <span dir="ltr">{c.end}</span></div>
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

/** A suggested recommendation text from what is filled in (the lab edits it freely). */
export function suggestRecommendation(tr: Trainee, r: Omit<Recommendation, "text">, lab: string): string {
  const period = r.from && r.to ? `خلال الفترة من ${r.from} إلى ${r.to}` : r.from ? `منذ ${r.from}` : "";
  if (r.kind === "employee") {
    return [
      `يسرّ ${lab} أن يوصي بالسيد / السيدة ${tr.name}، الذي عمل / التي عملت لدينا${r.position ? ` بوظيفة ${r.position}` : ""} ${period}.`,
      "وقد عُرف / عُرفت خلال عمله / عملها بالالتزام بالدوام والأمانة والدقة في إجراء الفحوصات وتسجيل النتائج، وحسن التعامل مع المرضى والزملاء، والحرص على تطبيق إجراءات السلامة وضبط الجودة.",
      "ولا نتردد في التوصية به / بها لأي جهة يتقدّم / تتقدّم إليها، متمنين له / لها دوام التوفيق.",
    ].join("\n\n");
  }
  return [
    `يسرّ ${lab} أن يوصي بالمتدرب / المتدربة ${tr.name}، الذي أمضى / التي أمضت فترة تدريب عملي لدينا ${period}.`,
    "وقد أبدى / أبدت خلال التدريب حرصاً على التعلّم والتزاماً بالمواعيد، وأتقن / أتقنت سحب العينات وتحضيرها وإجراء الفحوصات الأساسية وفق البروسيجر المعتمد وإجراءات السلامة.",
    "ونوصي به / بها للعمل أو لمواصلة التدريب، متمنين له / لها التوفيق والنجاح.",
  ].join("\n\n");
}

/** «كتاب توصية» — printable A4 letter on the station's letterhead. */
export function RecommendationLetter({ trainee, settings, r }: { trainee: Trainee; settings: TrainingSettings; r: Recommendation }) {
  return (
    <div className="sop-doc hidden bg-white text-[13px] leading-loose text-black print:block" data-testid="recommendation-print">
      <style>{`@media print {
        @page { size: A4; margin: 0; }
        .sop-doc { padding: 12mm 16mm 20mm; }
        .sop-doc .sop-footer { position: fixed; left: 16mm; right: 16mm; bottom: 8mm; }
      }`}</style>
      <SopLetterhead settings={settings} right={<><div className="font-bold" style={{ color: SOP_INK }}>كتاب توصية</div><div>التاريخ: <span dir="ltr">{r.date}</span></div></>} />
      <div className="mt-10 text-center text-2xl font-extrabold" style={{ color: SOP_INK }}>كتاب توصية</div>
      <div className="mt-1 text-center text-[11px] tracking-[0.3em] text-gray-500" dir="ltr">LETTER OF RECOMMENDATION</div>
      <div className="mt-8 font-bold">{r.addressee?.trim() || "إلى من يهمه الأمر"}</div>
      <div className="mt-1">تحية طيبة وبعد،</div>
      <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-gray-300 p-3 text-[12px]">
        <div><b>الاسم:</b> {trainee.name}</div>
        <div><b>الصفة:</b> {r.kind === "employee" ? `موظف سابق${r.position ? ` — ${r.position}` : ""}` : "متدرب"}</div>
        {(r.from || r.to) && <div className="col-span-2"><b>الفترة:</b> <span dir="ltr">{r.from ?? "—"}</span> إلى <span dir="ltr">{r.to ?? "—"}</span></div>}
      </div>
      <div className="mt-5 whitespace-pre-line text-justify">{r.text}</div>
      <div className="mt-6">وتفضلوا بقبول فائق الاحترام والتقدير.</div>
      <div className="mt-12 flex justify-end">
        <div className="w-64 text-center">
          <div className="h-10" />
          <div className="border-t border-gray-500 pt-1 font-semibold">{r.by?.trim() || "التوقيع"}</div>
          {r.byTitle?.trim() && <div className="text-[11px] text-gray-600">{r.byTitle}</div>}
          <div className="mt-6 text-[11px] text-gray-500">الختم</div>
        </div>
      </div>
      <SopFooter text={settings.footer} />
    </div>
  );
}
