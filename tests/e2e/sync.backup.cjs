// «النسخة الشاملة» (محطة المزامنة): every station in one file — download, check before restoring,
// restore on another device (the data replaces its own); the reminder in the stations after a week
// without a backup; the automatic save to a folder (the browser's folder picker stands in for an
// origin-private folder here), keeping the last 10 files.
const fs = require('fs');
const { B, ok, launch, done, kv, kvPut } = require('./lib.cjs');
const DAY = 86400000;
(async () => {
  const b = await launch();
  const errs = [];
  const dev = async () => {
    const ctx = await b.newContext({ viewport: { width: 1300, height: 900 }, acceptDownloads: true });
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message.slice(0, 140))); p.on('crash', () => errs.push('the page crashed: ' + p.url())); p.on('dialog', (d) => d.accept());
    return { ctx, p };
  };

  // ── A device with data in two stations ──
  const { p: a } = await dev();
  await a.goto(B + '/sync/backup'); await a.waitForSelector('[data-testid="full-backup-download"]', { timeout: 20000 });
  ok((await a.locator('[data-testid="backup-last"]').innerText()).includes('لم تُؤخذ نسخة شاملة'), 'no full backup yet');
  const patient = { id: 'p-backup-1', name: 'مراجع النسخة الشاملة', phone: '0770', created_at: Date.now() };
  await kvPut(a, 'station.patients.v1', [patient]);
  await kvPut(a, 'roster.staff.v1', [{ id: 's1', name: 'موظف النسخة' }]);
  await a.evaluate(() => { localStorage.setItem('station.theme.v1', 'dark'); localStorage.setItem('local.license.v1', '{"token":"x"}'); });
  await a.reload(); await a.waitForSelector('[data-testid="full-backup-download"]', { timeout: 20000 });
  const [dl] = await Promise.all([a.waitForEvent('download'), a.click('[data-testid="full-backup-download"]')]);
  const path = await dl.path();
  const file = JSON.parse(fs.readFileSync(path, 'utf8'));
  ok(/^spir-lab-backup-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), 'the file is named by its date');
  ok(file.app === 'spir-lab-full' && JSON.parse(file.data['station.patients.v1'])[0].name === patient.name && !!file.data['roster.staff.v1'], 'it holds the stations\' data');
  ok(file.settings['station.theme.v1'] === 'dark' && !JSON.stringify(file).includes('local.license') && !file.data['station.syncDevice.v1'], 'with the look, without the lab code or this computer\'s sync identity');
  await a.waitForTimeout(300);
  ok(!(await a.locator('[data-testid="backup-last"]').innerText()).includes('لم تُؤخذ'), 'the page shows the last backup');

  // ── Restored on another device ──
  const { p: c } = await dev();
  await c.goto(B + '/sync/backup'); await c.waitForSelector('[data-testid="full-backup-pick"]', { timeout: 20000 });
  await kvPut(c, 'station.patients.v1', [{ id: 'p-other', name: 'مراجع سيُستبدل', created_at: 1 }]);
  await kvPut(c, 'qc.devices.v1', [{ id: 'q1', name: 'جهاز سيُحذف' }]);
  await c.reload(); await c.waitForSelector('[data-testid="full-backup-pick"]', { timeout: 20000 });
  await c.setInputFiles('[data-testid="full-backup-file"]', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"spir-training"}') });
  ok((await c.locator('[data-testid="full-backup-msg"]').innerText()).includes('ليس «نسخة شاملة»'), 'another file is refused');
  await c.setInputFiles('[data-testid="full-backup-file"]', path);
  await c.waitForSelector('[data-testid="full-backup-preview"]');
  const preview = await c.locator('[data-testid="full-backup-preview"]').innerText();
  ok(preview.includes('محطة المختبر') && preview.includes('الكادر والدوام'), 'it is shown per station before restoring');
  await c.click('[data-testid="full-backup-restore"]');
  await c.waitForTimeout(2500); await c.waitForSelector('[data-testid="full-backup-pick"]', { timeout: 20000 });
  const pats = await kv(c, 'station.patients.v1');
  ok(pats.length === 1 && pats[0].id === patient.id, 'restored: the backup\'s patients replace the device\'s');
  ok((await kv(c, 'qc.devices.v1')) === null && (await kv(c, 'roster.staff.v1'))?.[0]?.name === 'موظف النسخة', 'what is not in the backup is gone, the rest is there');
  ok(await c.evaluate(() => localStorage.getItem('station.theme.v1')) === 'dark', 'the look came with it');

  // ── «كلمة مرور النسخ»: the file is sealed, and opens only with it ──
  await a.goto(B + '/sync/backup'); await a.waitForSelector('[data-testid="backup-password"]', { timeout: 20000 });
  await a.fill('input[aria-label="كلمة مرور النسخ"]', 'lab-pass-77'); await a.fill('input[aria-label="تأكيد كلمة مرور النسخ"]', 'lab-pass-70');
  await a.click('[data-testid="backup-password-save"]'); await a.waitForTimeout(300);
  ok((await a.locator('[data-testid="full-backup-msg"]').innerText()).includes('غير متطابقتين'), 'the two passwords must match');
  await a.fill('input[aria-label="تأكيد كلمة مرور النسخ"]', 'lab-pass-77');
  await a.click('[data-testid="backup-password-save"]'); await a.waitForSelector('[data-testid="backup-password"] >> text=مفعّلة', { timeout: 20000 });
  ok(!(await a.evaluate(() => JSON.stringify(localStorage))).includes('lab-pass-77'), 'the password itself is not kept on the device');
  const [dl3] = await Promise.all([a.waitForEvent('download'), a.click('[data-testid="full-backup-download"]')]);
  const sealedPath = await dl3.path();
  const sealedText = fs.readFileSync(sealedPath, 'utf8');
  ok(JSON.parse(sealedText).box && !sealedText.includes(patient.name) && !sealedText.includes('roster.staff'), 'the file is sealed: no patient name or station inside');
  await c.goto(B + '/sync/backup'); await c.waitForSelector('[data-testid="full-backup-pick"]', { timeout: 20000 });
  await c.setInputFiles('[data-testid="full-backup-file"]', sealedPath);
  await c.waitForSelector('[data-testid="full-backup-sealed"]');
  await c.fill('input[aria-label="كلمة مرور النسخة"]', 'wrong-pass'); await c.click('[data-testid="full-backup-unseal"]');
  await c.waitForSelector('[data-testid="full-backup-msg"]', { timeout: 20000 });
  ok((await c.locator('[data-testid="full-backup-msg"]').innerText()).includes('غير صحيحة') && await c.locator('[data-testid="full-backup-preview"]').count() === 0, 'a wrong password does not open it');
  await c.fill('input[aria-label="كلمة مرور النسخة"]', 'lab-pass-77'); await c.click('[data-testid="full-backup-unseal"]');
  await c.waitForSelector('[data-testid="full-backup-preview"]', { timeout: 20000 });
  ok((await c.locator('[data-testid="full-backup-preview"]').innerText()).includes('محطة المختبر'), 'the right password opens it for restoring');
  await c.click('[data-testid="full-backup-restore"]');
  await c.waitForTimeout(2500); await c.waitForSelector('[data-testid="full-backup-pick"]', { timeout: 20000 });
  ok((await kv(c, 'station.patients.v1'))?.[0]?.id === patient.id, 'and restores it');

  // ── The reminder in the stations ──
  await c.evaluate((t) => localStorage.setItem('local.backup.v1', JSON.stringify({ last: t })), Date.now() - 3 * DAY);
  await c.goto(B + '/store'); await c.waitForSelector('aside nav a', { timeout: 20000 }); await c.waitForTimeout(800);
  ok(await c.locator('[data-testid="backup-reminder"]').count() === 0, 'no reminder 3 days after a backup');
  await c.evaluate((t) => localStorage.setItem('local.backup.v1', JSON.stringify({ last: t })), Date.now() - 9 * DAY);
  await c.reload(); await c.waitForSelector('[data-testid="backup-reminder"]', { timeout: 15000 });
  ok((await c.locator('[data-testid="backup-reminder"]').innerText()).includes('9 يوم'), 'after 9 days: the reminder, in another station');
  ok(await c.locator('[data-testid="backup-reminder"] a').count() === 0, 'it does not link to another station');
  const [dl2] = await Promise.all([c.waitForEvent('download'), c.click('[data-testid="backup-reminder-go"]')]);
  ok(JSON.parse(fs.readFileSync(await dl2.path(), 'utf8')).app === 'spir-lab-full', 'it downloads the full backup from there');
  await c.waitForTimeout(300);
  ok(await c.locator('[data-testid="backup-reminder"]').count() === 0, 'and goes away');
  await c.evaluate((t) => localStorage.setItem('local.backup.v1', JSON.stringify({ last: t })), Date.now() - 9 * DAY);
  await c.reload(); await c.waitForSelector('[data-testid="backup-reminder"]', { timeout: 15000 });
  await c.click('[data-testid="backup-reminder"] button:has-text("لاحقاً")'); await c.reload(); await c.waitForSelector('aside nav a'); await c.waitForTimeout(800);
  ok(await c.locator('[data-testid="backup-reminder"]').count() === 0, '«لاحقاً»: not shown again today');
  const { p: fresh } = await dev();
  await fresh.goto(B + '/station'); await fresh.waitForTimeout(2500);
  ok(await fresh.locator('[data-testid="backup-reminder"]').count() === 0, 'a new device is not asked');

  // ── Automatic save to a folder ──
  const { ctx: fx, p: f } = await dev();
  // The browser's private folder stands in for the folder the lab picks (no folder picker in a test
  // browser). The app keeps the picked folder in IndexedDB («lab-backup-folder»); Chromium 153 closes
  // the whole browser when a private-folder handle is read back from IndexedDB on a new page (a
  // ten-line script without the app shows it), so here the stored value is a marker and reading it
  // gives the private folder again — the app's own steps (when due, write, keep the last 10) run as is.
  await fx.addInitScript(() => {
    const dir = () => navigator.storage.getDirectory().then((r) => r.getDirectoryHandle('lab-backups', { create: true }));
    let held = null; dir().then((h) => { held = h; });
    window.showDirectoryPicker = async () => (held = await dir());
    if (window.FileSystemHandle) { FileSystemHandle.prototype.queryPermission = async () => 'granted'; FileSystemHandle.prototype.requestPermission = async () => 'granted'; }
    const isFolderStore = (s) => s.name === 'h' && s.transaction?.db?.name === 'lab-backup-folder';
    const put = IDBObjectStore.prototype.put, get = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.put = function (v, k) { return put.call(this, isFolderStore(this) && k === 'dir' ? 'private-folder' : v, k); };
    IDBObjectStore.prototype.get = function (k) {
      const r = get.call(this, k);
      if (isFolderStore(this) && k === 'dir') Object.defineProperty(r, 'result', { get: () => held });
      return r;
    };
  });
  f.on('crash', () => console.log('the page crashed: ' + f.url()));
  let ending = false;
  b.on('disconnected', () => { if (!ending) console.log('the browser closed'); });
  const files = () => f.evaluate(async () => { const d = await (await navigator.storage.getDirectory()).getDirectoryHandle('lab-backups', { create: true }); const n = []; for await (const k of d.keys()) n.push(k); return n.sort(); });
  await f.goto(B + '/sync/backup'); await f.waitForSelector('[data-testid="auto-save-folder"]', { timeout: 20000 });
  await kvPut(f, 'station.patients.v1', [patient]);
  await f.evaluate(async () => { const d = await (await navigator.storage.getDirectory()).getDirectoryHandle('lab-backups', { create: true });
    for (let i = 1; i <= 12; i++) { const w = await (await d.getFileHandle(`spir-lab-backup-2020-01-${String(i).padStart(2, '0')}.json`, { create: true })).createWritable(); await w.write('{}'); await w.close(); }
    const w = await (await d.getFileHandle('notes.txt', { create: true })).createWritable(); await w.write('mine'); await w.close(); });
  await f.reload(); await f.waitForSelector('[data-testid="auto-save-folder"]', { timeout: 20000 });
  await f.click('[data-testid="auto-save-folder"]'); await f.waitForTimeout(1500);
  ok((await f.locator('[data-testid="auto-save"]').innerText()).includes('lab-backups'), 'the folder is chosen');
  let names = await files();
  const today = await f.evaluate(() => `spir-lab-backup-${new Date().toLocaleDateString('en-CA')}.json`);
  ok(names.includes(today) && names.filter((n) => n.startsWith('spir-lab-backup-')).length === 10 && names.includes('notes.txt'), 'the first backup is saved; the last 10 are kept, other files are left alone');
  const saved = await f.evaluate(async (n) => {
    const d = await (await navigator.storage.getDirectory()).getDirectoryHandle('lab-backups');
    return JSON.parse(await (await (await d.getFileHandle(n)).getFile()).text());
  }, today);
  ok(saved.app === 'spir-lab-full' && JSON.parse(saved.data['station.patients.v1'])[0].id === patient.id, 'the saved file is the full backup');
  // Due again (two days on): a station saves by itself when it opens — today's file is written again.
  // (Nothing is deleted in the browser's private folder here: a newer headless Chromium closed the
  // page when a file was removed from it before the next page opened.)
  const savedAt = saved.at;
  await f.evaluate(() => { const s = JSON.parse(localStorage.getItem('local.backup.v1')); s.last = Date.now() - 2 * 86400000; localStorage.setItem('local.backup.v1', JSON.stringify(s)); });
  await f.waitForTimeout(50);
  await f.goto(B + '/qc'); await f.waitForSelector('aside nav a', { timeout: 20000 }); await f.waitForTimeout(2000);
  const again = await f.evaluate(async (n) => {
    const d = await (await navigator.storage.getDirectory()).getDirectoryHandle('lab-backups');
    return JSON.parse(await (await (await d.getFileHandle(n)).getFile()).text());
  }, today);
  ok(again.at > savedAt && await f.evaluate(() => Date.now() - JSON.parse(localStorage.getItem('local.backup.v1')).last < 60000), 'when due, opening a station saves to the folder by itself');
  ok(await f.locator('[data-testid="backup-reminder"]').count() === 0, 'no reminder while the folder keeps the backups');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  ending = true; await b.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
