import type { ReactNode } from "react";
import { OfflineReady } from "@/components/local/OfflineReady";
import { PinGate } from "@/components/local/PinGate";
import { LocalThemeApplier } from "@/components/local/LocalTheme";
import { THEME_KEYS, themeScript } from "@/lib/local/theme";
import { AboutSidebar } from "@/components/about/AboutSidebar";
import { TextSizeMain } from "@/components/about/TextSize";

export const metadata = { title: "عن التطبيق" };

/** «عن التطبيق»: the app explained — open to everyone (no lab code, no data of its own). */
export default function AboutLayout({ children }: { children: ReactNode }) {
  return (
    <div className="about min-h-screen md:flex">
      <PinGate station="about" title="عن التطبيق" />
      <script dangerouslySetInnerHTML={{ __html: themeScript(THEME_KEYS.about) }} />
      <LocalThemeApplier storageKey={THEME_KEYS.about} />
      <AboutSidebar />
      <TextSizeMain>{children}</TextSizeMain>
      <OfflineReady />
    </div>
  );
}
