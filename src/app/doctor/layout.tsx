import type { ReactNode } from "react";
import { OfflineReady } from "@/components/local/OfflineReady";
import { PinGate } from "@/components/local/PinGate";
import { LocalDataGate } from "@/components/local/LocalDataGate";
import { LocalThemeApplier } from "@/components/local/LocalTheme";
import { THEME_KEYS, themeScript } from "@/lib/local/theme";
import { DoctorSidebar } from "@/components/doctors/DoctorSidebar";

export const metadata = { title: "نافذة الأطباء" };

/** «نافذة الأطباء»: on the doctor's own device (no lab code): the results the labs share with him
 *  by the codes they gave him. */
export default function DoctorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="doctor min-h-screen md:flex">
      <PinGate station="doctor" title="نافذة الأطباء" />
      <script dangerouslySetInnerHTML={{ __html: themeScript(THEME_KEYS.doctor) }} />
      <LocalThemeApplier storageKey={THEME_KEYS.doctor} />
      <LocalDataGate>
        <DoctorSidebar />
        <main className="min-w-0 flex-1 p-4 md:p-7">{children}</main>
      </LocalDataGate>
      <OfflineReady />
    </div>
  );
}
