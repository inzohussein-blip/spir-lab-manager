const { B, OWNER, ok, launch, tmp, pdfPages, done } = require('./lib.cjs');
const fs = require('node:fs');
(async () => {
  const b = await launch();
  const errs = [];
  const ctxO = await b.newContext({ viewport: { width: 1300, height: 950 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const o = await ctxO.newPage(); o.on('pageerror', e => errs.push(e.message.slice(0, 120))); o.on('dialog', d => d.accept());
  await o.goto(B + '/license'); await o.waitForTimeout(500);
  await o.fill('input[aria-label="كلمة المرور"]', OWNER); await o.click('button:has-text("دخول")');
  await o.waitForSelector('h1:has-text("إدارة الرموز")', { timeout: 15000 });
  const clip = () => o.evaluate(() => navigator.clipboard.readText());
  const card = (lab) => o.locator(`div[data-lab="${lab}"]`);
  // The code manager's sections (side menu).
  const go = (s) => o.click(`[data-section="${s}"]`);
  ok(await o.locator('text=صفحة المالك فقط').count() === 0, 'no «صفحة المالك فقط» line');
  ok(await o.locator('[data-section]').count() === 9, 'code manager: nine sections in the side menu (with «المحطات» and «رموز الدخول (PIN)»)');
  // «المحطات»: every station, including the sync station (with every code) and «عن التطبيق» (for everyone)
  await go('stations'); await o.waitForSelector('[data-testid="stations-overview"]', { timeout: 15000 });
  const sts = await o.locator('[data-testid="stations-overview"] [data-station]').evaluateAll((els) => els.map((e) => e.getAttribute('data-station')));
  ok(['station', 'purchasing', 'training', 'qc', 'roster', 'admin', 'sync', 'about'].every((x) => sts.includes(x)), `«المحطات» lists every station (${sts.join(', ')})`);
  ok((await o.locator('[data-station="about"]').innerText()).includes('للجميع') && (await o.locator('[data-station="sync"]').innerText()).includes('مع كل رمز'), 'the sync station comes with every code, «عن التطبيق» is for everyone');
  await go('codes');
  ok(await o.locator('[data-testid="codes-kpis"]').count() === 1, 'the codes open with their figures');
  // signing key sealed with AUTH_SECRET (the codes run always sets it)
  await go('system');
  await o.waitForSelector('[data-testid="key-sealed"]', { timeout: 15000 });
  ok((await o.locator('[data-testid="key-sealed"]').innerText()).includes('مشفّر بـ AUTH_SECRET'), 'signing key shown as sealed with AUTH_SECRET');
  // 5. trial
  await go('new');
  await o.fill('label:has-text("اسم المختبر") input', 'مختبر التجربة');
  await o.click('button:has-text("رمز تجريبي 7 أيام")'); await o.waitForTimeout(800);
  const trialCode = (await o.locator('div.font-mono.text-3xl').innerText()).trim();
  await go('codes');
  ok(await card('مختبر التجربة').locator('text=تجريبي').count() >= 1 && (await card('مختبر التجربة').innerText()).includes('7 يوم'), 'trial code: 7 days with «تجريبي» badge');
  // 2. activation message
  await o.click('button:has-text("نسخ رسالة التفعيل")'); await o.waitForTimeout(300);
  const msg = await clip();
  ok(msg.includes(trialCode) && msg.includes('مختبر التجربة') && msg.includes('/welcome') && msg.includes('07803993585') && msg.includes('(تجريبي)'), 'activation message has code, lab, link, phone');
  await o.click('button:text-is("تم")');
  // normal code, activate on a device
  await go('new');
  await o.fill('label:has-text("اسم المختبر") input', 'مختبر الرسالة'); await o.click('button:has-text("إنشاء الرمز")'); await o.waitForTimeout(800);
  const code = (await o.locator('div.font-mono.text-3xl').innerText()).trim(); await o.click('button:text-is("تم")');
  await go('codes');
  const ctxD = await b.newContext({ viewport: { width: 1300, height: 900 } }); const d = await ctxD.newPage(); d.on('pageerror', e => errs.push(e.message.slice(0, 120)));
  await d.goto(B + '/welcome'); await d.waitForTimeout(1500);
  await d.fill('input[aria-label="رمز المختبر"]', code); await d.click('button:has-text("تفعيل")'); await d.waitForTimeout(1500);
  // 6. default contact on the activation screen (shown before activation)
  const d0 = await (await b.newContext()).newPage(); await d0.goto(B + '/welcome'); await d0.waitForTimeout(1500);
  ok(await d0.locator('div[role=dialog]:has-text("07803993585")').count() === 1, 'activation window shows your number by default');
  // 4. payment, 8. device name, 7. message
  await o.reload(); await o.waitForTimeout(800);
  const c = card('مختبر الرسالة');
  await c.locator('button:has-text("الدفع والجهاز والرسالة والسجل")').click();
  await c.locator('input[aria-label="المبلغ"]').fill('150,000'); await c.locator('input[aria-label="مدفوع"]').check();
  await c.locator('div:has(> input[aria-label="المبلغ"]) button:has-text("حفظ")').click(); await o.waitForTimeout(700);
  ok(await c.locator('text=مدفوع · 150,000').count() === 1, 'payment saved: «مدفوع · 150,000»');
  ok((await o.locator('p:has(svg.lucide-wallet)').innerText()).includes('150,000'), 'paid total shown');
  await c.locator('input[aria-label="اسم الجهاز"]').fill('حاسوب الاستقبال'); await c.locator('div:has(> input[aria-label="اسم الجهاز"]) button:has-text("حفظ")').click(); await o.waitForTimeout(700);
  ok((await c.innerText()).includes('حاسوب الاستقبال'), 'device name shown instead of type');
  await c.locator('input[aria-label="رسالة للمختبر"]').fill('يرجى التجديد قبل نهاية الشهر'); await c.locator('button:has-text("إرسال")').click(); await o.waitForTimeout(700);
  ok(await c.locator('span:has-text("رسالة")').count() >= 1, 'message badge on the code');
  // device receives the message
  await d.evaluate(() => { const s = JSON.parse(localStorage.getItem('local.license.v1')); s.checkedAt = 0; localStorage.setItem('local.license.v1', JSON.stringify(s)); });
  await d.goto(B + '/station'); await d.waitForTimeout(2000);
  ok(await d.locator('text=رسالة من المزوّد').count() === 1 && await d.locator('text=يرجى التجديد قبل نهاية الشهر').count() === 1, 'station shows the provider message');
  await d.screenshot({ path: tmp('lic-msg.png') });
  await d.locator('button:text-is("تم")').click(); await d.reload(); await d.waitForTimeout(1500);
  ok(await d.locator('text=رسالة من المزوّد').count() === 0, 'message stays dismissed after «تم»');
  // station PIN forgotten: the owner sets a new one, the device takes it with «نسيت الرمز؟ ← تحديث»
  await d.goto(B + '/station/settings#look'); await d.waitForTimeout(1500);
  await d.click('[data-testid="pin-card"] button:has-text("تفعيل رمز الدخول")');
  await d.fill('input[aria-label="الرمز الجديد"]', '1111'); await d.fill('input[aria-label="تأكيد الرمز"]', '1111'); await d.click('button:has-text("حفظ الرمز")');
  const dp = await ctxD.newPage(); dp.on('pageerror', e => errs.push(e.message.slice(0, 120)));
  await dp.goto(B + '/station'); await dp.waitForTimeout(1500);
  ok(await dp.locator('[data-testid="pin-gate"]').isVisible(), 'device PIN asked in a new window');
  // «رموز الدخول (PIN)»: the owner's own window — per code, per station, several PINs for one station.
  await o.reload(); await o.waitForTimeout(800);
  await card('مختبر الرسالة').locator('button:has-text("الدفع والجهاز والرسالة والسجل")').click();
  ok((await card('مختبر الرسالة').locator('[data-testid="pin-owner"]').innerText()).includes('لم تُعيَّن رموز من هنا'), 'the code\'s details point to «رموز الدخول»');
  await card('مختبر الرسالة').locator('[data-testid="pin-owner"] button:has-text("فتح رموز الدخول")').click();
  await o.waitForSelector('[data-testid="pin-section"]', { timeout: 15000 });
  const pc = o.locator('[data-testid="pin-code"][data-pin-lab="مختبر الرسالة"]');
  const box = (st) => pc.locator(`[data-testid="pin-station"][data-station="${st}"]`);
  const sts2 = await pc.locator('[data-testid="pin-station"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-station')));
  ok(sts2.includes('station') && sts2.includes('sync') && sts2.includes('about') && !sts2.includes('admin'), `the code opens expanded, a box per station with sync and about (${sts2.join(', ')})`);
  await box('station').locator('input[aria-label="اسم الرمز"]').fill('الاستقبال');
  await box('station').locator('input[aria-label="رمز الدخول الجديد"]').fill('2468'); await box('station').locator('button:has-text("تعيين الرمز")').click(); await o.waitForTimeout(900);
  await box('station').locator('input[aria-label="اسم الرمز"]').fill('المساء');
  await box('station').locator('input[aria-label="رمز الدخول الجديد"]').fill('1357'); await box('station').locator('button:has-text("إضافة رمز آخر")').click(); await o.waitForTimeout(900);
  ok(await box('station').locator('[data-testid="pin-entry"]').count() === 2 && (await box('station').innerText()).includes('بانتظار اتصال الجهاز'), 'two PINs for the lab station, waiting for the device');
  ok(!(await box('station').innerText()).includes('2468'), 'the PINs themselves are never shown');
  await box('sync').locator('input[aria-label="رمز الدخول الجديد"]').fill('9090'); await box('sync').locator('button:has-text("تعيين الرمز")').click(); await o.waitForTimeout(900);
  await dp.click('[data-testid="pin-gate"] button:has-text("نسيت الرمز؟")');
  await dp.click('[data-testid="pin-gate"] button:has-text("تحديث من المزوّد")'); await dp.waitForTimeout(1500);
  await dp.fill('input[aria-label="رمز الدخول"]', '1111'); await dp.click('[data-testid="pin-gate"] button:has-text("دخول")');
  ok(await dp.locator('text=رمز غير صحيح').isVisible(), 'the forgotten PIN no longer works');
  await dp.fill('input[aria-label="رمز الدخول"]', '2468'); await dp.click('[data-testid="pin-gate"] button:has-text("دخول")');
  ok(await dp.locator('[data-testid="pin-gate"]').count() === 0, 'the owner\'s new PIN opens the station');
  const dp2 = await ctxD.newPage(); dp2.on('pageerror', e => errs.push(e.message.slice(0, 120)));
  await dp2.goto(B + '/station'); await dp2.waitForSelector('[data-testid="pin-gate"]', { timeout: 15000 });
  await dp2.fill('input[aria-label="رمز الدخول"]', '1357'); await dp2.click('[data-testid="pin-gate"] button:has-text("دخول")');
  ok(await dp2.locator('[data-testid="pin-gate"]').count() === 0, 'the second PIN of the same station opens it too');
  await dp2.goto(B + '/sync'); await dp2.waitForSelector('[data-testid="pin-gate"]', { timeout: 15000 });
  await dp2.fill('input[aria-label="رمز الدخول"]', '2468'); await dp2.click('[data-testid="pin-gate"] button:has-text("دخول")');
  ok(await dp2.locator('text=رمز غير صحيح').isVisible(), 'each station has its own PIN (the lab station\'s does not open sync)');
  await dp2.fill('input[aria-label="رمز الدخول"]', '9090'); await dp2.click('[data-testid="pin-gate"] button:has-text("دخول")');
  ok(await dp2.locator('[data-testid="pin-gate"]').count() === 0, 'the sync station opens with its own PIN');
  await dp2.goto(B + '/station/settings#look'); await dp2.waitForSelector('[data-testid="pin-card"]', { timeout: 15000 });
  ok(await dp2.locator('[data-testid="pin-extra"]').count() === 1, 'the station settings say another PIN from the provider is accepted');
  await dp2.close();
  await o.reload(); await o.waitForTimeout(800);
  ok((await box('station').innerText()).includes('وصل الجهاز'), 'the window shows the device got it');
  // Hide the feature for this lab: no PIN asked, its card hidden; show it again: back as it was.
  await pc.locator('[data-testid="pin-hide-toggle"]').click(); await o.waitForTimeout(900);
  ok(await pc.locator('[data-testid="pin-hidden-badge"]').count() === 1, 'PIN feature hidden for the code');
  await dp.evaluate(async () => { const s = JSON.parse(localStorage.getItem('local.license.v1')); s.checkedAt = 0; localStorage.setItem('local.license.v1', JSON.stringify(s)); });
  const dp3 = await ctxD.newPage(); dp3.on('pageerror', e => errs.push(e.message.slice(0, 120)));
  await dp3.goto(B + '/station'); await dp3.waitForTimeout(2500); await dp3.reload(); await dp3.waitForTimeout(1500);
  ok(await dp3.locator('[data-testid="pin-gate"]').count() === 0, 'hidden: the station opens without a PIN');
  await dp3.goto(B + '/station/settings#look'); await dp3.waitForSelector('[data-testid="pin-card-hidden"]', { timeout: 15000 });
  ok(await dp3.locator('[data-testid="pin-card"]').count() === 0, 'hidden: no PIN card in the settings, a note instead');
  await o.reload(); await o.waitForTimeout(800);
  await pc.locator('[data-testid="pin-hide-toggle"]').click(); await o.waitForTimeout(900);
  ok(await pc.locator('[data-testid="pin-hidden-badge"]').count() === 0, 'PIN feature shown again');
  await dp3.evaluate(async () => { const s = JSON.parse(localStorage.getItem('local.license.v1')); s.checkedAt = 0; localStorage.setItem('local.license.v1', JSON.stringify(s)); });
  await dp3.goto(B + '/station'); await dp3.waitForTimeout(2500);
  ok(await dp3.locator('[data-testid="pin-gate"]').isVisible(), 'shown again: the PIN is asked as before');
  await dp3.close();
  // Remove one station's PINs from the window.
  await o.reload(); await o.waitForTimeout(800);
  await box('sync').locator('button:has-text("إزالة الرمز")').click(); await o.waitForTimeout(900);
  ok((await box('sync').innerText()).includes('أُزيل الرمز'), 'a station\'s PIN removed from the window');
  await dp.close();
  // 3. history
  await go('codes'); await o.reload(); await o.waitForTimeout(800);
  await card('مختبر الرسالة').locator('button:has-text("الدفع والجهاز والرسالة والسجل")').click();
  const hist = await card('مختبر الرسالة').locator('ul').innerText();
  ok(['إنشاء الرمز', 'تفعيل على جهاز', 'تسجيل الدفع', 'رسالة للمختبر', 'رموز الدخول'].every((k) => hist.includes(k)), 'history lists create / activate / payment / message / PIN');
  // 1. filters & sort
  await o.click('button[aria-pressed]:has-text("تجريبي")'); await o.waitForTimeout(200);
  ok(await o.locator('div[data-lab]').count() === 1 && await o.locator('div[data-lab="مختبر التجربة"]').count() === 1, 'filter «تجريبي» shows only the trial code');
  await o.click('button[aria-pressed]:has-text("غير مستخدم")'); await o.waitForTimeout(200);
  ok(await o.locator('div[data-lab]').count() === 1, 'filter «غير مستخدم»');
  await o.click('button[aria-pressed]:has-text("الكل")');
  await o.selectOption('select[aria-label="الترتيب"]', 'name'); await o.waitForTimeout(200);
  const names = await o.locator('div[data-lab]').evaluateAll((els) => els.map((e) => e.getAttribute('data-lab')));
  ok(JSON.stringify(names) === JSON.stringify([...names].sort((a, b) => a.localeCompare(b, 'ar'))), 'sort by name');
  // copy status message
  await card('مختبر الرسالة').locator('button:has-text("رسالة الحالة")').click(); await o.waitForTimeout(300);
  const st = await clip();
  ok(st.includes('مختبر الرسالة') && st.includes('فعّال من') && st.includes('07803993585'), 'status message copied');
  // 9. CSV
  const [dl] = await Promise.all([o.waitForEvent('download'), o.click('button:has-text("تصدير CSV")')]);
  const csv = fs.readFileSync(await dl.path(), 'utf8');
  ok(csv.includes('مختبر الرسالة') && csv.includes('150,000') && csv.includes('حاسوب الاستقبال') && csv.includes('مختبر التجربة'), 'CSV export has codes, payment, device');
  await o.screenshot({ path: tmp('lic2-owner.png'), fullPage: true });
  // backup: download, delete a code, restore it back
  await go('backup');
  const [bk] = await Promise.all([o.waitForEvent('download'), o.click('button:has-text("تنزيل نسخة احتياطية")')]);
  const backup = JSON.parse(fs.readFileSync(await bk.path(), 'utf8'));
  ok(backup.app === 'lab-codes' && backup.licenses.length >= 2 && !JSON.stringify(backup).includes(code) && !JSON.stringify(backup).includes('signing_key'), 'backup has codes as hashes only, no signing key');
  await go('codes');
  await card('مختبر التجربة').locator('button[aria-label="حذف"]').click(); await o.waitForTimeout(700);
  ok(await card('مختبر التجربة').count() === 0, 'code deleted before restore');
  await go('backup');
  await o.setInputFiles('input[aria-label="ملف النسخة"]', await bk.path()); await o.waitForTimeout(1500);
  const restored = await o.locator('text=تم الاسترجاع').count() === 1;
  await go('codes');
  ok(await card('مختبر التجربة').count() === 1 && restored, 'restore brings the deleted code back');
  // the restored code still activates (its hash came back)
  const ctxT = await b.newContext(); const t = await ctxT.newPage();
  await t.goto(B + '/welcome'); await t.waitForTimeout(1500);
  await t.fill('input[aria-label="رمز المختبر"]', trialCode); await t.click('button:has-text("تفعيل")'); await t.waitForTimeout(1500);
  ok(await t.locator('div[role=dialog]').count() === 0, 'restored code activates a device');
  // sign-in log + attempt limit shared through the database
  const ctxX = await b.newContext(); const x = await ctxX.newPage(); x.on('dialog', d => d.accept());
  await x.goto(B + '/license'); await x.waitForTimeout(500);
  for (let i = 0; i < 9; i++) { await x.fill('input[aria-label="كلمة المرور"]', 'wrong-' + i); await x.click('button:has-text("دخول")'); await x.waitForTimeout(700); }
  ok(await x.locator('text=محاولات كثيرة').count() === 1, 'too many wrong passwords are blocked');
  await o.reload(); await o.waitForTimeout(800); await go('security');
  const log = await o.locator('div.rounded-2xl:has-text("سجل الدخول لهذه الصفحة")').innerText();
  ok(log.includes('دخول ناجح') && (log.match(/محاولة فاشلة/g) || []).length >= 8, 'sign-in log shows the success and the failed tries');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
