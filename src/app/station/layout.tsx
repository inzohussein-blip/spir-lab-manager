import type { ReactNode } from "react";
import { StationSidebar } from "@/components/station/StationSidebar";

export default function StationLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <StationSidebar />
      <main className="flex-1 p-5 md:p-7 print:p-0">{children}</main>
    </div>
  );
}
