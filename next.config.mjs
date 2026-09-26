import { randomBytes } from "node:crypto";

// One id per build, written into every page as <meta name="lab-build">: the stations'
// offline copy (public/local-sw.js) compares it to know when a newer version is out.
const LAB_BUILD = process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || randomBytes(8).toString("hex");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: { LAB_BUILD },
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
