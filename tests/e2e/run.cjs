// Runs the browser tests against a running server:  node tests/e2e/run.cjs plain | codes
//   plain — lab codes switched off (stations, forms, pages)
//   codes — server started with LICENSE_ADMIN_PASSWORD, AUTH_SECRET and a fresh database (lab codes)
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const SUITES = {
  plain: ['station.entry.cjs', 'station.options.cjs', 'station.forms.cjs', 'pages.crawl.cjs'],
  codes: ['codes.core.cjs', 'codes.manager.cjs'],
};
const mode = process.argv[2] || 'plain';
if (!SUITES[mode]) { console.error(`unknown mode "${mode}" — use: ${Object.keys(SUITES).join(' | ')}`); process.exit(2); }
let failed = 0;
for (const f of SUITES[mode]) {
  console.log(`\n── ${f}`);
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { stdio: 'inherit' });
  if (r.status !== 0) failed++;
}
console.log(`\n${mode}: ${SUITES[mode].length - failed} of ${SUITES[mode].length} suites passed`);
process.exit(failed ? 1 : 0);
