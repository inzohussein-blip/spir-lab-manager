/* Offline service worker for the LOCAL stations only (welcome portal, lab station,
   purchasing, training, quality, staff). The admin panel keeps its own /sw.js.

   - Registered once per station scope; every registration shares one versioned cache,
     so the app is downloaded once.
   - On the first online visit the whole app (every station page + its scripts, styles,
     icons and the bundled Arabic font) is saved. After that pages open without internet.
   - Pages: online → the latest version from the server (so updates show at once);
     no internet, or no answer within a few seconds → the saved copy.
   - When online, a page asks for a check: if the server has a newer build it is
     downloaded in the background into a new cache, switched atomically, and the page
     is told an update is ready (the old version keeps working until then). */

const META_CACHE = "local-meta";
const PREFIX = "local-app-";
const BASES = ["/welcome", "/station", "/store", "/training", "/qc", "/roster"];
const ROUTES = [
  "/welcome",
  "/station", "/station/inventory", "/station/records", "/station/settings", "/station/tests", "/station/visits", "/station/page/_",
  "/store", "/store/report", "/store/settings", "/store/suppliers",
  "/training", "/training/cards", "/training/edit", "/training/exam", "/training/manual", "/training/map", "/training/media",
  "/training/quiz", "/training/settings", "/training/tools", "/training/trainees", "/training/tubes", "/training/test/_",
  "/qc", "/qc/analytes", "/qc/chart", "/qc/devices", "/qc/entry", "/qc/settings", "/qc/temps",
  "/roster", "/roster/attendance", "/roster/leaves", "/roster/payroll", "/roster/schedule", "/roster/settings", "/roster/staff",
];
// Pages with an id in the URL are client pages: one saved copy serves every id.
const TEMPLATES = [["/training/test/", "/training/test/_"], ["/station/page/", "/station/page/_"]];
const EXTRA = ["/lab-logo.png", "/icon.svg", "/icon-192.png", "/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// ── Meta: which cache holds the complete current version ─────────────────────
let metaMemo;
async function getMeta() {
  if (metaMemo !== undefined) return metaMemo;
  try {
    const r = await (await caches.open(META_CACHE)).match("/__local-meta");
    metaMemo = r ? await r.json() : null;
  } catch { metaMemo = null; }
  // The cache itself may have been cleared by the browser or another worker.
  if (metaMemo && !(await caches.has(metaMemo.cache))) metaMemo = null;
  return metaMemo;
}
async function setMeta(m) {
  metaMemo = m;
  await (await caches.open(META_CACHE)).put("/__local-meta", new Response(JSON.stringify(m), { headers: { "content-type": "application/json" } }));
}

const isLocal = (p) => BASES.some((b) => p === b || p.startsWith(b + "/"));
function pageKey(pathname) {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  for (const [prefix, tpl] of TEMPLATES) if (p.startsWith(prefix) && p.length > prefix.length) return tpl;
  return p;
}

// ── Fetch handling ───────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;

  // Client-side navigation data (RSC). Online: normal. Offline or very slow: fail fast,
  // so Next.js falls back to a full page load — which is then served from the cache.
  if (req.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) {
    event.respondWith(rscFetch(req));
    return;
  }
  if (req.mode === "navigate") {
    if (isLocal(url.pathname)) event.respondWith(navigate(req, url));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || EXTRA.includes(url.pathname)) {
    event.respondWith(cacheFirst(req));
  }
});

async function rscFetch(req) {
  if (self.navigator && self.navigator.onLine === false) return Response.error();
  try {
    return await Promise.race([
      fetch(req),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 4000)),
    ]);
  } catch {
    return Response.error();
  }
}

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);

async function navigate(req, url) {
  const meta = await getMeta();
  const cached = meta ? await (await caches.open(meta.cache)).match(pageKey(url.pathname)) : undefined;
  if (!(self.navigator && self.navigator.onLine === false)) {
    try {
      // With a saved copy, don't keep the user waiting on a slow connection.
      const res = await withTimeout(fetch(req), cached ? 3000 : 20000);
      if (res.ok || res.type === "opaqueredirect" || !cached) return res;
    } catch { /* offline or too slow → saved copy */ }
  }
  if (cached) return cached;
  try {
    return await fetch(req);
  } catch {
    if (meta) {
      const home = await (await caches.open(meta.cache)).match("/welcome");
      if (home) return home;
    }
    return new Response(
      '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>بدون إنترنت</title>' +
      '<body style="font-family:system-ui;padding:40px;text-align:center;color:#334155"><h2>لا يوجد اتصال بالإنترنت</h2>' +
      "<p>لم تُجهَّز المحطات للعمل بدون إنترنت على هذا الجهاز بعد. افتحها مرة واحدة مع الإنترنت ثم ستعمل بدونه.</p></body></html>",
      { status: 503, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }
}

async function cacheFirst(req, cacheName) {
  const hit = await caches.match(req, { ignoreVary: true });
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok || res.type === "opaque") {
      const name = cacheName || (await getMeta())?.cache;
      if (name) (await caches.open(name)).put(req, res.clone()).catch(() => {});
    }
    return res;
  } catch {
    return Response.error();
  }
}

