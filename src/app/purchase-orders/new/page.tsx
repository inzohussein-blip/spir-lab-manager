import { query } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui/primitives";
import { PurchaseOrderForm } from "@/components/PurchaseOrderForm";

export const dynamic = "force-dynamic";

export default async function NewPurchaseOrderPage() {
  const [products, suppliers] = await Promise.all([
    query<any>(`select id, name, buy_price from products where is_active order by name`),
    query<any>(`select id, name from suppliers order by name`),
  ]);

  return (
    <div className="max-w-2xl">
      <PageHeader title="أمر شراء جديد" subtitle="اختر المورّد وأضف بنود الكواشف" />
      <Card>
        <PurchaseOrderForm products={products} suppliers={suppliers} />
      </Card>
    </div>
  );
}
