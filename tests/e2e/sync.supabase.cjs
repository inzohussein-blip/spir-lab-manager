// Lab database through Supabase (linked from the station's settings, lab codes off): devices keep
// working on their own copy and exchange records — upload, «use the lab's data», merge, restore,
// deletions, the later change winning, work done offline — and wrong details are told plainly.
const { B, ok, launch, done, kv, resetLocal } = require('./lib.cjs');
const { PG, freshDb, fakeSupabase, waitFor } = require('./pgfake.cjs');

(async () => {
  if (!PG) { console.log('SKIP sync.supabase.cjs — set E2E_PG_URL (a PostgreSQL the test may create databases in)'); ok(!process.env.CI, 'E2E_PG_URL is set in CI'); return done(); }
  const db = await freshDb('sbtest', { supabase: true });
  const empty = await freshDb('sbempty');
  const sb = await fakeSupabase(db.url, 3481);
  const sbNoTable = await fakeSupabase(empty.url, 3482);
  const b = await launch();
  const errs = [];

  const device = async (name) => {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(`${name} ${e.message.slice(0, 140)}`)); p.on('dialog', (d) => d.accept());
    await p.goto(B + '/welcome'); await resetLocal(p, { 'local.activation.v1': 'legacy' });
    return { ctx, p };
  };
  const addVisit = async (p, patient, value = '95') => {
    await p.goto(B + '/station'); await p.waitForSelector('input[placeholder="ابحث عن فحص…"]', { timeout: 20000 });
    await p.locator('label:has-text("الاسم الثلاثي") input').fill(patient);
    await p.fill('input[placeholder="ابحث عن فحص…"]', 'Glucose'); await p.waitForTimeout(100);
    await p.locator('div.grid button:has(span.flex-1)').first().click();
    await p.fill('input[placeholder="ابحث عن فحص…"]', ''); await p.locator('[data-result-idx="0"]').fill(value);
    await p.keyboard.press('Control+s'); await p.waitForTimeout(500);
  };
  const names = async (p) => ((await kv(p, 'station.visits.v1')) || []).map((v) => v.patient.name);
  const settings = async (p) => { await p.goto(B + '/station/settings'); await p.waitForSelector('[data-testid="sync-panel"]', { timeout: 20000 }); };
  const link = async (p, { url = sb.url, password = sb.password } = {}) => {
    await p.fill('input[aria-label="Project URL"]', url); await p.fill('input[aria-label="anon key"]', sb.anon);
    await p.fill('input[aria-label="بريد مستخدم المختبر"]', sb.email); await p.fill('input[aria-label="كلمة مرور مستخدم المختبر"]', password);
    await p.click('[data-testid="sync-link-btn"]');
    return (await waitFor(async () => (await p.locator('[data-testid="sync-msg"]').count()) && p.locator('[data-testid="sync-msg"]').innerText(), 15000)) || '';
  };
  const synced = (p) => waitFor(async () => /آخر مزامنة: \d/.test(await p.locator('[data-testid="sync-state"]').innerText()) && !/بانتظار الإرسال/.test(await p.locator('[data-testid="sync-state"]').innerText()), 20000);
  const remoteNames = async () => (await db.query(`select data from lab_sync_records where coll = 'station.visits.v1' and not deleted`)).map((r) => r.data.patient.name);
  const syncNow = async (p) => { await settings(p); await p.click('button:has-text("مزامنة الآن")'); await synced(p); };

  // ── Device A: works alone, then links; wrong details are explained ──
  const A = await device('A');
  await addVisit(A.p, 'مريض سوبابيس 1');
  await settings(A.p);
  ok((await A.p.locator('[data-testid="sync-panel"]').innerText()).includes('غير مربوط'), 'not linked: data on this device only');
  ok((await link(A.p, { password: 'wrong' })).includes('تعذّر الدخول'), 'wrong password → «تعذّر الدخول»');
  ok((await link(A.p, { url: sbNoTable.url })).includes('نفّذ سكربت الإعداد'), 'setup script not run → asks to run it');
  const m1 = await link(A.p);
  ok(m1.includes('تم الربط'), `A linked (${m1})`);
  ok(await synced(A.p), 'A: first sync done (empty lab database → this device uploads)');
  ok((await remoteNames()).includes('مريض سوبابيس 1'), 'A\'s visit is in the lab database');
  ok((await db.query(`select count(*)::int as n from lab_sync_records where coll = 'station.tests.v1'`))[0].n > 10, 'A\'s test catalog uploaded record by record');

  // ── Device B: has its own visit; merges ──
  const B2 = await device('B');
  await addVisit(B2.p, 'مريض سوبابيس 2');
  await settings(B2.p);
  const m2 = await link(B2.p);
  ok(m2.includes('تم الربط') && /\d+ سجلاً/.test(m2), `B linked; told the lab database has records (${m2})`);
  await B2.p.waitForSelector('[data-testid="sync-join"]', { timeout: 15000 });
  ok(true, 'B is asked how to join (lab database not empty)');
  await B2.p.click('button:has-text("دمج بيانات هذا الجهاز معها")');
  await synced(B2.p);
  const bNames = await names(B2.p);
  ok(bNames.includes('مريض سوبابيس 1') && bNames.includes('مريض سوبابيس 2'), `merge: B has both visits (${bNames.join(' / ')})`);
  ok((await remoteNames()).includes('مريض سوبابيس 2'), 'merge: B\'s visit reached the lab database');
  const aTestsN = ((await kv(A.p, 'station.tests.v1')) || []).length, bTestsN = ((await kv(B2.p, 'station.tests.v1')) || []).length;
  const remoteTests = (await db.query(`select count(*)::int as n from lab_sync_records where coll = 'station.tests.v1' and not deleted`))[0].n;
  ok(bTestsN === aTestsN && remoteTests === aTestsN, `merge: the built-in test list is not doubled (A ${aTestsN}, B ${bTestsN}, lab ${remoteTests})`);
  await syncNow(A.p);
  ok((await names(A.p)).includes('مريض سوبابيس 2'), 'A received B\'s visit');

  // ── Device C: «use the lab's data», then restore its own ──
  const C = await device('C');
  await addVisit(C.p, 'مريض الجهاز الثالث');
  await settings(C.p);
  await link(C.p);
  await C.p.waitForSelector('[data-testid="sync-join"]', { timeout: 15000 });
  await C.p.click('button:has-text("استخدام بيانات المختبر")');
  await synced(C.p);
  let cNames = await names(C.p);
  ok(cNames.includes('مريض سوبابيس 1') && cNames.includes('مريض سوبابيس 2') && !cNames.includes('مريض الجهاز الثالث'), `replace: C shows the lab's visits only (${cNames.join(' / ')})`);
  ok(!(await remoteNames()).includes('مريض الجهاز الثالث'), 'replace: C\'s own visit was not sent to the lab');
  const cTests = (await kv(C.p, 'station.tests.v1')) || [], aTests = (await kv(A.p, 'station.tests.v1')) || [];
  ok(cTests.length === aTests.length && cTests.every((t) => aTests.some((x) => x.id === t.id)), `replace: C's test catalog is the lab's (${cTests.length}), no duplicates`);
  await C.p.click('button:has-text("استرجاع بيانات الجهاز قبل الربط")');
  await C.p.waitForTimeout(1500);
  cNames = await names(C.p);
  ok(cNames.length === 1 && cNames[0] === 'مريض الجهاز الثالث', 'restore: C is back to its own data');
  ok((await C.p.locator('[data-testid="sync-panel"]').innerText()).includes('غير مربوط'), 'restore: C is unlinked');

  // ── A deletes a visit → gone on B ──
  await A.p.goto(B + '/station/visits'); await A.p.waitForSelector('text=مريض سوبابيس 2', { timeout: 15000 });
  await A.p.locator('tr:has-text("مريض سوبابيس 2") input[type=checkbox]').check();
  await A.p.click('button:has-text("حذف المحدَّد")'); await A.p.waitForTimeout(600);
  await syncNow(A.p);
  ok(!(await remoteNames()).includes('مريض سوبابيس 2'), 'deletion reached the lab database');
  await syncNow(B2.p);
  ok(!(await names(B2.p)).includes('مريض سوبابيس 2'), 'B no longer has the deleted visit');

  // ── Both offline change the lab name; the later change wins everywhere ──
  const setName = async (p, name) => {
    await p.goto(B + '/station/settings'); await p.waitForSelector('text=اسم المختبر', { timeout: 15000 });
    await p.locator('label:has-text("اسم المختبر") input').fill(name);
    await p.locator('button:has-text("حفظ")').first().click(); await p.waitForTimeout(400);
  };
  await A.ctx.setOffline(true); await B2.ctx.setOffline(true);
  await setName(A.p, 'مختبر أ (قديم)');
  await A.p.waitForTimeout(300);
  await setName(B2.p, 'مختبر ب (أحدث)');
  ok(/بانتظار الإرسال/.test(await B2.p.locator('[data-testid="sync-state"]').innerText()), 'offline: the change waits to be sent (the station keeps working)');
  await A.ctx.setOffline(false); await B2.ctx.setOffline(false);
  await syncNow(A.p); await syncNow(B2.p); await syncNow(A.p);
  const la = (await kv(A.p, 'station.settings.v1'))?.labName, lb = (await kv(B2.p, 'station.settings.v1'))?.labName;
  ok(la === 'مختبر ب (أحدث)' && lb === 'مختبر ب (أحدث)', `the later change wins on both (${la} / ${lb})`);

  // ── Text only: a device's logo (an image) stays on it; text changes still arrive ──
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await A.p.goto(B + '/station/settings'); await A.p.waitForSelector('text=اسم المختبر', { timeout: 15000 });
  await A.p.setInputFiles('input[type=file][accept="image/*"]', { name: 'logo.png', mimeType: 'image/png', buffer: png }); await A.p.waitForTimeout(600);
  ok(String((await kv(A.p, 'station.settings.v1'))?.logo).startsWith('data:image'), 'A has its logo');
  await syncNow(A.p);
  const remoteSettings = (await db.query(`select data from lab_sync_records where coll = 'station.settings.v1'`))[0]?.data;
  ok(!!remoteSettings && !JSON.stringify(remoteSettings).includes('data:'), 'the logo image was not sent to the lab database (text only)');
  await setName(B2.p, 'مختبر ب (بعد الشعار)');
  await syncNow(B2.p); await syncNow(A.p);
  const sa = await kv(A.p, 'station.settings.v1'), sbs = await kv(B2.p, 'station.settings.v1');
  ok(sa?.labName === 'مختبر ب (بعد الشعار)' && String(sa?.logo).startsWith('data:image'), 'A received B\'s text change and kept its own logo');
  ok(!String(sbs?.logo ?? '').startsWith('data:'), 'B did not receive A\'s logo');

  // ── Work done offline arrives later; the other device is told ──
  await B2.ctx.setOffline(true);
  await addVisit(B2.p, 'مريض بدون إنترنت');
  ok((await names(B2.p)).includes('مريض بدون إنترنت'), 'offline: visit saved on the device');
  await B2.ctx.setOffline(false);
  await syncNow(B2.p);
  ok((await remoteNames()).includes('مريض بدون إنترنت'), 'back online: the visit reached the lab database');
  await settings(A.p); await A.p.click('button:has-text("مزامنة الآن")');
  ok(!!(await waitFor(() => A.p.locator('[data-testid="sync-arrived"]').count(), 15000)), 'A is told updates arrived from the other devices');
  await A.p.click('[data-testid="sync-arrived"] button:has-text("عرضها")');
  ok((await names(A.p)).includes('مريض بدون إنترنت'), 'A has the visit made offline on B');

  ok(sb.calls.signIn <= 12, `devices keep their sign-in (${sb.calls.signIn} sign-ins)`);
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close(); await sb.close(); await sbNoTable.close(); await db.drop(); await empty.drop();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
