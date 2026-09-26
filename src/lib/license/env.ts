/**
 * Lab-code switches read from the environment — edge-safe (used by the middleware too).
 */
// ── Where the codes live ─────────────────────────────────────────────────────
// A database of their own (Vercel → Storage → Neon, prefix "LICENSE" → LICENSE_URL, or
// LICENSE_DATABASE_URL), so the codes never touch the admin panel's data. Without one they
// use the app database (DATABASE_URL) — or, locally only, the embedded demo database.
export function licenseDbUrl(): string {
  for (const k of ["LICENSE_DATABASE_URL", "LICENSE_URL", "LICENSE__URL"]) {
    const v = (process.env[k] ?? "").trim();
    if (/^postgres(ql)?:\/\//.test(v)) return v;
  }
  // Other names the integration may create: prefer the pooled connection, skip variants for other tools.
  const found = Object.entries(process.env)
    .filter(([k, v]) => /^LICENSE.*_URL/.test(k) && !/NO_SSL|PRISMA/.test(k) && /^postgres(ql)?:\/\//.test((v ?? "").trim()))
    .sort(([a], [b]) => Number(/UNPOOLED|NON_POOLING/.test(a)) - Number(/UNPOOLED|NON_POOLING/.test(b)));
  return found[0]?.[1]?.trim() ?? "";
}
/** Which database holds the codes (for the owner's status panel — never the address itself). */
export function licenseStorage(): "license-db" | "app-db" | "embedded" {
  if (licenseDbUrl()) return "license-db";
  return (process.env.DATABASE_URL ?? "").trim() ? "app-db" : "embedded";
}
/** Codes need a database that survives restarts; on Vercel the embedded one does not. */
export const durableStorage = () => !!licenseDbUrl() || !!(process.env.DATABASE_URL ?? "").trim() || !process.env.VERCEL;
export const passwordSet = () => !!(process.env.LICENSE_ADMIN_PASSWORD ?? "").trim();
/** On only with the owner's password AND durable storage — never locks devices on a throw-away database. */
export const licensingEnabled = () => passwordSet() && durableStorage();
