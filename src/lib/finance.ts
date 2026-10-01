import { query, queryOne } from "@/lib/db";

/**
 * «الحسابات» in the full admin panel: what came in (payments on invoices, and visits marked paid at
 * reception without an invoice), what went out (expenses, purchases), per day and per month.
 * Dates follow the database's own day (as the dashboard's «اليوم» does).
 */

export const METHOD_LABEL: Record<string, string> = { cash: "نقداً", card: "بطاقة", transfer: "تحويل" };
export const isDay = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
export const isMonth = (v?: string) => !!v && /^\d{4}-\d{2}$/.test(v);

export interface InRow { kind: "payment" | "order"; ref: string; href: string; patient: string; method: string; amount: number; at: string }

export async function today(): Promise<string> {
  return (await queryOne<{ d: string }>(`select current_date::text as d`))?.d ?? new Date().toISOString().slice(0, 10);
}

/** Money in on a day: invoice payments, and visits paid at reception that have no invoice. */
export async function dayIncome(day: string): Promise<InRow[]> {
  const [pays, orders] = await Promise.all([
    query<any>(
      `select p.amount, coalesce(p.method, 'cash') as method, p.paid_at::text as at, i.id as invoice_id, i.invoice_no, pt.full_name
         from payments p
         join invoices i on i.id = p.invoice_id
         left join patients pt on pt.id = i.patient_id
        where i.status <> 'void' and p.paid_at::date = $1::date
        order by p.paid_at`,
      [day]
    ),
    query<any>(
      `select o.id, o.accession_no, o.total_amount, coalesce(o.payment_method, 'cash') as method, o.created_at::text as at, pt.full_name
         from test_orders o
         left join patients pt on pt.id = o.patient_id
        where o.order_date = $1::date and o.payment_status = 'paid' and o.total_amount > 0
          and not exists (select 1 from invoices i where i.order_id = o.id and i.status <> 'void')
        order by o.created_at`,
      [day]
    ),
  ]);
  return [
    ...pays.map((r): InRow => ({ kind: "payment", ref: r.invoice_no ?? "فاتورة", href: `/invoices/${r.invoice_id}`, patient: r.full_name ?? "—", method: r.method, amount: Number(r.amount), at: r.at })),
    ...orders.map((r): InRow => ({ kind: "order", ref: r.accession_no ?? "طلب", href: `/orders/${r.id}`, patient: r.full_name ?? "—", method: r.method, amount: Number(r.total_amount), at: r.at })),
  ];
}

export async function dayExpenses(day: string) {
  return query<{ id: string; title: string; amount: number; category: string | null }>(
    `select id, title, amount, category from expenses where spent_on = $1::date order by created_at`,
    [day]
  );
}

export async function closingOf(day: string) {
  return queryOne<{ day: string; expected: number; counted: number; notes: string | null; closed_at: string; closed_by_name: string | null }>(
    `select c.day::text as day, c.expected, c.counted, c.notes, c.closed_at::text as closed_at, u.full_name as closed_by_name
       from cash_closings c left join app_users u on u.id = c.closed_by where c.day = $1::date`,
    [day]
  );
}

/** Each day of a month: money in, money out, and its closing. */
export async function monthDays(month: string) {
  return query<{ day: string; income: number; expenses: number; counted: number | null; expected: number | null }>(
    `with days as (
       select generate_series(($1 || '-01')::date, (($1 || '-01')::date + interval '1 month - 1 day')::date, interval '1 day')::date as day
     ),
     pay as (
       select p.paid_at::date as day, sum(p.amount) as amt from payments p join invoices i on i.id = p.invoice_id
        where i.status <> 'void' and to_char(p.paid_at, 'YYYY-MM') = $1 group by 1
     ),
     ord as (
       select o.order_date as day, sum(o.total_amount) as amt from test_orders o
        where to_char(o.order_date, 'YYYY-MM') = $1 and o.payment_status = 'paid'
          and not exists (select 1 from invoices i where i.order_id = o.id and i.status <> 'void') group by 1
     ),
     exp as (select spent_on as day, sum(amount) as amt from expenses where to_char(spent_on, 'YYYY-MM') = $1 group by 1)
     select d.day::text as day,
            coalesce(pay.amt, 0) + coalesce(ord.amt, 0) as income,
            coalesce(exp.amt, 0) as expenses,
            c.counted, c.expected
       from days d
       left join pay on pay.day = d.day
       left join ord on ord.day = d.day
       left join exp on exp.day = d.day
       left join cash_closings c on c.day = d.day
      order by d.day desc`,
    [month]
  );
}

export async function monthTotals(month: string) {
  const [byCat, purchases] = await Promise.all([
    query<{ category: string; amount: number }>(
      `select coalesce(nullif(trim(category), ''), 'أخرى') as category, sum(amount) as amount
         from expenses where to_char(spent_on, 'YYYY-MM') = $1 group by 1 order by 2 desc`,
      [month]
    ),
    queryOne<{ amount: number; n: number }>(
      `select coalesce(sum(total_amount), 0) as amount, count(*)::int as n from purchase_orders where to_char(order_date, 'YYYY-MM') = $1`,
      [month]
    ),
  ]);
  return { byCat: byCat.map((r) => ({ ...r, amount: Number(r.amount) })), purchases: Number(purchases?.amount ?? 0), purchaseCount: purchases?.n ?? 0 };
}

export const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + Number(x.amount || 0), 0);
export const addDays = (day: string, n: number) => {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const addMonths = (month: string, n: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};
