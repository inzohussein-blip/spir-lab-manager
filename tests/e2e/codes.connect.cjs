// «محطة التواصل» on the provider's site: switched on per lab code; «المحادثة العامة» between labs
// (a chosen name, or the lab's own name from its code — nothing else shown), the owner's
// moderation in /license (the lab behind each name, delete, stop a lab, switch it off); the
// sealed mailbox between two labs (off by default); and the internal chat kept per lab.
const { B, OWNER, ok, launch, done, kv } = require('./lib.cjs');
const HDR = { 'x-forwarded-for': '10.20.30.61' };
const TAG = Date.now().toString(36);
const Q = 'من يملك جهاز HbA1c؟ ' + TAG, Q2 = 'رسالة ثانية بسرعة ' + TAG;
const LA = 'مختبر النور ' + TAG, LB = 'مختبر الأمل ' + TAG, LC = 'مختبر بلا تواصل ' + TAG;
(async () => {
  const b = await launch();
  const errs = [];
  const until = async (fn, ms = 25000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch { /* not yet */ } await new Promise((r) => setTimeout(r, 500)); } return false; };
  const o = await (await b.newContext({ viewport: { width: 1300, height: 950 }, extraHTTPHeaders: HDR })).newPage();
  o.on('dialog', (d) => d.accept());
  await o.goto(B + '/license');
  const api = (body) => o.evaluate(async (body) => (await fetch('/api/license/admin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(), body);
  ok((await api({ op: 'login', password: OWNER })).ok === true, 'owner signs in');
  const prefs0 = (await o.evaluate(async () => (await fetch('/api/license/admin')).json())).prefs;
  ok(prefs0.connectRelay === false && prefs0.connectPublic === true && prefs0.defaultModules.includes('connect'), 'defaults: mailbox off, public chat on, the station in a new code');
  const ca = await api({ op: 'create', lab: LA, days: 30 });
  const cb = await api({ op: 'create', lab: LB, days: 30 });
  const cc = await api({ op: 'create', lab: LC, days: 30, modules: ['station'] });
  ok(ca.row.modules.includes('connect') && !cc.row.modules.includes('connect'), 'two codes with «محطة التواصل», one without');

  const computer = async (code, name) => {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, extraHTTPHeaders: HDR });
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(`${name} ${e.message.slice(0, 140)}`)); p.on('dialog', (d) => d.accept());
    await p.goto(B + '/welcome'); await p.waitForSelector('input[aria-label="رمز المختبر"]', { timeout: 20000 });
    await p.fill('input[aria-label="رمز المختبر"]', code); await p.click('button:has-text("تفعيل")'); await p.waitForTimeout(1500);
    return p;
  };
  const a = await computer(ca.code, 'a'), bb = await computer(cb.code, 'b'), c = await computer(cc.code, 'c');

  // ── Switched on per code ──
  await c.goto(B + '/connect'); await c.waitForTimeout(2500);
  ok(await c.locator('text=المحطة غير مفعّلة').count() === 1, 'a code without the station: «المحطة غير مفعّلة»');
  const refused = await c.evaluate(async () => {
    const { token, dev } = (() => { const s = JSON.parse(localStorage.getItem('local.license.v1')); return { token: s.token, dev: localStorage.getItem('local.device.v1') }; })();
    return (await (await fetch('/api/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'public_poll', token, device: dev }) })).json()).error;
  });
  ok(refused === 'module_off', 'and the server refuses it too');
  await a.goto(B + '/welcome'); await a.waitForTimeout(800);
  ok(await a.locator('a[href="/connect"]').count() === 1, 'the station\'s card on the welcome page');

  // ── «المحادثة العامة» ──
  const pub = async (p) => { await p.goto(B + '/connect/public'); await p.waitForSelector('[data-testid="public-thread"]', { timeout: 20000 }); };
  const say = async (p, text) => { await p.fill('[data-testid="public-thread"] textarea[aria-label="نص الرسالة"]', text); await p.click('[data-testid="public-thread"] button:has-text("إرسال")'); };
  await pub(a);
  ok(await a.locator('[data-testid="public-thread"] textarea').isDisabled(), 'no name chosen yet: writing waits for one');
  await a.click('[data-testid="public-as"] button:has-text("اسم المختبر")');
  await say(a, 'مرحباً بالجميع');
  await pub(bb);
  await bb.fill('input[aria-label="الاسم المستعار"]', 'زائر الشمال'); await bb.locator('input[aria-label="الاسم المستعار"]').blur();
  await say(bb, Q);
  const msgs = (p) => p.locator('[data-testid="public-thread"] [data-msg]').allInnerTexts();
  ok(await until(async () => (await msgs(bb)).some((t) => t.includes('مرحباً بالجميع') && t.includes(LA) && t.includes('مختبر'))), 'lab B sees lab A\'s message under its lab name (checked)');
  ok(await until(async () => (await msgs(a)).some((t) => t.includes(Q) && t.includes('زائر الشمال') && t.includes('اسم مستعار'))), 'lab A sees lab B under its chosen name, marked as such');
  ok(!(await msgs(a)).some((t) => t.includes(LB)), 'lab B\'s real name is not shown');
  const raw = await a.evaluate(async () => {
    const s = JSON.parse(localStorage.getItem('local.license.v1'));
    return (await fetch('/api/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'public_poll', token: s.token, device: localStorage.getItem('local.device.v1') }) })).json();
  });
  ok(raw.rows.every((r) => JSON.stringify(Object.keys(r).sort()) === JSON.stringify(['at', 'id', 'lab', 'mine', 'name', 'text'])), 'the server gives a name, a text and a time — nothing else about a lab');
  await bb.waitForTimeout(2200);
  await say(bb, Q2);
  await until(async () => (await bb.locator('[data-testid="public-thread"] textarea').inputValue()) === '', 5000);
  await say(bb, 'رسالة ثالثة بسرعة');
  ok(await until(async () => (await bb.locator('[data-testid="send-error"]').innerText()).includes('تمهّل'), 5000), 'too fast: «تمهّل قليلاً»');

  // ── The owner: who is behind each name; delete; stop a lab ──
  await o.goto(B + '/license#connect'); await o.reload(); await o.waitForSelector('[data-testid="connect-public-list"] [data-public-msg]', { timeout: 20000 });
  const ownerList = await o.locator('[data-testid="connect-public-list"]').innerText();
  ok(ownerList.includes('زائر الشمال') && ownerList.includes(LB), 'the owner sees the lab behind a chosen name');
  const bMsg = o.locator('[data-public-msg]', { hasText: Q });
  await bMsg.locator('button[aria-label="حذف الرسالة"]').click();
  await o.waitForTimeout(800);
  ok(await o.locator('[data-public-msg]', { hasText: Q }).count() === 0, 'a message deleted');
  ok(await until(async () => !(await msgs(a)).some((t) => t.includes(Q))), '…and it disappears for the labs that had it');
  await o.locator('[data-public-msg]', { hasText: Q2 }).locator('button[aria-label="إيقاف المختبر"]').click();
  await o.waitForSelector('[data-testid="connect-blocked"]', { timeout: 10000 });
  ok((await o.locator('[data-testid="connect-blocked"]').innerText()).includes(LB), 'lab B stopped from writing');
  await bb.waitForTimeout(2200); await say(bb, 'هل تسمعونني؟');
  ok(await until(async () => (await bb.locator('[data-testid="send-error"]').innerText()).includes('أوقف المزوّد'), 8000), 'a stopped lab is told so');
  await o.locator('[data-testid="connect-blocked"] button').click(); await o.waitForTimeout(800);
  ok(await o.locator('[data-testid="connect-blocked"]').count() === 0, 'and allowed again');
  await o.uncheck('input[aria-label="المحادثة العامة"]'); await o.waitForTimeout(800);
  await a.goto(B + '/connect/public'); await a.waitForTimeout(500); await a.reload();
  ok(await until(async () => (await a.locator('[data-testid="public-off"]').innerText()).includes('أوقف المزوّد')), 'the owner switches the public chat off');
  await o.check('input[aria-label="المحادثة العامة"]'); await o.waitForTimeout(500);

  // ── The internal chat on the site: off with the mailbox ──
  await a.goto(B + '/connect/room'); await a.waitForTimeout(1500);
  await a.reload();
  ok(await until(async () => (await a.locator('[data-testid="room-off"]').count()) === 1), 'the internal chat through the site waits for the provider (mailbox off)');

  // ── The sealed mailbox (off by default) ──
  await a.goto(B + '/connect/settings#labs'); await a.waitForSelector('[data-testid="mailbox-toggle"]', { timeout: 20000 });
  ok(await a.locator('[data-testid="mailbox-toggle"] input').isDisabled(), 'off at the provider: the lab cannot switch it on');
  await o.check('input[aria-label="صندوق البريد المشفّر"]'); await o.waitForTimeout(800);
  ok((await o.evaluate(async () => (await fetch('/api/license/admin')).json())).prefs.connectRelay === true, 'the owner switches the mailbox on');
  // Prefs saved from «الإعدادات العامة» keep it.
  await o.goto(B + '/license#settings'); await o.reload(); await o.waitForSelector('[data-testid="prefs-card"]', { timeout: 15000 });
  await o.click('[data-testid="prefs-card"] button:has-text("حفظ الإعدادات")'); await o.waitForTimeout(800);
  ok((await o.evaluate(async () => (await fetch('/api/license/admin')).json())).prefs.connectRelay === true, '…and saving the general settings keeps it');
  const mailboxOn = async (p) => {
    await p.goto(B + '/connect/settings#labs'); await p.reload(); await p.waitForSelector('[data-testid="mailbox-toggle"]', { timeout: 20000 });
    await until(async () => !(await p.locator('[data-testid="mailbox-toggle"] input').isDisabled()), 15000);
    await p.check('[data-testid="mailbox-toggle"] input');
  };
  await mailboxOn(a); await mailboxOn(bb);
  const card = async (p) => { await p.goto(B + '/connect/labs'); await p.waitForSelector('[data-testid="my-card"]', { timeout: 20000 }); return p.locator('textarea[aria-label="بطاقتي"]').inputValue(); };
  const addCard = async (p, text) => { await p.fill('textarea[aria-label="بطاقة المختبر"]', text); await p.click('[data-testid="add-lab"] button:has-text("إضافة")'); await p.waitForSelector('[data-testid="lab-chat"]', { timeout: 10000 }); };
  const cardA = await card(a), cardB = await card(bb);
  await addCard(bb, cardA); await addCard(a, cardB);
  ok(await until(async () => (await a.locator('[data-testid="lab-route"]').innerText()).includes('صندوق البريد المشفّر مفعّل')), 'the conversation goes by the mailbox');
  await a.fill('[data-testid="contact-thread"] textarea[aria-label="نص الرسالة"]', 'عبر الصندوق المشفّر'); await a.keyboard.press('Enter');
  ok(await until(async () => (await kv(a, 'connect.messages.v1')).some((m) => m.text === 'عبر الصندوق المشفّر' && m.status === 'sent' && m.via === 'mailbox')), 'sent to lab B\'s mailbox');
  await bb.goto(B + '/connect/labs');
  ok(await until(async () => ((await kv(bb, 'connect.messages.v1')) || []).some((m) => m.text === 'عبر الصندوق المشفّر' && m.dir === 'in'), 30000), 'lab B receives it');

  // ── The internal chat on the site (mailbox on): kept per lab ──
  const room = async (p) => {
    await p.goto(B + '/connect/room'); await p.reload(); await p.waitForSelector('[data-testid="room-code-form"]', { timeout: 20000 });
    await p.fill('input[aria-label="رمز المحادثة"]', 'same-code-both-labs'); await p.click('button:has-text("حفظ الرمز")');
    await p.waitForSelector('[data-testid="room-thread"]', { timeout: 20000 });
  };
  await room(a); await room(bb);
  await a.fill('[data-testid="room-thread"] textarea[aria-label="نص الرسالة"]', 'داخلي لمختبر النور فقط'); await a.keyboard.press('Enter');
  ok(await until(async () => (await kv(a, 'connect.messages.v1')).some((m) => m.text === 'داخلي لمختبر النور فقط' && m.status === 'sent')), 'lab A\'s internal message is kept by the server (sealed)');
  await bb.waitForTimeout(6000);
  ok(!((await kv(bb, 'connect.messages.v1')) || []).some((m) => m.text === 'داخلي لمختبر النور فقط'), 'another lab with the same chat code never gets it');

  await o.goto(B + '/license#connect'); await o.reload(); await o.waitForSelector('[data-testid="connect-owner"]', { timeout: 15000 });
  await o.uncheck('input[aria-label="صندوق البريد المشفّر"]'); await o.waitForTimeout(500); // back to the default for the other files
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
