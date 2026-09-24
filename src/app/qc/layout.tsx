import type { ReactNode } from "react";
import { OfflineReady } from "@/components/local/OfflineReady";
import { QcSidebar } from "@/components/qc/QcSidebar";

export const metadata = { title: "محطة الجودة والأجهزة" };

export default function QcLayout({ children }: { children: ReactNode }) {
  return (
    <div className="qc min-h-screen md:flex">
      <QcSidebar />
      <main className="min-w-0 flex-1 p-4 md:p-7 print:p-0">{children}</main>
      <OfflineReady />
    </div>
  );
}
