// The project's own images (public/lab-images): listed in the training image library, chosen for
// a test (the record keeps the path — text, so it syncs like any other text), shown, and part of
// the offline copy. Needs the test image: node tests/e2e/make-test-image.cjs before the build.
const { B, ok, launch, done, kv, resetLocal } = require('./lib.cjs');
const IMG = '/lab-images/test/أنبوب اختبار.png';

(async () => {
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 140))); p.on('dialog', (d) => d.accept());
  await p.goto(B + '/welcome'); await resetLocal(p, { 'local.activation.v1': 'legacy' });
  const loaded = (loc) => loc.evaluate((i) => new Promise((res) => { if (i.complete) return res(i.naturalWidth > 0); i.onload = () => res(true); i.onerror = () => res(false); setTimeout(() => res(i.naturalWidth > 0), 5000); }));

  await p.goto(B + '/training/media'); await p.waitForSelector('[data-testid="project-images"]', { timeout: 20000 });
  const sec = p.locator('[data-testid="project-images"]');
  ok((await sec.innerText()).includes('أنبوب اختبار'), 'media page lists the project\'s images (caption from the file name)');
  ok(await loaded(sec.locator('img').first()), 'the project image is shown');

  // A new training test with a project image as its cover.
  await p.goto(B + '/training/edit'); await p.waitForSelector('text=اسم الفحص (عربي)', { timeout: 20000 });
  await p.locator('label:has-text("اسم الفحص (عربي)") input').fill('فحص بصورة المشروع');
  await p.locator('button:has-text("من المكتبة")').first().click();
  await p.waitForSelector('[data-testid="library-project"]');
  ok(true, 'the image library opens on «صور المشروع»');
  await p.locator(`[data-testid="library-project"] button[title="${IMG}"]`).click();
  await p.click('button:has-text("حفظ الفحص")'); await p.waitForURL(/\/training\/test\//, { timeout: 15000 });
  const t = ((await kv(p, 'training.tests.v1')) || []).find((x) => x.name_ar === 'فحص بصورة المشروع');
  ok(t && t.coverImageId === IMG, `the test keeps the image's path (${t && t.coverImageId})`);
  const cover = p.locator('img[src*="lab-images"]').first();
  await cover.waitFor({ timeout: 10000 });
  ok(await loaded(cover), 'the cover image shows on the test page');

  // Part of the offline copy.
  let saved = null;
  for (let i = 0; i < 180 && !saved; i++) {
    await p.waitForTimeout(1000);
    saved = await p.evaluate(async () => { const m = await (await caches.open('local-meta')).match('/__local-meta'); return m ? (await m.json()).build : null; });
  }
  ok(!!saved, 'offline copy saved');
  const inCopy = await p.evaluate(async () => {
    const meta = await (await (await caches.open('local-meta')).match('/__local-meta')).json();
    return (await (await caches.open(meta.cache)).keys()).map((r) => decodeURIComponent(new URL(r.url).pathname)).filter((k) => k.startsWith('/lab-images/'));
  });
  ok(inCopy.includes('/lab-images/test/أنبوب اختبار.png'), `the project image is in the offline copy (${inCopy.join(', ')})`);
  const url = p.url();
  await ctx.setOffline(true);
  await p.goto(url); await p.waitForSelector('img[src*="lab-images"]', { timeout: 20000 });
  ok(await loaded(p.locator('img[src*="lab-images"]').first()), 'offline: the project image still shows');
  await ctx.setOffline(false);

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
