// The failover Worker (deploy/failover-worker/worker.mjs) against two local servers standing in for
// the main site and its standby:  npm test
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { route, resetState, DOWN_MS } from "../deploy/failover-worker/worker.mjs";

const FRONT = "https://spir-lab.example.workers.dev";
const mode = { primary: "ok", backup: "ok" };
const seen = { primary: [], backup: [] };

function site(name) {
  return http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      seen[name].push({ method: req.method, url: req.url, body, fwdHost: req.headers["x-forwarded-host"] });
      const m = mode[name];
      if (m === "503") { res.writeHead(503); return res.end("down"); }
      if (m === "vercel-error") { res.writeHead(500, { "x-vercel-error": "FUNCTION_INVOCATION_FAILED" }); return res.end("crash"); }
      if (m === "app-500") { res.writeHead(500); return res.end("app error"); }
      if (req.url === "/go") { res.writeHead(307, { location: `http://127.0.0.1:${req.socket.localPort}/welcome?x=1` }); return res.end(); }
      res.writeHead(200, { "content-type": "text/plain", "set-cookie": "lab_session=abc; Path=/; HttpOnly" });
      res.end(`${name}:${req.method}:${body}`);
    });
  });
}
const servers = { primary: site("primary"), backup: site("backup") };
const env = {};
before(async () => {
  for (const [k, s] of Object.entries(servers)) await new Promise((r) => s.listen(0, "127.0.0.1", r));
  env.PRIMARY = `http://127.0.0.1:${servers.primary.address().port}`;
  env.BACKUP = `http://127.0.0.1:${servers.backup.address().port}/`;
});
after(() => { for (const s of Object.values(servers)) s.close(); });
beforeEach(() => { mode.primary = "ok"; mode.backup = "ok"; seen.primary = []; seen.backup = []; resetState(); });

const get = (path, now) => route(new Request(FRONT + path), env, now);

test("the main site answers while it is up", async () => {
  const r = await get("/station?a=1");
  assert.equal(r.status, 200);
  assert.equal(await r.text(), "primary:GET:");
  assert.equal(r.headers.get("x-served-by"), "primary");
  assert.equal(seen.primary[0].url, "/station?a=1");
  assert.equal(seen.primary[0].fwdHost, new URL(FRONT).host, "the app sees the Worker's address");
  assert.match(r.headers.get("set-cookie") ?? "", /lab_session=abc/, "the sign-in cookie reaches the browser");
});

test("a hosting error (503) goes to the standby", async () => {
  mode.primary = "503";
  const r = await get("/");
  assert.equal(await r.text(), "backup:GET:");
  assert.equal(r.headers.get("x-served-by"), "backup");
});

test("Vercel's own error page goes to the standby; the app's own error does not", async () => {
  mode.primary = "vercel-error";
  assert.equal(await (await get("/")).text(), "backup:GET:");
  resetState(); mode.primary = "app-500";
  const r = await get("/");
  assert.equal(r.status, 500);
  assert.equal(r.headers.get("x-served-by"), "primary");
  assert.equal(seen.backup.length, 1, "not sent to the standby");
});

test("a main site out of reach goes to the standby, which is then tried first for a while", async () => {
  const saved = env.PRIMARY;
  env.PRIMARY = "http://127.0.0.1:9"; // nothing listens there
  const t = Date.now();
  assert.equal(await (await get("/a", t)).text(), "backup:GET:");
  env.PRIMARY = saved;
  const r = await get("/b", t + 1000);
  assert.equal(r.headers.get("x-served-by"), "backup", "the standby first while the main site rests");
  const r2 = await get("/c", t + DOWN_MS + 1000);
  assert.equal(r2.headers.get("x-served-by"), "primary", "then the main site again");
});

test("a POST and its body reach the standby when the main site could not take it", async () => {
  mode.primary = "503";
  const r = await route(new Request(FRONT + "/api/x", { method: "POST", body: "hello", headers: { "content-type": "text/plain" } }), env);
  assert.equal(await r.text(), "backup:POST:hello");
  assert.equal(seen.primary[0].body, "hello");
});

test("a redirect keeps the Worker's address", async () => {
  const r = await get("/go");
  assert.equal(r.status, 307);
  assert.equal(r.headers.get("location"), FRONT + "/welcome?x=1");
});

test("both out of reach: a clear 503", async () => {
  const saved = { ...env };
  env.PRIMARY = "http://127.0.0.1:9"; env.BACKUP = "http://127.0.0.1:9";
  const r = await get("/");
  Object.assign(env, saved);
  assert.equal(r.status, 503);
});

test("/__failover reports both sites", async () => {
  mode.backup = "503";
  const r = await get("/__failover");
  const j = await r.json();
  assert.equal(j.primary.ok, true);
  assert.equal(j.backup.ok, false);
});
