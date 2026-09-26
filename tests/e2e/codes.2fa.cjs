// Two-step sign-in for /licenses: set up with an authenticator code, sign in with it, codes used once, turn off.
const { B, OWNER, ok, launch, done } = require('./lib.cjs');
const { createHmac } = require('node:crypto');

// Independent RFC 6238 code generator (what the phone app computes).
function unbase32(s) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, value = 0; const out = [];
  for (const ch of s.replace(/\s/g, '').toUpperCase()) { value = (value << 5) | A.indexOf(ch); bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}
function totp(key, step, digits = 6, algo = 'sha1') {
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(step));
  const h = createHmac(algo, key).update(msg).digest(); const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 10 ** digits).padStart(digits, '0');
}
const step = () => Math.floor(Date.now() / 30000);
// Its own address: the attempt limit (codes.manager) blocks the default one for 10 minutes.
const HDR = { 'x-forwarded-for': '10.20.30.40' };

(async () => {
  ok(totp(Buffer.from('12345678901234567890'), 1, 8) === '94287082' && totp(Buffer.from('12345678901234567890'), 37037037, 8) === '14050471', 'code generator matches RFC 6238 test values');
  const b = await launch();
  const errs = [];
  const newOwnerPage = async () => {
    const p = await (await b.newContext({ viewport: { width: 1300, height: 950 }, extraHTTPHeaders: HDR })).newPage();
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 120))); p.on('dialog', (d) => d.accept());
    await p.goto(B + '/licenses'); await p.waitForSelector('input[aria-label="كلمة المرور"]', { timeout: 15000 });
    await p.fill('input[aria-label="كلمة المرور"]', OWNER); await p.click('button:has-text("دخول")');
    return p;
  };
  const o = await newOwnerPage();
  await o.waitForSelector('[data-testid="two-factor"]', { timeout: 15000 });
  await o.click('button:has-text("تفعيل التحقق بخطوتين")');
  await o.waitForSelector('[data-testid="totp-secret"]');
  ok(await o.locator('img[alt="رمز QR لتطبيق التحقق"]').count() === 1, 'setup shows a QR code for the phone');
  const key = unbase32(await o.locator('[data-testid="totp-secret"]').innerText());
  await o.locator('[data-testid="two-factor"] input[aria-label="رمز التحقق"]').fill(totp(key, step() - 5));
  await o.click('button:has-text("تأكيد التفعيل")'); await o.waitForTimeout(700);
  ok(await o.locator('text=الرمز غير صحيح').count() === 1, 'an old code does not confirm the setup');
  const c0 = totp(key, step());
  await o.locator('[data-testid="two-factor"] input[aria-label="رمز التحقق"]').fill(c0);
  await o.click('button:has-text("تأكيد التفعيل")'); await o.waitForTimeout(900);
  ok(await o.locator('text=✓ مفعّل').count() === 1, 'two-step sign-in switched on with a phone code');

  // Password alone now asks for the code.
  const p = await newOwnerPage();
  await p.waitForSelector('input[aria-label="رمز التحقق"]', { timeout: 10000 });
  ok(await p.locator('h1:has-text("إدارة الرموز")').count() === 0, 'password alone does not open the page');
  await p.fill('input[aria-label="رمز التحقق"]', '000000'); await p.click('button:has-text("دخول")'); await p.waitForTimeout(900);
  ok(await p.locator('text=رمز التحقق غير صحيح').count() === 1, 'a wrong code is refused');
  await p.fill('input[aria-label="رمز التحقق"]', c0); await p.click('button:has-text("دخول")'); await p.waitForTimeout(900);
  ok(await p.locator('h1:has-text("إدارة الرموز")').count() === 0, 'a code already used is refused');
  const used = totp(key, step() + 1);
  await p.fill('input[aria-label="رمز التحقق"]', used); await p.click('button:has-text("دخول")');
  await p.waitForSelector('h1:has-text("إدارة الرموز")', { timeout: 10000 });
  ok(true, 'password + fresh code opens the page');
  const log = await p.locator('text=سجل الدخول لهذه الصفحة').locator('xpath=..').innerText();
  ok((log.match(/محاولة فاشلة/g) || []).length >= 2, 'failed code attempts appear in the sign-in log');

  // Turn off (needs a code that was not used yet).
  const q = await (await b.newContext({ extraHTTPHeaders: HDR })).newPage();
  const api = (body) => q.evaluate(async (body) => (await fetch('/api/license/admin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(), body);
  await q.goto(B + '/licenses');
  ok((await api({ op: 'login', password: OWNER })).error === 'need_code', 'API: password alone → need_code');
  await p.locator('[data-testid="two-factor"] input[aria-label="رمز التحقق"]').fill(used);
  await p.click('[data-testid="two-factor"] button:has-text("إيقاف")'); await p.waitForTimeout(900);
  ok(await p.locator('text=الرمز غير صحيح').count() === 1, 'turning off needs an unused code');
  // wait for the next 30-second window so there is a fresh code
  const s0 = step(); while (step() === s0) await p.waitForTimeout(1000);
  await p.locator('[data-testid="two-factor"] input[aria-label="رمز التحقق"]').fill(totp(key, step() + 1));
  await p.click('[data-testid="two-factor"] button:has-text("إيقاف")'); await p.waitForTimeout(900);
  ok(await p.locator('button:has-text("تفعيل التحقق بخطوتين")').count() === 1, 'two-step sign-in switched off');
  ok((await api({ op: 'login', password: OWNER })).ok === true, 'password alone works again');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exitCode = 1; });
