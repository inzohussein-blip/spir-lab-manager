import { query, queryOne } from "@/lib/db";
import { PageHeader, Card, Button } from "@/components/ui/primitives";
import { StaffTabs } from "@/components/StaffTabs";
import { addLeave, deleteLeave, addAdvance, deleteAdvance } from "@/app/actions/staff";
import { ensureOps } from "@/lib/desk/schema";
import { money } from "@/lib/utils";

export const dynamic = "force-dynamic";

const field = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
const KIND: Record<string, string> = { annual: "اعتيادية", sick: "مرضية", emergency: "طارئة", unpaid: "بدون راتب" };

/** «الإجازات والسُّلف». */
export default async function LeavesPage() {
  await ensureOps();
  const today = (await queryOne<{ d: string }>(`select current_date::text as d`))!.d;
  const [staff, leaves, advances] = await Promise.all([
    query<any>(`select id, full_name from staff where is_active order by full_name`),
    query<any>(`select l.id, l.from_date::text as f, l.to_date::text as t, l.kind, l.paid, l.note, s.full_name,
                       (l.to_date - l.from_date + 1)::int as days
                  from staff_leaves l join staff s on s.id = l.staff_id order by l.from_date desc limit 200`),
    query<any>(`select a.id, a.amount, a.given_on::text as d, a.note, s.full_name
                  from staff_advances a join staff s on s.id = a.staff_id order by a.given_on desc limit 200`),
  ]);
  const people = staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>);
  return (
    <div>
      <PageHeader title="الإجازات والسُّلف" subtitle="تُحسب في الرواتب: الإجازة بدون راتب تُخصم، والسلفة تُخصم من راتب شهرها" />
      <StaffTabs active="/staff/leaves" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 font-semibold">الإجازات</div>
          <form action={addLeave} className="grid gap-2 sm:grid-cols-2" data-testid="leave-form">
            <select name="staff_id" required className={field} aria-label="الموظف" defaultValue=""><option value="" disabled>الموظف…</option>{people}</select>
            <select name="kind" className={field} aria-label="نوع الإجازة">{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <label className="text-xs text-muted">من<input type="date" name="from_date" required defaultValue={today} className={field} /></label>
            <label className="text-xs text-muted">إلى<input type="date" name="to_date" required defaultValue={today} className={field} /></label>
            <select name="paid" className={field} aria-label="براتب"><option value="1">براتب</option><option value="0">بدون راتب (تُخصم)</option></select>
            <input name="note" placeholder="ملاحظة" className={field} />
            <div className="sm:col-span-2"><Button>تسجيل الإجازة</Button></div>
          </form>
          <table className="mt-4 w-full text-sm">
            <tbody>
              {leaves.map((l) => (
                <tr key={l.id} className="border-t border-line" data-testid="leave-row">
                  <td className="py-2 font-medium">{l.full_name}</td>
                  <td className="py-2 text-xs" dir="ltr">{l.f} → {l.t}</td>
                  <td className="py-2 text-xs">{KIND[l.kind] ?? l.kind} · {l.days} يوم{!l.paid && <b className="text-red-600"> · بدون راتب</b>}</td>
                  <td className="py-2"><form action={deleteLeave}><input type="hidden" name="id" value={l.id} /><button className="text-xs text-red-600">حذف</button></form></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card>
          <div className="mb-3 font-semibold">السُّلف</div>
          <form action={addAdvance} className="grid gap-2 sm:grid-cols-2" data-testid="advance-form">
            <select name="staff_id" required className={field} aria-label="الموظف" defaultValue=""><option value="" disabled>الموظف…</option>{people}</select>
            <input name="amount" type="number" min="1" required placeholder="المبلغ" aria-label="مبلغ السلفة" className={field} />
            <input type="date" name="given_on" defaultValue={today} className={field} aria-label="تاريخ السلفة" />
            <input name="note" placeholder="ملاحظة" className={field} />
            <div className="sm:col-span-2"><Button>تسجيل السلفة</Button></div>
          </form>
          <table className="mt-4 w-full text-sm">
            <tbody>
              {advances.map((a) => (
                <tr key={a.id} className="border-t border-line" data-testid="advance-row">
                  <td className="py-2 font-medium">{a.full_name}</td>
                  <td className="py-2 tabular-nums">{money(a.amount)}</td>
                  <td className="py-2 text-xs" dir="ltr">{a.d}</td>
                  <td className="py-2 text-xs text-muted">{a.note ?? ""}</td>
                  <td className="py-2"><form action={deleteAdvance}><input type="hidden" name="id" value={a.id} /><button className="text-xs text-red-600">حذف</button></form></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
