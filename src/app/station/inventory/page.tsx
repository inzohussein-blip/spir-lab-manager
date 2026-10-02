"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** The stock room moved to the procurement station (same data on this device): its old address
 *  leads to the welcome page, where every station opens from its own card. */
export default function StationInventoryMoved() {
  const router = useRouter();
  useEffect(() => { router.replace("/welcome"); }, [router]);
  return <div className="grid min-h-[40vh] place-items-center text-sm text-muted">انتقل المخزن إلى محطة «المخزن والمشتريات» — تُفتح من الصفحة الرئيسية…</div>;
}
