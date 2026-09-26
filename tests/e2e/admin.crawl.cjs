// The full admin panel (lab codes off): sign in, then every page and the first record of each
// list opens without a server error or a page error.
const { B, ok, launch, done } = require('./lib.cjs');
const routes = ['/', '/appointments', '/audit', '/calendar', '/insights', '/inventory', '/invoices', '/orders', '/orders/new',
  '/orders-expenses', '/patients', '/patients/new', '/purchase-orders', '/quality', '/referrers', '/release', '/reorder', '/settings',
  '/staff', '/stock-balance', '/suppliers', '/tests', '/tools', '/users', '/worklist'];
(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(`${p.url()} ${e.message.slice(0, 140)}`));
  await p.goto(B + '/login');
  await p.fill('input[name="username"]', 'admin'); await p.fill('input[name="password"]', 'admin123');
  await Promise.all([p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 }), p.click('button[type="submit"]')]);
  ok(!p.url().includes('/login'), 'admin signs in');
  const bad = [];
  const visit = async (r) => {
    const res = await p.goto(B + r, { waitUntil: 'domcontentloaded' });
    if (!res || res.status() >= 500 || p.url().includes('/login')) bad.push(`${r} → ${res ? res.status() : 'no reply'}${p.url().includes('/login') ? ' (sent to login)' : ''}`);
  };
  for (const r of routes) await visit(r);
  ok(bad.length === 0, `${routes.length} admin pages open` + (bad.length ? ': ' + bad.join(', ') : ''));
  // Records behind the lists (dynamic routes: /orders/[id], its report / receipt / label, /patients/[id] …)
  const detail = [];
  for (const [list, re] of [['/orders', /^\/orders\/[0-9a-f-]{36}$/], ['/patients', /^\/patients\/[0-9a-f-]{36}$/],
    ['/invoices', /^\/invoices\/[0-9a-f-]{36}$/], ['/inventory', /^\/inventory\/[0-9a-f-]{36}$/], ['/purchase-orders', /^\/purchase-orders\/[0-9a-f-]{36}$/]]) {
    await p.goto(B + list);
    const href = (await p.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')))).find((h) => re.test(h || ''));
    if (href) detail.push(href);
    if (href && list === '/orders') detail.push(href + '/report', href + '/receipt', href + '/label');
  }
  bad.length = 0;
  for (const r of detail) await visit(r);
  ok(detail.length >= 2 && bad.length === 0, `${detail.length} record pages open (${detail.map((d) => d.split('/')[1]).join(', ')})` + (bad.length ? ': ' + bad.join(', ') : ''));
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exitCode = 1; });
