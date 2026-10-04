"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Printer, Tags, Save, Wallet, CheckCircle2, ScanLine } from "lucide-react";
import { collectSample, collectPay, deskDeliver, labFind } from "@/app/actions/desk";
import type { CollectRow } from "@/lib/desk/data";
import { STATUS_LABEL, type DeskPatient, type DeskTest } from "@/lib/desk/types";
import { Card } from "@/components/ui/primitives";
import { money } from "@/lib/utils";
import { PatientBox, TestPicker, EMPTY_PATIENT, field } from "./DeskParts";

const METHOD_LABEL: Record<string, string> = { cash: "نقداً", card: "بطاقة", transfer: "تحويل" };
const STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-800", in_progress: "bg-sky-50 text-sky-800", completed: "bg-teal-50 text-teal-800", delivered: "bg-gray-100 text-gray-600",
};

export function CollectWindow({ tests, referrers, today }: { tests: DeskTest[]; referrers: { id: string; name: string }[]; today: CollectRow[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [patient, setPatient] = useState<DeskPatient>({ ...EMPTY_PATIENT });
  const [chosen, setChosen] = useState<string[]>([]);
  const [referrer, setReferrer] = useState("");
  const [discount, setDiscount] = useState("");
  const [paid, setPaid] = useState<string | null>(null);
  const [method, setMethod] = useState("cash");
  const [done, setDone] = useState<{ orderId: string; accession: string } | null>(null);
  const [scan, setScan] = useState("");

  const sub = chosen.reduce((s, id) => s + (tests.find((t) => t.id === id)?.price ?? 0), 0);
  const disc = Math.min(Number(discount) || 0, sub);
  const total = sub - disc;
  const paidNow = paid == null ? total : Math.min(Number(paid) || 0, total);

  function save() {
    start(async () => {
      const r = await collectSample({ patient, testIds: chosen, referrerId: referrer || null, discount: disc, paid: paidNow, method });
      if (!r.ok) { toast.error(r.error); return; }
      setDone({ orderId: r.orderId, accession: r.accession });
      setPatient({ ...EMPTY_PATIENT }); setChosen([]); setReferrer(""); setDiscount(""); setPaid(null); setMethod("cash");
      toast.success(`سُجّلت العيّنة ${r.accession}`);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4">
      {done && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm" data-testid="collect-done">
          <span className="flex items-center gap-2 font-semibold text-teal-900"><CheckCircle2 className="size-5" /> سُجّلت العيّنة <span className="font-mono" dir="ltr">{done.accession}</span> وأُرسلت إلى المختبر.</span>
          <span className="flex gap-2">
            <Link href={`/orders/${done.orderId}/receipt?back=collect`} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 font-semibold text-white" data-testid="collect-receipt"><Printer className="size-4" /> الوصل</Link>
            <Link href={`/orders/${done.orderId}/label`} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 font-semibold"><Tags className="size-4" /> ملصقات الأنابيب</Link>
          </span>
        </div>
      )}

      <Card>
        <div className="mb-2 text-sm font-semibold">المراجع</div>
        <PatientBox value={patient} onChange={setPatient} />
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <select value={referrer} onChange={(e) => setReferrer(e.target.value)} aria-label="الطبيب المحيل" className={field}>
            <option value="">بلا طبيب محيل</option>
            {referrers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      </Card>

      <Card>
        <div className="mb-2 flex items-center justify-between text-sm font-semibold">
          <span>الفحوصات</span>
          <span className="text-muted">{chosen.length ? `${chosen.length} فحص` : ""}</span>
        </div>
        <TestPicker tests={tests} chosen={chosen} onChange={setChosen} prices />
      </Card>

      <Card>
        <div className="grid gap-3 sm:grid-cols-4">
          <div><div className="text-xs text-muted">المجموع</div><div className="text-lg font-bold tabular-nums" data-testid="collect-sub">{money(sub)}</div></div>
          <label className="text-xs text-muted">الخصم
            <input value={discount} onChange={(e) => setDiscount(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" aria-label="الخصم" placeholder="0" className={`${field} mt-1`} />
          </label>
          <label className="text-xs text-muted">المدفوع
            <input value={paid ?? String(total)} onChange={(e) => setPaid(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" aria-label="المدفوع" className={`${field} mt-1`} />
          </label>
          <label className="text-xs text-muted">طريقة الدفع
            <select value={method} onChange={(e) => setMethod(e.target.value)} aria-label="طريقة الدفع" className={`${field} mt-1`}>
              {Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
          <div className="text-sm">
            الإجمالي <b className="text-lg tabular-nums" data-testid="collect-total">{money(total)}</b> د.ع
            {total - paidNow > 0 && <span className="ms-3 font-semibold text-amber-700">المتبقي {money(total - paidNow)}</span>}
          </div>
          <button type="button" onClick={save} disabled={busy || !chosen.length || !patient.name.trim()} data-testid="collect-save"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
            <Save className="size-4" /> حفظ وإرسال للمختبر
          </button>
        </div>
      </Card>

      <Card className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div className="text-sm font-semibold">عيّنات اليوم</div>
          <form className="relative" onSubmit={(e) => { e.preventDefault(); const a = scan; setScan(""); void labFind(a).then((id) => id ? router.push(`/orders/${id}/receipt?back=collect`) : toast.error("لا توجد عيّنة بهذا الرقم.")); }}>
            <ScanLine className="pointer-events-none absolute inset-y-0 start-2.5 my-auto size-4 text-muted" />
            <input value={scan} onChange={(e) => setScan(e.target.value)} dir="ltr" aria-label="رقم العيّنة" placeholder="امسح رقم العيّنة" className="w-52 rounded-lg border border-line bg-surface py-1.5 pe-2 ps-8 text-sm outline-none focus:border-brand" />
          </form>
        </div>
        {today.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted">لم تُسجَّل عيّنات اليوم بعد.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="collect-today">
              <thead className="text-right text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="px-4 py-2 font-medium">الرقم</th><th className="px-4 py-2 font-medium">المراجع</th><th className="px-4 py-2 font-medium">الفحوص</th>
                  <th className="px-4 py-2 font-medium">المبلغ</th><th className="px-4 py-2 font-medium">الحالة</th><th className="px-4 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {today.map((r) => (
                  <TodayRow key={r.id} r={r} onDone={() => router.refresh()} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function TodayRow({ r, onDone }: { r: CollectRow; onDone: () => void }) {
  const [busy, start] = useTransition();
  const left = r.total - r.paid;
  return (
    <tr className="border-b border-line last:border-0" data-testid="collect-row">
      <td className="px-4 py-2 font-mono text-xs" dir="ltr">{r.accession}</td>
      <td className="px-4 py-2 font-medium">{r.name}</td>
      <td className="px-4 py-2 tabular-nums">{r.tests}</td>
      <td className="px-4 py-2 tabular-nums">
        {money(r.total)}
        {left > 0 && <span className="ms-1 text-xs font-semibold text-amber-700">(باقي {money(left)})</span>}
      </td>
      <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span></td>
      <td className="px-4 py-2">
        <span className="flex flex-wrap justify-end gap-1.5">
          {left > 0 && (
            <button type="button" disabled={busy} onClick={() => start(async () => { const x = await collectPay(r.id, left, "cash"); if (!x.ok) toast.error(x.error); else onDone(); })}
              className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs hover:bg-canvas"><Wallet className="size-3.5" /> استلام الباقي</button>
          )}
          {r.status === "completed" && (
            <button type="button" disabled={busy} onClick={() => start(async () => { const x = await deskDeliver(r.id); if (!x.ok) toast.error(x.error); else onDone(); })}
              className="rounded-md bg-teal-600 px-2 py-1 text-xs font-semibold text-white">تسليم النتيجة</button>
          )}
          <Link href={`/orders/${r.id}/receipt?back=collect`} className="rounded-md border border-line px-2 py-1 text-xs hover:bg-canvas">الوصل</Link>
          <Link href={`/orders/${r.id}/label`} className="rounded-md border border-line px-2 py-1 text-xs hover:bg-canvas">الملصقات</Link>
        </span>
      </td>
    </tr>
  );
}
