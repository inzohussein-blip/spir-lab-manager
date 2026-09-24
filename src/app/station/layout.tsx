import type { ReactNode } from "react";
import { OfflineReady } from "@/components/local/OfflineReady";
import { StationSidebar } from "@/components/station/StationSidebar";

export default function StationLayout({ children }: { children: ReactNode }) {
  return (
    <div className="station min-h-screen md:flex">
      <StationSidebar />
      <main className="min-w-0 flex-1 p-4 md:p-7 print:p-0">{children}</main>
      <OfflineReady />
    </div>
  );
}
