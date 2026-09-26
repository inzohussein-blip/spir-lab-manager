const { B, OWNER, ok, launch, tmp, pdfPages, done } = require('./lib.cjs');
const DAY = 86400000;
(async () => {
  const b = await launch();
  const errs = [];
  const newDev = async (opts = {}) => {
    const ctx = await b.newContext({ viewport: { width: 1300, height: 900 } });
    if (opts.time) await ctx.clock.install({ time: opts.time });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message.slice(0, 120))); p.on('dialog', d => d.accept());
    return { ctx, p };
  };
  // ── owner ──
  const { p: o } = await newDev();
  await o.goto(B + '/licenses'); await o.waitForTimeout(600);
  await o.fill('input[aria-label="كلمة المرور"]', 'wrong'); await o.click('button:has-text("دخول")'); await o.waitForSelector('text=كلمة المرور غير صحيحة', { timeout: 20000 }).catch(() => {});
  ok(await o.locator('text=كلمة المرور غير صحيحة').count() === 1, 'owner: wrong password refused');
  await o.fill('input[aria-label="كلمة المرور"]', OWNER); await o.click('button:has-text("دخول")'); await o.waitForSelector('h1:has-text("إدارة الرموز")', { timeout: 15000 }).catch(() => {});
  ok(await o.locator('h1:has-text("إدارة الرموز")').count() === 1, 'owner: signed in');
  const create = async (lab, period, admin) => {
    await o.fill('label:has-text("اسم المختبر") input', lab);
    if (period) await o.selectOption('label:has-text("المدة") select', String(period));
    if (period === -1) await o.fill('input[aria-label="عدد الأيام"]', '1');
    if (admin) await o.locator('form button[aria-pressed]:has-text("لوحة الإدارة الكاملة")').click();
    await o.click('button:has-text("إنشاء الرمز")'); await o.waitForTimeout(700);
    const code = (await o.locator('div.font-mono.text-3xl').innerText()).trim();
    await o.click('button:text-is("تم")');
    return code;
  };
  const codeA = await create('مختبر الأمل', 30, false);
  const codeB = await create('مختبر النور', 365, true);
  const codeC = await create('مختبر يوم واحد', -1, false);
  ok(/^[2-9A-Z]{4}-[2-9A-Z]{4}-[2-9A-Z]{4}$/.test(codeA), `code format ${codeA}`);
  const owner = async (lab, btn) => { await o.reload(); await o.waitForTimeout(700); const card = o.locator('div.rounded-2xl', { has: o.locator(`span.text-base:text-is("${lab}")`) }); return card; };
  // ── device A: new device must activate ──
  const { p: a } = await newDev();
  await a.goto(B + '/welcome'); await a.waitForTimeout(1500);
  ok(await a.locator('div[role=dialog]:has-text("تفعيل المحطات")').count() === 1, 'new device: activation window on Welcome');
  await a.fill('input[aria-label="رمز المختبر"]', 'AAAA-BBBB-CCCC'); await a.click('button:has-text("تفعيل")'); await a.waitForTimeout(1200);
  ok(await a.locator('text=الرمز غير صحيح').count() === 1, 'wrong code refused');
  await a.fill('input[aria-label="رمز المختبر"]', codeA.toLowerCase()); await a.click('button:has-text("تفعيل")'); await a.waitForTimeout(1500);
  ok(await a.locator('div[role=dialog]').count() === 0, 'code A activates device A (lower-case typing accepted)');
  await a.goto(B + '/station'); await a.waitForTimeout(1200);
  ok(await a.locator('div[role=dialog]').count() === 0 && await a.locator('h1').count() > 0, 'station opens on device A');
  // admin panel refused (code A has no admin)
  await a.goto(B + '/login'); await a.waitForTimeout(800);
  ok(new URL(a.url()).pathname === '/welcome', 'admin panel redirects without admin in code');
  ok(await a.locator('text=غير مفعّلة في رمزك').count() >= 1, 'admin card shows «غير مفعّلة في رمزك»');
  // ── device B: same code refused ──
  const { p: bdev } = await newDev();
  await bdev.goto(B + '/welcome'); await bdev.waitForTimeout(1500);
  await bdev.fill('input[aria-label="رمز المختبر"]', codeA); await bdev.click('button:has-text("تفعيل")'); await bdev.waitForTimeout(1200);
  ok(await bdev.locator('text=مفعّل على جهاز آخر').count() === 1, 'code A refused on a second device');
  // ── owner removes QC from A ──
  let card = await owner('مختبر الأمل');
  await card.locator('button[aria-pressed]:has-text("محطة الجودة والأجهزة")').click(); await o.waitForTimeout(600);
  ok((await card.innerText()).includes('فعّال'), 'owner list shows A active');
  const forceRefresh = (p) => p.evaluate(() => { const s = JSON.parse(localStorage.getItem('local.license.v1')); s.checkedAt = 0; localStorage.setItem('local.license.v1', JSON.stringify(s)); });
  await forceRefresh(a); await a.goto(B + '/qc'); await a.waitForTimeout(1800);
  ok(await a.locator('div[role=dialog]:has-text("المحطة غير مفعّلة")').count() === 1, 'QC locked after owner removed it');
  await a.goto(B + '/welcome'); await a.waitForTimeout(1500);
  ok(await a.locator('text=غير مفعّلة في رمزك').count() >= 2, 'Welcome greys out QC card too');
  // ── stop / resume ──
  card = await owner('مختبر الأمل');
  await card.locator('button:has-text("إيقاف")').click(); await o.waitForTimeout(600);
  await forceRefresh(a); await a.goto(B + '/station'); await a.waitForTimeout(1800);
  ok(await a.locator('div[role=dialog]:has-text("المحطات مقفلة")').count() === 1 && await a.locator('text=موقوف').count() >= 1, 'stopped code locks the device');
  card = await owner('مختبر الأمل');
  await card.locator('button:has-text("إعادة تفعيل")').click(); await o.waitForTimeout(600);
  await a.click('button:has-text("تحقق الآن")'); await a.waitForTimeout(1800);
  ok(await a.locator('div[role=dialog]').count() === 0, 'resume + «تحقق الآن» unlocks');
  // ── device C: 1-day code, then time passes ──
  const { ctx: cctx, p: c } = await newDev();
  await c.goto(B + '/welcome'); await c.waitForTimeout(1500);
  await c.fill('input[aria-label="رمز المختبر"]', codeC); await c.click('button:has-text("تفعيل")'); await c.waitForTimeout(1500);
  const cState = await c.evaluate(() => ({ ...localStorage }));
  const { ctx: c2ctx, p: c2 } = await newDev({ time: new Date(Date.now() + 2 * DAY) });
  await c2.goto(B + '/welcome'); await c2.evaluate((st) => { localStorage.clear(); for (const [k, v] of Object.entries(st)) localStorage.setItem(k, v); }, cState);
  await c2.goto(B + '/station'); await c2.waitForTimeout(2000);
  ok(await c2.locator('div[role=dialog]:has-text("المحطات مقفلة")').count() === 1 && await c2.locator('text=انتهت مدة').count() === 1, 'expired code: full lock after the period');
  // clock turned back on the expired device
  const lockedState = await c2.evaluate(() => ({ ...localStorage }));
  const { p: c3 } = await newDev();
  await c3.goto(B + '/welcome'); await c3.evaluate((st) => { localStorage.clear(); for (const [k, v] of Object.entries(st)) localStorage.setItem(k, v); }, lockedState);
  await c3.goto(B + '/station'); await c3.waitForTimeout(1800);
  ok(await c3.locator('text=تاريخ الجهاز أو ساعته غير صحيحة').count() === 1, 'clock turned back is detected');
  // owner extends C → «تحقق الآن» on the future-clock device unlocks
  card = await owner('مختبر يوم واحد');
  await card.locator('select[aria-label="تمديد"]').selectOption('30'); await o.waitForTimeout(700);
  await c2.click('button:has-text("تحقق الآن")'); await c2.waitForTimeout(2000);
  ok(await c2.locator('div[role=dialog]').count() === 0, 'extension reaches the device via «تحقق الآن»');
  // ── legacy device: 30 days ──
  const { p: l } = await newDev();
  await l.goto(B + '/verify/x'); await l.evaluate(() => { localStorage.clear(); localStorage.setItem('station.tests.v1', '[]'); localStorage.setItem('local.license.enabled', '1'); });
  await l.goto(B + '/station'); await l.waitForTimeout(1800);
  ok(await l.locator('div[role=dialog]').count() === 0 && await l.locator('text=يعمل بالتفعيل السابق').count() === 1, 'existing device: works with 30-day notice');
  const legacyState = await l.evaluate(() => ({ ...localStorage }));
  const { p: l2 } = await newDev({ time: new Date(Date.now() + 31 * DAY) });
  await l2.goto(B + '/verify/x'); await l2.evaluate((st) => { localStorage.clear(); for (const [k, v] of Object.entries(st)) localStorage.setItem(k, v); localStorage.removeItem('local.license.seen.v1'); }, legacyState);
  await l2.goto(B + '/station'); await l2.waitForTimeout(1800);
  ok(await l2.locator('text=انتهت فترة التفعيل السابق').count() === 1, 'existing device: locked after 30 days');
  await l2.evaluate(() => localStorage.removeItem('local.license.grace.v1')); await l2.reload(); await l2.waitForTimeout(1500);
  ok(await l2.locator('text=انتهت فترة التفعيل السابق').count() === 1, 'deleting the 30-day start does not restart it');
  // ── admin code on device D ──
  const { ctx: dctx, p: d } = await newDev();
  await d.goto(B + '/welcome'); await d.waitForTimeout(1500);
  await d.fill('input[aria-label="رمز المختبر"]', codeB); await d.click('button:has-text("تفعيل")'); await d.waitForTimeout(1500);
  const cookies = await dctx.cookies();
  ok(cookies.some(c => c.name === 'lab_lic_admin'), 'admin code sets the admin-panel cookie');
  await d.reload(); await d.waitForTimeout(1200);
  ok(await d.locator('a[href="/login"]:has-text("الدخول")').count() === 1, 'admin card opens for code with admin');
  await d.goto(B + '/login'); await d.waitForTimeout(800);
  ok(new URL(d.url()).pathname === '/login', 'admin login reachable with admin code');
  // owner removes admin from B → refresh clears cookie
  card = await owner('مختبر النور');
  await card.locator('button[aria-pressed]:has-text("لوحة الإدارة الكاملة")').click(); await o.waitForTimeout(600);
  await forceRefresh(d); await d.goto(B + '/welcome'); await d.waitForTimeout(1800);
  await d.goto(B + '/login'); await d.waitForTimeout(800);
  ok(new URL(d.url()).pathname === '/welcome', 'removing admin from the code closes the panel');
  // ── move A to device B ──
  card = await owner('مختبر الأمل');
  await card.locator('button:has-text("نقل لجهاز جديد")').click(); await o.waitForTimeout(600);
  await bdev.goto(B + '/welcome'); await bdev.waitForTimeout(1500);
  await bdev.fill('input[aria-label="رمز المختبر"]', codeA); await bdev.click('button:has-text("تفعيل")'); await bdev.waitForTimeout(1500);
  ok(await bdev.locator('div[role=dialog]').count() === 0, 'after «نقل لجهاز جديد» the code activates device B');
  await forceRefresh(a); await a.goto(B + '/station'); await a.waitForTimeout(1800);
  ok(await a.locator('text=لم يعد صالحاً').count() === 1, 'old device A locks once the code moved');
  // renewal with a new code on the locked device
  const codeA2 = await create('مختبر الأمل 2', 30, false);
  await a.fill('input[aria-label="رمز المختبر"]', codeA2); await a.click('button:has-text("تفعيل رمز جديد")'); await a.waitForTimeout(1800);
  ok(await a.locator('div[role=dialog]').count() === 0, 'locked device unlocks with a new code');
  // data kept
  ok(await a.evaluate(() => !!localStorage.getItem('station.tests.v1')), 'station data still on the device');
  // owner list
  await o.reload(); await o.waitForTimeout(800);
  const txt = await o.locator('body').innerText();
  ok(txt.includes('مختبر الأمل') && txt.includes('Chrome'), 'owner list shows device label');
  await o.screenshot({ path: tmp('lic-owner.png'), fullPage: true });
  await c2.goto(B + '/welcome'); await c2.waitForTimeout(300);
  await l.goto(B + '/station'); await l.waitForTimeout(1500); await l.screenshot({ path: tmp('lic-grace.png') });
  await l2.screenshot({ path: tmp('lic-locked.png') });
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exitCode = 1; });
