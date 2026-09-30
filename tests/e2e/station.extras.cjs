// Lab station additions: the recycle bin (visits and patients, 30 days), a long visits list drawn
// in parts (and searched in full), restoring the default tests, and the signature / stamp on the report.
const { B, ok, launch, done, kv, kvPut, resetLocal } = require('./lib.cjs');
const IMG = '/lab-images/test/أنبوب اختبار.png';

(async () => {
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 140))); p.on('dialog', (d) => d.accept());
  await p.goto(B + '/welcome'); await resetLocal(p, { 'local.activation.v1': 'legacy' });
  const addVisit = async (patient) => {
    await p.goto(B + '/station'); await p.waitForSelector('input[placeholder="ابحث عن فحص…"]', { timeout: 20000 });
    await p.locator('label:has-text("الاسم الثلاثي") input').fill(patient);
    await p.fill('input[placeholder="ابحث عن فحص…"]', 'Glucose'); await p.waitForTimeout(100);
    await p.locator('div.grid button:has(span.flex-1)').first().click();
    await p.fill('input[placeholder="ابحث عن فحص…"]', ''); await p.locator('[data-result-idx="0"]').fill('90');
    await p.keyboard.press('Control+s'); await p.waitForTimeout(500);
  };
  const names = async () => ((await kv(p, 'station.visits.v1')) || []).map((v) => v.patient.name);

  // ── Recycle bin ──
  await addVisit('مراجع السلة الأول'); await addVisit('مراجع السلة الثاني');
  await p.goto(B + '/station/visits'); await p.waitForSelector('text=مراجع السلة الأول', { timeout: 15000 });
  await p.locator('tr:has-text("مراجع السلة الأول") button[aria-label="حذف الزيارة"]').click(); await p.waitForTimeout(400);
  ok(!(await names()).includes('مراجع السلة الأول'), 'deleted visit leaves the list');
  await p.goto(B + '/station/trash'); await p.waitForSelector('[data-testid="trash-list"]', { timeout: 15000 });
  const row = p.locator('li[data-trash="مراجع السلة الأول"]');
  ok(await row.count() === 1 && (await row.innerText()).includes('يُحذف نهائياً بعد 30 يوم'), 'it is in the recycle bin (30 days)');
  await row.locator('button:has-text("استرجاع")').click(); await p.waitForTimeout(400);
  const n1 = await names();
  ok(n1.includes('مراجع السلة الأول') && n1.indexOf('مراجع السلة الثاني') < n1.indexOf('مراجع السلة الأول'), 'restored, back in date order');
  ok(await p.locator('li[data-trash]').count() === 0, 'restored item leaves the bin');
  // a patient record
  await p.goto(B + '/station/records'); await p.waitForSelector('text=مراجع السلة الثاني', { timeout: 15000 });
  await p.locator('button:has-text("مراجع السلة الثاني")').first().click();
  await p.click('button[aria-label="حذف المراجع"]'); await p.waitForTimeout(400);
  ok(!((await kv(p, 'station.patients.v1')) || []).some((x) => x.name === 'مراجع السلة الثاني'), 'deleted patient record leaves the list');
  await p.goto(B + '/station/trash'); await p.waitForSelector('li[data-trash="مراجع السلة الثاني"]', { timeout: 15000 });
  ok((await p.locator('li[data-trash="مراجع السلة الثاني"]').innerText()).includes('مراجع'), 'patient record in the bin');
  await p.locator('li[data-trash="مراجع السلة الثاني"] button[aria-label="حذف نهائي"]').click(); await p.waitForTimeout(400);
  ok(await p.locator('li[data-trash]').count() === 0, 'deleted for good from the bin');
  // older than 30 days → gone by itself
  await kvPut(p, 'station.trash.v1', [{ id: 'old-1', kind: 'visit', deleted_at: Date.now() - 31 * 86400000, item: { id: 'old-1', created_at: Date.now() - 40 * 86400000, patient: { name: 'قديم جداً', gender: '' }, results: [] } }]);
  await p.goto(B + '/station/trash'); await p.waitForSelector('[data-testid="trash-list"]', { timeout: 15000 });
  ok(await p.locator('li[data-trash]').count() === 0 && ((await kv(p, 'station.trash.v1')) || []).length === 0, 'items older than 30 days are removed');

  // ── Qualitative results (e.g. viruses): quick choices Positive, Negative, +, ++, +++ ──
  await p.goto(B + '/station'); await p.waitForSelector('input[placeholder="ابحث عن فحص…"]', { timeout: 20000 });
  await p.fill('input[placeholder="ابحث عن فحص…"]', 'C-Reactive'); await p.waitForTimeout(100);
  await p.locator('div.grid button:has(span.flex-1)').first().click();
  await p.fill('input[placeholder="ابحث عن فحص…"]', '');
  const labels = (await p.locator('button:text-is("Positive"), button:text-is("Negative"), button:text-is("+"), button:text-is("++"), button:text-is("+++")').allInnerTexts());
  ok(JSON.stringify(labels) === JSON.stringify(['Positive', 'Negative', '+', '++', '+++']), `qualitative quick choices: ${labels.join(' ')}`);
  await p.click('button:text-is("Positive")');
  ok(await p.locator('[data-result-idx="0"]').inputValue() === 'Positive', '«Positive» fills the result');

  // ── A long visits list: drawn in parts, searched in full ──
  const many = Array.from({ length: 260 }, (_, i) => ({
    id: `bulk-${i}`, created_at: Date.now() - i * 60000, accession: `LAB-20260101-${String(i + 1).padStart(3, '0')}`,
    patient: { name: `مراجع رقم ${i}`, gender: 'male' }, results: [{ testId: 'x', name_ar: 'سكر', value: '90' }],
  }));
  await kvPut(p, 'station.visits.v1', many);
  await p.goto(B + '/station/visits'); await p.waitForSelector('text=مراجع رقم 0', { timeout: 15000 });
  ok(await p.locator('tbody tr').count() === 100, 'first 100 visits drawn');
  ok((await p.locator('button:has-text("عرض المزيد")').innerText()).includes('160'), '«عرض المزيد» says how many are left');
  await p.locator('button:has-text("عرض المزيد")').scrollIntoViewIfNeeded(); await p.waitForTimeout(800);
  ok(await p.locator('tbody tr').count() >= 200, 'scrolling to the end draws more');
  await p.fill('input[placeholder="ابحث بالاسم أو رقم العيّنة أو الهاتف…"]', 'مراجع رقم 257'); await p.waitForTimeout(500);
  ok(await p.locator('tbody tr').count() === 1 && (await p.locator('tbody').innerText()).includes('مراجع رقم 257'), 'search finds a visit far down the list');
  await p.fill('input[placeholder="ابحث بالاسم أو رقم العيّنة أو الهاتف…"]', 'LAB-20260101-003'); await p.waitForTimeout(500);
  ok((await p.locator('tbody').innerText()).includes('مراجع رقم 2'), 'search by sample number');

  // ── Restoring the default tests ──
  const tests0 = await kv(p, 'station.tests.v1');
  const glu = tests0.find((t) => t.code === 'GLU') || tests0.find((t) => t.code);
  const gone = tests0.find((t) => t.code && t.code !== glu.code);
  const edited = tests0.filter((t) => t.id !== gone.id).map((t) => (t.id === glu.id ? { ...t, unit: 'وحدة خاطئة' } : t));
  edited.push({ id: 'my-own', name_ar: 'فحص خاص بالمختبر', normal: { kind: 'none' } });
  await kvPut(p, 'station.tests.v1', edited);
  await p.goto(B + '/station/settings#tests'); await p.waitForSelector('[data-testid="defaults-card"]', { timeout: 15000 });
  await p.click('button:has-text("استعادة القيم الافتراضية للفحوصات")'); await p.waitForTimeout(400);
  let t1 = await kv(p, 'station.tests.v1');
  ok(t1.find((t) => t.id === glu.id)?.unit === glu.unit, 'a built-in test back to its default (same id)');
  ok(t1.some((t) => t.code === gone.code) && t1.some((t) => t.id === 'my-own'), 'a deleted built-in comes back; the lab\'s own test stays');
  await p.click('button:has-text("استعادة قائمة الفحوصات الافتراضية بالكامل")'); await p.waitForTimeout(400);
  t1 = await kv(p, 'station.tests.v1');
  ok(!t1.some((t) => t.id === 'my-own') && t1.length === tests0.length && t1.find((t) => t.code === glu.code)?.id === glu.id, `full default list (${t1.length}), own test removed, ids kept`);

  // ── Signature and stamp on the report (off by default) ──
  await kvPut(p, 'station.visits.v1', many.slice(0, 1));
  await p.goto(B + '/station/visits'); await p.waitForSelector('text=مراجع رقم 0', { timeout: 15000 });
  await p.click('button:has-text("عرض/طباعة")'); await p.waitForTimeout(500);
  ok(await p.locator('[data-testid="report-signature"]').count() === 0 && await p.locator('text=التوقيع / الختم').count() === 1, 'off by default: the plain «التوقيع / الختم» line');
  await p.goto(B + '/station/settings#report'); await p.waitForSelector('[data-testid="signature-card"]', { timeout: 15000 });
  await p.locator('[data-testid="signature-card"] button[role="switch"]').click(); await p.waitForTimeout(300);
  await p.selectOption('select[aria-label="صورة التوقيع"]', IMG);
  await p.selectOption('select[aria-label="صورة الختم"]', IMG);
  await p.fill('label:has-text("الاسم تحت التوقيع") input', 'د. محلل الفحص'); await p.locator('label:has-text("الصفة") input').click(); await p.waitForTimeout(300);
  const st = await kv(p, 'station.settings.v1');
  ok(st.signatureOn === true && st.signatureImage === IMG && st.stampImage === IMG && st.signatureName === 'د. محلل الفحص', 'settings saved');
  await p.goto(B + '/station/visits'); await p.waitForSelector('text=مراجع رقم 0', { timeout: 15000 });
  await p.click('button:has-text("عرض/طباعة")'); await p.waitForTimeout(500);
  const sig = p.locator('[data-testid="report-signature"]');
  ok(await sig.count() === 1 && (await sig.innerText()).includes('د. محلل الفحص') && await sig.locator('img').count() === 2, 'report shows the signature (with name) and the stamp');
  ok(await sig.locator('img').first().evaluate((i) => new Promise((r) => { if (i.complete) return r(i.naturalWidth > 0); i.onload = () => r(true); i.onerror = () => r(false); })), 'the signature image loads');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
