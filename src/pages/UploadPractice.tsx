import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { UploadForm } from "@/components/upload/UploadForm";

const UploadPractice = () => {
  return (
    <DashboardLayout>
      <div className="max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Carica Nuova Pratica</h1>
          <p className="text-muted-foreground mt-1">
            Inserisci i dettagli della pratica e carica i documenti necessari
          </p>
        </div>
        <UploadForm />
      </div>
    </DashboardLayout>
  );
};

export default UploadPractice;
