// The lab station's new-look pages (as spir-supply-manager's): «لوحة التحكم», «التحليلات» and
// «لوحة المهام» — in the menu and on the welcome page only in the new look, their figures from this
// device's visits, the tasks moved by button and by dragging (a visit still waiting for results
// cannot be handed over), and Excel from the analytics.
const fs = require('fs');
const { B, ok, launch, done, kv, kvPut, resetLocal } = require('./lib.cjs');
const DAY = 86400000;
(async () => {
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(`${p.url()} ${e.message.slice(0, 140)}`));
  await p.goto(B + '/welcome'); await resetLocal(p, { 'local.activation.v1': 'legacy' });
  await p.goto(B + '/station'); await p.waitForSelector('label:has-text("الاسم الثلاثي") input', { timeout: 20000 });
  // Classic look: none of it in the menu, nor on the welcome page.
  ok(await p.locator('aside a[href="/station/dashboard"]').count() === 0, 'classic look: no «لوحة التحكم» in the menu');
  const cat = await kv(p, 'station.tests.v1');
  const hb = cat.find((t) => t.code === 'HB'), glu = cat.find((t) => t.code === 'FBS') || cat[1];
  const now = Date.now();
  const r = (t, value) => ({ testId: t.id, name_ar: t.name_ar, value });
  await kvPut(p, 'station.visits.v1', [
    { id: 'v-pend', created_at: now - 60000, accession: 'LAB-1', patient: { name: 'مريض بانتظار', gender: 'male' }, referrer: 'د. سامر', results: [r(hb, '13'), r(glu, '')] },
    { id: 'v-done', created_at: now - 3600000 < new Date(new Date().toDateString()).getTime() ? now - 120000 : now - 3600000, accession: 'LAB-2', patient: { name: 'مريض جاهز', gender: 'female' }, referrer: 'د. سامر', results: [r(hb, '12'), r(glu, '90')] },
    { id: 'v-yest', created_at: now - DAY, accession: 'LAB-3', patient: { name: 'مريض الأمس', gender: 'male' }, results: [r(hb, '14')] },
    { id: 'v-old', created_at: now - 40 * DAY, accession: 'LAB-4', patient: { name: 'مريض قديم', gender: 'male' }, referrer: 'د. ليلى', results: [r(glu, '100')] },
  ]);
  await kvPut(p, 'station.stock.v1', [{ id: 's1', name: 'كاشف ناقص', qty: 2, minQty: 5 }]);
  const st = (await kv(p, 'station.settings.v1')) || {};
  await kvPut(p, 'station.settings.v1', { ...st, deliveryStatus: true });

  // The new look.
  await p.evaluate(() => localStorage.setItem('lab-ui', 'new'));
  await p.goto(B + '/welcome'); await p.waitForTimeout(800);
  ok(await p.locator('a[href="/station/dashboard"]').isVisible(), 'new look: the «لوحة التحكم» card on the welcome page');
  await p.goto(B + '/station/dashboard'); await p.waitForSelector('[data-testid="dashboard-page"]', { timeout: 20000 });
  ok(await p.locator('aside a[href="/station/dashboard"]').count() >= 1 && await p.locator('aside a[href="/station/tasks"]').count() >= 1, 'and in the lab station\'s menu, with «التحليلات» and «لوحة المهام»');
  const kpi = async (id) => (await p.locator(`[data-testid="${id}"]`).innerText()).replace(/\s+/g, ' ');
  ok((await kpi('dash-kpi-today')).includes(' 2 '), `today: 2 visits (${await kpi('dash-kpi-today')})`);
  ok((await kpi('dash-kpi-pending')).includes(' 1 '), 'one visit waiting for results');
  ok((await kpi('dash-kpi-ready')).includes(' 3 '), 'three ready to hand over (the last 60 days)');
  ok((await p.locator('[data-testid="dash-waiting"]').innerText()).includes('مريض بانتظار'), '«التالي»: the visit to finish, opening on the entry screen');
  ok(await p.locator('[data-testid="dash-waiting"] a[href="/station?edit=v-pend"]').count() === 1, 'its link opens that visit');
  ok((await p.locator('[data-testid="dash-stock"]').innerText()).includes('1') && await p.locator('[data-testid="dash-stock"] a').count() === 0, 'the stock room counted (1 under its minimum), with no link to another station');
  ok(await p.locator('[data-testid="pill-bars"] [title*="2 زيارة"]').count() >= 1, 'the week\'s bars say each day\'s visits on hover');

  await p.goto(B + '/station/analytics'); await p.waitForSelector('[data-testid="analytics-page"]', { timeout: 20000 });
  await p.click('[data-testid="range-7"]'); await p.waitForTimeout(300);
  ok((await p.locator('[data-testid="analytics-kpi-visits"]').innerText()).includes('3'), '7 days: 3 visits');
  ok(await p.locator('[data-testid="area-chart"] rect title').count() === 7, 'the daily chart: one hover strip per day');
  ok((await p.locator('[data-testid="analytics-top"]').innerText()).includes('د. سامر'), 'the referring doctors');
  await p.click('[data-testid="range-90"]'); await p.waitForTimeout(300);
  ok((await p.locator('[data-testid="analytics-kpi-visits"]').innerText()).includes('4'), '90 days: 4 visits');
  ok(await p.locator('[data-testid="heatmap"] span').count() === 140, 'the activity of the last 20 weeks');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-testid="analytics-excel"]')]);
  ok(/^analytics-.*\.xlsx$/.test(dl.suggestedFilename()) && fs.readFileSync(await dl.path()).slice(0, 2).toString() === 'PK', 'Excel downloads');

  await p.goto(B + '/station/tasks'); await p.waitForSelector('[data-testid="tasks-page"]', { timeout: 20000 });
  const n = (col) => p.locator(`[data-col="${col}"] [data-card]`).count();
  ok(await n('pending') === 1 && await n('ready') === 3 && await n('delivered') === 0, 'tasks: 1 waiting, 3 ready, none handed over yet');
  await p.locator('[data-col="ready"] [data-card="v-done"] [data-testid="task-deliver"]').click(); await p.waitForTimeout(300);
  ok(await n('delivered') === 1 && !!((await kv(p, 'station.visits.v1')).find((v) => v.id === 'v-done').delivered_at), '«تسليم»: handed over, kept on the visit');
  await p.locator('[data-col="ready"] [data-card="v-yest"]').dragTo(p.locator('[data-col="delivered"]')); await p.waitForTimeout(300);
  ok(await n('delivered') === 2, 'dragged to «سُلّمت اليوم»: handed over too');
  await p.locator('[data-col="delivered"] [data-card="v-done"] [data-testid="task-undeliver"]').click(); await p.waitForTimeout(300);
  ok(await n('delivered') === 1 && !((await kv(p, 'station.visits.v1')).find((v) => v.id === 'v-done').delivered_at), '«إرجاع»: back to ready');
  await p.locator('[data-col="pending"] [data-card="v-pend"]').dragTo(p.locator('[data-col="delivered"]')).catch(() => {}); await p.waitForTimeout(300);
  ok(await n('pending') === 1 && await n('delivered') === 1, 'a visit still waiting for results is not handed over');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
