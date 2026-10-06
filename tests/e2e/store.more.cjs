// «المخزن والمشتريات» additions: kits (defined in «الأصناف», bought in «المشتريات»), the movement
// log, the stocktake, and three options that start off: supplier debts, prices, barcodes.
const { B, ok, launch, done, kv, kvPut, resetLocal } = require('./lib.cjs');
(async () => {
  const b = await launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(`${p.url()} ${e.message.slice(0, 140)}`)); p.on('dialog', (d) => d.accept());
  await p.goto(B + '/welcome'); await resetLocal(p, { 'local.activation.v1': 'legacy' });
  const settled = async (fn, ms = 5000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await p.waitForTimeout(150); } return false; };
  const stock = async () => (await kv(p, 'station.stock.v1')) || [];
  const qty = async (id) => (await stock()).find((s) => s.id === id)?.qty;
  const sw = (label) => p.locator(`label:has(span:text-is("${label}"))`).locator('button[role=switch]');

  await p.goto(B + '/station'); await p.waitForTimeout(1200); // the lab's tests exist once the station opened
  await kvPut(p, 'station.stock.v1', [{ id: 'glu', name: 'كاشف السكر', qty: 0 }, { id: 'cal', name: 'محلول المعايرة', qty: 0 }]);

  // ── A kit: defined in «الأصناف» ──
  await p.goto(B + '/store/items'); await p.waitForSelector('[data-testid="items-list"]', { timeout: 20000 });
  await p.click('[data-testid="kit-new"]');
  const kf = p.locator('[data-testid="kit-form"]');
  await kf.locator('input[aria-label="اسم الكت"]').fill('كت السكر');
  await kf.locator('input[aria-label="صنف في الكت"]').first().fill('كاشف السكر');
  await kf.locator('input[aria-label="الكمية في الكت"]').first().fill('4');
  await kf.locator('button:has-text("صنف آخر في الكت")').click();
  await kf.locator('input[aria-label="صنف في الكت"]').nth(1).fill('محلول المعايرة');
  await kf.locator('input[aria-label="الكمية في الكت"]').nth(1).fill('1');
  await kf.locator('button:has-text("صنف آخر في الكت")').click();
  await kf.locator('input[aria-label="صنف في الكت"]').nth(2).fill('محلول التنظيف');
  ok(await kf.locator('[data-testid="kit-part-new"]').count() === 1, 'a name not in the stock room is marked «جديد»');
  await p.click('[data-testid="kit-save"]');
  const clean = async () => ((await stock()).find((s) => s.name === 'محلول التنظيف'));
  ok(await settled(async () => !!(await clean())) && (await clean()).qty === 0, 'saving the kit adds the new item to the stock room (0)');
  ok(await settled(async () => JSON.stringify(((await kv(p, 'station.kits.v1')) || [])[0]?.parts) === JSON.stringify([{ stockId: 'glu', qty: 4 }, { stockId: 'cal', qty: 1 }, { stockId: (await clean()).id, qty: 1 }])), 'kit saved: 4 × reagent + 1 × calibrator + 1 × the new item');
  ok(await kf.count() === 0 && (await p.locator('li[data-kit="كت السكر"]').innerText()).includes('كاشف السكر'), 'kit listed with what it holds');
  ok((await p.locator('tr[data-item="كاشف السكر"] [data-testid="item-kits"]').innerText()).includes('كت السكر × 4'), 'the item shows the kit it comes in');

  // ── Bought in «المشتريات»: its contents go to the stock room ──
  await p.goto(B + '/store'); await p.waitForSelector('[data-testid="purchase-new"]', { timeout: 20000 });
  await p.click('[data-testid="purchase-new"]');
  await p.fill('[data-line="0"] input[data-line-name]', 'كت السكر');
  await p.click('button:has-text("حفظ العملية")');
  ok((await p.locator('[data-testid="purchase-form"] [role=alert]').innerText()).includes('اسم كت'), 'a kit typed as «صنف» is refused: items and kits are separate');
  await p.click('[data-line="0"] button[data-line-kind="kit"]');
  ok(await p.locator('[data-line="0"] input[placeholder="الكت"]').count() === 1, '«كت» chosen: the line takes a kit (its own list)');
  await p.locator('input[aria-label="العدد"]').first().fill('2');
  ok(await p.locator('[data-testid="line-kit"]').count() === 1 && (await p.locator('[data-testid="kit-contents"]').innerText()).includes('كاشف السكر × 8'), 'the line is marked as a kit, with what it adds (2 kits → 8 reagents)');
  await p.locator('input[aria-label="المجموع"]').first().fill('100000');
  ok(await p.locator('input[aria-label="سعر الواحد"]').first().inputValue() === '50,000', 'the total, and the price of one kit beside it (100,000 ÷ 2 = 50,000)');
  await p.click('button:has-text("حفظ العملية")');
  ok(await settled(async () => (await qty('glu')) === 8 && (await qty('cal')) === 2), 'buying 2 kits: 8 reagents and 2 calibrators in stock');
  const kp = ((await kv(p, 'purchasing.purchases.v1')) || [])[0];
  ok(kp?.items[0]?.kitId && kp.total === 100000 && kp.items[0].unitPrice === 50000, 'the purchase remembers the kit, its total and the price of one');

  // ── An unpaid purchase becomes paid in one click (and back) ──
  const firstPur = async () => ((await kv(p, 'purchasing.purchases.v1')) || [])[0];
  ok((await firstPur()).paid === false && (await p.locator('[data-testid="purchase-due"]').first().innerText()).includes('غير مدفوعة'), 'saved as unpaid');
  await p.locator('li[data-purchase] button:has-text("تم الدفع")').first().click();
  ok(await settled(async () => (await firstPur()).paid === true) && (await p.locator('[data-testid="purchase-due"]').first().innerText()).includes('مدفوعة'), '«تم الدفع»: the purchase is now paid');
  await p.click('button[role=tab]:has-text("غير مدفوعة")');
  ok(await p.locator('li[data-purchase]').count() === 0, 'the «غير مدفوعة» filter no longer lists it');
  await p.click('button[role=tab]:has-text("الكل")');
  await p.locator('[data-testid="purchase-due"] button:has-text("مدفوعة")').first().click();
  ok(await settled(async () => (await firstPur()).paid === false), 'clicking «مدفوعة» turns it back to unpaid');
  await p.locator('li[data-purchase] button[aria-expanded]').first().click();
  ok((await p.locator('[data-testid="purchase-details"]').innerText()).includes('كت السكر'), 'a click on the row shows its lines');

  // ── «سجل الحركة» ──
  await p.goto(B + '/store/inventory'); await p.waitForSelector('[data-testid="stock-qty"]', { timeout: 20000 });
  await p.click('button[aria-label="صرف من كاشف السكر"]'); await p.click('[data-testid="move-dialog"] button[type=submit]');
  ok(await settled(async () => (await qty('glu')) === 7), 'issued by hand (8 → 7)');
  await p.click('a[aria-label="سجل حركة كاشف السكر"]'); await p.waitForSelector('[data-testid="moves"] tbody tr[data-reason]', { timeout: 20000 });
  const reasons = await p.locator('[data-testid="moves"] tbody tr[data-reason]').evaluateAll((rs) => rs.map((r) => r.dataset.reason));
  ok(JSON.stringify(reasons) === JSON.stringify(['issue', 'purchase']), `the item's history: manual issue, then the purchase (${reasons.join(', ')})`);
  ok((await p.locator('[data-testid="moves"] tbody tr').first().innerText()).includes('7'), 'with the count after each move');

  // ── «الجرد» ──
  await p.goto(B + '/store/count'); await p.waitForSelector('[data-testid="count-table"]', { timeout: 20000 });
  await p.fill('input[aria-label="المعدود كاشف السكر"]', '5');
  ok((await p.locator('tr[data-count="كاشف السكر"] [data-testid="count-diff"]').innerText()).trim() === '-2', 'the difference shows (5 counted, 7 recorded → -2)');
  await p.click('[data-testid="count-save"]');
  ok(await settled(async () => (await qty('glu')) === 5) && (await qty('cal')) === 2, 'the stocktake sets the counted item only (7 → 5)');
  ok(await p.locator('[data-testid="count-history"] details').count() === 1, 'the stocktake is kept');
  ok(((await kv(p, 'station.stockMoves.v1')) || [])[0]?.reason === 'count', 'and recorded in the movement log');

  // ── Options: all off at first ──
  await p.goto(B + '/store/settings#extras'); await p.waitForSelector('[data-testid="store-extras"]', { timeout: 20000 });
  ok((await Promise.all(['ديون الموردين', 'الأسعار وقيمة المخزن', 'الباركود'].map((l) => sw(l).getAttribute('aria-checked')))).every((x) => x === 'false'), 'debts, prices and barcode: off by default');
  await p.goto(B + '/store'); await p.waitForSelector('[data-testid="purchase-new"]', { timeout: 20000 }); await p.click('[data-testid="purchase-new"]');
  await p.waitForSelector('input[placeholder="الصنف"]');
  ok(await p.locator('input[aria-label="المدفوع الآن"]').count() === 0 && await p.locator('[data-testid="scan-box"]').count() === 0, 'purchases as before (no payments, no scanning)');

  // ── Supplier debts ──
  await p.goto(B + '/store/settings#extras'); await p.waitForSelector('[data-testid="store-extras"]', { timeout: 20000 });
  await sw('ديون الموردين').click();
  ok(await settled(async () => (await kv(p, 'purchasing.settings.v1'))?.debts === true), 'supplier debts switched on');
  await kvPut(p, 'purchasing.suppliers.v1', [{ id: 'sup1', name: 'مورّد الكواشف' }]);
  await p.goto(B + '/store'); await p.waitForSelector('[data-testid="purchase-new"]', { timeout: 20000 }); await p.click('[data-testid="purchase-new"]');
  await p.waitForSelector('input[aria-label="المدفوع الآن"]');
  await p.fill('input[aria-label="المورّد"]', 'مورّد الكواشف');
  await p.fill('input[placeholder="الصنف"]', 'كاشف السكر');
  await p.locator('input[aria-label="العدد"]').first().fill('1');
  await p.locator('input[aria-label="المجموع"]').first().fill('10000');
  await p.fill('input[aria-label="المدفوع الآن"]', '4000');
  await p.click('button:has-text("حفظ العملية")');
  const due = p.locator('[data-testid="purchase-due"]').first();
  ok(await settled(async () => (await due.innerText()).includes('6,000')), `paid 4,000 of 10,000: 6,000 still owed (${(await due.innerText()).replace(/\s+/g, ' ')})`);
  await due.locator('button:has-text("دفعة")').click();
  await p.fill('input[aria-label="مبلغ الدفعة"]', '2000'); await p.click('button:has-text("تسجيل")');
  ok(await settled(async () => (await p.locator('[data-testid="purchase-due"]').first().innerText()).includes('4,000')), 'a further payment of 2,000: 4,000 owed');
  await settled(async () => ((await firstPur())?.payments || []).length === 2); // on disk before the page changes
  await p.goto(B + '/store/suppliers'); await p.waitForSelector('tr[data-supplier="مورّد الكواشف"]', { timeout: 20000 });
  ok((await p.locator('tr[data-supplier="مورّد الكواشف"] [data-testid="supplier-due"]').innerText()).includes('4,000'), 'the supplier\'s balance: 4,000');
  await p.click('button[aria-label="كشف حساب مورّد الكواشف"]');
  ok((await p.locator('[data-testid="statement"] tbody tr').count()) === 3 && (await p.locator('[data-testid="statement-due"]').innerText()).includes('4,000'), 'account statement: the purchase, two payments, 4,000 owed');
  await p.goto(B + '/store'); await p.waitForSelector('li[data-purchase]', { timeout: 20000 });
  await p.locator('li[data-purchase]').first().locator('button:has-text("تم الدفع")').click();
  ok(await settled(async () => { const x = (await firstPur()); return x.paid === true && x.payments.reduce((t, y) => t + y.amount, 0) === 10000; }), '«تم الدفع» with debts on: the remaining 4,000 recorded as a payment');
  await p.goto(B + '/store/suppliers'); await p.waitForSelector('tr[data-supplier="مورّد الكواشف"]', { timeout: 20000 });
  ok(!(await p.locator('tr[data-supplier="مورّد الكواشف"] [data-testid="supplier-due"]').innerText()).includes('4,000'), 'the supplier owes nothing now');

  // ── Prices: unit price from the last purchase, stock value, cost per test ──
  await p.goto(B + '/store/settings#extras'); await p.waitForSelector('[data-testid="store-extras"]', { timeout: 20000 });
  await sw('الأسعار وقيمة المخزن').click();
  ok(await settled(async () => (await kv(p, 'purchasing.settings.v1'))?.prices === true), 'prices switched on');
  ok((await stock()).find((s) => s.id === 'glu')?.price === 10000, 'the reagent\'s unit price comes from its last purchase (10,000)');
  await p.goto(B + '/store/inventory'); await p.waitForSelector('[data-testid="stock-value"]', { timeout: 20000 });
  ok((await p.locator('[data-testid="stock-value"]').innerText()).includes('60,000'), `stock value: 6 × 10,000 = 60,000 (${(await p.locator('[data-testid="stock-value"]').innerText()).replace(/\s+/g, ' ')})`);
  const hb = (await kv(p, 'station.tests.v1')).find((t) => t.code === 'HB');
  await kvPut(p, 'station.stock.v1', (await stock()).map((s) => (s.id === 'glu' ? { ...s, testIds: [hb.id] } : s)));
  await p.goto(B + '/store/items'); await p.waitForSelector('[data-testid="items-list"]', { timeout: 20000 });
  await p.click('button[role=tab]:has-text("التحاليل وموادها")'); await p.waitForSelector('tr[data-test="HB"] [data-testid="test-cost"]', { timeout: 20000 });
  ok((await p.locator('tr[data-test="HB"] [data-testid="test-cost"]').innerText()).includes('10,000'), 'cost per test: the material linked to it');

  // ── Barcodes ──
  await p.goto(B + '/store/settings#extras'); await p.waitForSelector('[data-testid="store-extras"]', { timeout: 20000 });
  await sw('الباركود').click();
  ok(await settled(async () => (await kv(p, 'purchasing.settings.v1'))?.barcode === true), 'barcodes switched on');
  await p.goto(B + '/store/items?edit=glu'); await p.waitForSelector('input[aria-label="باركود الصنف"]', { timeout: 20000 });
  await p.fill('input[aria-label="باركود الصنف"]', '6291041500213'); await p.click('button:has-text("حفظ التعديل")');
  ok(await settled(async () => (await stock()).find((s) => s.id === 'glu')?.barcode === '6291041500213'), 'barcode saved on the item');
  await p.goto(B + '/store'); await p.waitForSelector('[data-testid="purchase-new"]', { timeout: 20000 }); await p.click('[data-testid="purchase-new"]');
  await p.waitForSelector('[data-testid="scan-box"]', { timeout: 20000 });
  const scan = async (code) => { await p.fill('input[aria-label="امسح الباركود"]', code); await p.press('input[aria-label="امسح الباركود"]', 'Enter'); await p.waitForTimeout(150); };
  await scan('6291041500213'); await scan('6291041500213');
  ok(await p.locator('input[placeholder="الصنف"]').first().inputValue() === 'كاشف السكر' && await p.locator('input[aria-label="العدد"]').first().inputValue() === '2', 'purchases: scanning twice adds the item with 2');
  await scan('000');
  ok((await p.locator('[data-testid="scan-box"]').innerText()).includes('غير معروف'), 'an unknown code is said so');
  await p.goto(B + '/store/count'); await p.waitForSelector('[data-testid="scan-box"]', { timeout: 20000 });
  await scan('6291041500213'); await scan('6291041500213'); await scan('6291041500213');
  ok(await p.locator('input[aria-label="المعدود كاشف السكر"]').inputValue() === '3', 'stocktake: each scan counts one');

  // ── The supplier's invoice number, a GS1 box code, and an ordered purchase (received later) ──
  await p.goto(B + '/store'); await p.waitForSelector('[data-testid="purchase-new"]', { timeout: 20000 }); await p.click('[data-testid="purchase-new"]');
  await p.waitForSelector('[data-testid="scan-box"]', { timeout: 20000 });
  ok(await p.locator('[data-testid="camera-scan"]').count() === 1, 'purchases: the camera scan button is beside the scan box');
  await p.fill('input[aria-label="المورّد"]', 'مورّد الكواشف');
  await p.fill('input[aria-label="رقم فاتورة المورّد"]', 'INV-77');
  await scan('(01)06291041509999(17)271231(10)LOT9');
  ok(await p.locator('input[aria-label="اللوت"]').first().inputValue() === 'LOT9' && await p.locator('input[aria-label="الاكسباير"]').first().inputValue() === '2027-12-31', 'a GS1 box code fills the line\'s lot and expiry');
  await p.fill('input[placeholder="الصنف"]', 'كاشف الصفراء');
  await p.locator('input[aria-label="العدد"]').first().fill('3');
  await p.locator('input[aria-label="المجموع"]').first().fill('9000');
  await p.check('input[aria-label="طلبية بانتظار الاستلام"]');
  await p.click('button:has-text("حفظ العملية")');
  const ord = async () => ((await kv(p, 'purchasing.purchases.v1')) || []).find((x) => x.supplierRef === 'INV-77');
  ok(await settled(async () => !!(await ord())) && (await ord()).ordered === true && (await ord()).items[0].gtin === '06291041509999', 'saved as ordered, with the supplier\'s invoice number and the box code');
  ok(!(await stock()).some((s) => s.name === 'كاشف الصفراء'), 'an ordered purchase brings nothing into the stock room');
  ok((await p.locator('li[data-purchase]').first().innerText()).includes('بانتظار الاستلام') && (await p.locator('li[data-purchase]').first().innerText()).includes('INV-77'), 'the list shows it as waiting, with the invoice number');
  ok(!(await p.locator('[data-testid="purchase-totals"]').innerText()).includes('9,000'), 'and it is not counted as spending yet');
  await p.click('[data-testid="purchase-receive"]');
  ok(await settled(async () => (await ord())?.ordered !== true) && await settled(async () => !!(await stock()).find((s) => s.name === 'كاشف الصفراء')), '«استلام»: the purchase is received');
  const gall = (await stock()).find((s) => s.name === 'كاشف الصفراء');
  ok(gall?.qty === 3 && gall.lot === 'LOT9' && gall.expiry === '2027-12-31' && gall.barcode === '06291041509999', 'its lines went into the stock room with lot, expiry and the box code as the item\'s barcode');
  ok((await p.locator('[data-testid="purchase-totals"]').innerText()).includes('9,000'), 'and now counts as spending');
  await p.goto(B + '/store'); await p.waitForSelector('[data-testid="purchase-new"]', { timeout: 20000 }); await p.click('[data-testid="purchase-new"]');
  await p.waitForSelector('[data-testid="scan-box"]', { timeout: 20000 });
  await scan('(01)06291041509999(17)281130(10)LOT10');
  ok(await p.locator('input[placeholder="الصنف"]').first().inputValue() === 'كاشف الصفراء' && await p.locator('input[aria-label="اللوت"]').first().inputValue() === 'LOT10', 'the next scan of that box finds the item by its code, with the new lot');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
