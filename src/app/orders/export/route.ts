import { NextRequest } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  pending: "قيد الانتظار",
  in_progress: "قيد الفحص",
  completed: "مكتمل",
  delivered: "مُسلّم",
};

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

/** Export the (optionally filtered) sample registry as CSV — same filters as
 *  the /orders page. UTF-8 BOM so Arabic opens correctly in Excel. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") || "").trim();
  const status = sp.get("status") || "";
  const from = sp.get("from") || "";
  const to = sp.get("to") || "";

  const where: string[] = [];
  const params: any[] = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(`(p.full_name ilike $${params.length} or o.accession_no ilike $${params.length})`);
  }
  if (status) {
    params.push(status);
    where.push(`o.status = $${params.length}`);
  }
  if (from) {
    params.push(from);
    where.push(`o.order_date >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    where.push(`o.order_date <= $${params.length}`);
  }
  const whereSql = where.length ? `where ${where.join(" and ")}` : "";

  const rows = await query<any>(
    `select o.accession_no, o.order_date, p.full_name, p.phone,
            count(i.id)::int as tests, o.status, o.total_amount
       from test_orders o
       join patients p on p.id = o.patient_id
       left join test_order_items i on i.order_id = o.id
       ${whereSql}
      group by o.id, p.full_name, p.phone
      order by o.order_date desc, o.created_at desc
      limit 5000`,
    params
  );

  const header = ["رقم العيّنة", "التاريخ", "المريض", "الهاتف", "عدد الفحوصات", "الحالة", "المبلغ"];
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.accession_no,
        r.order_date,
        r.full_name,
        r.phone,
        r.tests,
        statusLabel[r.status] ?? r.status,
        r.total_amount,
      ]
        .map(csvCell)
        .join(",")
    );
  }
  const csv = "﻿" + lines.join("\r\n");

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="samples-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
