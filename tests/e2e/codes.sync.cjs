// Lab database through PostgreSQL, linked by the owner in /license (and by a lab from its own
// settings): the connection string stays sealed on the server, the lab's devices share visits
// through it, and only a device holding the lab's code is served.
const { B, OWNER, ok, launch, done, kv } = require('./lib.cjs');
const { PG, freshDb, waitFor } = require('./pgfake.cjs');
const HDR = { 'x-forwarded-for': '10.20.30.42' }; // own address: codes.manager trips the attempt limit
const LAB = 'مختبر المزامنة ' + Date.now().toString(36);

(async () => {
  if (process.env.E2E_STATION_SYNC !== '1') { console.log('SKIP codes.sync.cjs — station sync is off (build with NEXT_PUBLIC_STATION_SYNC=1, run with E2E_STATION_SYNC=1)'); return done(); }
  if (!PG) { console.log('SKIP codes.sync.cjs — set E2E_PG_URL'); ok(!process.env.CI, 'E2E_PG_URL is set in CI'); return done(); }
  const db = await freshDb('pgsync');
  const pgPass = new URL(PG).password;
  const b = await launch();
  const errs = [];
  const o = await (await b.newContext({ viewport: { width: 1300, height: 950 }, extraHTTPHeaders: HDR })).newPage();
  o.on('dialog', (d) => d.accept());
  await o.goto(B + '/license');
  const api = (body) => o.evaluate(async (body) => (await fetch('/api/license/admin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(), body);
  ok((await api({ op: 'login', password: OWNER })).ok === true, 'owner signs in');
  const c1 = await api({ op: 'create', lab: `${LAB} — الاستقبال`, days: 30 });
  const c2 = await api({ op: 'create', lab: `${LAB} — المختبر`, days: 30 });
  ok(!!c1.code && !!c2.code, 'two codes for the lab\'s two devices');

  // ── Owner links the first code (wrong details are explained), then the second to the same database ──
  await o.goto(B + '/license'); await o.waitForSelector(`div[data-lab="${LAB} — الاستقبال"]`, { timeout: 15000 });
  const card1 = o.locator(`div[data-lab="${LAB} — الاستقبال"]`), card2 = o.locator(`div[data-lab="${LAB} — المختبر"]`);
  ok((await card1.locator('[data-testid="lab-db"]').innerText()).includes('على الجهاز فقط'), 'a new code: data on the device only');
  await card1.locator('button[aria-label="قاعدة بيانات المختبر"]').click();
  const modal = o.locator('[data-testid="db-modal"]');
  await modal.locator('button:has-text("PostgreSQL")').click();
  const bad = new URL(db.url); bad.password = 'wrong-pass';
  await modal.locator('input[aria-label="رابط الاتصال"]').fill(bad.toString());
  await modal.locator('button:has-text("اختبار الاتصال")').click();
  ok(((await waitFor(() => modal.locator('[data-testid="db-msg"]').innerText(), 15000)) || '').includes('تعذّر الدخول'), 'wrong password → «تعذّر الدخول»');
  await modal.locator('input[aria-label="رابط الاتصال"]').fill(db.url);
  await modal.locator('button:has-text("اختبار الاتصال")').click();
  ok(((await waitFor(async () => { const t = await modal.locator('[data-testid="db-msg"]').innerText(); return t.includes('يعمل') && t; }, 15000)) || '').includes('0 سجلاً'), 'test: the connection works (empty database, table created)');
  await modal.locator('button:has-text("حفظ وربط")').click();
  await waitFor(async () => (await card1.locator('[data-testid="lab-db"]').innerText()).includes('PostgreSQL'), 15000);
  ok((await card1.locator('[data-testid="lab-db"]').innerText()).includes('PostgreSQL'), 'code 1 linked to PostgreSQL');
  await card2.locator('button[aria-label="قاعدة بيانات المختبر"]').click();
  const fromId = await modal.locator('select[aria-label="نسخ من رمز"] option', { hasText: `${LAB} — الاستقبال` }).getAttribute('value');
  await modal.locator('select[aria-label="نسخ من رمز"]').selectOption(fromId);
  await modal.locator('button:has-text("ربط بها")').click();
  await waitFor(async () => (await card2.locator('[data-testid="lab-db"]').innerText()).includes('PostgreSQL'), 15000);
  ok((await card2.locator('[data-testid="lab-db"]').innerText()).includes('PostgreSQL'), 'code 2 linked to the same database («ربط بها»)');
  const got = await api({ op: 'sync_get', id: c1.row.id });
  ok(got.config?.kind === 'postgres' && !JSON.stringify(got).includes(pgPass), `the owner page never gets the connection string back (${got.config?.host})`);
  const backup = JSON.stringify((await api({ op: 'backup' })).backup);
  ok(backup.includes('sync_config') && !backup.includes(pgPass) && !backup.includes(db.url), 'codes backup keeps the link sealed (no password in the file)');

  // ── Device 1: activates, works, uploads (empty database) ──
  const device = async (code, name) => {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, extraHTTPHeaders: HDR });
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(`${name} ${e.message.slice(0, 140)}`)); p.on('dialog', (d) => d.accept());
    await p.goto(B + '/welcome'); await p.waitForSelector('input[aria-label="رمز المختبر"]', { timeout: 20000 });
    await p.fill('input[aria-label="رمز المختبر"]', code); await p.click('button:has-text("تفعيل")'); await p.waitForTimeout(1500);
    return { ctx, p };
  };
  const addVisit = async (p, patient) => {
    await p.goto(B + '/station'); await p.waitForSelector('input[placeholder="ابحث عن فحص…"]', { timeout: 20000 });
    await p.locator('label:has-text("الاسم الثلاثي") input').fill(patient);
    await p.fill('input[placeholder="ابحث عن فحص…"]', 'Glucose'); await p.waitForTimeout(100);
    await p.locator('div.grid button:has(span.flex-1)').first().click();
    await p.fill('input[placeholder="ابحث عن فحص…"]', ''); await p.locator('[data-result-idx="0"]').fill('101');
    // Printing saves the visit and gives it its sample number.
    await p.evaluate(() => { window.print = () => {}; });
    await p.click('button:has-text("طباعة")'); await p.waitForTimeout(1200);
  };
  const names = async (p) => ((await kv(p, 'station.visits.v1')) || []).map((v) => v.patient.name);
  const settings = async (p) => { await p.goto(B + '/station/settings#device'); await p.waitForSelector('[data-testid="sync-panel"]', { timeout: 20000 }); };
  const state = (p) => p.locator('[data-testid="sync-state"]').innerText();
  const synced = (p) => waitFor(async () => { const t = await state(p); return /آخر مزامنة: \d/.test(t) && !/بانتظار الإرسال/.test(t); }, 25000);
  const syncNow = async (p) => { await settings(p); await p.click('button:has-text("مزامنة الآن")'); await synced(p); };
  const remoteNames = async () => (await db.query(`select data from lab_sync_records where coll = 'station.visits.v1' and not deleted`)).map((r) => r.data.patient.name);

  const d1 = await device(c1.code, 'D1');
  await addVisit(d1.p, 'مراجع الاستقبال');
  await settings(d1.p);
  const link1 = await d1.p.locator('[data-testid="sync-link"]').innerText();
  ok(link1.includes('PostgreSQL') && link1.includes('من صفحة الرموز'), `device 1 got the link with its code (${link1.replace(/\s+/g, ' ')})`);
  ok(await synced(d1.p), 'device 1 synced');
  ok((await remoteNames()).includes('مراجع الاستقبال'), 'device 1\'s visit is in the lab\'s PostgreSQL');
  ok(!(await d1.p.evaluate(() => localStorage.getItem('local.license.v1') || '')).includes(pgPass), 'the device never holds the connection string');
  const health = async (card) => { await o.reload(); await o.waitForSelector(`div[data-lab="${LAB} — الاستقبال"]`, { timeout: 15000 }); return card.locator('[data-testid="sync-health"]').innerText().catch(() => ''); };
  const h1 = await waitFor(async () => { const t = await health(card1); return t.includes('آخر مزامنة') && t; }, 20000, 1500);
  ok(!!h1 && h1.includes('✓'), `code manager shows device 1's last sync (${h1})`);

  // ── Device 2: takes the lab's data; visits go both ways ──
  const d2 = await device(c2.code, 'D2');
  await settings(d2.p);
  await d2.p.waitForSelector('[data-testid="sync-join"]', { timeout: 20000 });
  const h2 = await waitFor(async () => { const t = await health(card2); return t.includes('بانتظار') && t; }, 20000, 1500);
  ok(!!h2, `code manager shows device 2 waiting for its choice (${h2})`);
  await d2.p.click('button:has-text("استخدام بيانات المختبر")');
  await synced(d2.p);
  ok((await names(d2.p)).includes('مراجع الاستقبال'), 'device 2 has device 1\'s visit');
  // Device 2 gets its own letter in sample numbers.
  await settings(d2.p);
  await d2.p.fill('input[aria-label="حرف الجهاز"]', 'b');
  await d2.p.locator('[data-testid="device-tag"] button:has-text("حفظ")').click(); await d2.p.waitForTimeout(300);
  await addVisit(d2.p, 'مراجع المختبر');
  await syncNow(d2.p);
  await syncNow(d1.p);
  ok((await names(d1.p)).includes('مراجع المختبر'), 'device 1 received device 2\'s visit');
  const acc = [...(await kv(d1.p, 'station.visits.v1'))].map((v) => v.accession).filter(Boolean);
  ok(acc.length === 2 && new Set(acc).size === 2, `sample numbers stay unique across the devices (${acc.join(', ')})`);
  ok(acc.some((a) => /^LAB-\d{8}-B001$/.test(a)), 'device 2\'s numbers carry its letter (…-B001)');
  ok(!('station.deviceTag.v1' in Object.fromEntries((await db.query(`select coll from lab_sync_records`)).map((r) => [r.coll, 1]))), 'the device letter stays on its device (not synced)');

  // ── Only a device holding the lab's code is served ──
  const lab = (body) => o.evaluate(async (body) => { const r = await fetch('/api/labsync', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, ...(await r.json()) }; }, body);
  const other = await lab({ op: 'pull', lid: c1.row.id, device: 'someone-else-device-0001', since: 0, node: 'x' });
  ok(other.status === 403 && !other.rows, 'another device with the code\'s id is refused (403)');
  ok((await lab({ op: 'pull' })).status === 400, 'a call without a device is refused');

  // ── The lab cannot remove the owner's link; the owner can ──
  await settings(d1.p);
  await d1.p.click('button:has-text("إلغاء الربط")');
  ok(((await waitFor(() => d1.p.locator('[data-testid="sync-msg"]').innerText(), 10000)) || '').includes('صفحة الرموز'), 'device: the owner\'s link cannot be removed here');
  await o.goto(B + '/license'); await o.waitForSelector(`div[data-lab="${LAB} — المختبر"]`, { timeout: 15000 });
  await card2.locator('button[aria-label="قاعدة بيانات المختبر"]').click();
  await modal.locator('button:has-text("بدون")').click();
  await modal.locator('button:has-text("إلغاء الربط")').click();
  await waitFor(async () => (await card2.locator('[data-testid="lab-db"]').innerText()).includes('على الجهاز فقط'), 15000);
  ok((await card2.locator('[data-testid="lab-db"]').innerText()).includes('على الجهاز فقط'), 'owner unlinked code 2');
  await settings(d2.p);
  await d2.p.click('button:has-text("تحديث الربط")');
  ok(!!(await waitFor(async () => (await d2.p.locator('[data-testid="sync-panel"]').innerText()).includes('غير مربوط'), 15000)), 'device 2 follows: not linked, its data stays');
  ok((await names(d2.p)).length === 2, 'device 2 keeps its visits after unlinking');

  // ── The lab links its own PostgreSQL from the station's settings ──
  await d2.p.click('[data-testid="sync-panel"] button:has-text("PostgreSQL")');
  await d2.p.fill('input[aria-label="رابط الاتصال"]', db.url);
  await d2.p.click('[data-testid="sync-link-btn"]');
  const m2 = (await waitFor(() => d2.p.locator('[data-testid="sync-msg"]').innerText(), 15000)) || '';
  ok(m2.includes('تم الربط'), `device 2 linked its PostgreSQL from its settings (${m2})`);
  await o.reload(); await o.waitForSelector(`div[data-lab="${LAB} — المختبر"]`, { timeout: 15000 });
  ok((await card2.locator('[data-testid="lab-db"]').innerText()).includes('من الجهاز'), 'owner page shows it was linked from the device');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close(); await db.drop();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
