"use server";

import Anthropic from "@anthropic-ai/sdk";
import { query, queryOne } from "@/lib/db";

const DISCLAIMER =
  "⚕️ هذا ملخص أولي لدعم القرار المكتبي، وليس تشخيصاً طبياً نهائياً. القرار السريري مسؤولية الطبيب المختص.";

/**
 * AI Diagnostic Assistant (section 7): reads a patient's results and returns a
 * trustworthy medical summary that links the abnormal (H/L) readings — strictly
 * as preliminary decision support, never a diagnosis.
 */
export async function analyzeOrder(
  orderId: string
): Promise<{ summary?: string; error?: string; disclaimer: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      error:
        "المساعد الذكي غير مُفعّل — أضف ANTHROPIC_API_KEY في إعدادات البيئة.",
      disclaimer: DISCLAIMER,
    };
  }

  const patient = await queryOne<any>(
    `select p.full_name, p.gender, p.age_years, p.chronic_diseases,
            p.current_meds, p.is_pregnant
       from test_orders o join patients p on p.id = o.patient_id
      where o.id = $1`,
    [orderId]
  );
  if (!patient) {
    return { error: "الطلب غير موجود", disclaimer: DISCLAIMER };
  }

  const results = await query<any>(
    `select t.name_ar, t.name_en, t.unit, t.normal_low, t.normal_high,
            r.value_numeric, r.value_text, r.flag
       from test_order_items i
       join test_catalog t on t.id = i.test_id
       left join test_results r on r.order_item_id = i.id
      where i.order_id = $1`,
    [orderId]
  );
  if (results.length === 0) {
    return { error: "لا توجد نتائج مُدخلة بعد", disclaimer: DISCLAIMER };
  }

  const lines = results
    .map((r: any) => {
      const val = r.value_numeric ?? r.value_text ?? "—";
      const range =
        r.normal_low != null || r.normal_high != null
          ? ` (النطاق ${r.normal_low ?? "?"}–${r.normal_high ?? "?"} ${r.unit ?? ""})`
          : "";
      const flag =
        r.flag === "H" ? " [مرتفع H]" : r.flag === "L" ? " [منخفض L]" : "";
      return `- ${r.name_ar}: ${val}${range}${flag}`;
    })
    .join("\n");

  const patientCtx = [
    `الجنس: ${patient.gender === "male" ? "ذكر" : patient.gender === "female" ? "أنثى" : "غير محدد"}`,
    patient.age_years ? `العمر: ${patient.age_years}` : null,
    patient.chronic_diseases ? `أمراض مزمنة: ${patient.chronic_diseases}` : null,
    patient.current_meds ? `أدوية حالية: ${patient.current_meds}` : null,
    patient.is_pregnant ? `حالة الحمل: حامل` : null,
  ]
    .filter(Boolean)
    .join("، ");

  const client = new Anthropic();
  try {
    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-opus-5",
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      system:
        "أنت مساعد مختبر طبي. مهمتك تقديم ملخص أولي موثوق يربط القراءات غير " +
        "الطبيعية (H/L) ببعضها لدعم قرار الطبيب. لا تُعطِ تشخيصاً نهائياً ولا " +
        "خطة علاج. اكتب بالعربية بإيجاز ووضوح، وأشر إلى ضرورة مراجعة الطبيب. " +
        "استخدم عناوين قصيرة ونقاطاً.",
      messages: [
        {
          role: "user",
          content:
            `بيانات المريض: ${patientCtx || "غير متوفرة"}\n\n` +
            `نتائج الفحوصات:\n${lines}\n\n` +
            "المطلوب: (1) ملخص موجز للقراءات غير الطبيعية وارتباطها المحتمل، " +
            "(2) ملاحظات تستحق انتباه الطبيب، (3) توصية عامة بالمتابعة. " +
            "بدون تشخيص قطعي.",
        },
      ],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n")
      .trim();

    return { summary: text, disclaimer: DISCLAIMER };
  } catch (e: any) {
    return {
      error: `تعذّر توليد الملخص: ${e?.message ?? "خطأ غير معروف"}`,
      disclaimer: DISCLAIMER,
    };
  }
}
