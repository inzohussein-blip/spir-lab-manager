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
  },
};
export default nextConfig;
