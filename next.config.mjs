import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";

// One id per version of the code, written into every page as <meta name="lab-build">: the
// stations' offline copy (public/local-sw.js) compares it to know when a newer version is out.
// It is worked out from the code itself (and the NEXT_PUBLIC_ settings), so the main site
// (Vercel) and the standby one (Firebase, docs/FIREBASE_STANDBY.md) built from the same commit
// carry the same id: switching between them is not taken for an update. LAB_BUILD overrides it.
const LAB_BUILD = (process.env.LAB_BUILD ?? "").trim() || (() => {
  const h = createHash("sha256");
  // Only the NEXT_PUBLIC_ settings the code uses, and only when set: the ones a host adds by itself
  // (Vercel's NEXT_PUBLIC_VERCEL_URL changes with every deployment) would give each site its own id.
  const used = new Set();
  const walk = (p) => {
    if (!existsSync(p)) return;
    if (statSync(p).isDirectory()) { for (const f of readdirSync(p).sort()) walk(`${p}/${f}`); return; }
    const data = readFileSync(p);
    h.update(p); h.update(data);
    if (p.startsWith("src/")) for (const m of data.toString("latin1").matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) used.add(m[0]);
  };
  for (const p of ["src", "public", "supabase", "package-lock.json", "next.config.mjs"]) walk(p);
  for (const k of [...used].sort()) if (process.env[k]) h.update(`${k}=${process.env[k]}`);
  return h.digest("hex").slice(0, 16);
})();
// The version people see (welcome page, code manager): when this build was made, Baghdad time.
const LAB_VERSION = (() => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baghdad", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const v = (t) => parts.find((x) => x.type === t).value;
  return `${v("year")}.${v("month")}.${v("day")}-${v("hour")}${v("minute")}`;
})();

// Images placed in public/lab-images (sub-folders allowed) become the project's image library:
// the same on every device, part of the app (and of its offline copy), no database needed.
const LAB_STATIC_IMAGES = (() => {
  const dir = "public/lab-images";
  if (!existsSync(dir)) return "[]";
  const files = readdirSync(dir, { recursive: true }).map(String)
    .filter((f) => /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(f))
    .map((f) => "/lab-images/" + f.split("\\").join("/"))
    .sort((a, b) => a.localeCompare(b));
  return JSON.stringify(files);
})();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: { LAB_BUILD, LAB_VERSION, LAB_STATIC_IMAGES },
  // The same id for Next's own files, so a page from one site keeps working on the other.
  generateBuildId: async () => LAB_BUILD,
  // PGlite ships a WASM Postgres; keep it (and node-postgres) out of the
  // bundler so they load as normal Node dependencies at runtime.
  serverExternalPackages: [
    "@electric-sql/pglite",
    "pg",
    "@react-pdf/renderer",
    "bwip-js",
  ],
  // The PGlite fallback reads these SQL files at runtime; make sure Vercel's
  // function bundle includes them (they aren't statically imported).
  outputFileTracingIncludes: {
    "/**": ["./supabase/migrations/**", "./supabase/seed.sql"],
  },
  // The code manager's address is /license; the old /licenses still leads there.
  async redirects() {
    return [{ source: "/licenses", destination: "/license", permanent: false }];
  },
  // Basic protection for every page: no framing by other sites (e.g. the code manager inside a
  // trap page), no guessing of file types, and only the site's address sent on outgoing links.
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    }];
  },
};
export default nextConfig;
