"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { setOrderPayment } from "@/app/actions/orders";

const sel =
  "rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-brand";

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
      disabled={pending}
    >
      {pending ? "…" : "تحديث الدفع"}
    </button>
  );
}

/** Inline quick-payment control: set the order's payment status + method
 *  from the reception or release desk without opening the invoice. */
export function QuickPay({
  orderId,
  status,
  method,
}: {
  orderId: string;
  status: string | null;
  method: string | null;
}) {
  const [st, setSt] = useState(status ?? "unpaid");
  const [mt, setMt] = useState(method ?? "cash");

  return (
    <form action={setOrderPayment} className="flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="order_id" value={orderId} />
      <select name="payment_status" value={st} onChange={(e) => setSt(e.target.value)} className={sel}>
        <option value="unpaid">غير مدفوع</option>
        <option value="partial">دفع جزئي</option>
        <option value="paid">مدفوع</option>
      </select>
      {st !== "unpaid" && (
        <select name="payment_method" value={mt} onChange={(e) => setMt(e.target.value)} className={sel}>
          <option value="cash">نقداً</option>
          <option value="card">بطاقة</option>
          <option value="transfer">تحويل</option>
        </select>
      )}
      <SaveBtn />
    </form>
  );
}
