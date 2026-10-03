"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye } from "lucide-react";
import { getTests, type StationSettings, type StationTest } from "@/lib/station/store";
import { ReportSheet, type ReportRow } from "./ReportSheet";

/** Sample results for the preview, taken from the catalog (real names, units and ranges). */
const SAMPLE: [string, string][] = [["HB", "11.2"], ["WBC", "7.4"], ["PLT", "250"], ["UREA", "52"], ["CREA", "0.9"]];

/**
 * Settings → «التقرير المطبوع»: the real result sheet at a small size, with sample results, so every
 * setting (letterhead, colours, table, pre-printed paper, logo, font, signature, QR code) shows at
 * once in one place. Not printed.
 */
export function ReportPreview({ settings }: { settings: StationSettings }) {
  const [tests, setTests] = useState<StationTest[]>([]);
  const [date, setDate] = useState("");
  const [at, setAt] = useState<number | undefined>(undefined);
  useEffect(() => { setTests(getTests()); const now = Date.now(); setDate(new Date(now).toLocaleDateString("en-CA")); setAt(now); }, []);
  const rows = useMemo(() => SAMPLE.flatMap(([code, value]) => {
    const t = tests.find((x) => x.code === code);
    return t ? [{ key: t.id, name: t.name_ar, value, unit: t.unit, test: t } satisfies ReportRow] : [];
  }), [tests]);

  return (
    <div className="rounded-2xl border border-line bg-surface p-3 shadow-[var(--shadow-card)]" data-testid="settings-preview">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted"><Eye className="size-4" /> معاينة الورقة (A4، بيانات تجريبية)</div>
      <div className="overflow-hidden rounded-lg border border-line bg-white">
        <div style={{ zoom: 0.5 }}>
          <ReportSheet settings={settings} date={date} at={at} accession="LAB-PREVIEW-001" printable={false}
            patient={{ name: "مريض تجريبي", gender: "male", age: "40", phone: "07700000000" }} referrer="د. طبيب محيل" rows={rows} />
        </div>
      </div>
    </div>
  );
}
