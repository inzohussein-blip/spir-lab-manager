import type { ReactNode } from "react";
import { OfflineReady } from "@/components/local/OfflineReady";
import { ActivationGate } from "@/components/local/ActivationGate";
import { LocalDataGate } from "@/components/local/LocalDataGate";
import { ACTIVATION_SCRIPT } from "@/lib/local/activation";
import { LocalThemeApplier } from "@/components/local/LocalTheme";
import { THEME_KEYS, themeScript } from "@/lib/local/theme";
import { SyncSidebar } from "@/components/sync/SyncSidebar";

export const metadata = { title: "محطة المزامنة" };

/** «محطة المزامنة»: every activated computer of the lab (no station of its own to switch on). */
export default function SyncLayout({ children }: { children: ReactNode }) {
  return (
    <div className="sync min-h-screen md:flex">
      <script dangerouslySetInnerHTML={{ __html: ACTIVATION_SCRIPT }} />
      <ActivationGate />
      <script dangerouslySetInnerHTML={{ __html: themeScript(THEME_KEYS.sync) }} />
      <LocalThemeApplier storageKey={THEME_KEYS.sync} />
      <LocalDataGate>
        <SyncSidebar />
        <main className="min-w-0 flex-1 p-4 md:p-7">{children}</main>
      </LocalDataGate>
      <OfflineReady />
    </div>
  );
}
