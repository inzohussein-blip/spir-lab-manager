// Getting into and out of the full admin panel on a device with a lab code: the card opens as soon
// as the code is entered, each crossing between the panel and the pages outside it shows the right
// frame (the panel with its menu and «خروج»; the welcome page without them), signing out and in
// again works, and a device whose admin cookie was lost is let back in by the card.
const { B, OWNER, ok, launch, done } = require('./lib.cjs');
const HDR = { 'x-forwarded-for': '10.20.30.' + (Date.now() % 200 + 30) };
(async () => {
  const b = await launch();
  const errs = [];
  const o = await (await b.newContext({ extraHTTPHeaders: HDR })).newPage();
  await o.goto(B + '/license');
  const api = (body) => o.evaluate(async (body) => (await fetch('/api/license/admin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(), body);
  ok((await api({ op: 'login', password: OWNER })).ok === true, 'owner signs in');
  const c = await api({ op: 'create', lab: 'مختبر الدخول ' + Date.now().toString(36), days: 30, modules: ['station', 'admin'] });
  const ctx = await b.newContext({ viewport: { width: 1300, height: 900 }, extraHTTPHeaders: HDR });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`${p.url()} ${e.message.slice(0, 140)}`));
  p.on('dialog', (d) => d.accept());
  const frame = async () => ({ aside: await p.locator('aside').count(), logout: await p.locator('header button:has-text("خروج")').count() });

  await p.goto(B + '/welcome'); await p.waitForSelector('input[aria-label="رمز المختبر"]', { timeout: 20000 });
  await p.fill('input[aria-label="رمز المختبر"]', c.code); await p.click('button:has-text("تفعيل")');
  ok(await p.waitForSelector('[data-testid="admin-card"]', { timeout: 15000 }).then(() => true, () => false), 'the admin card opens as soon as the code is entered (no reload)');
  await p.click('[data-testid="admin-card"]');
  await p.waitForSelector('[data-testid="first-run"]', { timeout: 20000 });
  await p.fill('input[name="full_name"]', 'مدير'); await p.fill('input[name="username"]', 'navadmin');
  await p.fill('input[name="password"]', 'nav-pass-1'); await p.fill('input[name="again"]', 'nav-pass-2');
  await p.click('button[type="submit"]');
  await p.waitForSelector('text=كلمتا المرور غير متطابقتين', { timeout: 15000 });
  ok(await p.inputValue('input[name="username"]') === 'navadmin' && await p.inputValue('input[name="full_name"]') === 'مدير', 'first admin: a mistake keeps the name and username');
  await p.fill('input[name="password"]', 'nav-pass-1'); await p.fill('input[name="again"]', 'nav-pass-1');
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => u.pathname === '/', { timeout: 20000 }); await p.waitForSelector('aside', { timeout: 20000 });
  let f = await frame();
  ok(f.aside === 1 && f.logout === 1, 'first admin made: the panel with its menu and «خروج»');

  await p.click('[data-testid="admin-home"]');
  await p.waitForURL((u) => u.pathname === '/welcome', { timeout: 20000 }); await p.waitForSelector('[data-testid="admin-card"]', { timeout: 20000 });
  ok((await frame()).aside === 0, '«الصفحة الرئيسية»: the welcome page, outside the panel\'s frame');
  await p.click('[data-testid="admin-card"]');
  await p.waitForURL((u) => u.pathname === '/', { timeout: 20000 }); await p.waitForSelector('aside', { timeout: 20000 });
  f = await frame();
  ok(f.aside === 1 && f.logout === 1, 'the card leads back into the panel, still signed in, with its menu');
  await p.click('aside a[href="/patients"]'); await p.waitForURL((u) => u.pathname === '/patients', { timeout: 20000 });
  ok((await frame()).aside === 1, 'moving inside the panel keeps its frame');

  await p.click('header button:has-text("خروج")');
  await p.waitForURL((u) => u.pathname === '/login', { timeout: 20000 }); await p.waitForSelector('input[name="username"]', { timeout: 20000 });
  ok((await frame()).aside === 0, 'signed out: the sign-in page alone');
  await p.fill('input[name="username"]', 'navadmin'); await p.fill('input[name="password"]', 'wrong-pass');
  await p.click('button[type="submit"]');
  ok(await p.waitForSelector('text=بيانات الدخول غير صحيحة', { timeout: 15000 }).then(() => true, () => false), 'a wrong password is told');
  ok(await p.inputValue('input[name="username"]') === 'navadmin', '…and the username stays as typed (not back to «admin»)');
  await p.fill('input[name="password"]', 'nav-pass-1'); await p.click('button[type="submit"]');
  await p.waitForURL((u) => u.pathname === '/', { timeout: 20000 }); await p.waitForSelector('aside', { timeout: 20000 });
  f = await frame();
  ok(f.aside === 1 && f.logout === 1, 'signed in again: the panel with its menu');

  // The browser lost the admin cookie: the panel sends the device to the welcome page, and the
  // card renews it with the lab code instead of sending the device round in a circle.
  const keep = (await ctx.cookies()).filter((x) => x.name !== 'lab_lic_admin');
  await ctx.clearCookies(); await ctx.addCookies(keep);
  await p.goto(B + '/patients'); await p.waitForURL((u) => u.pathname === '/welcome', { timeout: 20000 });
  ok(true, 'without the admin cookie the panel sends the device to the welcome page');
  await p.waitForSelector('[data-testid="admin-card"]', { timeout: 20000 });
  await p.click('[data-testid="admin-card"]');
  await p.waitForURL((u) => u.pathname === '/', { timeout: 20000 }).catch(() => {});
  ok(new URL(p.url()).pathname === '/' && (await frame()).aside === 1, '…and the card lets it back in (the cookie renewed)');

  ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs.join(' | ') : ''}`);
  await b.close();
  done('codes.adminnav');
})().catch((e) => { console.error(e); process.exit(1); });
