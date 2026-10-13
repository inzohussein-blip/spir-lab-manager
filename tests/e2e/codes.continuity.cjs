// Work goes on when the provider's site is gone (lab codes on):
//  - a device locks only on a refusal signed with its own license's key, and takes a new license
//    only from that key — a server without it (a new database, another site on the address) cannot
//    lock the labs or change their codes;
//  - «ضمان الاستمرارية»: with the site out of reach for long before the end, the code keeps working
//    the owner's days past it, then locks;
//  - «رمز تجديد بلا إنترنت»: typed on a locked device that cannot reach the site, it opens it again;
//  - the signing key's backup downloads, and only its passphrase restores it.
const { B, OWNER, ok, launch, done } = require('./lib.cjs');
const { SignJWT, generateKeyPair, exportJWK } = require('jose');
const DAY = 86400000;
// Its own address: the earlier files' wrong passwords are counted per address.
(async () => {
  const b = await launch();
  const errs = [];
  const newDev = async (time) => {
    const ctx = await b.newContext({ viewport: { width: 1300, height: 900 }, acceptDownloads: true, extraHTTPHeaders: { 'x-forwarded-for': '10.20.30.93' } });
    if (time) await ctx.clock.install({ time });
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message.slice(0, 120))); p.on('dialog', (d) => d.accept());
    return { ctx, p };
  };
  // ── The owner and a code ──
  const { p: o } = await newDev();
  await o.goto(B + '/license'); await o.waitForTimeout(600);
  await o.fill('input[aria-label="كلمة المرور"]', OWNER); await o.click('button:has-text("دخول")'); await o.waitForSelector('h1:has-text("إدارة الرموز")', { timeout: 15000 });
  const go = (s) => o.click(`[data-section="${s}"]`);
  await go('new');
  await o.fill('label:has-text("اسم المختبر") input', 'مختبر الاستمرارية');
  await o.selectOption('label:has-text("المدة") select', '30');
  await o.click('button:has-text("إنشاء الرمز")'); await o.waitForTimeout(700);
  const code = (await o.locator('div.font-mono.text-3xl').innerText()).trim();
  await o.click('button:text-is("تم")');
  const card = async () => { await o.reload(); await o.waitForTimeout(700); await go('codes'); return o.locator('div[data-lab="مختبر الاستمرارية"]'); };

  const { p: d } = await newDev();
  await d.goto(B + '/welcome'); await d.waitForTimeout(1500);
  await d.fill('input[aria-label="رمز المختبر"]', code); await d.click('button:has-text("تفعيل")'); await d.waitForTimeout(1500);
  ok(await d.locator('div[role=dialog]').count() === 0, 'the device is activated');
  const lic = () => d.evaluate(() => JSON.parse(localStorage.getItem('local.license.v1')));
  const payload = (t) => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString());
  const forceRefresh = () => d.evaluate(() => { const s = JSON.parse(localStorage.getItem('local.license.v1')); s.checkedAt = 0; localStorage.setItem('local.license.v1', JSON.stringify(s)); });
  const openStation = async () => { await d.goto(B + '/station'); await d.waitForTimeout(1800); };
  const p0 = payload((await lic()).token);

  // ── A server without the key: its refusals and licenses change nothing ──
  const other = await generateKeyPair('ES256', { extractable: true });
  const otherPub = await exportJWK(other.publicKey);
  const fake = async (status, body) => { await d.unroute('**/api/license/check').catch(() => {}); await d.route('**/api/license/check', (r) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })); };
  await fake(404, { ok: false, error: 'not_found' });
  await forceRefresh(); await openStation();
  ok(await d.locator('div[role=dialog]:has-text("المحطات مقفلة")').count() === 0 && !(await lic()).blocked, 'an unsigned «not found» (a new database) does not lock');
  const forged = await new SignJWT({ typ: 'refusal', lid: p0.lid, dev: p0.dev, err: 'stopped', at: Date.now() }).setProtectedHeader({ alg: 'ES256' }).sign(other.privateKey);
  await fake(403, { ok: false, error: 'stopped', proof: forged });
  await forceRefresh(); await openStation();
  ok(await d.locator('div[role=dialog]:has-text("المحطات مقفلة")').count() === 0 && !(await lic()).blocked, 'a refusal signed by another key (another site) does not lock');
  const shortToken = await new SignJWT({ lid: p0.lid, lab: 'x', dev: p0.dev, mods: [], until: Date.now() + DAY }).setProtectedHeader({ alg: 'ES256' }).sign(other.privateKey);
  await fake(200, { ok: true, token: shortToken, pub: otherPub, now: Date.now() });
  await forceRefresh(); await openStation();
  ok(payload((await lic()).token).until === p0.until, 'a license signed by another key is not taken (the code keeps its end)');
  ok(!!(await lic()).otherKeyAt, 'the device notes that the site answered with another key');
  await d.waitForSelector('[data-testid="notice-enter-code"]', { timeout: 10000 }).catch(() => {});
  ok((await d.locator('body').innerText()).includes('بمفتاح توقيع غير مفتاح رمز') && await d.locator('[data-testid="notice-enter-code"]').count() === 1, 'the stations say so, with «إدخال الرمز» to confirm a new key');
  await d.unroute('**/api/license/check');

  // ── The real owner's stop still locks, and resuming opens again ──
  let c = await card();
  await c.locator('button[aria-label="إيقاف"]').click(); await o.waitForTimeout(600);
  await forceRefresh(); await openStation();
  ok(await d.locator('div[role=dialog]:has-text("المحطات مقفلة")').count() === 1 && (await lic()).blocked?.error === 'stopped', 'the owner\'s stop (signed) locks the device');
  c = await card();
  await c.locator('button[aria-label="إعادة تفعيل"]').click(); await o.waitForTimeout(600);
  await d.click('button:has-text("تحقق الآن")'); await d.waitForTimeout(1800);
  ok(await d.locator('div[role=dialog]').count() === 0, 'resumed: open again');
  ok(!(await lic()).otherKeyAt, 'an answer with the code\'s own key clears the note');

  // ── «ضمان الاستمرارية» ──
  c = await card();
  await c.locator('button:has-text("الدفع والجهاز والرسالة والسجل")').click();
  await c.locator('input[aria-label="أيام ضمان الاستمرارية"]').fill('30');
  await c.locator('[data-testid="continuity"] button:has-text("حفظ")').click(); await o.waitForTimeout(800);
  await forceRefresh(); await openStation();
  const p1 = payload((await lic()).token);
  ok(p1.cont === 30, 'the device\'s license carries the owner\'s 30 days');
  // A device whose clock is past the end, that could not reach the site for 20 days before it.
  const state = await d.evaluate(() => Object.fromEntries(['local.device.v1', 'local.license.v1', 'local.license.enabled', 'local.activation.v1'].map((k) => [k, localStorage.getItem(k)])));
  const lic0 = JSON.parse(state['local.license.v1']);
  const later = async (days, heardDaysBefore) => {
    const { ctx, p } = await newDev(p1.until + days * DAY);
    await p.route('**/api/license/**', (r) => r.abort()); // the site is gone
    await p.goto(B + '/verify/x').catch(() => {});
    await p.evaluate(([st, heard]) => { for (const [k, v] of Object.entries(st)) if (v != null) localStorage.setItem(k, v); const s = JSON.parse(st['local.license.v1']); s.checkedAt = heard; localStorage.setItem('local.license.v1', JSON.stringify(s)); }, [state, p1.until - heardDaysBefore * DAY]);
    await p.goto(B + '/station').catch(() => {}); await p.waitForTimeout(2000);
    return { ctx, p };
  };
  let dev2 = await later(2, 20);
  ok(await dev2.p.locator('div[role=dialog]:has-text("المحطات مقفلة")').count() === 0 && (await dev2.p.locator('body').innerText()).includes('ضمان الاستمرارية'), 'past the end with the site out of reach for 20 days: still working, with the notice');
  await dev2.ctx.close();
  dev2 = await later(2, 3);
  ok(await dev2.p.locator('div[role=dialog]:has-text("المحطات مقفلة")').count() === 1, 'the site answered 3 days before the end: locked as usual');
  await dev2.ctx.close();
  dev2 = await later(40, 20);
  ok(await dev2.p.locator('div[role=dialog]:has-text("المحطات مقفلة")').count() === 1, 'after the 30 days of continuity: locked');
  const [bk] = await Promise.all([dev2.p.waitForEvent('download'), dev2.p.click('[data-testid="locked-backup"]')]);
  ok(JSON.parse(require('fs').readFileSync(await bk.path(), 'utf8')).app === 'spir-lab-full', 'locked, the lab can still take a full backup of its data');

  // ── «رمز تجديد بلا إنترنت» on that locked device ──
  c = await card();
  await c.locator('button:has-text("الدفع والجهاز والرسالة والسجل")').click();
  await c.locator('input[aria-label="أيام رمز التجديد"]').fill('60');
  await c.locator('[data-testid="renew-offline"]').click();
  await o.waitForSelector('[data-testid="renew-code"]', { timeout: 10000 });
  const renew = await o.locator('[data-testid="renew-code"]').inputValue();
  ok(renew.startsWith('SPIR-RENEW.'), 'the owner gets a renewal text');
  const wa = await o.getAttribute('[data-testid="renew-whatsapp"]', 'href');
  ok(wa.startsWith('https://wa.me/?text=') && decodeURIComponent(wa.split('text=')[1]).includes(renew), '«إرسال بواتساب» carries the whole renewal text');
  const L = dev2.p;
  await L.fill('input[aria-label="رمز المختبر"]', renew.slice(0, -3) + 'abc'); await L.click('button:has-text("تفعيل رمز جديد")'); await L.waitForTimeout(800);
  ok((await L.locator('div[role=dialog]').innerText()).includes('رمز التجديد غير صحيح'), 'a changed renewal text is refused');
  await L.fill('input[aria-label="رمز المختبر"]', renew); await L.click('button:has-text("تفعيل رمز جديد")'); await L.waitForTimeout(1500);
  ok(await L.locator('div[role=dialog]:has-text("المحطات مقفلة")').count() === 0, 'the renewal text opens the locked device without reaching the site');
  await dev2.ctx.close();

  // ── The signing key's backup ──
  await go('system');
  await o.fill('input[aria-label="كلمة مرور المالك للمفتاح"]', OWNER);
  await o.fill('input[aria-label="عبارة حماية المفتاح"]', 'backup-pass-123');
  const [dl] = await Promise.all([o.waitForEvent('download'), o.click('[data-testid="key-export"]')]);
  const file = JSON.parse(require('fs').readFileSync(await dl.path(), 'utf8'));
  ok(file.app === 'lab-signing-key' && file.pub?.x === lic0.pub.x && !JSON.stringify(file).includes('"d"'), 'the key downloads sealed (its public half is the devices\' key; the private part is not readable)');
  await o.setInputFiles('input[aria-label="ملف مفتاح التوقيع"]', await dl.path());
  await o.fill('input[aria-label="عبارة حماية المفتاح"]', 'wrong-pass-123');
  await o.click('[data-testid="key-import"]'); await o.waitForTimeout(1200);
  ok((await o.locator('[data-testid="key-backup"]').innerText()).includes('لا تفتح هذا الملف'), 'a wrong passphrase does not restore it');
  await o.fill('input[aria-label="عبارة حماية المفتاح"]', 'backup-pass-123');
  await o.click('[data-testid="key-import"]'); await o.waitForTimeout(1200);
  ok((await o.locator('[data-testid="key-backup"]').innerText()).includes('استُعيد مفتاح التوقيع'), 'the right passphrase restores it');
  await forceRefresh(); await openStation();
  ok(await d.locator('div[role=dialog]').count() === 0 && payload((await lic()).token).lid === p0.lid, 'after the restore the device still refreshes from the site');

  // ── «ضمان الاستمرارية» for new codes, and for every code at once ──
  const licenses = async () => (await o.evaluate(async () => (await fetch('/api/license/admin')).json())).licenses;
  await o.reload(); await o.waitForTimeout(700); await go('settings');
  await o.fill('input[aria-label="ضمان الاستمرارية الافتراضي"]', '45');
  await o.click('[data-testid="prefs-card"] button:has-text("حفظ الإعدادات")'); await o.waitForTimeout(800);
  const api = (body) => o.evaluate(async (body) => (await fetch('/api/license/admin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(), body);
  const fresh = await api({ op: 'create', lab: 'مختبر الضمان الافتراضي', days: 30 });
  const trial = await api({ op: 'create', lab: 'مختبر تجريبي للضمان', days: 7, trial: true });
  let all = await licenses();
  ok(all.find((r) => r.id === fresh.row.id)?.continuity_days === 45, 'a new code starts with the default continuity (45 days)');
  ok(all.find((r) => r.id === trial.row.id)?.continuity_days === 0, 'a trial code does not');
  await go('settings');
  await o.fill('input[aria-label="ضمان الاستمرارية الافتراضي"]', '20');
  await o.click('[data-testid="continuity-all"]'); await o.waitForTimeout(1200);
  all = await licenses();
  ok(all.filter((r) => !r.is_trial).every((r) => r.continuity_days === 20) && all.find((r) => r.id === trial.row.id)?.continuity_days === 0, '«تطبيقه على كل الرموز الحالية»: every paid code now 20 days, the trial left alone');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
