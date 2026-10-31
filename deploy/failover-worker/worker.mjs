/**
 * One address in front of several copies of the site (docs/NETLIFY_STANDBY.md): every request goes
 * to the main site (PRIMARY, e.g. Vercel) and, when it does not answer, to the standby (BACKUP, e.g.
 * Netlify), then to the second standby (BACKUP2, e.g. your own computer or a rented server —
 * docs/SELF_HOST_STANDBY.md). Clients keep the Worker's address, so what each browser keeps (the
 * stations' data, the device's activation, the sign-in) stays where it is whichever site answers.
 *
 * Runs on Cloudflare Workers (free plan: a *.workers.dev address, 100,000 requests a day).
 * Settings (Worker → Settings → Variables): PRIMARY, BACKUP and (optional) BACKUP2 — the sites' addresses.
 *
 * When does it switch? When a site cannot be reached, takes longer than TIMEOUT_MS to start
 * answering, or answers with a hosting error (502 / 503 / 504, or Vercel's own error page). A page
 * error of the app itself (any other status) is passed on as it is: the standby, with the same code
 * and database, would give the same answer. A site that failed is tried last for DOWN_MS, then in
 * its place again.
 *
 * A POST (saving, signing in…) goes to the next site only when the one before could not have taken
 * it: no connection, or a hosting error. After a timeout it is not sent twice.
 */

export const TIMEOUT_MS = 15_000;
export const DOWN_MS = 60_000;
const RETRY_STATUS = new Set([502, 503, 504]);

/** Each site's last failure (per Worker instance; each instance learns on its own). */
let downUntil = {};
export const resetState = () => { downUntil = {}; };

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
  const front = new URL(req.url);
  const sites = [["primary", trim(env.PRIMARY)], ["backup", trim(env.BACKUP)], ["backup2", trim(env.BACKUP2)]].filter(([, o]) => o);
  if (!trim(env.PRIMARY)) return new Response("PRIMARY is not set (Worker → Settings → Variables).", { status: 500 });
  const resting = (name) => now < (downUntil[name] ?? 0);

  // Which site answers now, all of them at once (for the owner, and for an uptime monitor).
  if (front.pathname === "/__failover") {
    const probe = async (o) => {
      const t = Date.now();
      try { const r = await fetch(o + "/api/time", { signal: AbortSignal.timeout(8000) }); return { ok: r.ok, status: r.status, ms: Date.now() - t }; }
      catch (e) { return { ok: false, error: String(e && e.name || e), ms: Date.now() - t }; }
    };
    const out = { primary: null, backup: null };
    await Promise.all(sites.map(async ([name, o]) => { out[name] = { ...(await probe(o)), resting: resting(name) }; }));
    return Response.json({ ...out, primaryResting: resting("primary") }, { headers: { "cache-control": "no-store" } });
  }

  const safe = req.method === "GET" || req.method === "HEAD";
  // The body is read once so it can be sent again to the next site.
  const body = safe ? undefined : await req.arrayBuffer();
  // The sites in their order, the ones that failed lately at the end.
  const order = [...sites.filter(([n]) => !resting(n)), ...sites.filter(([n]) => resting(n))];
  let last = null;
  for (let i = 0; i < order.length; i++) {
    const [served, origin] = order[i];
    const isLast = i === order.length - 1;
    try {
      const res = await forward(origin, req, body, front, TIMEOUT_MS);
      if (!hostingFailed(res)) {
        downUntil[served] = 0;
        return relay(res, origin, front, served);
      }
      downUntil[served] = now + DOWN_MS;
      if (isLast) return relay(res, origin, front, served);
      last = [res, origin, served];
    } catch (e) {
      downUntil[served] = now + DOWN_MS;
      // A POST that timed out may have been done already: not sent again.
      const timedOut = e === "timeout" || (e && (e.name === "AbortError" || e.name === "TimeoutError"));
      if (!safe && timedOut) return new Response("The site took too long to answer. Check before trying again.", { status: 504, headers: { "x-served-by": served } });
      if (isLast) {
        if (last) return relay(last[0], last[1], front, last[2]);
        return new Response("Every copy of the site is out of reach. The stations keep working on this device.", { status: 503, headers: { "retry-after": "30", "x-served-by": served } });
      }
    }
  }
  return new Response("No site answered.", { status: 503 });
}

export default {
  fetch: (req, env) => route(req, env),
};
