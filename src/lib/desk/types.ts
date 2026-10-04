/**
 * What «نافذة ساحب الدم» and «نافذة المختبر» pass between the server and the page. No browser or
 * server APIs here (both sides import it).
 */
import type { Gender, NormalRange, StationSettings } from "@/lib/station/store";
import { DEFAULT_TESTS } from "@/lib/station/defaultTests";

export interface DeskTest {
  id: string;
  code: string;
  name_ar: string;
  name_en: string | null;
  category: string | null;
  sample_type: string | null;
  unit: string | null;
  price: number;
  normal: NormalRange;
  critical_low: number | null;
  critical_high: number | null;
  active: boolean;
}

export interface DeskPatient { id?: string; name: string; gender: Gender; age: string; phone: string }

export type OrderStatus = "pending" | "in_progress" | "completed" | "delivered";
export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "بانتظار المختبر",
  in_progress: "قيد العمل",
  completed: "معتمدة",
  delivered: "سُلّمت",
};
export const SOURCE_LABEL: Record<string, string> = { desk: "الاستقبال", collect: "ساحب الدم", lab: "المختبر" };

export interface QueueRow {
  id: string;
  accession: string;
  name: string;
  status: OrderStatus;
  source: string;
  created_at: number;
  tests: number;
  done: number;
  /** Minutes allowed before the sample is late (0 = no limit). */
  tat: number;
  awaiting2: boolean;
  critical: number;
}

export interface LabItem {
  itemId: string;
  testId: string;
  value: string;
  hl: boolean;
  flag: string | null;
  critical: boolean;
}

export interface LabOrderData {
  id: string;
  accession: string;
  status: OrderStatus;
  source: string;
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
  patient: DeskPatient & { id: string };
  referrer: string;
  items: LabItem[];
  /** Earlier result of each test for this patient (test id → value and time). */
  prev: Record<string, { value: string; at: number }>;
  verifiedBy: string;
  verified2By: string;
  /** The first verification is done and a second one (by someone else) is due. */
  awaiting2: boolean;
  criticalOpen: { id: string; test: string; value: string }[];
}

/** The lab window's print options (the station's report options it uses), kept in lab_settings. */
export type LabPrint = Partial<Pick<StationSettings,
  "reportFill" | "fillSmart" | "fillPaper" | "fillNotes" | "fillHead" | "fillCard" | "fillPrev" | "fillLevel" |
  "reportBarcode" | "labQr" | "labUrl" | "labPhone" | "labAddress" | "labQrLogo" | "printPrevious" |
  "prePrinted" | "prePrintedTop" | "prePrintedBottom" | "reportHeadOn" | "reportHead" | "reportDate" |
  "reportFontOn" | "reportFont" | "tubeLabel" | "labelSize" | "labelCopies" | "entryWhatsApp" | "entryHighlight" |
  "autoDerived" | "derivedEgfr" | "derivedSampson" | "sfaDiagnosis" | "sfaAutoCalc" | "formHideEmpty" | "csTestedOnly" |
  "formBoldAbnormal" | "signatureOn" | "signatureImage" | "stampImage" | "signatureName" | "signatureTitle" | "reportTable"
>> & { paper?: "A4" | "A5" };

export interface LabRules {
  /** A second person must verify the results before they are final. */
  twoStep: boolean;
  /** Minutes a sample may wait before it shows as late (0 = no limit). */
  tat: number;
}
export const DEFAULT_RULES: LabRules = { twoStep: false, tat: 120 };

let byCode: Map<string, NormalRange> | null = null;
/** A catalog entry's reference range in the stations' form: its own when set, the built-in one for
 *  its code (by sex and age), or its plain low – high / text. */
export function normalOf(row: { code?: string | null; normal?: unknown; normal_low?: unknown; normal_high?: unknown; normal_text?: string | null }): NormalRange {
  const own = row.normal as NormalRange | null | undefined;
  if (own && typeof own === "object" && "kind" in own) return own;
  byCode ??= new Map(DEFAULT_TESTS().map((t) => [t.code ?? "", t.normal]));
  const d = row.code ? byCode.get(row.code) : undefined;
  if (d) return d;
  const lo = row.normal_low == null ? null : Number(row.normal_low);
  const hi = row.normal_high == null ? null : Number(row.normal_high);
  if (lo != null || hi != null) return { kind: "numeric", low: lo, high: hi };
  if (row.normal_text?.trim()) return { kind: "text", text: row.normal_text.trim() };
  return { kind: "none" };
}

/** A result outside the catalog's critical limits (numbers only). */
export function isCritical(value: string, t: { critical_low: number | null; critical_high: number | null }): boolean {
  const v = value.trim();
  if (!v || !/^-?\d+(\.\d+)?$/.test(v)) return false;
  const n = Number(v);
  return (t.critical_low != null && n < t.critical_low) || (t.critical_high != null && n > t.critical_high);
}
