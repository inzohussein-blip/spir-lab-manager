// «محطة التواصل» on a lab's own installation (no lab codes): the internal chat between two of
// the lab's computers («رمز المحادثة», not the sync's key), two labs meeting by their cards, a
// sealed file from one to the other (and refused by anyone else), a direct connection by codes,
// the settings — and «إيقاف المزامنة» in «محطة المزامنة».
const { B, ok, launch, done, kv, resetLocal } = require('./lib.cjs');
const fs = require('node:fs');
(async () => {
  const b = await launch();
  const errs = [];
  const computer = async () => {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(`${p.url()} ${e.message.slice(0, 140)}`)); p.on('dialog', (d) => d.accept());
    await p.goto(B + '/welcome'); await resetLocal(p, { 'local.activation.v1': 'legacy' });
    return p;
  };
  const until = async (fn, ms = 20000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch { /* not yet */ } await new Promise((r) => setTimeout(r, 400)); } return false; };
  const A = await computer();
  const Bp = await computer();

  // ── The station ──
  await A.goto(B + '/connect'); await A.waitForSelector('[data-testid="connect-hero"]', { timeout: 20000 });
  const items = await A.locator('aside nav a').count();
  ok(items === 7, `the station has its side menu (${items} items)`);
  ok(await A.locator('a[href="/connect"]').count() >= 1 && await A.locator('.connect').count() === 1, 'its own look (accent class)');

  // ── This computer's names ──
  const names = async (p, pc, lab) => {
    await p.goto(B + '/connect/settings#device'); await p.waitForSelector('input[aria-label="اسم الحاسوب في المحادثة"]', { timeout: 20000 });
    await p.fill('input[aria-label="اسم الحاسوب في المحادثة"]', pc); await p.locator('input[aria-label="اسم الحاسوب في المحادثة"]').blur();
    await p.fill('input[aria-label="اسم المختبر على البطاقة"]', lab); await p.locator('input[aria-label="اسم المختبر على البطاقة"]').blur();
  };
  await names(A, 'الاستقبال', 'مختبر الأول');
  await names(Bp, 'المختبر', 'مختبر الثاني');
  ok((await kv(A, 'connect.settings.v1'))?.name === 'الاستقبال', 'the computer\'s name is saved');

  // ── «رمز المحادثة»: 8 characters or more, never the sync's key ──
  await A.evaluate(() => localStorage.setItem('lab-hub-key', 'sync-key-12345'));
  await A.goto(B + '/connect/room'); await A.waitForSelector('[data-testid="room-code-form"]', { timeout: 20000 });
  await A.fill('input[aria-label="رمز المحادثة"]', 'short'); await A.click('button:has-text("حفظ الرمز")');
  ok((await A.locator('[data-testid="room-code-error"]').innerText()).includes('8 أحرف'), 'a short chat code is refused');
  await A.fill('input[aria-label="رمز المحادثة"]', 'sync-key-12345'); await A.click('button:has-text("حفظ الرمز")');
  ok((await A.locator('[data-testid="room-code-error"]').innerText()).includes('رمز المزامنة'), 'the sync\'s key cannot be the chat code');
  await A.fill('input[aria-label="رمز المحادثة"]', 'lab-chat-2026'); await A.click('button:has-text("حفظ الرمز")');
  await A.waitForSelector('[data-testid="room-thread"]', { timeout: 20000 });
  const st = await kv(A, 'connect.settings.v1');
  ok(!!st.room?.tag && !JSON.stringify(st).includes('lab-chat-2026'), 'the code itself is not kept, only what comes from it');
  await Bp.goto(B + '/connect/room'); await Bp.waitForSelector('[data-testid="room-code-form"]', { timeout: 20000 });
  await Bp.fill('input[aria-label="رمز المحادثة"]', 'lab-chat-2026'); await Bp.click('button:has-text("حفظ الرمز")');
  await Bp.waitForSelector('[data-testid="room-thread"]', { timeout: 20000 });

  // ── The internal chat ──
  await A.fill('[data-testid="room-thread"] textarea[aria-label="نص الرسالة"]', 'مرحبا من الاستقبال');
  await A.click('[data-testid="room-thread"] button:has-text("إرسال")');
  ok(await until(async () => (await Bp.locator('[data-testid="room-thread"] [data-msg="in"]').allInnerTexts()).some((t) => t.includes('مرحبا من الاستقبال') && t.includes('الاستقبال'))), 'the other computer gets the message, with the sender\'s name');
  ok(await until(async () => (await Bp.locator('[data-testid="room-online"] li').count()) === 2), 'both computers are shown online');
  await Bp.click('[data-testid="room-thread"] button[aria-label="رسالة عاجلة"]');
  await Bp.fill('[data-testid="room-thread"] textarea[aria-label="نص الرسالة"]', 'العينة جاهزة للسحب');
  await Bp.keyboard.press('Enter');
  ok(await until(async () => (await A.locator('[data-testid="room-thread"] [data-msg="in"]').allInnerTexts()).some((t) => t.includes('العينة جاهزة للسحب') && t.includes('عاجل'))), 'an urgent reply arrives marked «عاجل»');
  await Bp.click('[data-testid="quick-replies"] button:has-text("تم، شكراً")');
  ok(await until(async () => (await A.locator('[data-testid="room-thread"] [data-msg="in"]').allInnerTexts()).some((t) => t.includes('تم، شكراً'))), 'a ready reply goes with one click');
  const sealed = await A.evaluate(async () => (await (await fetch('/api/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'room_poll', tag: 'f'.repeat(40), since: 0 }) })).json()));
  ok(sealed.ok && sealed.rows.length === 0, 'another room name sees nothing');
  // Unread badge while on another page
  await A.goto(B + '/connect/settings'); await A.waitForSelector('[data-testid="settings-layout"]', { timeout: 20000 });
  await Bp.fill('[data-testid="room-thread"] textarea[aria-label="نص الرسالة"]', 'رسالة أثناء غيابك'); await Bp.keyboard.press('Enter');
  ok(await until(async () => Number(await A.locator('[data-testid="menu-unread-room"]').innerText()) >= 1), 'an unread badge on «المحادثة الداخلية» in the menu');

  // ── Two labs meet by their cards ──
  const card = async (p) => {
    await p.goto(B + '/connect/labs'); await p.waitForSelector('[data-testid="my-card"]', { timeout: 20000 });
    return { text: await p.locator('textarea[aria-label="بطاقتي"]').inputValue(), fp: await p.locator('[data-testid="my-fp"]').innerText() };
  };
  const cA = await card(A), cB = await card(Bp);
  ok(cA.text.startsWith('SPIR-CARD:') && cA.fp !== cB.fp, 'each computer has its own card and fingerprint');
  const add = async (p, text, name) => {
    await p.fill('textarea[aria-label="بطاقة المختبر"]', text); await p.click('[data-testid="add-lab"] button:has-text("إضافة")');
    await p.waitForSelector(`[data-contact="${name}"]`, { timeout: 10000 });
  };
  await add(Bp, cA.text, 'مختبر الأول');
  ok((await Bp.locator('[data-testid="contact-fp"]').innerText()) === cA.fp, 'the added lab\'s fingerprint is the one it shows itself');
  await Bp.click('button:has-text("البصمة مطابقة")');
  ok(await Bp.locator('[data-testid="lab-chat"] :text("تم التحقق")').count() === 1, 'marked as checked');
  await add(A, cB.text, 'مختبر الثاني');
  await A.fill('textarea[aria-label="بطاقة المختبر"]', cA.text); await A.click('[data-testid="add-lab"] button:has-text("إضافة")');
  ok((await A.locator('[data-testid="add-lab"]').innerText()).includes('هذا الحاسوب نفسه'), 'a computer cannot add its own card');

  // ── A sealed file from lab 2 to lab 1 ──
  await Bp.goto(B + '/connect/file'); await Bp.waitForSelector('[data-testid="file-out"] select', { timeout: 20000 });
  await Bp.fill('textarea[aria-label="نص الرسالة للملف"]', 'نتيجة المريض جاهزة — سري');
  const [dl] = await Promise.all([Bp.waitForEvent('download'), Bp.click('button:has-text("تنزيل الملف")')]);
  const file = await dl.path();
  const raw = fs.readFileSync(file, 'utf8');
  ok(raw.includes('spir-msg') && !raw.includes('نتيجة المريض'), 'the file is sealed (its text cannot be read in it)');
  await A.goto(B + '/connect/file'); await A.waitForSelector('[data-testid="file-in"]', { timeout: 20000 });
  await A.setInputFiles('[data-testid="file-input"]', file);
  ok((await A.locator('[data-testid="file-in-msg"]').innerText()).includes('1 رسالة جديدة من «مختبر الثاني»'), 'lab 1 opens it: one new message from lab 2');
  await A.goto(B + '/connect/labs'); await A.click('[data-contact="مختبر الثاني"]');
  ok(await until(async () => (await A.locator('[data-testid="contact-thread"] [data-msg="in"]').allInnerTexts()).some((t) => t.includes('نتيجة المريض جاهزة'))), 'the message is in the conversation with lab 2');
  await Bp.goto(B + '/connect/file'); await Bp.waitForSelector('[data-testid="file-in"]', { timeout: 20000 });
  await Bp.setInputFiles('[data-testid="file-input"]', file);
  ok((await Bp.locator('[data-testid="file-in-msg"]').innerText()).includes('لمختبر آخر'), 'no one else opens it (even its sender)');

  // ── A direct connection by codes ──
  await A.goto(B + '/connect/direct'); await A.waitForSelector('[data-testid="peers"]', { timeout: 20000 });
  await A.click('button:has-text("إنشاء رمز دعوة")');
  await A.waitForSelector('[data-testid="invite-code"]', { timeout: 20000 });
  const invite = await A.locator('[data-testid="invite-code"]').inputValue();
  ok(invite.startsWith('SPIR-LINK:'), 'an invitation code');
  await Bp.goto(B + '/connect/direct'); await Bp.waitForSelector('[data-testid="peers"]', { timeout: 20000 });
  await Bp.click('button:has-text("لديّ رمز دعوة")');
  await Bp.fill('textarea[aria-label="رمز الدعوة المستلم"]', invite); await Bp.click('button:has-text("إنشاء رمز الرد")');
  await Bp.waitForSelector('[data-testid="answer-code"]', { timeout: 20000 });
  await A.fill('textarea[aria-label="رمز الرد"]', await Bp.locator('[data-testid="answer-code"]').inputValue()); await A.click('[data-testid="invite"] button:has-text("اتصال")');
  const open = await until(async () => (await A.locator('[data-peer-state="open"]').count()) === 1 && (await Bp.locator('[data-peer-state="open"]').count()) === 1, 30000);
  ok(open, 'the two computers are connected directly');
  if (open) {
    ok(await until(async () => (await A.locator('[data-peer-state="open"]').innerText()).includes('مختبر الثاني')), 'each knows the other by its card');
    await Bp.click('[data-peer-state="open"] a:has-text("المحادثة")');
    await Bp.waitForSelector('[data-testid="lab-route"]', { timeout: 10000 });
    ok((await Bp.locator('[data-testid="lab-route"]').innerText()).includes('متصل مباشرة الآن'), 'the conversation shows the direct connection');
    await Bp.fill('[data-testid="contact-thread"] textarea[aria-label="نص الرسالة"]', 'مباشرة بلا وسيط'); await Bp.keyboard.press('Enter');
    await A.goto(B + '/connect/labs#' + (await kv(A, 'connect.contacts.v1')).find((c) => c.name === 'مختبر الثاني').id);
    ok(await until(async () => (await A.locator('[data-testid="contact-thread"] [data-msg="in"]').allInnerTexts()).some((t) => t.includes('مباشرة بلا وسيط') && t.includes('مباشر'))), 'a message arrives over the direct connection');
  }

  // ── «المحادثة العامة» needs the provider's site ──
  await A.goto(B + '/connect/public'); await A.waitForSelector('[data-testid="public-off"]', { timeout: 20000 });
  ok((await A.locator('[data-testid="public-off"]').innerText()).includes('موقع المزوّد'), 'the public chat is on the provider\'s site only');

  // ── Settings ──
  await A.goto(B + '/connect/settings#messages'); await A.waitForSelector('[data-testid="quick-list"]', { timeout: 20000 });
  await A.fill('input[aria-label="رسالة جديدة جاهزة"], input[aria-label="رسالة جاهزة جديدة"]', 'أرسلوا المندوب');
  await A.click('[data-testid="quick-list"] ~ form button:has-text("إضافة")');
  ok((await kv(A, 'connect.settings.v1')).quick.includes('أرسلوا المندوب'), 'a ready reply added');
  ok(await A.locator('[data-testid="mailbox-toggle"] input').isDisabled(), 'the sealed mailbox is not offered here (provider\'s site only)');
  await A.goto(B + '/connect/settings#look'); await A.waitForSelector('[data-sec="look"] [data-testid="pin-card"]', { timeout: 20000 });
  ok(true, 'its own PIN card');
  ok(!JSON.stringify(await A.evaluate(() => Object.keys(localStorage))).includes('connect.messages'), 'messages are not in localStorage');
  // Backup: the key, the labs and the messages — restored on another computer, it is the same «lab».
  await A.goto(B + '/connect/settings#device-data'); await A.waitForSelector('[data-testid="connect-backup"]', { timeout: 20000 });
  const [bk] = await Promise.all([A.waitForEvent('download'), A.click('[data-testid="connect-backup"] button:has-text("تصدير نسخة احتياطية")')]);
  const bkFile = await bk.path();
  const bkData = JSON.parse(fs.readFileSync(bkFile, 'utf8'));
  ok(bkData.app === 'spir-connect-backup' && !!bkData.data['connect.identity.v1']?.priv && bkData.data['connect.contacts.v1'].length === 1, 'the backup holds the key and the labs');
  const C = await computer();
  await C.goto(B + '/connect/settings#device-data'); await C.waitForSelector('[data-testid="connect-backup"]', { timeout: 20000 });
  await C.setInputFiles('[data-testid="connect-backup-file"]', bkFile);
  ok((await C.locator('[data-testid="connect-backup-msg"]').innerText()).includes('تمت الاستعادة'), 'restored on another computer');
  await C.goto(B + '/connect/labs'); await C.waitForSelector('[data-testid="my-fp"]', { timeout: 20000 });
  ok((await C.locator('[data-testid="my-fp"]').innerText()) === cA.fp && await C.locator('[data-contact="مختبر الثاني"]').count() === 1, 'same fingerprint and the same labs there');

  // ── «محطة المزامنة ← الإعدادات ← الحماية» ──
  await A.goto(B + '/sync/settings#protect'); await A.waitForSelector('[data-testid="sync-master"]', { timeout: 20000 });
  ok((await A.locator('[data-testid="sync-master-state"]').innerText()) === 'تعمل', 'sync is on by default');
  await A.click('[data-testid="sync-master"] button:has-text("إيقاف المزامنة")');
  ok((await A.locator('[data-testid="sync-master-state"]').innerText()) === 'موقوفة', 'sync switched off on this computer');
  await A.goto(B + '/sync/file'); await A.waitForSelector('[data-testid="sync-paused"]', { timeout: 20000 });
  ok(await A.locator('[data-testid="sync-export"]').isDisabled() && await A.locator('[data-testid="sync-drop"]').isDisabled(), 'off: no sync file out or in');
  await A.goto(B + '/sync'); await A.waitForSelector('[data-testid="sync-paused"]', { timeout: 20000 });
  ok(true, 'the overview says so');
  await A.click('[data-testid="sync-paused"] a:has-text("تشغيل المزامنة")');
  await A.waitForSelector('[data-testid="sync-master"]', { timeout: 20000 });
  await A.click('[data-testid="sync-master"] button:has-text("تشغيل المزامنة")');
  ok((await A.locator('[data-testid="sync-master-state"]').innerText()) === 'تعمل', 'switched on again');
  await A.goto(B + '/sync/file'); await A.waitForSelector('[data-testid="sync-export"]', { timeout: 20000 });
  ok(!(await A.locator('[data-testid="sync-export"]').isDisabled()) && await A.locator('[data-testid="sync-paused"]').count() === 0, 'on: sync files work again');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
