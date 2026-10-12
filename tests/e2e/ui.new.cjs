// The two looks: the classic one (the default — the project exactly as it was) and the new green one
// chosen on the welcome page («الثيم»): data-ui="new" on <html>, the floating menu, the top bar (⌘K
// over this station's pages and records, alerts, pill tabs), green everywhere on screen — and none of
// it in the classic look.
const { B, ok, launch, done, resetLocal, kvPut } = require('./lib.cjs');
(async () => {
  const b = await launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(`${p.url()} ${e.message.slice(0, 140)}`));
  await p.goto(B + '/welcome'); await resetLocal(p, { 'local.activation.v1': 'legacy' });
  const ui = () => p.evaluate(() => document.documentElement.getAttribute('data-ui'));
  const brand = (sel) => p.evaluate((s) => getComputedStyle(document.querySelector(s)).getPropertyValue('--color-brand').trim(), sel);

  // ── The classic look is the default ──
  if (process.env.UI !== 'new') {
    await p.goto(B + '/welcome'); await p.waitForSelector('[data-testid="ui-switch"]');
    ok(await ui() === null && await p.locator('[data-testid="ui-classic"][aria-checked="true"]').count() === 1, 'classic by default: no data-ui, «التصميم القديم» chosen');
    ok(!(await p.locator('.ui-only-new').first().isVisible()) && await p.locator('.ui-only-classic').first().isVisible(), 'classic: its own welcome header only');
    await p.goto(B + '/store'); await p.waitForSelector('aside nav a', { timeout: 20000 });
    ok(await p.getByTestId('ui-topbar').count() === 0 && await p.getByTestId('side-new').count() === 0, 'classic: no top bar, the classic menu');
    ok((await brand('.store')).toLowerCase() !== '#14733f', `classic: the store keeps its own colour (${await brand('.store')})`);
  }

  // ── Choosing the new look on the welcome page ──
  await p.goto(B + '/welcome'); await p.waitForSelector('[data-testid="ui-switch"]');
  await p.click('[data-testid="ui-new"]');
  ok(await ui() === 'new' && await p.evaluate(() => localStorage.getItem('lab-ui')) === 'new', 'the new look: data-ui="new", kept on this device');
  ok(await p.locator('.ui-only-new').first().isVisible() && !(await p.locator('.ui-only-classic').first().isVisible()), 'new: its own welcome header');
  await p.reload(); await p.waitForSelector('[data-testid="ui-switch"]');
  ok(await ui() === 'new', 'set again before the page is drawn (after a reload)');

  // ── A station in the new look ──
  await kvPut(p, 'station.stock.v1', [{ id: 's1', name: 'كاشف السكر', qty: 0, minQty: 2 }]);
  await p.goto(B + '/store'); await p.waitForSelector('[data-testid="side-new"]', { timeout: 20000 });
  ok(await p.getByTestId('ui-topbar').isVisible(), 'new: the top bar');
  ok((await brand('.store')).toLowerCase() === '#14733f', `new: every station wears the same green (${await brand('.store')})`);
  ok(await p.getByTestId('ui-tabs').isVisible() && await p.locator('[data-testid="ui-tabs"] a[aria-current="page"]').count() === 1, 'new: the station\'s pages as pills');
  await p.keyboard.press('Control+k'); await p.waitForSelector('[data-testid="ui-palette"]');
  await p.keyboard.type('كاشف السكر');
  ok(await p.locator('[data-testid="ui-palette"] button', { hasText: 'كاشف السكر' }).count() >= 1, '⌘K: this station\'s records (a stock item)');
  await p.keyboard.press('Escape');
  await p.click('[data-testid="ui-bell"]');
  ok(await p.locator('header[data-testid="ui-topbar"] a', { hasText: 'المشتريات والمخزن والأسعار' }).count() === 1, 'the bell: the menu\'s numbers as alerts');
  // Printing keeps the classic colours (the new look is for the screen only).
  await p.emulateMedia({ media: 'print' });
  ok((await brand('.store')).toLowerCase() !== '#14733f', 'print: the new look does not apply');
  await p.emulateMedia({ media: 'screen' });

  // ── Back to the classic look: exactly as before ──
  if (process.env.UI !== 'new') {
    await p.goto(B + '/welcome'); await p.waitForSelector('[data-testid="ui-switch"]');
    await p.click('[data-testid="ui-classic"]');
    ok(await ui() === null && await p.evaluate(() => localStorage.getItem('lab-ui')) === null, 'back to classic: no data-ui, nothing kept');
    await p.goto(B + '/store'); await p.waitForSelector('aside nav a', { timeout: 20000 });
    ok(await p.getByTestId('ui-topbar').count() === 0 && await p.getByTestId('side-new').count() === 0, 'classic again: no top bar, the classic menu');
  }

  ok(errs.length === 0, `no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
  await b.close();
  done();
})();
