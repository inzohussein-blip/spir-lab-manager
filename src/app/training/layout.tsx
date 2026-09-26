import type { ReactNode } from "react";
import { OfflineReady } from "@/components/local/OfflineReady";
import { ActivationGate } from "@/components/local/ActivationGate";
import { ACTIVATION_SCRIPT } from "@/lib/local/activation";
import { LocalThemeApplier } from "@/components/local/LocalTheme";
import { THEME_KEYS, themeScript } from "@/lib/local/theme";
import { TrainingSidebar } from "@/components/training/TrainingSidebar";

export const metadata = { title: "محطة التدريب والمعلومات" };

export default function TrainingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="training min-h-screen md:flex">
      <script dangerouslySetInnerHTML={{ __html: ACTIVATION_SCRIPT }} />
      <ActivationGate module="training" />
      <script dangerouslySetInnerHTML={{ __html: themeScript(THEME_KEYS.training) }} />
      <LocalThemeApplier storageKey={THEME_KEYS.training} />
      <TrainingSidebar />
      <main className="min-w-0 flex-1 p-4 md:p-7 print:p-0">{children}</main>
      <OfflineReady />
    </div>
  );
}
