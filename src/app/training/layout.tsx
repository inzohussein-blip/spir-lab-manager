import type { ReactNode } from "react";
import { TrainingSidebar } from "@/components/training/TrainingSidebar";

export const metadata = { title: "محطة التدريب والمعلومات" };

export default function TrainingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="training min-h-screen md:flex">
      <TrainingSidebar />
      <main className="min-w-0 flex-1 p-4 md:p-7 print:p-0">{children}</main>
    </div>
  );
}
