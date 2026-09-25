import type { ReactNode } from "react";
import { OfflineReady } from "@/components/local/OfflineReady";
import { ActivationGate } from "@/components/local/ActivationGate";
import { ACTIVATION_SCRIPT } from "@/lib/local/activation";
import { LocalThemeApplier } from "@/components/local/LocalTheme";
import { THEME_KEYS, themeScript } from "@/lib/local/theme";
import { RosterSidebar } from "@/components/roster/RosterSidebar";

export const metadata = { title: "محطة الكادر والدوام" };

export default function RosterLayout({ children }: { children: ReactNode }) {
  return (
    <div className="roster min-h-screen md:flex">
      <script dangerouslySetInnerHTML={{ __html: ACTIVATION_SCRIPT }} />
      <ActivationGate />
      <script dangerouslySetInnerHTML={{ __html: themeScript(THEME_KEYS.roster) }} />
      <LocalThemeApplier storageKey={THEME_KEYS.roster} />
      <RosterSidebar />
      <main className="min-w-0 flex-1 p-4 md:p-7 print:p-0">{children}</main>
      <OfflineReady />
    </div>
  );
}
