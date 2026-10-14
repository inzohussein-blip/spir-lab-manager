// The offline copy must hold every page of the local stations: each page under their folders in
// src/app (one copy for a page with an id in its address, each «عن التطبيق» section by name) is in
// public/local-sw.js ROUTES, and every route there is a real page. No browser or server needed.
const fs = require('node:fs');
const path = require('node:path');
const { ok, done } = require('./lib.cjs');
const ROOT = path.join(__dirname, '..', '..');
const sw = fs.readFileSync(path.join(ROOT, 'public/local-sw.js'), 'utf8');
const list = (name) => { const at = sw.indexOf(`const ${name}`); return [...sw.slice(at, sw.indexOf('];', at)).matchAll(/"(\/[^"]*)"/g)].map((m) => m[1]); };
const routes = new Set(list('ROUTES'));
const bases = list('BASES').map((b) => b.slice(1));
const about = [...fs.readFileSync(path.join(ROOT, 'src/lib/about/content.ts'), 'utf8').matchAll(/slug: "([a-z-]+)"/g)].map((m) => `/about/${m[1]}`);

const pages = new Set();
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.name === 'page.tsx') {
      const rel = '/' + path.relative(path.join(ROOT, 'src/app'), dir).split(path.sep).filter((x) => !/^\(.*\)$/.test(x)).join('/');
      if (rel === '/about/[slug]') about.forEach((a) => pages.add(a));
      else pages.add(rel.replace(/\/\[[^\]]+\]/g, '/_'));
    }
  }
};
for (const b of bases) walk(path.join(ROOT, 'src/app', b));

const missing = [...pages].filter((p) => !routes.has(p)).sort();
const extra = [...routes].filter((r) => !pages.has(r)).sort();
ok(pages.size > 50, `the local stations' pages found (${pages.size})`);
ok(missing.length === 0, `every page is saved for offline use${missing.length ? ` — missing: ${missing.join(', ')}` : ''}`);
ok(extra.length === 0, `every saved route is a real page${extra.length ? ` — not found: ${extra.join(', ')}` : ''}`);
done();
