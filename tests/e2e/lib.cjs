/**
 * Shared helpers for the browser tests (run by tests/e2e/run.cjs and in CI).
 *  - E2E_BASE: site address (default http://localhost:3456)
 *  - CHROME_PATH: a Chromium to use instead of Playwright's own download
 *  - E2E_OWNER_PASSWORD: owner password of /licenses in the "codes" run
 */
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("playwright-core");

const B = (process.env.E2E_BASE || "http://localhost:3456").replace(/\/$/, "");
const OWNER = process.env.E2E_OWNER_PASSWORD || "owner-test-pass";
let pass = 0, fail = 0;

function ok(cond, msg) {
  if (cond) pass++; else fail++;
  console.log((cond ? "PASS " : "FAIL ") + msg);
}
function launch() {
  const executablePath = process.env.CHROME_PATH || undefined;
  return chromium.launch(executablePath ? { executablePath } : {});
}
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "lab-e2e-"));
/** A file path for screenshots / downloads that never lands in the repository. */
const tmp = (name) => path.join(outDir, name);
/** Pages in a PDF produced by page.pdf(). */
const pdfPages = (buf) => (buf.toString("latin1").match(/\/Type\s*\/Page(?!s)/g) || []).length;
function done(label) {
  console.log(`${label || path.basename(process.argv[1])}: ${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
}

// Station data lives in IndexedDB "lab-local" (src/lib/local/kv.ts); these read / change it from a test.
const IDB = `(() => new Promise((res, rej) => { const r = indexedDB.open('lab-local', 1);
  r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); };
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }))`;
/** The stored JSON value of a station key (null when missing). */
const kv = (page, k) => page.evaluate(async ([k, IDB]) => {
  const d = await (0, eval)(IDB)();
  const v = await new Promise((res) => { const r = d.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => res(undefined); });
  d.close();
  const raw = v ?? localStorage.getItem(k);
  return raw == null ? null : JSON.parse(raw);
}, [k, IDB]);
/** Write (or with null, delete) a station key directly; reload the page afterwards. */
const kvPut = (page, k, value) => page.evaluate(async ([k, value, IDB]) => {
  const d = await (0, eval)(IDB)();
  await new Promise((res) => { const tx = d.transaction('kv', 'readwrite'); const s = tx.objectStore('kv');
    if (value == null) s.delete(k); else s.put(JSON.stringify(value), k); tx.oncomplete = tx.onerror = res; });
  d.close(); localStorage.removeItem(k);
}, [k, value, IDB]);
/** A clean device: empty localStorage (plus the given keys) and no station data; reload afterwards. */
const resetLocal = (page, keep = {}) => page.evaluate(async (keep) => {
  localStorage.clear();
  for (const [k, v] of Object.entries(keep)) localStorage.setItem(k, v);
  await new Promise((res) => { const r = indexedDB.deleteDatabase('lab-local'); r.onsuccess = r.onerror = r.onblocked = res; });
}, keep);

module.exports = { B, OWNER, ok, launch, tmp, pdfPages, done, kv, kvPut, resetLocal };
