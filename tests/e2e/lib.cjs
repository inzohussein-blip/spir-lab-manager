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
module.exports = { B, OWNER, ok, launch, tmp, pdfPages, done };
