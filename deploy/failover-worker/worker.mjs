/**
 * One address in front of two copies of the site (docs/NETLIFY_STANDBY.md): every request goes to
 * the main site (PRIMARY, e.g. Vercel) and, when it does not answer, to the standby (BACKUP, e.g.
 * Netlify). Clients keep the Worker's address, so what each browser keeps (the stations' data, the
 * device's activation, the sign-in) stays where it is whichever site answers.
 *
 * Runs on Cloudflare Workers (free plan: a *.workers.dev address, 100,000 requests a day).
 * Settings (Worker → Settings → Variables): PRIMARY and BACKUP — the two sites' addresses.
 *
 * When does it switch? When the main site cannot be reached, takes longer than TIMEOUT_MS to start
 * answering, or answers with a hosting error (502 / 503 / 504, or Vercel's own error page). A page
 * error of the app itself (any other status) is passed on as it is: the standby, with the same code
 * and database, would give the same answer. After a failure the standby is tried first for
 * DOWN_MS, then the main site again.
 *
 * A POST (saving, signing in…) goes to the standby only when the main site could not have taken it:
 * no connection, or a hosting error. After a timeout it is not sent twice.
 */

export const TIMEOUT_MS = 15_000;
export const DOWN_MS = 60_000;
const RETRY_STATUS = new Set([502, 503, 504]);

/** The main site's last failure (per Worker instance; each instance learns on its own). */
let primaryDownUntil = 0;
export const resetState = () => { primaryDownUntil = 0; };

const trim = (u) => String(u || "").trim().replace(/\/+$/, "");

/** Whether an answer is the hosting failing (not the app answering). */
function hostingFailed(res) {
  if (RETRY_STATUS.has(res.status)) return true;
  // Vercel's own errors (function crashed or timed out, deployment missing…) carry x-vercel-error.
  return res.status >= 500 && res.headers.has("x-vercel-error");
}

async function forward(origin, req, body, front, timeoutMs) {
  const url = new URL(req.url);
  const target = new URL(url.pathname + url.search, origin);
  const headers = new Headers(req.headers);
  headers.delete("host");
  // The app builds its own links (the report's QR, WhatsApp notices) from these.
  headers.set("x-forwarded-host", front.host);
  headers.set("x-forwarded-proto", front.protocol.replace(":", ""));
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort("timeout"), timeoutMs);
  try {
    return await fetch(target, { method: req.method, headers, body, redirect: "manual", signal: ctl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** The answer as the browser should see it: links back to the site keep the Worker's address. */
function relay(res, origin, front, served) {
  const out = new Response(res.body, res);
  const loc = out.headers.get("location");
  if (loc) {
    try {
      const l = new URL(loc, origin);
      if (l.origin === new URL(origin).origin) out.headers.set("location", front.origin + l.pathname + l.search + l.hash);
    } catch { /* leave it */ }
  }
  out.headers.set("x-served-by", served);
  return out;
}

export async function route(req, env, now = Date.now()) {
  const primary = trim(env.PRIMARY), backup = trim(env.BACKUP);
  const front = new URL(req.url);
  if (!primary) return new Response("PRIMARY is not set (Worker → Settings → Variables).", { status: 500 });

  // Which site answers now, both of them at once (for the owner, and for an uptime monitor).
  if (front.pathname === "/__failover") {
    const probe = async (o) => {
      if (!o) return null;
      const t = Date.now();
      try { const r = await fetch(o + "/api/time", { signal: AbortSignal.timeout(8000) }); return { ok: r.ok, status: r.status, ms: Date.now() - t }; }
      catch (e) { return { ok: false, error: String(e && e.name || e), ms: Date.now() - t }; }
    };
    const [p, b] = await Promise.all([probe(primary), probe(backup)]);
    return Response.json({ primary: p, backup: b, primaryResting: now < primaryDownUntil }, { headers: { "cache-control": "no-store" } });
  }

  const safe = req.method === "GET" || req.method === "HEAD";
  // The body is read once so it can be sent again to the standby.
  const body = safe ? undefined : await req.arrayBuffer();
  const order = backup && now < primaryDownUntil ? [[backup, "backup"], [primary, "primary"]] : [[primary, "primary"], [backup, "backup"]];
  let last = null;
  for (let i = 0; i < order.length; i++) {
    const [origin, served] = order[i];
    if (!origin) continue;
    const isLast = i === order.length - 1 || !order[i + 1][0];
    try {
      const res = await forward(origin, req, body, front, TIMEOUT_MS);
      if (!hostingFailed(res) || isLast) {
        if (served === "primary" && !hostingFailed(res)) primaryDownUntil = 0;
        return relay(res, origin, front, served);
      }
      if (served === "primary") primaryDownUntil = now + DOWN_MS;
      last = res;
    } catch (e) {
      if (served === "primary") primaryDownUntil = now + DOWN_MS;
      // A POST that timed out may have been done already: not sent again.
      const timedOut = e === "timeout" || (e && (e.name === "AbortError" || e.name === "TimeoutError"));
      if (!safe && timedOut) return new Response("The site took too long to answer. Check before trying again.", { status: 504, headers: { "x-served-by": served } });
      if (isLast) return new Response("Both copies of the site are out of reach. The stations keep working on this device.", { status: 503, headers: { "retry-after": "30", "x-served-by": served } });
    }
  }
  return last ? relay(last, order[order.length - 1][0], front, "backup") : new Response("No site answered.", { status: 503 });
}

export default {
  fetch: (req, env) => route(req, env),
};
