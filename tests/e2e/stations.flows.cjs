// Purchasing, quality, staff and training: a record is saved, survives a reload, and comes back
// from a backup restored in a clean browser.
const { B, ok, launch, done, kv, resetLocal } = require('./lib.cjs');
(async () => {
  const b = await launch();
  const errs = [];
  const fresh = async () => {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, acceptDownloads: true });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(`${p.url()} ${e.message.slice(0, 140)}`)); p.on('dialog', (d) => d.accept());
    await p.goto(B + '/welcome'); await resetLocal(p, { 'local.activation.v1': 'legacy' });
    return p;
  };
  const p = await fresh();
  const backup = async (path, button) => {
    await p.goto(B + path); await p.waitForTimeout(1200);
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click(`button:has-text("${button}")`)]);
    return dl.path();
  };
  const restore = async (path, file) => {
    const q = await fresh();
    await q.goto(B + path); await q.waitForTimeout(1200);
    await q.setInputFiles('input[type=file][accept*="json"]', file); await q.waitForTimeout(2500);
    return q;
  };

  // ── Purchasing ──
  await p.goto(B + '/store'); await p.waitForSelector('[data-testid="purchase-new"]', { timeout: 20000 }); await p.click('[data-testid="purchase-new"]');
  await p.fill('input[aria-label="المورّد"]', 'مورّد الفحص');
  await p.fill('input[placeholder="الصنف"]', 'كاشف الفحص'); await p.fill('input[aria-label="الكمية"]', '3'); await p.fill('input[aria-label="السعر الإجمالي"]', '75000');
  await p.click('button:has-text("حفظ العملية")'); await p.waitForTimeout(800);
  await p.reload(); await p.waitForTimeout(1500);
  ok((await p.locator('body').innerText()).includes('مورّد الفحص'), 'purchasing: purchase saved and kept after reload');
  const purFile = await backup('/store/settings#device', 'تصدير نسخة');
  const q1 = await restore('/store/settings', purFile);
  ok(((await kv(q1, 'purchasing.purchases.v1')) || []).length === 1, 'purchasing: backup restores the purchase');

  // ── Staff (roster) ──
  await p.goto(B + '/roster/staff'); await p.waitForSelector('label:has-text("الاسم") input', { timeout: 20000 });
  await p.fill('label:has-text("الاسم *") input', 'موظف الفحص'); await p.click('button:has-text("إضافة")'); await p.waitForTimeout(600);
  await p.reload(); await p.waitForTimeout(1500);
  ok((await p.locator('body').innerText()).includes('موظف الفحص'), 'staff: employee saved and kept after reload');
  const rosFile = await backup('/roster/settings#device', 'تصدير نسخة احتياطية');
  const q2 = await restore('/roster/settings', rosFile);
  ok(((await kv(q2, 'roster.staff.v1')) || []).some((s) => s.name === 'موظف الفحص'), 'staff: backup restores the employee');

  // ── Quality (QC) ──
  await p.goto(B + '/qc/entry'); await p.waitForTimeout(1500);
  const val = p.locator('input[placeholder="القيمة"]').first();
  if (await val.count()) {
    await val.fill('101'); await val.press('Tab'); await p.waitForTimeout(600);
    await p.reload(); await p.waitForTimeout(1500);
    const n = ((await kv(p, 'qc.results.v1')) || []).length;
    ok(n >= 1, `quality: control result saved (${n})`);
    const qcFile = await backup('/qc/settings#device', 'تصدير نسخة احتياطية');
    const q3 = await restore('/qc/settings', qcFile);
    ok(((await kv(q3, 'qc.results.v1')) || []).length === n, 'quality: backup restores the results');
  } else ok(false, 'quality: no control material to enter a value for');

  // ── Training ──
  await p.goto(B + '/training/trainees'); await p.waitForSelector('input[placeholder="الاسم"]', { timeout: 20000 });
  await p.fill('input[placeholder="الاسم"]', 'متدرب الفحص'); await p.click('button:has-text("إضافة")'); await p.waitForTimeout(600);
  await p.reload(); await p.waitForTimeout(1500);
  ok((await p.locator('body').innerText()).includes('متدرب الفحص'), 'training: trainee saved and kept after reload');

  const trFile = await backup('/training/settings#device', 'تصدير نسخة احتياطية');
  const q4 = await restore('/training/settings', trFile);
  ok(((await kv(q4, 'training.trainees.v1')) || []).some((t) => t.name === 'متدرب الفحص'), 'training: backup restores the trainee');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
