const { B, OWNER, ok, launch, tmp, pdfPages, done } = require('./lib.cjs');
const fs = require('node:fs');
(async () => {
  const b = await launch();
  const errs = [];
  const ctxO = await b.newContext({ viewport: { width: 1300, height: 950 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const o = await ctxO.newPage(); o.on('pageerror', e => errs.push(e.message.slice(0, 120))); o.on('dialog', d => d.accept());
  await o.goto(B + '/licenses'); await o.waitForTimeout(500);
  await o.fill('input[aria-label="كلمة المرور"]', OWNER); await o.click('button:has-text("دخول")');
  await o.waitForSelector('h1:has-text("إدارة الرموز")', { timeout: 15000 });
  const clip = () => o.evaluate(() => navigator.clipboard.readText());
  const card = (lab) => o.locator(`div[data-lab="${lab}"]`);
  // 5. trial
  await o.fill('label:has-text("اسم المختبر") input', 'مختبر التجربة');
  await o.click('button:has-text("رمز تجريبي 7 أيام")'); await o.waitForTimeout(800);
  const trialCode = (await o.locator('div.font-mono.text-3xl').innerText()).trim();
  ok(await card('مختبر التجربة').locator('text=تجريبي').count() >= 1 && (await card('مختبر التجربة').innerText()).includes('7 يوم'), 'trial code: 7 days with «تجريبي» badge');
  // 2. activation message
  await o.click('button:has-text("نسخ رسالة التفعيل")'); await o.waitForTimeout(300);
  const msg = await clip();
  ok(msg.includes(trialCode) && msg.includes('مختبر التجربة') && msg.includes('/welcome') && msg.includes('07803993585') && msg.includes('(تجريبي)'), 'activation message has code, lab, link, phone');
  await o.click('button:text-is("تم")');
  // normal code, activate on a device
  await o.fill('label:has-text("اسم المختبر") input', 'مختبر الرسالة'); await o.click('button:has-text("إنشاء الرمز")'); await o.waitForTimeout(800);
  const code = (await o.locator('div.font-mono.text-3xl').innerText()).trim(); await o.click('button:text-is("تم")');
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
  // 3. history
  await o.reload(); await o.waitForTimeout(800);
  await card('مختبر الرسالة').locator('button:has-text("الدفع والجهاز والرسالة والسجل")').click();
  const hist = await card('مختبر الرسالة').locator('ul').innerText();
  ok(['إنشاء الرمز', 'تفعيل على جهاز', 'تسجيل الدفع', 'رسالة للمختبر'].every((k) => hist.includes(k)), 'history lists create / activate / payment / message');
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
  const [bk] = await Promise.all([o.waitForEvent('download'), o.click('button:has-text("تنزيل نسخة احتياطية")')]);
  const backup = JSON.parse(fs.readFileSync(await bk.path(), 'utf8'));
  ok(backup.app === 'lab-codes' && backup.licenses.length >= 2 && !JSON.stringify(backup).includes(code) && !JSON.stringify(backup).includes('signing_key'), 'backup has codes as hashes only, no signing key');
  await card('مختبر التجربة').locator('button[aria-label="حذف"]').click(); await o.waitForTimeout(700);
  ok(await card('مختبر التجربة').count() === 0, 'code deleted before restore');
  await o.setInputFiles('input[aria-label="ملف النسخة"]', await bk.path()); await o.waitForTimeout(1500);
  ok(await card('مختبر التجربة').count() === 1 && await o.locator('text=تم الاسترجاع').count() === 1, 'restore brings the deleted code back');
  // the restored code still activates (its hash came back)
  const ctxT = await b.newContext(); const t = await ctxT.newPage();
  await t.goto(B + '/welcome'); await t.waitForTimeout(1500);
  await t.fill('input[aria-label="رمز المختبر"]', trialCode); await t.click('button:has-text("تفعيل")'); await t.waitForTimeout(1500);
  ok(await t.locator('div[role=dialog]').count() === 0, 'restored code activates a device');
  // sign-in log + attempt limit shared through the database
  const ctxX = await b.newContext(); const x = await ctxX.newPage(); x.on('dialog', d => d.accept());
  await x.goto(B + '/licenses'); await x.waitForTimeout(500);
  for (let i = 0; i < 9; i++) { await x.fill('input[aria-label="كلمة المرور"]', 'wrong-' + i); await x.click('button:has-text("دخول")'); await x.waitForTimeout(700); }
  ok(await x.locator('text=محاولات كثيرة').count() === 1, 'too many wrong passwords are blocked');
  await o.reload(); await o.waitForTimeout(800);
  const log = await o.locator('div.rounded-2xl:has-text("سجل الدخول لهذه الصفحة")').innerText();
  ok(log.includes('دخول ناجح') && (log.match(/محاولة فاشلة/g) || []).length >= 8, 'sign-in log shows the success and the failed tries');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exitCode = 1; });
