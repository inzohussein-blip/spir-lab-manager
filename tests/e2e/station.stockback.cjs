// Stock given back: a test taken off a saved visit returns what it took; deleting visits asks whether
// they were entered by mistake (yes: their materials go back; no: real visits, the stock stays);
// restoring a visit whose materials were given back takes them again. Skipped tests give nothing back.
const { B, ok, launch, done, kv, kvPut, resetLocal } = require('./lib.cjs');
(async () => {
  const b = await launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(`${p.url()} ${e.message.slice(0, 140)}`));
  // Dialogs: the next answers are taken from this list (true = «موافق»), then «موافق».
  const answers = []; const asked = [];
  p.on('dialog', (d) => { asked.push(d.message()); const a = answers.length ? answers.shift() : true; a ? d.accept() : d.dismiss(); });
  await p.goto(B + '/welcome'); await resetLocal(p, { 'local.activation.v1': 'legacy' });
  const settled = async (fn, ms = 6000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await p.waitForTimeout(150); } return false; };
  await p.goto(B + '/station'); await p.waitForSelector('label:has-text("الاسم الثلاثي") input', { timeout: 20000 });
  const cat = await kv(p, 'station.tests.v1');
  const hb = cat.find((t) => t.code === 'HB').id, wbc = cat.find((t) => t.code === 'WBC').id;
  await kvPut(p, 'station.stock.v1', [{ id: 'reagent-cbc', name: 'كاشف CBC', qty: 10, testIds: [hb, wbc] }]);
  const qty = async () => ((await kv(p, 'station.stock.v1')) || []).find((s) => s.id === 'reagent-cbc')?.qty;
  const pick = async (q) => { await p.fill('input[placeholder="ابحث عن فحص…"]', q); await p.waitForTimeout(150); await p.locator('div.grid button:has(span.flex-1)').first().click(); await p.fill('input[placeholder="ابحث عن فحص…"]', ''); };
  const save = () => p.click('button[title="حفظ (Ctrl+S)"]');
  const visit = async (name, tests) => {
    await p.goto(B + '/station'); await p.waitForSelector('label:has-text("الاسم الثلاثي") input', { timeout: 20000 });
    await p.locator('label:has-text("الاسم الثلاثي") input').fill(name);
    for (const t of tests) await pick(t);
    await save();
  };

  await visit('مريض الإرجاع', ['Hemoglobin', 'White Blood']);
  ok(await settled(async () => (await qty()) === 8), 'a visit with Hb + WBC takes two units (10 → 8)');
  await pick('White Blood'); await save(); // WBC taken off the saved visit
  ok(await settled(async () => (await qty()) === 9), 'a test taken off the saved visit gives its unit back (8 → 9)');
  ok(((await kv(p, 'station.stockMoves.v1')) || []).some((m) => m.reason === 'return' && m.delta === 1), 'the movement log says «إرجاع»');

  const del = async (name, answer) => {
    await p.goto(B + '/station/visits'); await p.waitForTimeout(1200);
    answers.push(true, answer); // «حذف…؟» then «أُدخلت خطأً؟»
    await p.locator('tr', { hasText: name }).locator('button[aria-label="حذف الزيارة"]').first().click(); await p.waitForTimeout(600);
  };
  await del('مريض الإرجاع', true);
  ok(asked.some((m) => m.includes('أُدخلت') && m.includes('1 وحدة')), 'deleting asks whether it was a mistake, with the units it took');
  ok(await settled(async () => (await qty()) === 10), 'entered by mistake: its unit goes back (9 → 10)');

  await p.goto(B + '/station/trash'); await p.waitForTimeout(1000);
  await p.locator('button:has-text("استرجاع")').last().click();
  ok(await settled(async () => (await qty()) === 9), 'restored from the bin: it takes its unit again (10 → 9)');

  await visit('مريض حقيقي', ['Hemoglobin']);
  ok(await settled(async () => (await qty()) === 8), 'another visit takes its unit (9 → 8)');
  await del('مريض حقيقي', false);
  ok(await settled(async () => !((await kv(p, 'station.visits.v1')) || []).some((v) => v.patient.name === 'مريض حقيقي')) && (await qty()) === 8, 'a real visit deleted to free space: the stock stays (8)');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
