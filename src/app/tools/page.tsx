"use client";

import { useState } from "react";
import { Calculator, ArrowLeftRight } from "lucide-react";

const field =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Common clinical-chemistry conversions (conventional ↔ SI).
const CONVERSIONS: Record<string, { label: string; factor: number; from: string; to: string }> = {
  glucose: { label: "الجلوكوز", factor: 0.0555, from: "mg/dL", to: "mmol/L" },
  cholesterol: { label: "الكوليسترول", factor: 0.0259, from: "mg/dL", to: "mmol/L" },
  triglycerides: { label: "الدهون الثلاثية", factor: 0.0113, from: "mg/dL", to: "mmol/L" },
  creatinine: { label: "الكرياتينين", factor: 88.4, from: "mg/dL", to: "µmol/L" },
  urea: { label: "اليوريا (BUN)", factor: 0.357, from: "mg/dL", to: "mmol/L" },
  bilirubin: { label: "البيليروبين", factor: 17.1, from: "mg/dL", to: "µmol/L" },
  calcium: { label: "الكالسيوم", factor: 0.25, from: "mg/dL", to: "mmol/L" },
};

function MarginCalculator() {
  const [price, setPrice] = useState("");
  const [reagentCost, setReagentCost] = useState("");
  const [qty, setQty] = useState("1");
  const cost = num(reagentCost) * num(qty);
  const profit = num(price) - cost;
  const margin = num(price) > 0 ? (profit / num(price)) * 100 : 0;

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2 font-semibold">
        <Calculator className="size-4.5 text-brand" />
        حاسبة هامش ربح الفحص
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-medium">
          سعر الفحص
          <input className={field} value={price} onChange={(e) => setPrice(e.target.value)} type="number" />
        </label>
        <label className="text-sm font-medium">
          تكلفة الكاشف/وحدة
          <input className={field} value={reagentCost} onChange={(e) => setReagentCost(e.target.value)} type="number" />
        </label>
        <label className="text-sm font-medium">
          عدد الوحدات
          <input className={field} value={qty} onChange={(e) => setQty(e.target.value)} type="number" />
        </label>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg bg-canvas p-3">
          <div className="text-xs text-muted">التكلفة</div>
          <div className="text-lg font-bold">{cost.toFixed(2)}</div>
        </div>
        <div className="rounded-lg bg-canvas p-3">
          <div className="text-xs text-muted">الربح</div>
          <div className={`text-lg font-bold ${profit < 0 ? "text-red-600" : "text-brand-dark"}`}>
            {profit.toFixed(2)}
          </div>
        </div>
        <div className="rounded-lg bg-canvas p-3">
          <div className="text-xs text-muted">الهامش %</div>
          <div className={`text-lg font-bold ${margin < 0 ? "text-red-600" : "text-brand-dark"}`}>
            {margin.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
}

function UnitConverter() {
  const [analyte, setAnalyte] = useState("glucose");
  const [value, setValue] = useState("");
  const c = CONVERSIONS[analyte];
  const si = num(value) * c.factor;

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2 font-semibold">
        <ArrowLeftRight className="size-4.5 text-brand" />
        محوّل الوحدات المخبرية (تقليدي ↔ SI)
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">
          التحليل
          <select className={field} value={analyte} onChange={(e) => setAnalyte(e.target.value)}>
            {Object.entries(CONVERSIONS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          القيمة ({c.from})
          <input className={field} value={value} onChange={(e) => setValue(e.target.value)} type="number" />
        </label>
      </div>
      <div className="mt-4 rounded-lg bg-canvas p-4 text-center">
        <div className="text-xs text-muted">النتيجة بالنظام الدولي</div>
        <div className="text-2xl font-bold text-brand-dark">
          {si ? si.toFixed(2) : "—"} <span className="text-sm font-normal text-muted">{c.to}</span>
        </div>
      </div>
    </div>
  );
}

export default function ToolsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">الأدوات</h1>
        <p className="mt-1 text-sm text-muted">أدوات حسابية مساعدة للمختبر</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <MarginCalculator />
        <UnitConverter />
      </div>
    </div>
  );
}
