"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** The stock room moved to the procurement station (same data on this device). */
export default function StationInventoryMoved() {
  const router = useRouter();
  useEffect(() => { router.replace("/store/inventory"); }, [router]);
  return <div className="grid min-h-[40vh] place-items-center text-sm text-muted">انتقل المخزن إلى محطة المخزن والمشتريات…</div>;
}
