import type { StationTest } from "@/lib/station/store";

/** Common consumables of a lab, each linked to the lab station's tests that use it (one unit per
 *  visit): tubes by department and sample, and the containers of urine, stool, semen and culture. */
export function consumablePresets(tests: StationTest[]): { name: string; testIds: string[] }[] {
  const blood = (t: StationTest) => (t.sample_type ?? "دم") === "دم" && !["أدرار", "الخروج", "السائل المنوي", "الزرع الجرثومي"].includes(t.category ?? "");
  const edta = (t: StationTest) => t.category === "أمراض الدم" || t.code === "HBA1C";
  const ids = (f: (t: StationTest) => boolean) => tests.filter(f).map((t) => t.id);
  return [
    { name: "أنبوب EDTA (بنفسجي)", testIds: ids((t) => blood(t) && edta(t)) },
    { name: "أنبوب جل / بدون مانع تخثر (أصفر)", testIds: ids((t) => blood(t) && !edta(t)) },
    { name: "سرنجة سحب دم", testIds: ids(blood) },
    { name: "علبة إدرار", testIds: ids((t) => t.sample_type === "إدرار" || t.category === "أدرار") },
    { name: "علبة خروج", testIds: ids((t) => t.sample_type === "براز" || t.category === "الخروج") },
    { name: "علبة سائل منوي", testIds: ids((t) => t.category === "السائل المنوي") },
    { name: "مسحة / علبة زرع", testIds: ids((t) => t.category === "الزرع الجرثومي") },
  ].filter((p) => p.testIds.length > 0);
}
