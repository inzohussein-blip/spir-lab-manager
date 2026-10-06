/**
 * A saved report form (urine, stool, semen, culture — stored as "__tpl__:" + JSON) as plain text,
 * for places that show a result on one line (the doctors' window, the panel's older pages). Plain
 * code: works on the server and in the browser. Any other value is returned as it is.
 */
export const isFormText = (v?: string | null): boolean => !!v && v.startsWith("__tpl__:");
export function formPlain(v?: string | null): string {
  if (!isFormText(v)) return v ?? "";
  try {
    const o = JSON.parse(v!.slice(8)) as Record<string, unknown>;
    return Object.entries(o)
      .filter(([k, x]) => !k.startsWith("hl:") && x != null && String(x).trim() !== "")
      .map(([k, x]) => `${k.replace(/^ab2?:/, "")}: ${String(x)}`)
      .join(" · ");
  } catch {
    return "";
  }
}
