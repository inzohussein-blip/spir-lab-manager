import "server-only";

/**
 * Generate an inline Code128 barcode as an SVG string (for the accession /
 * sample id). Server-side, no client JS; prints crisply on the A4 report.
 * Returns "" on any failure so the caller can simply skip rendering.
 */
export async function barcodeSvg(text: string): Promise<string> {
  if (!text) return "";
  try {
    const mod: any = await import("bwip-js");
    const gen = mod.default ?? mod;
    return gen.toSVG({
      bcid: "code128",
      text,
      scale: 2,
      height: 8,
      includetext: false,
      paddingwidth: 0,
      paddingheight: 0,
    }) as string;
  } catch {
    return "";
  }
}
