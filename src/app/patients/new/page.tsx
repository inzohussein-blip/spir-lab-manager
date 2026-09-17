import { PageHeader, Card } from "@/components/ui/primitives";
import { PatientForm } from "@/components/PatientForm";

export default function NewPatientPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader title="إضافة مريض جديد" subtitle="سجّل بيانات المريض الأساسية ومعلوماته الطبية" />
      <Card>
        <PatientForm />
      </Card>
    </div>
  );
}
