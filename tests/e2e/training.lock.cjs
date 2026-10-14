// «التدريب»: the edit PIN opens on any address — the lab computer (localhost) and the others on the
// network (http://192.168.…, where the browser offers no crypto.subtle) give the same SHA-256, and a
// PIN saved earlier on such an address (the older FNV fallback) still opens.
const crypto = require('crypto');
const { B, ok, launch, done, kv, kvPut } = require('./lib.cjs');
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
const fnv = (t) => { let h = 0x811c9dc5; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193); } return 'f' + (h >>> 0).toString(16); };
(async () => {
  const b = await launch();
  const errs = [];
  const p = await (await b.newContext({ viewport: { width: 1300, height: 900 } })).newPage();
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 140)));
  await p.goto(B + '/training/settings'); await p.waitForSelector('aside nav a', { timeout: 20000 }); await p.waitForTimeout(800);
  const settings = (await kv(p, 'training.settings.v1')) || {};
  const tryPin = async (hash, pin) => {
    await kvPut(p, 'training.settings.v1', { ...settings, lockEnabled: true, pinHash: hash });
    await p.evaluate(() => sessionStorage.clear());
    await p.goto(B + '/training/exam'); await p.waitForSelector('input[placeholder="رمز التعديل"]', { timeout: 20000 });
    // The page's own form (a small one sits in the menu too).
    const form = p.locator('form:has-text("وضع القراءة فقط")');
    await form.locator('input[placeholder="رمز التعديل"]').fill(pin); await form.locator('button:has-text("فتح")').click(); await p.waitForTimeout(700);
    return p.locator('form:has-text("وضع القراءة فقط")').count().then((n) => n === 0);
  };
  ok(!(await tryPin(sha('spir-training-pin:2468'), '1111')), 'a wrong PIN does not open');
  ok(await tryPin(sha('spir-training-pin:2468'), '2468'), 'a PIN saved as SHA-256 opens here (' + new URL(B).hostname + ')');
  ok(await tryPin(fnv('spir-training-pin:1357'), '1357'), 'a PIN saved with the older fallback still opens');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
