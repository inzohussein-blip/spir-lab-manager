import Link from "next/link";
import { ChevronRight, ChevronLeft, Wallet, ArrowDownCircle, ArrowUpCircle, Scale, Lock, LockOpen } from "lucide-react";
import { PageHeader, Card, StatTile, Badge, Button } from "@/components/ui/primitives";
import { PrintButton } from "@/components/PrintButton";
import { money, cn } from "@/lib/utils";
import { addExpense } from "@/app/actions/expenses";
import { closeDay, reopenDay } from "@/app/actions/finance";
import {
  today, dayIncome, dayExpenses, closingOf, monthDays, monthTotals, sum, addDays, addMonths, isDay, isMonth, METHOD_LABEL,
} from "@/lib/finance";

export const dynamic = "force-dynamic";

const field = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
const iqd = (n: number) => `${money(n)} د.ع`;

/** «الصندوق اليومي»: what came in and went out on a day, its closing (the cash counted in the
 *  drawer), and the month around it. */
export default async function CashboxPage(props: { searchParams: Promise<{ d?: string; m?: string }> }) {
  const sp = await props.searchParams;
  const now = await today();
  const day = isDay(sp.d) ? sp.d! : now;
  const month = isMonth(sp.m) ? sp.m! : day.slice(0, 7);

  const [income, expenses, closing, days, totals] = await Promise.all([
    dayIncome(day), dayExpenses(day), closingOf(day), monthDays(month), monthTotals(month),
  ]);
  const inTotal = sum(income);
  const outTotal = sum(expenses);
  const byMethod = (m: string) => sum(income.filter((r) => r.method === m));
  const cashIn = byMethod("cash");
  const expected = cashIn - outTotal; // expenses are paid from the drawer
  const monthIn = days.reduce((s, d) => s + Number(d.income), 0);
  const monthOut = days.reduce((s, d) => s + Number(d.expenses), 0);
  const monthNet = monthIn - monthOut - totals.purchases;
  const shownDays = days.filter((d) => d.day <= now && (Number(d.income) || Number(d.expenses) || d.counted != null));

  return (
    <div data-testid="cashbox">
      <PageHeader title="الصندوق اليومي" subtitle="الداخل والمصروف لكل يوم، وإغلاق الصندوق، وملخص الشهر"
        action={<div className="no-print flex items-center gap-2"><PrintButton /></div>} />

      {/* The day */}
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/cashbox?d=${addDays(day, -1)}`} className="grid size-9 place-items-center rounded-lg border border-line bg-surface hover:bg-canvas" aria-label="اليوم السابق"><ChevronRight className="size-4" /></Link>
        <form className="flex items-center gap-2">
          <input type="date" name="d" defaultValue={day} max={now} aria-label="اليوم" className={cn(field, "w-auto")} />
          <Button variant="ghost">عرض</Button>
        </form>
        {day < now && <Link href={`/cashbox?d=${addDays(day, 1)}`} className="grid size-9 place-items-center rounded-lg border border-line bg-surface hover:bg-canvas" aria-label="اليوم التالي"><ChevronLeft className="size-4" /></Link>}
        {day !== now && <Link href="/cashbox" className="text-sm text-brand-dark hover:underline">اليوم</Link>}
        <span className="ms-auto">{closing ? <Badge tone="brand"><Lock className="me-1 size-3" /> مغلق</Badge> : <Badge tone="warn">مفتوح</Badge>}</span>
      </div>

      <div className="mb-1 hidden text-lg font-bold print:block">الصندوق اليومي — <span dir="ltr">{day}</span></div>
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="cashbox-tiles">
        <StatTile label="الداخل" value={iqd(inTotal)} tone="brand" icon={<ArrowDownCircle className="size-5" />}
          hint={["cash", "card", "transfer"].filter((m) => byMethod(m)).map((m) => `${METHOD_LABEL[m]} ${money(byMethod(m))}`).join(" · ") || "لا شيء بعد"} />
        <StatTile label="المصروف" value={iqd(outTotal)} tone="danger" icon={<ArrowUpCircle className="size-5" />} hint={`${expenses.length} بند`} />
        <StatTile label="صافي اليوم" value={iqd(inTotal - outTotal)} tone={inTotal - outTotal < 0 ? "danger" : "neutral"} icon={<Scale className="size-5" />} />
        <StatTile label="المتوقع في الصندوق (نقداً)" value={iqd(expected)} tone="neutral" icon={<Wallet className="size-5" />} hint="النقد الداخل − المصروف" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-0">
          <div className="border-b border-line px-5 py-3 font-semibold">الداخل ({income.length})</div>
          {income.length === 0 ? <p className="px-5 py-6 text-center text-sm text-muted">لا مقبوضات في هذا اليوم.</p> : (
            <table className="w-full text-sm" data-testid="cashbox-in">
              <tbody>
                {income.map((r, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    <td className="px-5 py-2"><Link href={r.href} className="font-medium hover:underline">{r.patient}</Link>
                      <div className="text-[11px] text-muted">{r.kind === "payment" ? `دفعة على فاتورة ${r.ref}` : `مدفوع عند الاستقبال — ${r.ref}`}</div></td>
                    <td className="px-3 py-2 text-xs text-muted">{METHOD_LABEL[r.method] ?? r.method}</td>
                    <td className="px-5 py-2 text-left font-semibold tabular-nums">{money(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card className="p-0">
          <div className="border-b border-line px-5 py-3 font-semibold">المصروف ({expenses.length})</div>
          {expenses.length > 0 && (
            <table className="w-full text-sm" data-testid="cashbox-out">
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-b border-line">
                    <td className="px-5 py-2 font-medium">{e.title}{e.category && <span className="ms-2 text-[11px] text-muted">{e.category}</span>}</td>
                    <td className="px-5 py-2 text-left font-semibold tabular-nums">{money(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!closing && (
            <form action={addExpense} className="no-print grid gap-2 p-4 sm:grid-cols-[1fr_8rem_8rem_auto]" data-testid="cashbox-add-expense">
              <input type="hidden" name="spent_on" value={day} />
              <input name="title" placeholder="البيان (إيجار، كهرباء، رواتب…)" required aria-label="البيان" className={field} />
              <input name="amount" type="number" step="any" min="0" placeholder="المبلغ" required aria-label="المبلغ" className={field} />
              <input name="category" placeholder="التصنيف" aria-label="التصنيف" className={field} />
              <Button>إضافة مصروف</Button>
            </form>
          )}
        </Card>
      </div>

      {/* Closing */}
      <Card className="mt-4" >
        <div className="mb-2 flex items-center gap-2 font-semibold"><Lock className="size-4 text-brand-dark" /> إغلاق الصندوق</div>
        {closing ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm" data-testid="cashbox-closed">
            <span>المتوقع: <b className="tabular-nums">{money(closing.expected)}</b></span>
            <span>المعدود: <b className="tabular-nums">{money(closing.counted)}</b></span>
            <span>الفرق: <b className={cn("tabular-nums", Number(closing.counted) - Number(closing.expected) < 0 ? "text-red-600" : Number(closing.counted) - Number(closing.expected) > 0 ? "text-amber-600" : "text-brand-dark")}>
              {money(Number(closing.counted) - Number(closing.expected))}</b></span>
            {closing.notes && <span className="text-muted">{closing.notes}</span>}
            <span className="text-xs text-muted">أُغلق {closing.closed_by_name ? `بواسطة ${closing.closed_by_name}` : ""}</span>
            <form action={reopenDay} className="no-print ms-auto"><input type="hidden" name="day" value={day} /><Button variant="ghost"><LockOpen className="size-4" /> إعادة فتح</Button></form>
          </div>
        ) : (
          <form action={closeDay} className="no-print grid gap-2 sm:grid-cols-[10rem_1fr_auto]" data-testid="cashbox-close">
            <input type="hidden" name="day" value={day} />
            <input type="hidden" name="expected" value={expected} />
            <input name="counted" type="number" step="any" placeholder="المعدود نقداً" required aria-label="المعدود نقداً" defaultValue={expected > 0 ? expected : undefined} className={field} />
            <input name="notes" placeholder="ملاحظة (اختياري)" aria-label="ملاحظة" className={field} />
            <Button>إغلاق اليوم</Button>
            <p className="text-xs text-muted sm:col-span-3">اعدد النقد في الصندوق واكتبه؛ يُحفظ الفرق مع المتوقع ({money(expected)}). يمكن إعادة فتح اليوم لاحقاً.</p>
          </form>
        )}
      </Card>

      {/* The month */}
      <div className="mt-8 mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold">ملخص الشهر</h2>
        <div className="no-print ms-auto flex items-center gap-1">
          <Link href={`/cashbox?d=${day}&m=${addMonths(month, -1)}`} className="grid size-8 place-items-center rounded-lg border border-line bg-surface hover:bg-canvas" aria-label="الشهر السابق"><ChevronRight className="size-4" /></Link>
          <span className="px-2 font-semibold tabular-nums" dir="ltr">{month}</span>
          {month < now.slice(0, 7) && <Link href={`/cashbox?d=${day}&m=${addMonths(month, 1)}`} className="grid size-8 place-items-center rounded-lg border border-line bg-surface hover:bg-canvas" aria-label="الشهر التالي"><ChevronLeft className="size-4" /></Link>}
        </div>
      </div>
      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="cashbox-month">
        <StatTile label="الداخل" value={iqd(monthIn)} tone="brand" />
        <StatTile label="المصروفات" value={iqd(monthOut)} tone="danger" hint={totals.byCat.slice(0, 3).map((c) => `${c.category} ${money(c.amount)}`).join(" · ") || undefined} />
        <StatTile label="المشتريات" value={iqd(totals.purchases)} tone="warn" hint={`${totals.purchaseCount} أمر شراء`} />
        <StatTile label="الصافي" value={iqd(monthNet)} tone={monthNet < 0 ? "danger" : "neutral"} hint="الداخل − المصروفات − المشتريات" />
      </div>
      <Card className="p-0">
        {shownDays.length === 0 ? <p className="px-5 py-6 text-center text-sm text-muted">لا حركة في هذا الشهر.</p> : (
          <table className="w-full text-sm">
            <thead className="border-b border-line text-right text-muted">
              <tr><th className="px-5 py-2.5 font-medium">اليوم</th><th className="px-3 py-2.5 font-medium">الداخل</th><th className="px-3 py-2.5 font-medium">المصروف</th><th className="px-3 py-2.5 font-medium">الصافي</th><th className="px-5 py-2.5 font-medium">الإغلاق</th></tr>
            </thead>
            <tbody>
              {shownDays.map((d) => {
                const diff = d.counted != null ? Number(d.counted) - Number(d.expected) : null;
                return (
                  <tr key={d.day} className={cn("border-b border-line last:border-0", d.day === day && "bg-brand-light/40")}>
                    <td className="px-5 py-2"><Link href={`/cashbox?d=${d.day}&m=${month}`} className="font-medium tabular-nums hover:underline" dir="ltr">{d.day}</Link></td>
                    <td className="px-3 py-2 tabular-nums">{money(d.income)}</td>
                    <td className="px-3 py-2 tabular-nums">{money(d.expenses)}</td>
                    <td className="px-3 py-2 font-semibold tabular-nums">{money(Number(d.income) - Number(d.expenses))}</td>
                    <td className="px-5 py-2 text-xs">{diff == null ? <span className="text-muted">مفتوح</span> : diff === 0 ? <span className="text-brand-dark">مطابق</span> : <span className={diff < 0 ? "text-red-600" : "text-amber-600"}>فرق {money(diff)}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
      <p className="no-print mt-3 text-xs text-muted">
        الداخل = الدفعات على الفواتير + الطلبات المعلَّمة «مدفوع» عند الاستقبال بلا فاتورة. المصروفات من <Link href="/orders-expenses" className="text-brand-dark hover:underline">المصروفات</Link> (والرواتب تُسجّل مصروفاً بتصنيف «رواتب»)، والمشتريات من <Link href="/purchase-orders" className="text-brand-dark hover:underline">أوامر الشراء</Link>.
      </p>
    </div>
  );
}
