/**
 * The id of the version the site serves (<meta name="lab-build">), as plain text. Made once at
 * build time and served as a static file, so the stations' offline copy (public/local-sw.js) asks
 * «is there a newer version?» without running anything on the server.
 */
export const dynamic = "force-static";

export function GET() {
  return new Response(process.env.LAB_BUILD ?? "", { headers: { "content-type": "text/plain; charset=utf-8" } });
}
