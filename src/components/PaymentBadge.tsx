import { Badge } from "@/components/ui/primitives";

const LABEL: Record<string, string> = {
  unpaid: "غير مدفوع",
  paid: "مدفوع",
  partial: "دفع جزئي",
};
const TONE: Record<string, "brand" | "warn" | "danger"> = {
  unpaid: "danger",
  paid: "brand",
  partial: "warn",
};

/** Small chip reflecting an order's payment status, used across the workflow. */
export function PaymentBadge({ status }: { status: string | null }) {
  const key = status ?? "unpaid";
  return <Badge tone={TONE[key] ?? "warn"}>{LABEL[key] ?? "—"}</Badge>;
}
