"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Save, WifiOff, ClipboardList } from "lucide-react";
import { useOffline } from "@/components/offline/OfflineProvider";
import { formPlain } from "@/lib/station/formPlain";
import { isFormCode, decodeForm, encodeForm, formProgress, type FormCode, type FormOptions, type FormValues } from "@/lib/station/templates";
import { FormDialog } from "@/components/station/ReportForms";

/** Written results offered while typing (as at the lab station and «نافذة المختبر»). */
const QUAL = ["Positive", "Negative", "+", "++", "+++"];
/** Arabic-Indic digits and comma typed on an Arabic keyboard → 1 2 3 and a dot. */
const latin = (v: string) => v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[٫,]/g, ".").trim();

const field =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

/** Live H/L/N preview while typing (the authoritative flag is set by a DB
 *  trigger on save; this just mirrors it for the technician). */
function previewFlag(
  value: string,
  low: number | null,
  high: number | null
): "H" | "L" | "N" | null {
  if (value === "" || value == null) return null;
  const v = Number(value);
  if (Number.isNaN(v)) return null;
  if (low != null && v < Number(low)) return "L";
  if (high != null && v > Number(high)) return "H";
  return "N";
}

function FlagPill({ flag }: { flag: "H" | "L" | "N" | null }) {
  if (!flag) return null;
  const map = {
    H: { cls: "bg-red-50 text-red-600", label: "مرتفع H" },
    L: { cls: "bg-blue-50 text-blue-600", label: "منخفض L" },
    N: { cls: "bg-teal-50 text-brand-dark", label: "طبيعي N" },
  } as const;
  const m = map[flag];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${m.cls}`}>
      {m.label}
    </span>
  );
}

/** Labeled input used inside the structured panels (Urine/Stool). */
function LabeledCell({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className={field} />
    </label>
  );
}

export function ResultEntry({
  item,
  orderId,
  patientId,
  formOpts,
}: {
  item: any;
  orderId: string;
  patientId: string;
  /** «نافذة المختبر ← الإعدادات»'s options for the report forms (GUE, GSE, semen, C&S…). */
  formOpts?: FormOptions;
}) {
  const { submitResult, online } = useOffline();
  const [pending, start] = useTransition();

  const hadValue =
    item.value_numeric != null || item.value_text != null ||
    item.physical_inspection != null || item.microscopic != null;
  const [saved, setSaved] = useState(hadValue);

  // A number or a written result (Positive, a titer…): one field, saved as whichever it is.
  const [num, setNum] = useState<string>(item.value_text != null ? String(item.value_text) : item.value_numeric != null ? String(item.value_numeric) : "");
  // A report form (GUE, GSE, semen, C&S…): filled in the lab station's form, kept as written text.
  const form = !item.is_special && isFormCode(item.code ?? undefined) ? (item.code as FormCode) : null;
  const [formValues, setFormValues] = useState<FormValues>(() => (form ? decodeForm(item.value_text ?? "") : {}));
  const [formOpen, setFormOpen] = useState(false);
  const [phys, setPhys] = useState({
    color: item.physical_inspection?.color ?? "",
    appearance: item.physical_inspection?.appearance ?? "",
    sediment: item.physical_inspection?.sediment ?? "",
  });
  const [mic, setMic] = useState({
    rbc: item.microscopic?.rbc ?? "",
    pus: item.microscopic?.pus_cells ?? "",
    epithelial: item.microscopic?.epithelial ?? "",
    crystals: item.microscopic?.crystals ?? "",
    mucus: item.microscopic?.mucus ?? "",
  });

  const low = item.normal_low != null ? Number(item.normal_low) : null;
  const high = item.normal_high != null ? Number(item.normal_high) : null;
  const typed = latin(String(num));
  const isNumber = typed !== "" && Number.isFinite(Number(typed));
  const flag = item.is_special || form || !isNumber ? null : previewFlag(typed, low, high);
  const rangeText =
    low != null || high != null
      ? `${low ?? "…"}–${high ?? "…"}${item.unit ? ` ${item.unit}` : ""}`
      : item.unit || "—";

  function save() {
    const fields: Record<string, string> = {
      order_item_id: item.item_id,
      order_id: orderId,
      patient_id: patientId,
      test_id: item.test_id,
    };
    if (item.is_special) {
      Object.assign(fields, {
        phys_color: phys.color,
        phys_appearance: phys.appearance,
        phys_sediment: phys.sediment,
        mic_rbc: mic.rbc,
        mic_pus: mic.pus,
        mic_epithelial: mic.epithelial,
        mic_crystals: mic.crystals,
        mic_mucus: mic.mucus,
      });
    } else if (form) {
      const text = encodeForm(formValues);
      if (!text) { toast.error("املأ النموذج أولاً."); return; }
      fields.value_text = text;
    } else if (isNumber) {
      fields.value_numeric = typed;
    } else if (typed) {
      fields.value_text = typed;
    } else {
      toast.error("اكتب النتيجة أولاً.");
      return;
    }
    start(async () => {
      const r = await submitResult(fields, `نتيجة: ${item.name_ar}`);
      if (r === "queued") toast.info("حُفظت محلياً — ستُزامن عند عودة الاتصال");
      else toast.success("حُفظت النتيجة");
      setSaved(true);
    });
  }

  return (
    <div
      data-result={item.name_ar}
      className={`rounded-2xl border bg-surface p-5 shadow-[var(--shadow-card)] transition-colors ${
        saved ? "border-brand/40" : "border-line"
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {saved && (
            <span className="grid size-5 place-items-center rounded-full bg-brand text-white">
              <Check className="size-3" strokeWidth={3} />
            </span>
          )}
          <span className="font-semibold">{item.name_ar}</span>
        </div>
        {!item.is_special && !form && (
          <div className="flex items-center gap-2 text-xs text-muted">
            <span>النطاق الطبيعي: {rangeText}</span>
            <FlagPill flag={flag} />
          </div>
        )}
      </div>

      {item.is_special ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset className="rounded-xl border border-line p-3">
            <legend className="px-1 text-xs font-semibold text-muted">الفحص العيني</legend>
            <div className="grid grid-cols-3 gap-2">
              <LabeledCell label="المظهر" value={phys.appearance} onChange={(v) => setPhys({ ...phys, appearance: v })} />
              <LabeledCell label="اللون" value={phys.color} onChange={(v) => setPhys({ ...phys, color: v })} />
              <LabeledCell label="الرواسب" value={phys.sediment} onChange={(v) => setPhys({ ...phys, sediment: v })} />
            </div>
          </fieldset>
          <fieldset className="rounded-xl border border-line p-3">
            <legend className="px-1 text-xs font-semibold text-muted">الفحص المجهري</legend>
            <div className="grid grid-cols-2 gap-2">
              <LabeledCell label="Pus cells" value={mic.pus} onChange={(v) => setMic({ ...mic, pus: v })} />
              <LabeledCell label="RBCs" value={mic.rbc} onChange={(v) => setMic({ ...mic, rbc: v })} />
              <LabeledCell label="الخلايا الطلائية" value={mic.epithelial} onChange={(v) => setMic({ ...mic, epithelial: v })} />
              <LabeledCell label="الأملاح/البلورات" value={mic.crystals} onChange={(v) => setMic({ ...mic, crystals: v })} />
              <LabeledCell label="المخاط" value={mic.mucus} onChange={(v) => setMic({ ...mic, mucus: v })} />
            </div>
          </fieldset>
        </div>
      ) : form ? (
        <div data-testid="result-form">
          <div className="rounded-lg bg-canvas px-3 py-2 text-sm" dir="auto">
            {encodeForm(formValues) ? formPlain(encodeForm(formValues)) : <span className="text-muted">لم يُملأ النموذج بعد</span>}
          </div>
          <button type="button" onClick={() => setFormOpen(true)} data-testid="result-form-open"
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-canvas">
            <ClipboardList className="size-4" /> {encodeForm(formValues) ? "تعديل النموذج" : "تعبئة النموذج"}
            <span className="text-xs text-muted">({formProgress(form, formValues).filled}/{formProgress(form, formValues).total})</span>
          </button>
          {formOpen && (
            <FormDialog code={form} testName={item.name_ar} values={formValues} opts={formOpts ?? { diagnosis: false, autoCalc: false, hideEmpty: false, testedOnly: false, boldAbnormal: false, highlight: false }}
              onChange={(v) => { setFormValues(v); setSaved(false); }} onClose={() => setFormOpen(false)} />
          )}
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            inputMode={/^[\d٠-٩.,٫-]*$/.test(String(num)) ? "decimal" : "text"}
            list={`qual-${item.item_id}`}
            placeholder="النتيجة: رقم، أو Positive / Negative / +"
            aria-label={`نتيجة ${item.name_ar}`}
            dir="ltr"
            value={num}
            onChange={(e) => {
              setNum(e.target.value);
              setSaved(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
            }}
            className={`${field} pl-16 text-base font-semibold tabular-nums`}
          />
          {item.unit && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
              {item.unit}
            </span>
          )}
          <datalist id={`qual-${item.item_id}`}>{QUAL.map((q) => <option key={q} value={q} />)}</datalist>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={save}
          disabled={pending}
          data-testid="result-save"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {online ? <Save className="size-4" /> : <WifiOff className="size-4" />}
          {pending ? "جارٍ الحفظ…" : online ? "حفظ النتيجة" : "حفظ (دون اتصال)"}
        </button>
        {saved && !pending && (
          <span className="text-xs text-brand-dark">محفوظة</span>
        )}
      </div>
    </div>
  );
}
