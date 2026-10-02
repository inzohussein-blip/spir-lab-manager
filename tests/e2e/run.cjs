// Runs the browser tests against a running server:  node tests/e2e/run.cjs plain | codes
//   plain — lab codes switched off (stations, forms, pages, the admin panel)
//   codes — server started with LICENSE_ADMIN_PASSWORD, AUTH_SECRET and a fresh database (lab codes,
//           lab databases for sync and for the admin panel)
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const SUITES = {
  plain: ['station.entry.cjs', 'station.storage.cjs', 'station.offline.cjs', 'station.outage.cjs', 'station.options.cjs', 'station.forms.cjs', 'stations.flows.cjs', 'pages.crawl.cjs', 'admin.crawl.cjs', 'sync.supabase.cjs', 'training.images.cjs', 'station.extras.cjs', 'station.requests.cjs', 'sync.file.cjs', 'stations.links.cjs', 'station.more.cjs', 'store.more.cjs', 'station.fill.cjs', 'training.library.cjs', 'training.guide.cjs', 'about.station.cjs', 'admin.finance.cjs', 'connect.cjs', 'doctors.cjs'],
  codes: ['codes.core.cjs', 'codes.manager.cjs', 'codes.2fa.cjs', 'codes.offline.cjs', 'codes.sync.cjs', 'codes.companysync.cjs', 'codes.admindb.cjs', 'codes.features.cjs', 'codes.connect.cjs', 'codes.doctors.cjs'],
};
// A file that hangs is stopped and counted as failed, so the other files still run.
const LIMIT_MIN = 10;
const mode = process.argv[2] || 'plain';
if (!SUITES[mode]) { console.error(`unknown mode "${mode}" — use: ${Object.keys(SUITES).join(' | ')}`); process.exit(2); }
let failed = 0;
for (const f of SUITES[mode]) {
  console.log(`\n── ${f}`);
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { stdio: 'inherit', timeout: LIMIT_MIN * 60_000, killSignal: 'SIGKILL' });
  if (r.error && r.error.code === 'ETIMEDOUT') console.log(`FAIL ${f} stopped after ${LIMIT_MIN} minutes`);
  if (r.status !== 0) failed++;
}
console.log(`\n${mode}: ${SUITES[mode].length - failed} of ${SUITES[mode].length} suites passed`);
process.exit(failed ? 1 : 0);
