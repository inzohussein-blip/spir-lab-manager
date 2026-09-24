import type { ReactNode } from "react";
import { OfflineReady } from "@/components/local/OfflineReady";
import { PurchasingSidebar } from "@/components/purchasing/PurchasingSidebar";

export default function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen md:flex">
      <PurchasingSidebar />
      <main className="min-w-0 flex-1 p-4 md:p-7">{children}</main>
      <OfflineReady />
    </div>
  );
}
