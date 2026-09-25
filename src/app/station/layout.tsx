import type { ReactNode } from "react";
import { OfflineReady } from "@/components/local/OfflineReady";
import { StationSidebar } from "@/components/station/StationSidebar";
import { StationThemeApplier } from "@/components/station/StationTheme";
import { STATION_THEME_SCRIPT } from "@/lib/station/theme";

export default function StationLayout({ children }: { children: ReactNode }) {
  return (
    <div className="station min-h-screen md:flex">
      {/* Station appearance (Settings) — applied before paint, then kept in sync. */}
      <script dangerouslySetInnerHTML={{ __html: STATION_THEME_SCRIPT }} />
      <StationThemeApplier />
      <StationSidebar />
      <main className="min-w-0 flex-1 p-4 md:p-7 print:p-0">{children}</main>
      <OfflineReady />
    </div>
  );
}
