import type { ReactNode } from "react";
import { RosterSidebar } from "@/components/roster/RosterSidebar";

export const metadata = { title: "محطة الكادر والدوام" };

export default function RosterLayout({ children }: { children: ReactNode }) {
  return (
    <div className="roster min-h-screen md:flex">
      <RosterSidebar />
      <main className="min-w-0 flex-1 p-4 md:p-7 print:p-0">{children}</main>
    </div>
  );
}
