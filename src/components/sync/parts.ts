/** Shared bits of «محطة المزامنة»'s pages. */
export const STATION_LABEL: Record<string, string> = {
  station: "محطة المختبر", purchasing: "المشتريات", training: "التدريب والمعلومات", qc: "الجودة والأجهزة", roster: "الكادر والدوام",
};
export const card = "rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]";
export const btn = "inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold";
export const when = (t: number) => new Date(t).toLocaleString("ar-IQ-u-nu-latn", { dateStyle: "medium", timeStyle: "short" });
/** Whole days since a time (0 = today). */
export const daysSince = (t: number) => Math.floor((Date.now() - t) / 86_400_000);
