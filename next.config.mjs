import { randomBytes } from "node:crypto";

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

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: { LAB_BUILD, LAB_VERSION },
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
