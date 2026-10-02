// «نافذة الأطباء» on the provider's site: a lab's computer uploads under its lab code (nobody
// else can replace its copy), the doctor's window needs no lab code, and the owner's switch in
// /license stops uploading and showing for every lab.
const { B, OWNER, ok, launch, done, kv, kvPut } = require('./lib.cjs');
const HDR = { 'x-forwarded-for': '10.20.30.71' };
const TAG = Date.now().toString(36);
(async () => {
  const b = await launch();
  const errs = [];
  const until = async (fn, ms = 25000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch { /* not yet */ } await new Promise((r) => setTimeout(r, 500)); } return false; };
  const o = await (await b.newContext({ viewport: { width: 1300, height: 950 }, extraHTTPHeaders: HDR })).newPage();
  o.on('dialog', (d) => d.accept());
  await o.goto(B + '/license');
  const api = (body) => o.evaluate(async (body) => (await fetch('/api/license/admin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(), body);
  ok((await api({ op: 'login', password: OWNER })).ok === true, 'owner signs in');
  ok((await o.evaluate(async () => (await fetch('/api/license/admin')).json())).prefs.doctorsOn === true, 'the doctors\' window is on by default');
  const ca = await api({ op: 'create', lab: 'مختبر الأطباء ' + TAG, days: 30 });
  const cb = await api({ op: 'create', lab: 'مختبر آخر ' + TAG, days: 30 });

  const computer = async (code, name) => {
    // The doctor's device on its own address (its wrong codes below are counted per address).
    const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, extraHTTPHeaders: code ? HDR : { 'x-forwarded-for': `10.20.${Date.now() % 200 + 40}.${Math.floor(Math.random() * 250) + 1}` } });
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(`${name} ${e.message.slice(0, 140)}`)); p.on('dialog', (d) => d.accept());
    if (!code) return p;
    await p.goto(B + '/welcome'); await p.waitForSelector('input[aria-label="رمز المختبر"]', { timeout: 20000 });
    await p.fill('input[aria-label="رمز المختبر"]', code); await p.click('button:has-text("تفعيل")'); await p.waitForTimeout(1500);
    return p;
  };
  const a = await computer(ca.code, 'a'), bb = await computer(cb.code, 'b');
  await a.goto(B + '/station'); await a.waitForSelector('aside', { timeout: 20000 });
  const hb = (await kv(a, 'station.tests.v1')).find((t) => t.code === 'HB');
  await kvPut(a, 'station.visits.v1', [
    { id: 'v1', created_at: Date.now() - 5 * 60000, patient: { name: 'مراجع الدكتور', gender: 'female', age: '30' }, referrer: 'د. سارة', results: [{ testId: hb.id, name_ar: hb.name_ar, value: '11', unit: hb.unit }] },
  ]);

  // ── The lab's computer makes a code and uploads under its lab code ──
  await a.goto(B + '/sync/doctors'); await a.waitForSelector('[data-testid="new-doctor-code"]', { timeout: 20000 });
  await a.fill('input[aria-label="اسم الطبيب"]', 'د. سارة'); await a.click('button:has-text("إنشاء الرمز")');
  await a.waitForSelector('[data-testid="doctor-code"]', { timeout: 20000 });
  const code = (await a.locator('[data-testid="doctor-code"]').innerText()).trim();
  ok(await until(async () => !!(await kv(a, 'doctors.shares.v1'))[0].lastAt), 'the copy is uploaded with the lab\'s code');
  const tag = (await kv(a, 'doctors.shares.v1'))[0].tag;
  const post = (p, body) => p.evaluate(async (body) => { const r = await fetch('/api/doctors', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, ...(await r.json()) }; }, body);
  const noToken = await post(a, { op: 'publish', tag, box: 'x'.repeat(60) });
  ok(noToken.ok === false && noToken.status === 403, `without a lab code nothing is uploaded (${noToken.error})`);
  const proof = (p) => p.evaluate(() => ({ token: JSON.parse(localStorage.getItem('local.license.v1')).token, device: localStorage.getItem('local.device.v1') }));
  const other = await post(bb, { op: 'publish', tag, box: 'x'.repeat(60), ...(await proof(bb)) });
  ok(other.ok === false && other.error === 'taken', 'another lab cannot replace this lab\'s copy');
  const otherRevoke = await post(bb, { op: 'revoke', tag, ...(await proof(bb)) });
  const still = await post(bb, { op: 'fetch', tag });
  ok(still.ok === true && typeof still.box === 'string', `nor remove it (${otherRevoke.ok ? 'answered ok, kept' : otherRevoke.error})`);

  // ── The doctor's device: no lab code ──
  const d = await computer(null, 'doctor');
  await d.goto(B + '/doctor/labs'); await d.waitForSelector('[data-testid="doctor-gate"]', { timeout: 20000 });
  await d.waitForTimeout(1500);
  ok(await d.locator('input[aria-label="رمز المختبر"]').count() === 0 && await d.locator('a[href]').count() === 0, 'the doctors\' window asks for no lab code, only its activation code (no link anywhere)');
  ok(await d.evaluate(() => localStorage.getItem('local.activation.v1')) === 'pending', 'the doctor\'s browser is marked new (its offline copy does not count as an older station\'s data)');
  await d.fill('[data-testid="doctor-gate"] input[aria-label="رمز التفعيل"]', code); await d.click('[data-testid="doctor-gate"] button:has-text("تفعيل")');
  await d.waitForSelector('[data-testid="doctor-lab"]', { timeout: 20000 });
  ok((await d.locator('[data-testid="doctor-lab"]').innerText()).includes('1 نتيجة'), 'the doctor activates the account with the code and gets the result');
  // Standalone like /license: nothing leads to it.
  await d.goto(B + '/welcome'); await d.waitForSelector('input[aria-label="رمز المختبر"]', { timeout: 45000 });
  ok(await d.locator('a[href^="/doctor"]').count() === 0, 'neither the welcome page nor its activation window leads to the doctors\' window');
  await d.goto(B + '/station'); await d.waitForSelector('input[aria-label="رمز المختبر"]', { timeout: 45000 });
  ok(await d.locator('a[href^="/doctor"]').count() === 0, '…nor a station');
  // «عن التطبيق» first, then the stations: still asked for a lab code (its offline copy is not older data).
  const v = await computer(null, 'visitor');
  await v.goto(B + '/about'); await v.waitForTimeout(1500);
  ok(await v.evaluate(() => localStorage.getItem('local.activation.v1')) === 'pending', 'a browser opening «عن التطبيق» first is marked new too');
  await v.evaluate(() => localStorage.setItem('local-offline-ready', '1')); // as when its offline copy is saved
  await v.goto(B + '/welcome');
  ok(await v.waitForSelector('input[aria-label="رمز المختبر"]', { timeout: 45000 }).then(() => true, () => false), '…and the stations still ask it for a lab code');

  // ── The owner's switch ──
  const prefsSave = async (on) => {
    await o.goto(B + '/license#settings'); await o.reload(); await o.waitForSelector('[data-testid="prefs-card"]', { timeout: 15000 });
    if (on) await o.check('input[aria-label="نافذة الأطباء"]'); else await o.uncheck('input[aria-label="نافذة الأطباء"]');
    await o.click('[data-testid="prefs-card"] button:has-text("حفظ الإعدادات")'); await o.waitForTimeout(800);
  };
  await prefsSave(false);
  ok((await o.evaluate(async () => (await fetch('/api/license/admin')).json())).prefs.doctorsOn === false, 'the owner switches the doctors\' window off');
  ok((await (await o.evaluate(async () => (await fetch('/api/doctors')).json()))).on === false, 'the server says it is off at once');
  const offFetch = await post(d, { op: 'fetch', tag });
  ok(offFetch.status === 403 && offFetch.error === 'off', 'nothing is shown while it is off');
  await a.goto(B + '/sync/doctors');
  ok(await until(async () => (await a.locator('[data-testid="doctors-off"]').count()) === 1), 'the lab sees that the provider switched it off');
  await d.goto(B + '/doctor'); await d.waitForSelector('[data-testid="doctor-refresh"]', { timeout: 20000 });
  await d.click('[data-testid="doctor-refresh"]');
  ok(await until(async () => (await d.locator('[data-testid="lab-error"]').innerText()).includes('غير متاحة')), 'the doctor sees why');
  ok(await d.locator('[data-testid="doctor-visit"]').count() === 1, 'and keeps the results already on his device');
  await prefsSave(true);
  ok((await o.evaluate(async () => (await fetch('/api/license/admin')).json())).prefs.doctorsOn === true, 'switched on again (the default for the other files)');
  ok((await post(d, { op: 'fetch', tag })).ok === true, 'the copy is shown again');

  // ── A wrong code, many times from one address, waits a while ──
  let last = 0;
  for (let i = 0; i < 32; i++) last = (await post(d, { op: 'fetch', tag: (i.toString(16).padStart(2, '0') + TAG).padEnd(40, 'e').replace(/[^0-9a-f]/g, 'e') })).status;
  ok(last === 429, `many wrong codes in a row are slowed down (${last})`);

  // ── Stopping a code while the provider has the window off: its copy still leaves the server ──
  await prefsSave(false);
  await a.goto(B + '/sync/doctors'); await a.waitForSelector('[data-testid="doctor-share"]', { timeout: 20000 });
  await a.click('[data-testid="doctor-share"] button:has-text("إيقاف الرمز")');
  ok(await until(async () => ((await kv(a, 'doctors.shares.v1')) || []).length === 0), 'a code can be stopped while the window is off');
  await prefsSave(true);
  ok((await post(a, { op: 'fetch', tag })).status === 404, '…and its copy is gone when the window is on again');

  // ── At most 300 doctor codes per lab on the server ──
  const pb = await proof(bb);
  const box = 'x'.repeat(40);
  let lastPub = null;
  for (let i = 0; i < 301; i++) lastPub = await post(bb, { op: 'publish', tag: (i.toString(16).padStart(4, '0') + 'b'.repeat(36)), box, ...pb });
  ok(lastPub.ok === false && lastPub.error === 'too_many_codes', `the 301st code of one lab is refused (${lastPub.error})`);
  ok((await post(bb, { op: 'publish', tag: '0000' + 'b'.repeat(36), box: 'y'.repeat(40), ...pb })).ok === true, '…an existing one still updates');

  ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs.join(' | ') : ''}`);
  await b.close();
  done('codes.doctors');
})().catch((e) => { console.error(e); process.exit(1); });
