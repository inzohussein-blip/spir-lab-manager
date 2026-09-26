// The site going down must not stop a lab: with the offline copy saved, the station keeps
// working while the server is (1) off, (2) answering every request with an error, (3) hanging.
// Starts its own server (needs a build: `npm run build`), on E2E_OUTAGE_PORT (default 3471).
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const { ok, launch, done, resetLocal, kv } = require('./lib.cjs');
const PORT = Number(process.env.E2E_OUTAGE_PORT || 3471);
const B = `http://localhost:${PORT}`;
const ROOT = path.join(__dirname, '..', '..');

function startNext() {
  const env = { ...process.env, PORT: String(PORT) };
  delete env.LICENSE_ADMIN_PASSWORD; // lab codes off: this is about the site being down
  const child = spawn(process.execPath, [require.resolve('next/dist/bin/next', { paths: [ROOT] }), 'start', '-p', String(PORT)], { cwd: ROOT, env, stdio: 'ignore' });
  return child;
}
async function waitUp() {
  for (let i = 0; i < 90; i++) {
    const up = await new Promise((res) => http.get(`${B}/welcome`, (r) => { r.resume(); res(r.statusCode === 200); }).on('error', () => res(false)));
    if (up) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}
const stop = (child) => new Promise((res) => { child.once('exit', res); child.kill('SIGTERM'); setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* gone */ } }, 5000); });
const listen = (handler) => new Promise((res) => { const s = http.createServer(handler); s.listen(PORT, () => res(s)); });
const close = (s) => new Promise((res) => { s.closeAllConnections?.(); s.close(() => res()); });

(async () => {
  let next = startNext();
  ok(await waitUp(), 'site started');
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 140))); p.on('dialog', (d) => d.accept());
  await p.goto(B + '/welcome'); await resetLocal(p, { 'local.activation.v1': 'legacy' }); await p.reload();
  let saved = null;
  for (let i = 0; i < 180 && !saved; i++) {
    await p.waitForTimeout(1000);
    saved = await p.evaluate(async () => { const m = await (await caches.open('local-meta')).match('/__local-meta'); return m ? (await m.json()).build : null; });
  }
  ok(!!saved, 'offline copy saved');
  // A visit entered while the site is up.
  await p.goto(B + '/station'); await p.waitForSelector('input[placeholder="ابحث عن فحص…"]', { timeout: 20000 });
  await p.locator('label:has-text("الاسم الثلاثي") input').fill('مراجع قبل التوقف');
  await p.fill('input[placeholder="ابحث عن فحص…"]', 'Glucose'); await p.waitForTimeout(100);
  await p.locator('div.grid button:has(span.flex-1)').first().click();
  await p.fill('input[placeholder="ابحث عن فحص…"]', ''); await p.locator('[data-result-idx="0"]').fill('95');
  await p.keyboard.press('Control+s'); await p.waitForTimeout(600);

  const works = async (label) => {
    const t0 = Date.now();
    await p.goto(B + '/station', { timeout: 30000 }).catch(() => {});
    const opened = await p.waitForSelector('input[placeholder="ابحث عن فحص…"]', { timeout: 20000 }).then(() => true, () => false);
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    ok(opened, `${label}: station opens (${secs} s)`);
    if (!opened) return;
    // Move to another page inside the station (client navigation falls back to the saved copy).
    await p.locator('a[href="/station/visits"]').first().click();
    const listed = await p.waitForSelector('text=مراجع قبل التوقف', { timeout: 20000 }).then(() => true, () => false);
    ok(listed, `${label}: visits page opens with the saved visit`);
    ok(((await kv(p, 'station.visits.v1')) || []).length >= 1, `${label}: data intact`);
  };

  await stop(next);
  await works('server off');

  const failing = await listen((req, res) => { res.writeHead(500, { 'content-type': 'text/html' }); res.end('<h1>Internal Server Error</h1>'); });
  await works('server answering 500');
  await close(failing);

  const hanging = await listen(() => { /* never answers */ });
  await works('server hanging');
  await close(hanging);

  // Back up: the station is served by the site again.
  next = startNext();
  ok(await waitUp(), 'site back up');
  await works('site back');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  await stop(next);
  done();
})().catch((e) => { console.error(e); process.exitCode = 1; process.exit(1); });
