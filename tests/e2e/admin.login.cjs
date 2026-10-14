// The admin panel's sign-in: after 10 wrong passwords from one address in 10 minutes it waits (even
// the right password), as the owner's and the lab codes' sign-ins do; another address is not affected,
// and a right password clears the count.
const { B, ok, launch, done } = require('./lib.cjs');
(async () => {
  const b = await launch();
  const errs = [];
  const at = async (ip) => {
    const p = await (await b.newContext({ viewport: { width: 1300, height: 900 }, extraHTTPHeaders: { 'x-forwarded-for': ip } })).newPage();
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 140)));
    await p.goto(B + '/login'); await p.waitForSelector('input[name="username"]', { timeout: 20000 });
    return p;
  };
  const tryLogin = async (p, password) => {
    await p.fill('input[name="username"]', 'admin'); await p.fill('input[name="password"]', password);
    await p.click('button[type="submit"]');
    await p.waitForFunction(() => !location.pathname.startsWith('/login') || /غير صحيحة|محاولات كثيرة/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(300);
    return new URL(p.url()).pathname.startsWith('/login') ? (await p.locator('body').innerText()) : 'in';
  };
  const ip = `10.77.${Date.now() % 200}.${Math.floor(Math.random() * 250) + 1}`;
  const p = await at(ip);
  let last = '';
  for (let i = 0; i < 10; i++) last = await tryLogin(p, 'wrong-' + i);
  ok(last.includes('غير صحيحة'), 'ten wrong passwords: «بيانات الدخول غير صحيحة»');
  ok((await tryLogin(p, 'wrong-x')).includes('محاولات كثيرة'), 'the eleventh waits: «محاولات كثيرة خاطئة»');
  ok((await tryLogin(p, 'admin123')).includes('محاولات كثيرة'), 'even the right password waits now');
  const q = await at(ip.replace(/\.\d+$/, '.' + ((Number(ip.split('.').pop()) % 250) + 2)));
  ok((await tryLogin(q, 'admin123')) === 'in', 'another address signs in');
  const r = await at(`10.78.${Date.now() % 200}.9`);
  for (let i = 0; i < 3; i++) await tryLogin(r, 'wrong-' + i);
  ok((await tryLogin(r, 'admin123')) === 'in', 'a few wrong tries, then the right password: in');
  // A made-up session cookie (signed with the old key that was written in the code, or with an id that
  // is no account's) never opens the panel.
  const { SignJWT } = require('jose');
  const forged = async (key, id) => new SignJWT({ user: { id, username: 'x', full_name: 'x', role: 'admin' }, db: 'main' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(key));
  const opens = async (cookie) => {
    const res = await fetch(B + '/users', { headers: { cookie: `lab_session=${cookie}` }, redirect: 'manual' });
    return res.status === 200 && /المستخدمون/.test(await res.text());
  };
  const oldKey = 'dev-insecure-key-change-me-in-production-00000000';
  ok(!(await opens(await forged(oldKey, 'not-a-uuid'))), 'a cookie made with the old built-in key does not open the panel');
  ok(!(await opens(await forged(oldKey, '00000000-0000-0000-0000-000000000000'))), 'nor one with an unknown account id');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