// ── Prepare / update on request from a page ──────────────────────────────────
let running = null;
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "local-prepare") return;
  const source = event.source;
  const tell = (msg) => { try { source && source.postMessage({ type: "local-offline", ...msg }); } catch { /* page gone */ } };
  running = running || prepare(tell).finally(() => { running = null; });
  event.waitUntil(running.then((r) => tell(r)));
});

const buildIdOf = (html) => {
  const m = /buildId\\?"\s*:\s*\\?"([^"\\]+)/.exec(html);
  return m ? m[1] : null;
};

async function prepare(tell) {
  const meta = await getMeta();
  let first;
  try {
    const res = await fetch("/welcome", { cache: "no-store", credentials: "same-origin" });
    if (!res.ok) throw new Error("status " + res.status);
    first = await res.text();
  } catch {
    return { status: meta ? "ready" : "offline" }; // offline: keep using what we have
  }
  const build = buildIdOf(first);
  if (!build) return { status: meta ? "ready" : "error" };
  if (meta && meta.build === build) return { status: "ready" };

  const name = PREFIX + build;
  const cache = await caches.open(name);
  const assets = new Set();
  const collect = (text) => {
    for (const m of text.matchAll(/\/_next\/static\/[^"'\\\s)]+/g)) assets.add(m[0]);
  };
  const store = async (key, res) => {
    // Re-wrap with a clean header set: never keep a "redirected" response or a stale
    // content-encoding for a body that is already decoded.
    const body = await res.blob();
    await cache.put(key, new Response(body, { status: 200, headers: { "content-type": res.headers.get("content-type") || "text/html; charset=utf-8" } }));
  };
  try {
    const total = ROUTES.length;
    for (let i = 0; i < ROUTES.length; i++) {
      const path = ROUTES[i];
      const res = path === "/welcome" ? new Response(first, { headers: { "content-type": "text/html; charset=utf-8" } })
        : await fetch(path, { cache: "no-store", credentials: "same-origin" });
      if (!res.ok || res.redirected) throw new Error(path + " → " + res.status);
      const html = await res.clone().text();
      if (buildIdOf(html) !== build) throw new Error("build changed during download");
      collect(html);
      await store(path, res);
      if (!meta) tell({ status: "progress", done: i + 1, total });
    }
    // Scripts, styles and anything they reference; hashed files are immutable, so
    // reuse copies from the previous version instead of downloading them again.
    const queue = [...assets];
    for (let i = 0; i < queue.length; i++) {
      const u = queue[i];
      let res = await caches.match(u);
      if (!res) {
        res = await fetch(u, { credentials: "same-origin" });
        if (!res.ok) throw new Error(u + " → " + res.status);
      }
      await cache.put(u, res.clone());
      if (u.endsWith(".css")) {
        const css = await res.text();
        for (const m of css.matchAll(/url\((\/_next\/static\/[^)"']+)\)/g)) if (!assets.has(m[1])) { assets.add(m[1]); queue.push(m[1]); }
      }
      if (/\/webpack-[^/]+\.js$/.test(u)) {
        // Lazily loaded chunks (e.g. the barcode library) are listed in the webpack runtime.
        const js = await res.text();
        const m = /"static\/chunks\/"\+\((\{[^}]*\})\)\[e\]\+"\."\+\((\{[^}]*\})\)\[e\]\+"\.js"/.exec(js);
        if (m) {
          const toMap = (s) => Object.fromEntries([...s.matchAll(/(\d+):"([^"]+)"/g)].map((x) => [x[1], x[2]]));
          const names = toMap(m[1]), hashes = toMap(m[2]);
          for (const id of Object.keys(hashes)) {
            const lazy = `/_next/static/chunks/${names[id] || id}.${hashes[id]}.js`;
            if (!assets.has(lazy)) { assets.add(lazy); queue.push(lazy); }
          }
        }
      }
    }
    for (const u of EXTRA) {
      try { const r = await fetch(u); if (r.ok) await cache.put(u, r); } catch { /* optional */ }
    }
  } catch (e) {
    await caches.delete(name);
    // Keep the previous saved version; the next page open simply tries again.
    return { status: meta ? "update-failed" : "error", error: String(e && e.message || e) };
  }

  await setMeta({ cache: name, build, at: Date.now() });
  for (const k of await caches.keys()) if ((k.startsWith(PREFIX) && k !== name) || k === "local-fonts") await caches.delete(k);
  return { status: meta ? "updated" : "installed", build };
}
