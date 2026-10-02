import type { ReactNode } from "react";
import { OfflineReady } from "@/components/local/OfflineReady";
import { ActivationGate } from "@/components/local/ActivationGate";
import { PinGate } from "@/components/local/PinGate";
import { LocalDataGate } from "@/components/local/LocalDataGate";
import { ACTIVATION_SCRIPT } from "@/lib/local/activation";
import { StationSidebar } from "@/components/station/StationSidebar";
import { LocalThemeApplier } from "@/components/local/LocalTheme";
import { THEME_KEYS, themeScript } from "@/lib/local/theme";
import { DoctorPublisher } from "@/components/doctors/DoctorPublisher";

export default function StationLayout({ children }: { children: ReactNode }) {
  return (
    <div className="station min-h-screen md:flex">
      <script dangerouslySetInnerHTML={{ __html: ACTIVATION_SCRIPT }} />
      <ActivationGate module="station" />
      <PinGate station="station" title="محطة المختبر" />
      {/* Station appearance (Settings) — applied before paint, then kept in sync. */}
      <script dangerouslySetInnerHTML={{ __html: themeScript(THEME_KEYS.station) }} />
      <LocalThemeApplier storageKey={THEME_KEYS.station} />
      <LocalDataGate>
        <StationSidebar />
        <DoctorPublisher />
        <main className="min-w-0 flex-1 p-4 md:p-7 print:p-0">{children}</main>
      </LocalDataGate>
      <OfflineReady />
    </div>
  );
}
