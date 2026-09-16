/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  // PGlite ships a WASM Postgres; keep it (and node-postgres) out of the
  // bundler so they load as normal Node dependencies at runtime.
  experimental: {
    serverComponentsExternalPackages: [
      "@electric-sql/pglite",
      "pg",
      "@react-pdf/renderer",
    ],
    // The PGlite fallback reads these SQL files at runtime; make sure Vercel's
    // function bundle includes them (they aren't statically imported).
    outputFileTracingIncludes: {
      "/**": ["./supabase/migrations/**", "./supabase/seed.sql"],
    },
  },
};
export default nextConfig;
