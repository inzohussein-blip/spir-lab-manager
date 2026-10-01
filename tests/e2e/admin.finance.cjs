// «الحسابات» in the full admin panel: a referred visit, its invoice with a part payment → the day's cash
// box, the patient's debt, and the doctor's share; an expense; closing the day; the side menu.
const { B, ok, launch, done } = require('./lib.cjs');
(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(`${p.url()} ${e.message.slice(0, 140)}`));
  const num = (t) => Number(String(t).replace(/[^\d.-]/g, '')) || 0;
  await p.goto(B + '/login');
  await p.fill('input[name="username"]', 'admin'); await p.fill('input[name="password"]', 'admin123');
  await Promise.all([p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 }), p.click('button[type="submit"]')]);

  // The side menu.
  for (const [href, label] of [['/cashbox', 'الصندوق اليومي'], ['/debts', 'الديون'], ['/referrers/commissions', 'حصص الأطباء']]) {
    ok(await p.locator(`aside a[href="${href}"]:has-text("${label}")`).count() >= 1, `menu: «${label}»`);
  }

  // A doctor with a 10% share.
  const doc = 'د. حصة التجربة ' + Date.now().toString().slice(-4);
  await p.goto(B + '/referrers');
  await p.fill('input[name="name"]', doc); await p.fill('input[name="commission_pct"]', '10');
  await p.click('form button:has-text("إضافة")'); await p.waitForTimeout(800);
  await p.reload();
  ok((await p.locator(`tr:has-text("${doc}")`).innerText()).includes('10%'), 'a referring doctor with his share (10%)');

  // A visit he referred, with a priced test.
  const name = 'مريض الحسابات ' + Date.now().toString().slice(-5);
  await p.goto(B + '/patients/new');
  await p.fill('input[name="full_name"]', name); await p.fill('input[name="age_years"]', '30'); await p.fill('input[name="phone"]', '07712340000');
  await Promise.all([p.waitForURL((u) => /^\/patients\/[0-9a-f-]{36}$/.test(u.pathname), { timeout: 20000 }), p.click('button:has-text("حفظ المريض")')]);
  const patientId = new URL(p.url()).pathname.split('/').pop();
  await p.goto(B + '/orders/new?patient=' + patientId); await p.waitForTimeout(1200);
  await p.click('button:has-text("طبيب من المجمع")');
  await p.locator('select').filter({ has: p.locator(`option:has-text("${doc}")`) }).selectOption({ label: doc });
  await p.locator('button', { hasText: /د\.ع/ }).first().click();
  await p.click('button:has-text("إرسال الطلب للمختبر")');
  await p.waitForURL((u) => /^\/orders\/[0-9a-f-]{36}$/.test(u.pathname), { timeout: 20000 });
  // Its invoice, half paid.
  await Promise.all([p.waitForURL((u) => /^\/invoices\/[0-9a-f-]{36}$/.test(u.pathname), { timeout: 20000 }), p.click('button:has-text("إنشاء فاتورة")')]);
  const total = num(await p.locator('input[name="amount"]').inputValue());
  ok(total > 0, `an invoice for the visit (${total})`);
  const part = Math.round(total / 2);
  await p.fill('input[name="amount"]', String(part));
  await p.click('button:has-text("تسجيل الدفعة")'); await p.waitForTimeout(1000);

  // The day's cash box.
  await p.goto(B + '/cashbox'); await p.waitForSelector('[data-testid="cashbox"]', { timeout: 20000 });
  ok((await p.locator('[data-testid="cashbox-in"]').innerText()).includes(name), 'cash box: the payment is in today\'s money in');
  await p.fill('[data-testid="cashbox-add-expense"] input[name="title"]', 'كهرباء التجربة');
  await p.fill('[data-testid="cashbox-add-expense"] input[name="amount"]', '1000');
  await p.click('[data-testid="cashbox-add-expense"] button'); await p.waitForTimeout(1000);
  await p.reload();
  ok((await p.locator('[data-testid="cashbox-out"]').innerText()).includes('كهرباء التجربة'), 'an expense added from the cash box');
  const tiles = await p.locator('[data-testid="cashbox-tiles"]').innerText();
  ok(tiles.includes('الداخل') && tiles.includes('صافي اليوم'), 'money in, out and the day\'s net');
  await p.fill('[data-testid="cashbox-close"] input[name="counted"]', '0');
  await p.click('[data-testid="cashbox-close"] button:has-text("إغلاق اليوم")'); await p.waitForTimeout(1000);
  await p.reload();
  ok((await p.locator('[data-testid="cashbox-closed"]').innerText()).includes('الفرق'), 'the day closed with the counted cash and the difference');
  ok(await p.locator('[data-testid="cashbox-add-expense"]').count() === 0, 'a closed day takes no more expenses');
  await p.click('[data-testid="cashbox-closed"] button:has-text("إعادة فتح")'); await p.waitForTimeout(800);
  await p.reload();
  ok(await p.locator('[data-testid="cashbox-close"]').count() === 1, 'and can be opened again');
  ok((await p.locator('[data-testid="cashbox-month"]').innerText()).includes('الصافي'), 'the month\'s summary');

  // The debt.
  await p.goto(B + '/debts?q=' + encodeURIComponent(name)); await p.waitForSelector('[data-testid="debts"]', { timeout: 20000 });
  const row = p.locator(`[data-testid="debts-list"] tr:has-text("${name}")`);
  ok(await row.count() === 1 && num(await row.locator('td').nth(4).innerText()) === total - part, `the patient owes the rest (${total - part})`);
  ok(((await row.locator('a[href^="https://wa.me/964"]').getAttribute('href')) || '').includes('9647712340000'), 'a WhatsApp reminder to his number');

  // The doctor's share.
  await p.goto(B + '/referrers/commissions'); await p.waitForSelector('[data-testid="commissions"]', { timeout: 20000 });
  const drow = p.locator(`tr[data-referrer="${doc}"]`);
  ok(num(await drow.locator('td').nth(1).innerText()) === 1, 'his referral this month');
  await drow.locator('a:has-text("الكشف")').click(); await p.waitForSelector('[data-testid="commission-statement"]', { timeout: 20000 });
  ok(num(await p.locator('[data-testid="commission-share"]').innerText()) === Math.round(total * 0.1), `his statement: 10% of ${total}`);

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
