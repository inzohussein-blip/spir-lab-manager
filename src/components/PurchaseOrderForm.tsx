"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createPurchaseOrder } from "@/app/actions/purchasing";

type Product = { id: string; name: string; buy_price: number };
type Supplier = { id: string; name: string };
type Line = { product_id: string; quantity: number; unit_price: number };

const field = "rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

export function PurchaseOrderForm({
  products,
  suppliers,
}: {
  products: Product[];
  suppliers: Supplier[];
}) {
  const [lines, setLines] = useState<Line[]>([{ product_id: "", quantity: 1, unit_price: 0 }]);

  function setLine(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((ls) => [...ls, { product_id: "", quantity: 1, unit_price: 0 }]);
  }
  function removeLine(i: number) {
    setLines((ls) => ls.filter((_, idx) => idx !== i));
  }

  const total = lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unit_price || 0), 0);
  const valid = lines.some((l) => l.product_id && Number(l.quantity) > 0);

  return (
    <form action={createPurchaseOrder} className="flex flex-col gap-4">
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">
          المورّد
          <select name="supplier_id" className={`mt-1 w-full ${field}`} defaultValue="">
            <option value="">— بدون —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          المرجع
          <input name="reference" className={`mt-1 w-full ${field}`} placeholder="رقم فاتورة المورّد…" />
        </label>
      </div>

      <div className="rounded-xl border border-line">
        <div className="grid grid-cols-[1fr_80px_100px_36px] gap-2 border-b border-line bg-canvas px-3 py-2 text-xs text-muted">
          <span>المادة</span><span>الكمية</span><span>سعر الوحدة</span><span></span>
        </div>
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_80px_100px_36px] items-center gap-2 border-b border-line px-3 py-2 last:border-0">
            <select
              className={field}
              value={l.product_id}
              onChange={(e) => {
                const p = products.find((x) => x.id === e.target.value);
                setLine(i, { product_id: e.target.value, unit_price: p ? Number(p.buy_price) : l.unit_price });
              }}
            >
              <option value="">اختر مادة…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <input type="number" step="any" className={field} value={l.quantity}
              onChange={(e) => setLine(i, { quantity: Number(e.target.value) })} />
            <input type="number" step="any" className={field} value={l.unit_price}
              onChange={(e) => setLine(i, { unit_price: Number(e.target.value) })} />
            <button type="button" onClick={() => removeLine(i)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-red-600">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        <button type="button" onClick={addLine} className="flex items-center gap-1.5 px-3 py-2 text-sm text-brand-dark hover:underline">
          <Plus className="size-4" /> إضافة بند
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm">الإجمالي: <b>{total.toFixed(2)}</b></div>
        <button
          disabled={!valid}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          إنشاء الأمر
        </button>
      </div>
    </form>
  );
}
