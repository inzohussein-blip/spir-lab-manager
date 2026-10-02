// Every public page opens without errors or sideways scrolling — desktop, phone and dark mode.
const { B, ok, launch, done, kv, resetLocal } = require('./lib.cjs');
const routes = ['/welcome', '/station', '/station/inventory', '/store/inventory', '/store/items', '/store/count', '/store/moves', '/station/records', '/station/settings', '/station/tests', '/station/visits',
  '/store', '/store/report', '/store/settings', '/store/suppliers',
  '/training', '/training/cards', '/training/edit', '/training/exam', '/training/guide', '/training/manual', '/training/map', '/training/media', '/training/quiz',
  '/training/settings', '/training/tools', '/training/trainees', '/training/tubes', '/training/test/FIRST',
  '/qc', '/qc/analytes', '/qc/chart', '/qc/devices', '/qc/entry', '/qc/settings', '/qc/temps',
  '/roster', '/roster/attendance', '/roster/leaves', '/roster/payroll', '/roster/schedule', '/roster/settings', '/roster/staff', '/connect', '/connect/room', '/connect/public', '/connect/labs', '/connect/direct', '/connect/file', '/connect/settings', '/sync', '/sync/file', '/sync/auto', '/sync/log', '/sync/settings', '/about', '/about/station', '/about/report', '/about/qc', '/about/roster', '/about/connect', '/about/faq', '/about/settings', '/license'];
(async () => {
  const b = await launch();
  for (const [w, h, theme] of [[1440, 900, 'light'], [390, 844, 'light'], [1440, 900, 'dark']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message.slice(0, 150)));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('CONSOLE ' + m.text().slice(0, 150)); });
    await p.goto(B + '/welcome');
    await resetLocal(p, { theme, 'local.activation.v1': 'legacy' });
    await p.goto(B + '/training'); await p.waitForTimeout(800);
    const first = ((await kv(p, 'training.tests.v1')) || [{ id: 'x' }])[0].id;
    let bad = 0;
    for (const r0 of routes) {
      const r = r0.replace('FIRST', first);
      errs.length = 0;
      let status = 0;
      try { status = (await p.goto(B + r, { waitUntil: 'networkidle' })).status(); } catch (e) { errs.push('NAV ' + e.message.slice(0, 100)); }
      await p.waitForTimeout(250);
      const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (errs.length || ov > 2 || status >= 400) { bad++; console.log(`  [${w} ${theme}] ${r} status=${status} overflowX=${ov} ${errs.join(' || ')}`); }
    }
    ok(bad === 0, `${routes.length} pages at ${w}px ${theme}: no errors, no sideways scroll`);
    await ctx.close();
  }
  // The code manager's address is /license; the old /licenses still leads there.
  const rp = await (await b.newContext()).newPage();
  await rp.goto(B + '/licenses'); await rp.waitForTimeout(300);
  ok(new URL(rp.url()).pathname === '/license', `/licenses leads to /license (${new URL(rp.url()).pathname})`);
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
