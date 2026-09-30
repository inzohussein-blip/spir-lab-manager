// «المزامنة التلقائية» of a lab's computers (switched on in «محطة المزامنة»): two computers of lab A
// exchange their stock items through A's own database; lab B's computer never sees them, and A's
// never see B's. The server serves only a device presenting its signed license: a code and a device
// id alone, or another lab's license, get nothing. A sync file of lab B does not go into lab A's
// computer. A lab without a database of its own is told to link one.
const { B, OWNER, ok, launch, done, kv } = require('./lib.cjs');
const { PG, freshDb, waitFor } = require('./pgfake.cjs');
const HDR = { 'x-forwarded-for': '10.20.30.47' };
const TAG = Date.now().toString(36);
const A = 'مختبر أ ' + TAG, BB = 'مختبر ب ' + TAG;

(async () => {
  if (!PG) { console.log('SKIP codes.companysync.cjs — set E2E_PG_URL'); ok(!process.env.CI, 'E2E_PG_URL is set in CI'); return done(); }
  const dbA = await freshDb('cosynca'), dbB = await freshDb('cosyncb');
  const b = await launch();
  const errs = [];
  const o = await (await b.newContext({ extraHTTPHeaders: HDR })).newPage();
  await o.goto(B + '/licenses');
  const api = (body) => o.evaluate(async (body) => (await fetch('/api/license/admin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(), body);
  ok((await api({ op: 'login', password: OWNER })).ok === true, 'owner signs in');
  // Two computers on one code need «حساب واحد بعدة أجهزة» (put back as it was at the end).
  const prefsBefore = (await o.evaluate(async () => (await fetch('/api/license/admin')).json())).prefs;
  await api({ op: 'prefs', prefs: { ...prefsBefore, multiDevice: true } });
  const ca = await api({ op: 'create', lab: A, days: 30, maxDevices: 2 });
  const cb = await api({ op: 'create', lab: BB, days: 30 });
  const cc = await api({ op: 'create', lab: 'مختبر ج ' + TAG, days: 30 });
  ok(!!ca.code && !!cb.code && !!cc.code, 'lab A (2 computers), lab B, and lab C (no database yet)');
  const linkA = await api({ op: 'admin_db_set', id: ca.row.id, conn: dbA.url, first: { username: 'admin', password: 'pass-a-1' } });
  const linkB = await api({ op: 'admin_db_set', id: cb.row.id, conn: dbB.url, first: { username: 'admin', password: 'pass-b-1' } });
  ok(linkA.ok && linkB.ok, 'A and B each link a database of their own');

  const computer = async (code, name) => {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, extraHTTPHeaders: HDR, acceptDownloads: true });
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(`${name} ${e.message.slice(0, 140)}`)); p.on('dialog', (d) => d.accept());
    await p.goto(B + '/welcome'); await p.waitForSelector('input[aria-label="رمز المختبر"]', { timeout: 20000 });
    await p.fill('input[aria-label="رمز المختبر"]', code); await p.click('button:has-text("تفعيل")'); await p.waitForTimeout(1500);
    return p;
  };
  const addStock = async (p, name) => {
    await p.goto(B + '/store/inventory'); await p.waitForSelector('label:has-text("اسم الصنف") input', { timeout: 20000 });
    await p.fill('label:has-text("اسم الصنف") input', name); await p.fill('input[aria-label="الكمية"]', '3');
    await p.click('button:has-text("إضافة")'); await p.waitForTimeout(500);
  };
  const a1 = await computer(ca.code, 'a1'), a2 = await computer(ca.code, 'a2'), b1 = await computer(cb.code, 'b1');
  const SA1 = `صنف أ1 ${TAG}`, SA2 = `صنف أ2 ${TAG}`, SB = `صنف ب ${TAG}`;
  await addStock(a1, SA1); await addStock(a2, SA2); await addStock(b1, SB);

  const items = async (p) => ((await kv(p, 'station.stock.v1')) || []).map((s) => s.name);
  const switchOn = async (p) => {
    await p.goto(B + '/sync/auto'); await p.waitForSelector('[data-testid="company-sync"]', { timeout: 20000 });
    await p.check('input[aria-label="المزامنة التلقائية"]');
    return waitFor(async () => (await p.getAttribute('[data-testid="company-sync"]', 'data-state')) === 'ok', 30000);
  };
  const syncNow = async (p) => {
    await p.goto(B + '/sync/auto'); await p.waitForSelector('[data-testid="company-sync-now"]', { timeout: 20000 });
    await p.click('[data-testid="company-sync-now"]');
    await waitFor(async () => (await p.getAttribute('[data-testid="company-sync"]', 'data-state')) === 'ok', 30000);
  };
  ok(!!(await switchOn(a1)), 'A1: automatic sync on → synced');
  ok(!!(await switchOn(a2)), 'A2: on → synced');
  ok(!!(await switchOn(b1)), 'B1: on → synced');
  await syncNow(a1); await syncNow(a2); await syncNow(b1);

  const l1 = await items(a1), l2 = await items(a2), lb = await items(b1);
  ok(l1.includes(SA2) && l2.includes(SA1), 'A1 and A2 have each other\'s stock items');
  ok(!lb.includes(SA1) && !lb.includes(SA2), 'lab B\'s computer has none of A\'s records');
  ok(!l1.includes(SB) && !l2.includes(SB), 'lab A\'s computers have none of B\'s');

  // ── The server: signed license only, and only its own lab ──
  const proof = (p) => p.evaluate(() => { const s = JSON.parse(localStorage.getItem('local.license.v1') || 'null'); const dev = localStorage.getItem('local.device.v1'); return { token: s && s.token, device: dev }; });
  const post = (p, url, body) => p.evaluate(async ([url, body]) => { const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json().catch(() => null) }; }, [url, body]);
  const pa = await proof(a1), pb = await proof(b1);
  ok(!!pa.token && !!pb.token && !!pa.device, 'devices hold signed licenses');
  const noTok = await post(b1, '/api/company-sync', { op: 'pull', since: 0, node: 'x', lid: ca.row.id, device: pa.device });
  ok(noTok.status === 403, `a code and device id without the license get nothing (${noTok.status})`);
  const mixed = await post(b1, '/api/company-sync', { op: 'pull', since: 0, node: 'x', token: pb.token, device: pa.device });
  ok(mixed.status === 403, 'B\'s license with A\'s device id gets nothing');
  const forged = await post(b1, '/api/company-sync', { op: 'pull', since: 0, node: 'x', token: pa.token.slice(0, -4) + 'AAAA', device: pa.device });
  ok(forged.status === 403, 'an altered license gets nothing');
  const own = await post(b1, '/api/company-sync', { op: 'pull', since: 0, node: 'x', token: pb.token, device: pb.device });
  const txt = JSON.stringify(own.body);
  ok(own.status === 200 && txt.includes(SB) && !txt.includes(SA1) && !txt.includes(SA2), 'B\'s license reads only B\'s records');

  // ── Files: B's sync file does not go into A's computer ──
  await b1.goto(B + '/sync/file'); await b1.waitForSelector('[data-testid="sync-export"]', { timeout: 20000 });
  const [dl] = await Promise.all([b1.waitForEvent('download'), b1.click('[data-testid="sync-export"]')]);
  await a1.goto(B + '/sync/file'); await a1.waitForSelector('[data-testid="sync-export"]', { timeout: 20000 });
  await a1.setInputFiles('[data-testid="sync-file"]', await dl.path());
  await a1.waitForSelector('[data-testid="sync-apply"]', { timeout: 15000 }); await a1.click('[data-testid="sync-apply"]');
  await a1.waitForSelector('[data-testid="sync-result"]', { timeout: 15000 });
  ok((await a1.getByTestId('sync-result').innerText()).includes('مختبر آخر') && !(await items(a1)).includes(SB), 'lab B\'s sync file is refused on lab A\'s computer');

  // ── Lab C has no database of its own: told to link one ──
  const c1 = await computer(cc.code, 'c1');
  await c1.goto(B + '/sync/auto'); await c1.waitForSelector('[data-testid="company-sync"]', { timeout: 20000 });
  await c1.check('input[aria-label="المزامنة التلقائية"]');
  ok(!!(await waitFor(async () => (await c1.getByTestId('company-sync-state').innerText().catch(() => '')).includes('لم يربط قاعدة بياناته'), 30000)), 'lab C (no database): told to link its own database');
  ok((await dbA.query(`select count(*)::int as n from lab_sync_records`))[0].n > 0 && (await dbB.query(`select count(*)::int as n from lab_sync_records`))[0].n > 0, 'A\'s and B\'s records are in their own databases');

  // ── Switched off: this computer stops, its data stays ──
  await a2.goto(B + '/sync/auto'); await a2.waitForSelector('[data-testid="company-sync"]', { timeout: 20000 });
  await a2.uncheck('input[aria-label="المزامنة التلقائية"]'); await a2.waitForTimeout(800);
  ok((await a2.getAttribute('[data-testid="company-sync"]', 'data-state')) === 'off' && (await items(a2)).includes(SA1), 'switched off: its records stay');

  await api({ op: 'prefs', prefs: prefsBefore });
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  for (const d of [dbA, dbB]) await d.drop().catch(() => {});
  done();
})().catch((e) => { console.error(e); process.exit(1); });
