import type { ReactNode } from "react";
import { OfflineReady } from "@/components/local/OfflineReady";
import { ActivationGate } from "@/components/local/ActivationGate";
import { LocalDataGate } from "@/components/local/LocalDataGate";
import { ACTIVATION_SCRIPT } from "@/lib/local/activation";

export const metadata = { title: "محطة المزامنة" };

/** «محطة المزامنة»: every activated computer of the lab (no station of its own to switch on). */
export default function SyncLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <script dangerouslySetInnerHTML={{ __html: ACTIVATION_SCRIPT }} />
      <ActivationGate />
      <LocalDataGate>
        <main className="mx-auto max-w-5xl p-4 md:p-7">{children}</main>
      </LocalDataGate>
      <OfflineReady />
    </div>
  );
}
