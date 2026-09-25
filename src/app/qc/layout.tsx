import type { ReactNode } from "react";
import { OfflineReady } from "@/components/local/OfflineReady";
import { LocalThemeApplier } from "@/components/local/LocalTheme";
import { THEME_KEYS, themeScript } from "@/lib/local/theme";
import { QcSidebar } from "@/components/qc/QcSidebar";

export const metadata = { title: "محطة الجودة والأجهزة" };

export default function QcLayout({ children }: { children: ReactNode }) {
  return (
    <div className="qc min-h-screen md:flex">
      <script dangerouslySetInnerHTML={{ __html: themeScript(THEME_KEYS.qc) }} />
      <LocalThemeApplier storageKey={THEME_KEYS.qc} />
      <QcSidebar />
      <main className="min-w-0 flex-1 p-4 md:p-7 print:p-0">{children}</main>
      <OfflineReady />
    </div>
  );
}
