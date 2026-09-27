import { notFound } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { barcodeSvg } from "@/lib/barcode";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

/** Printable sample labels (one per distinct specimen type) with the accession
 *  barcode — "Print Lab Labels" from the bench mockup. */
export default async function LabelPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const order = await queryOne<any>(
    `select o.accession_no, o.order_date, p.full_name, p.gender, p.age_years
       from test_orders o join patients p on p.id = o.patient_id
      where o.id = $1`,
    [params.id]
  );
  if (!order) notFound();

  const samples = await query<{ sample_type: string | null }>(
    `select distinct coalesce(t.sample_type, 'عينة') as sample_type
       from test_order_items i join test_catalog t on t.id = i.test_id
      where i.order_id = $1`,
    [params.id]
  );
  const labels = samples.length ? samples.map((s) => s.sample_type) : ["عينة"];
  const barcode = order.accession_no ? await barcodeSvg(order.accession_no) : "";

  return (
    <div>
      <div className="no-print mb-4">
        <PrintButton />
      </div>

      <div id="report-sheet" className="flex flex-wrap gap-3">
        {labels.map((sample, i) => (
          <div
            key={i}
            className="w-[58mm] rounded-md border border-black bg-white p-2 text-black print:border-black"
          >
            <div className="flex items-center justify-between text-[10px] font-bold text-teal-800">
              <span>مختبر التحاليل</span>
              <span>{sample}</span>
            </div>
            <div className="mt-1 truncate text-sm font-bold">{order.full_name}</div>
            <div className="text-[10px] text-gray-600">
              {order.gender === "male" ? "ذكر" : order.gender === "female" ? "أنثى" : "—"}
              {order.age_years ? ` · ${order.age_years} سنة` : ""} · {order.order_date}
            </div>
            {barcode && (
              <span className="mt-1 block h-8 w-full" dangerouslySetInnerHTML={{ __html: barcode }} />
            )}
            <div className="text-center font-mono text-[10px]">{order.accession_no}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
