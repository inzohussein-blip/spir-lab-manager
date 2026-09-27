/**
 * The project's own images (public/lab-images, listed at build time — next.config): the same on
 * every device and part of the app, so a record pointing to one needs no database. A record keeps
 * the image's path ("/lab-images/tubes/edta.jpg") where a stored image keeps its id.
 */
export interface StaticImage { path: string; caption: string }

export const STATIC_PREFIX = "/lab-images/";
export const isStaticImage = (id?: string) => !!id && id.startsWith(STATIC_PREFIX);

/** «tubes/edta-tube.jpg» → «edta tube» (the file name, readable). */
const captionOf = (path: string) =>
  decodeURIComponent(path.slice(STATIC_PREFIX.length)).replace(/\.[a-z0-9]+$/i, "").split("/").pop()!.replace(/[-_]+/g, " ").trim();

export const STATIC_IMAGES: StaticImage[] = (() => {
  try {
    const list = JSON.parse(process.env.LAB_STATIC_IMAGES || "[]") as unknown;
    return Array.isArray(list) ? list.filter((p): p is string => typeof p === "string" && isStaticImage(p)).map((path) => ({ path, caption: captionOf(path) })) : [];
  } catch { return []; }
})();
