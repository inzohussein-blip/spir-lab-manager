import { randomBytes } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";

// One id per build, written into every page as <meta name="lab-build">: the stations'
// offline copy (public/local-sw.js) compares it to know when a newer version is out.
const LAB_BUILD = process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || randomBytes(8).toString("hex");
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
};
export default nextConfig;
