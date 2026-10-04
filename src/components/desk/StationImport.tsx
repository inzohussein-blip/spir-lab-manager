"use client";

import { useState } from "react";
import { Upload, CheckCircle2 } from "lucide-react";
import { importStationTests, importStationVisits } from "@/app/actions/stationImport";
import type { StationBackup } from "@/lib/station/store";

const BATCH = 50;

export function StationImport() {
  const [file, setFile] = useState<StationBackup | null>(null);
  const [err, setErr] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number; imported: number; skipped: number; tests: number } | null>(null);
  const [running, setRunning] = useState(false);

  async function pick(f: File | undefined) {
    setErr(""); setFile(null); setProgress(null);
    if (!f) return;
    try {
      const b = JSON.parse(await f.text()) as StationBackup;
      if (b?.app !== "spir-lab-station" || !Array.isArray(b.tests)) throw new Error();
      setFile(b);
    } catch {
      setErr("هذا ليس ملف نسخة احتياطية لمحطة المختبر.");
    }
  }
  async function run() {
    if (!file || running) return;
    setRunning(true); setErr("");
    try {
      const t = await importStationTests(file.tests);
      if (!t.ok) { setErr(t.error); return; }
      const visits = file.visits ?? [];
      let imported = 0, skipped = 0;
      setProgress({ done: 0, total: visits.length, imported, skipped, tests: t.added });
      for (let i = 0; i < visits.length; i += BATCH) {
        const r = await importStationVisits(visits.slice(i, i + BATCH), t.map);
        if (!r.ok) { setErr(r.error); return; }
        imported += r.imported; skipped += r.skipped;
        setProgress({ done: Math.min(visits.length, i + BATCH), total: visits.length, imported, skipped, tests: t.added });
      }
    } catch {
      setErr("انقطع الاستيراد — أعد المحاولة؛ ما استُورد لا يتكرر.");
    } finally {
      setRunning(false);
    }
  }
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]" data-testid="station-import">
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line p-6 text-sm text-muted hover:bg-canvas">
        <Upload className="size-6" /> اختر ملف النسخة الاحتياطية (JSON)
        <input type="file" accept="application/json,.json" className="hidden" aria-label="ملف النسخة الاحتياطية" onChange={(e) => void pick(e.target.files?.[0])} />
      </label>
      {file && (
        <div className="mt-3 text-sm" data-testid="station-import-file">
          في الملف: <b>{file.tests.length}</b> فحص، <b>{file.visits?.length ?? 0}</b> زيارة، <b>{file.patients?.length ?? 0}</b> مراجع.
          <p className="mt-1 text-xs text-muted">الزيارات تُستورد مرة واحدة (إعادة الاستيراد تتخطى ما سبق)، بلا أسعار وبلا خصم من المخزون، وتظهر في سجل العيّنات.</p>
          <button type="button" disabled={running} onClick={() => void run()} data-testid="station-import-run"
            className="mt-3 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{running ? "جارٍ الاستيراد…" : "استيراد"}</button>
        </div>
      )}
      {progress && (
        <div className="mt-3 flex items-center gap-2 text-sm" data-testid="station-import-progress">
          {!running && <CheckCircle2 className="size-5 text-teal-600" />}
          <span>{progress.done}/{progress.total} — استُورد <b>{progress.imported}</b>، تُخطّي <b>{progress.skipped}</b>، وأُضيف <b>{progress.tests}</b> فحص جديد للكتالوج.</span>
        </div>
      )}
      {err && <p className="mt-3 text-sm text-red-600" role="alert">{err}</p>}
    </div>
  );
}
