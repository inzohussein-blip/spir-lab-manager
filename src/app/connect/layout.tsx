import type { ReactNode } from "react";
import { OfflineReady } from "@/components/local/OfflineReady";
import { ActivationGate } from "@/components/local/ActivationGate";
import { PinGate } from "@/components/local/PinGate";
import { LocalDataGate } from "@/components/local/LocalDataGate";
import { ACTIVATION_SCRIPT } from "@/lib/local/activation";
import { LocalThemeApplier } from "@/components/local/LocalTheme";
import { THEME_KEYS, themeScript } from "@/lib/local/theme";
import { ConnectSidebar } from "@/components/connect/ConnectSidebar";

export const metadata = { title: "محطة التواصل" };

/** «محطة التواصل»: the lab's computers, other labs and «المحادثة العامة» (switched on per code). */
export default function ConnectLayout({ children }: { children: ReactNode }) {
  return (
    <div className="connect min-h-screen md:flex">
      <script dangerouslySetInnerHTML={{ __html: ACTIVATION_SCRIPT }} />
      <ActivationGate module="connect" />
      <PinGate station="connect" title="محطة التواصل" />
      <script dangerouslySetInnerHTML={{ __html: themeScript(THEME_KEYS.connect) }} />
      <LocalThemeApplier storageKey={THEME_KEYS.connect} />
      <LocalDataGate>
        <ConnectSidebar />
        <main className="min-w-0 flex-1 p-4 md:p-7">{children}</main>
      </LocalDataGate>
      <OfflineReady />
    </div>
  );
}
