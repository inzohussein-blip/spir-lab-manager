import type { ReactNode } from "react";
import { PurchasingSidebar } from "@/components/purchasing/PurchasingSidebar";

export default function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <PurchasingSidebar />
      <main className="flex-1 p-5 md:p-7">{children}</main>
    </div>
  );
}
