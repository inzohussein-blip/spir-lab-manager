// «رموز الأطباء» and «نافذة الأطباء» on a lab's own installation (no lab codes): the lab makes a
// code for a referring doctor in «محطة المزامنة»; on another device the doctor adds the code and
// sees only the patients referred under his name, in the period the lab chose — sealed on the way
// (the server keeps nothing it can read). The lab links another spelling of his name, shows the
// phone, renews the code (the old one stops) and stops it; the doctor leaves the device.
const { B, ok, launch, done, kv, kvPut, resetLocal } = require('./lib.cjs');
(async () => {
  const b = await launch();
  const errs = [];
  const device = async () => {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(`${p.url()} ${e.message.slice(0, 140)}`)); p.on('dialog', (d) => d.accept());
    return p;
  };
  const until = async (fn, ms = 20000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch { /* not yet */ } await new Promise((r) => setTimeout(r, 400)); } return false; };
  const DAY = 86400000;

  // ── The lab: a few visits from different referring names ──
  const L = await device();
  await L.goto(B + '/welcome'); await resetLocal(L, { 'local.activation.v1': 'legacy' });
  await L.goto(B + '/station'); await L.waitForSelector('aside', { timeout: 20000 });
  const tests = await kv(L, 'station.tests.v1');
  const hb = tests.find((t) => t.code === 'HB');
  ok(!!hb, 'the lab\'s test list has Hb');
  const now = Date.now();
  const visit = (id, ago, name, referrer, results, phone) => ({
    id, created_at: now - ago, accession: `A-${id}`, patient: { name, gender: 'male', age: '40', ...(phone ? { phone } : {}) }, referrer,
    results: results.map((value) => ({ testId: hb.id, name_ar: hb.name_ar, value, unit: hb.unit })),
  });
  await kvPut(L, 'station.visits.v1', [
    visit('v1', 10 * 60000, 'مريض أول', 'د. أحمد علي', ['7.5'], '07701234567'),
    visit('v2', 3 * DAY, 'مريض ثاني', 'الدكتور احمد علي', ['14']),
    visit('v3', 2 * 60 * 60000, 'مريض سامي', 'Dr Sami', ['13']),
    visit('v4', 20 * DAY, 'مريض الشهر', 'د. أحمد علي', ['12']),
    visit('v5', 30 * 60000, 'مريض اسم آخر', 'أحمد العلي', ['15']),
    visit('v6', 20 * 60000, 'مريض بلا نتيجة', 'د. أحمد علي', ['']),
    visit('v7', 400 * DAY, 'مريض قديم جداً', 'د. أحمد علي', ['11']),
  ]);
  await kvPut(L, 'station.settings.v1', { ...((await kv(L, 'station.settings.v1')) || {}), labName: 'مختبر الاختبار', footer: 'بغداد — شارع فلسطين' });

  // ── «رموز الأطباء» in «محطة المزامنة» ──
  await L.goto(B + '/sync/doctors'); await L.waitForSelector('[data-testid="new-doctor-code"]', { timeout: 20000 });
  ok(await L.locator('aside a[href="/sync/doctors"]').count() === 1, '«رموز الأطباء» is in the sync station\'s menu');
  ok(await L.locator('[data-testid="doctors-off"]').count() === 0, 'the doctors\' window is on');
  await L.fill('input[aria-label="اسم الطبيب"]', 'د. أحمد علي');
  await L.selectOption('select[aria-label="مدة العرض"]', 'week');
  await L.click('button:has-text("إنشاء الرمز")');
  await L.waitForSelector('[data-testid="doctor-code"]', { timeout: 20000 });
  const code = (await L.locator('[data-testid="doctor-code"]').innerText()).trim();
  ok(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code), `a 12-character code is shown once (${code})`);
  ok((await L.locator('[data-testid="doctor-code-shown"] a[href*="wa.me"], [data-testid="doctor-code-shown"] a[href*="whatsapp"]').count()) >= 1, 'it can be sent by WhatsApp');
  const sh = (await kv(L, 'doctors.shares.v1'))[0];
  ok(sh && !JSON.stringify(sh).includes(code.replace(/-/g, '')) && !JSON.stringify(sh).includes(code), 'the code itself is not kept, only what comes from it');
  ok(await until(async () => !!(await kv(L, 'doctors.shares.v1'))[0].lastAt), 'the doctor\'s results are uploaded');
  ok((await L.locator('[data-testid="doctor-share"] [data-testid="share-status"]').innerText()).startsWith('2 مراجع'), 'the row counts the doctor\'s patients in the week (2)');
  const box = await L.evaluate(async (tag) => (await (await fetch('/api/doctors', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'fetch', tag }) })).json()), sh.tag);
  ok(box.ok && typeof box.box === 'string' && !box.box.includes('مريض') && !JSON.stringify(box).includes('أحمد'), 'the server keeps a sealed copy (no names in it)');
  const wrong = await L.evaluate(async () => (await fetch('/api/doctors', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'fetch', tag: 'a'.repeat(40) }) })).status);
  ok(wrong === 404, 'another name finds nothing');
  ok(await L.locator('[data-testid="names-check"] li[data-referrer="أحمد العلي"] select').count() === 1, '«أحمد العلي» is listed as not linked');
  ok(await L.locator('[data-testid="names-check"] li[data-referrer="الدكتور احمد علي"] select').count() === 0, 'another way of writing the same name goes to the code already');

  // ── «نافذة الأطباء» on the doctor's own device ──
  const D = await device();
  await D.goto(B + '/doctor'); await resetLocal(D);
  const activate = async (c) => { await D.fill('[data-testid="doctor-gate"] input[aria-label="رمز التفعيل"]', c); await D.click('[data-testid="doctor-gate"] button:has-text("تفعيل")'); };
  for (const path of ['/doctor', '/doctor/labs', '/doctor/settings']) {
    await D.goto(B + path); await D.waitForSelector('[data-testid="doctor-gate"]', { timeout: 20000 });
  }
  ok(await D.locator('aside').count() === 0 && await D.locator('a[href]').count() === 0, 'without an activation code: only the activation screen (no menu, no page, no link)');
  ok(await D.locator('.doctor').count() === 1, 'its own look');
  ok(await D.locator('input[aria-label="رمز المختبر"], [data-testid="pin-gate"]').count() === 0, 'no lab code is asked for');
  await activate('ABCD-EFGH-JKMN');
  ok(await until(async () => (await D.locator('[data-testid="doctor-gate-error"]').innerText()).includes('لا نتائج لهذا الرمز')), 'a wrong code is refused');
  await activate(` ${code.toLowerCase().replace(/-/g, ' ')} `);
  await D.waitForSelector('aside nav a', { timeout: 20000 });
  ok(await D.locator('[data-testid="doctor-gate"]').count() === 0 && await D.locator('aside nav a').count() === 3, 'the code (typed in small letters with spaces) activates the account: the window and its menu (3 items)');
  ok(await D.locator('aside a[href="/welcome"]').count() === 0, 'no link to the lab\'s stations');
  ok((await kv(D, 'doctor.labs.v1'))[0].name === 'مختبر الاختبار', 'the lab is known by its name');
  ok(!JSON.stringify(await kv(D, 'doctor.labs.v1')).includes(code), 'the doctor\'s device keeps what comes from the code, not the code');
  await D.goto(B + '/doctor/labs'); await D.waitForSelector('[data-testid="add-lab"]', { timeout: 20000 });
  await D.fill('input[aria-label="رمز الطبيب"]', code); await D.click('[data-testid="add-lab"] button:has-text("إضافة")');
  ok(await until(async () => (await D.locator('[data-testid="add-lab-msg"]').innerText()).includes('مضاف مسبقاً')), 'the same lab is not added twice');

  const patients = async () => D.locator('[data-testid="doctor-visit"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-patient')));
  await D.goto(B + '/doctor'); await D.waitForSelector('[data-testid="doctor-results"]', { timeout: 20000 });
  let seen = await patients();
  ok(seen.length === 2 && seen[0] === 'مريض أول' && seen[1] === 'مريض ثاني', `only his patients in the last week, latest first (${seen.join('، ')})`);
  ok(Number(await D.locator('[data-testid="menu-new-results"]').innerText()) === 2 && await D.locator('[data-testid="visit-new"]').count() === 2, 'both are marked «جديد»');
  await D.click('[data-testid="doctor-visit"][data-patient="مريض أول"]');
  await D.waitForSelector('[data-testid="doctor-report"]', { timeout: 10000 });
  const rep = await D.locator('[data-testid="doctor-report"]').innerText();
  ok(rep.includes('مختبر الاختبار') && rep.includes('بغداد — شارع فلسطين') && rep.includes('7.5'), 'the report shows the lab\'s name and footer and the result');
  ok(rep.includes('7.5 L'), 'a low result is marked L with its range');
  ok(await D.locator('[data-testid="report-phone"]').count() === 0, 'the patient\'s phone is hidden by default');
  await D.click('button:has-text("رجوع")');
  ok(await until(async () => Number(await D.locator('[data-testid="menu-new-results"]').innerText()) === 1), 'an opened visit is no longer new');
  await D.fill('input[aria-label="بحث باسم المراجع"]', 'ثاني');
  ok((await patients()).join() === 'مريض ثاني', 'search by the patient\'s name');
  await D.fill('input[aria-label="بحث باسم المراجع"]', '');
  await D.click('[role="group"][aria-label="المدة"] button:has-text("اليوم")');
  ok((await patients()).join() === 'مريض أول', 'the «اليوم» filter');

  // ── The lab: a month, another spelling linked, the phone shown ──
  await L.goto(B + '/sync/doctors'); await L.waitForSelector('[data-testid="doctor-share"]', { timeout: 20000 });
  await L.selectOption('select[aria-label="مدة العرض — د. أحمد علي"]', 'month');
  await L.selectOption('select[aria-label="ربط أحمد العلي"]', { label: 'د. أحمد علي' });
  ok(await until(async () => ((await kv(L, 'doctors.shares.v1'))[0].aliases || []).includes('أحمد العلي')), 'another spelling is linked to the doctor');
  await L.uncheck('input[aria-label="إخفاء هاتف المريض — د. أحمد علي"]');
  ok(await until(async () => { const s = (await kv(L, 'doctors.shares.v1'))[0]; return s.window === 'month' && !s.hidePhone && s.lastCount === 4; }), 'the new choices are uploaded (4 patients in the month)');
  await D.click('[role="group"][aria-label="المدة"] button:has-text("الكل")');
  await D.click('[data-testid="doctor-refresh"]');
  ok(await until(async () => (await patients()).length === 4), 'the doctor sees the month');
  seen = await patients();
  ok(seen.includes('مريض اسم آخر') && seen.includes('مريض الشهر') && !seen.includes('مريض قديم جداً') && !seen.includes('مريض سامي') && !seen.includes('مريض بلا نتيجة'),
    `the linked spelling and the month, nothing older, nobody else's, no visit without a result (${seen.join('، ')})`);
  await D.click('[data-testid="doctor-visit"][data-patient="مريض أول"]');
  await D.waitForSelector('[data-testid="doctor-report"]', { timeout: 10000 });
  ok((await D.locator('[data-testid="report-phone"]').innerText()).includes('07701234567'), 'the phone shows when the lab allows it');
  await D.click('button:has-text("رجوع")');

  // ── «رمز جديد» offline: nothing changes (the old code would keep working) ──
  const tagBefore = (await kv(L, 'doctors.shares.v1'))[0].tag;
  const alerts = []; L.on('dialog', (dl) => { if (dl.type() === 'alert') alerts.push(dl.message()); });
  await L.context().setOffline(true);
  await L.click('[data-testid="doctor-share"] button:has-text("رمز جديد")');
  ok(await until(async () => alerts.some((m) => m.includes('تعذّر إيقاف الرمز القديم'))), 'offline: «رمز جديد» says the old code could not be stopped');
  ok((await kv(L, 'doctors.shares.v1'))[0].tag === tagBefore, '…and keeps the code as it was');
  await L.context().setOffline(false);

  // ── «رمز جديد»: the old code stops at once ──
  await L.click('[data-testid="doctor-share"] button:has-text("رمز جديد")');
  ok(await until(async () => (await L.locator('[data-testid="doctor-code"]').innerText()).trim() !== code), 'a new code is shown');
  const code2 = (await L.locator('[data-testid="doctor-code"]').innerText()).trim();
  ok(await until(async () => (await kv(L, 'doctors.shares.v1'))[0].lastAt > 0), 'the new code\'s copy is uploaded');
  await D.click('[data-testid="doctor-refresh"]');
  ok(await until(async () => (await D.locator('[data-testid="doctor-gate-stopped"]').count()) === 1 && (await D.locator('aside').count()) === 0), 'with the old code the window closes: the activation screen, saying the code was stopped');
  await activate(code2);
  ok(await until(async () => (await D.locator('[data-testid="doctor-visit"]').count()) === 4), 'the new code opens the results');
  ok((await kv(D, 'doctor.labs.v1')).length === 1, 'the stopped code\'s lab leaves the device');

  // ── A PIN on the doctor's device; forgotten: clear the device instead of asking a provider ──
  await D.goto(B + '/doctor/settings#look'); await D.waitForSelector('[data-testid="pin-card"]', { timeout: 20000 });
  await D.click('[data-testid="pin-card"] button:has-text("تفعيل رمز الدخول")');
  await D.fill('input[aria-label="الرمز الجديد"]', '2468'); await D.fill('input[aria-label="تأكيد الرمز"]', '2468');
  await D.click('[data-testid="pin-card"] button:has-text("حفظ الرمز")');
  const D2 = await D.context().newPage(); D2.on('pageerror', (e) => errs.push(`D2 ${e.message.slice(0, 140)}`)); D2.on('dialog', (d) => d.accept());
  await D2.goto(B + '/doctor'); await D2.waitForSelector('[data-testid="pin-gate"]', { timeout: 20000 });
  ok(true, 'a new window asks for the doctor\'s PIN');
  await D2.click('[data-testid="pin-gate"] button:has-text("نسيت الرمز؟")');
  ok(await D2.locator('[data-testid="pin-gate"] button:has-text("تحديث من المزوّد")').count() === 0, 'no provider to ask on a doctor\'s device');
  await D2.click('[data-testid="doctor-pin-reset"]');
  ok(await until(async () => (await D2.locator('[data-testid="pin-gate"]').count()) === 0 && (await D2.locator('[data-testid="doctor-gate"]').count()) === 1), 'forgotten PIN: removed, back to the activation screen…');
  ok(((await kv(D2, 'doctor.labs.v1')) || []).length === 0, '…with the labs and results gone from the device');
  await D2.close();

  // ── The doctor leaves the device ──
  await D.goto(B + '/doctor'); await D.waitForSelector('[data-testid="doctor-gate"]', { timeout: 20000 });
  await activate(code2); await D.waitForSelector('aside nav a', { timeout: 20000 });
  await D.goto(B + '/doctor/settings#leave'); await D.waitForSelector('[data-testid="doctor-leave"]', { timeout: 20000 });
  ok(await D.locator('[data-testid="settings-layout"]').count() === 1, 'the settings page');
  await D.click('[data-testid="doctor-leave"] button:has-text("خروج")');
  ok(await until(async () => ((await kv(D, 'doctor.labs.v1')) || []).length === 0 && (await D.locator('[data-testid="doctor-gate"]').count()) === 1), '«خروج» forgets the labs and results and shows the activation screen');

  // ── «إيقاف الرمز»: the doctor's window closes ──
  await activate(code2); await D.waitForSelector('aside nav a', { timeout: 20000 });
  const tag2 = (await kv(L, 'doctors.shares.v1'))[0].tag;
  await L.click('[data-testid="doctor-share"] button:has-text("إيقاف الرمز")');
  ok(await until(async () => ((await kv(L, 'doctors.shares.v1')) || []).length === 0), 'the code is stopped');
  const gone = await L.evaluate(async (tag) => (await fetch('/api/doctors', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'fetch', tag }) })).status, tag2);
  ok(gone === 404, 'its copy left the server');
  await D.goto(B + '/doctor');
  ok(await until(async () => (await D.locator('[data-testid="doctor-gate-stopped"]').count()) === 1), 'the doctor\'s window closes (activation screen)');
  ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs.join(' | ') : ''}`);
  await b.close();
  done('doctors');
})().catch((e) => { console.error(e); process.exit(1); });
