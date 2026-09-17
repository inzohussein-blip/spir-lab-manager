"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useOffline } from "@/components/offline/OfflineProvider";
import { Button } from "@/components/ui/primitives";
import type { OutboxFields } from "@/lib/offline/outbox";

type Test = { id: string; name_ar: string; category: string | null; price: number };
type Referrer = { id: string; name: string };

export function OrderForm({
  patientId,
  tests,
  referrers,
}: {
  patientId: string;
  tests: Test[];
  referrers: Referrer[];
}) {
  const { submitOrder } = useOffline();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [referrer, setReferrer] = useState("");

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  const total = tests.filter((t) => selected.has(t.id)).reduce((s, t) => s + Number(t.price), 0);

  function submit() {
    if (selected.size === 0) return;
    const fields: OutboxFields = {
      patient_id: patientId,
      referrer_id: referrer,
      test_ids: Array.from(selected),
    };
    start(async () => {
      const r = await submitOrder(fields, `طلب فحص (${selected.size})`);
      if (r.status === "synced") {
        router.push(`/orders/${r.orderId}`);
      } else {
        toast.info("حُفظ الطلب محلياً — سيُزامن عند عودة الاتصال");
        router.push(`/patients/${patientId}`);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {referrers.length > 0 && (
        <label className="text-sm font-medium">
          الطبيب المُحيل (اختياري)
          <select
            value={referrer}
            onChange={(e) => setReferrer(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
          >
            <option value="">— مريض خارجي —</option>
            {referrers.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </label>
      )}

      <div className="text-sm font-medium">اختر الفحوصات المطلوبة:</div>
      <div className="grid gap-1 sm:grid-cols-2">
        {tests.map((t) => (
          <label
            key={t.id}
            className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas"
          >
            <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} className="size-4" />
            <span className="flex-1">{t.name_ar}</span>
            <span className="text-muted">{t.price}</span>
          </label>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm">الإجمالي: <b>{total}</b></div>
        <Button onClick={submit} disabled={pending || selected.size === 0}>
          {pending ? "جارٍ الإنشاء…" : "إنشاء الطلب"}
        </Button>
      </div>
    </div>
  );
}
