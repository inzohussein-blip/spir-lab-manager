import type { ReactNode } from "react";
import { OfflineReady } from "@/components/local/OfflineReady";
import { PinGate } from "@/components/local/PinGate";
import { LocalDataGate } from "@/components/local/LocalDataGate";
import { ACTIVATION_SCRIPT } from "@/lib/local/activation";
import { LocalThemeApplier } from "@/components/local/LocalTheme";
import { THEME_KEYS, themeScript } from "@/lib/local/theme";
import { DoctorSidebar } from "@/components/doctors/DoctorSidebar";
import { DoctorGate } from "@/components/doctors/DoctorGate";

export const metadata = { title: "نافذة الأطباء" };

/** «نافذة الأطباء»: standalone like /license — no page links here; the lab sends the address with
 *  the doctor's activation code, and nothing opens without that code (components/doctors/DoctorGate).
 *  On the doctor's own device (no lab code): the results the labs share with him. */
export default function DoctorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="doctor min-h-screen md:flex">
      {/* No lab code is asked here; the script only marks a new browser as new, so the offline copy
          saved from this window is not taken for an older station's data (a free 30 days). */}
      <script dangerouslySetInnerHTML={{ __html: ACTIVATION_SCRIPT }} />
      <PinGate station="doctor" title="نافذة الأطباء" />
      <script dangerouslySetInnerHTML={{ __html: themeScript(THEME_KEYS.doctor) }} />
      <LocalThemeApplier storageKey={THEME_KEYS.doctor} />
      <LocalDataGate>
        <DoctorGate>
          <DoctorSidebar />
          <main className="min-w-0 flex-1 p-4 md:p-7">{children}</main>
        </DoctorGate>
      </LocalDataGate>
      <OfflineReady />
    </div>
  );
}
