import type { ReactNode } from "react";
import { OfflineReady } from "@/components/local/OfflineReady";
import { ActivationGate } from "@/components/local/ActivationGate";
import { ACTIVATION_SCRIPT } from "@/lib/local/activation";
import { LocalThemeApplier } from "@/components/local/LocalTheme";
import { THEME_KEYS, themeScript } from "@/lib/local/theme";
import { PurchasingSidebar } from "@/components/purchasing/PurchasingSidebar";

export default function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <div className="store min-h-screen md:flex">
      <script dangerouslySetInnerHTML={{ __html: ACTIVATION_SCRIPT }} />
      <ActivationGate module="purchasing" />
      <script dangerouslySetInnerHTML={{ __html: themeScript(THEME_KEYS.store) }} />
      <LocalThemeApplier storageKey={THEME_KEYS.store} />
      <PurchasingSidebar />
      <main className="min-w-0 flex-1 p-4 md:p-7">{children}</main>
      <OfflineReady />
    </div>
  );
}
