import { PageHeader, Card } from "@/components/ui/primitives";
import { PatientForm } from "@/components/PatientForm";

export default function NewPatientPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader title="إضافة مريض جديد" subtitle="القسم 1 — النتائج والمرضى" />
      <Card>
        <PatientForm />
      </Card>
    </div>
  );
}
