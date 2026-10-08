import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { UploadForm } from "@/components/upload/UploadForm";
import { useMessages } from "@/i18n";
import { uploadMessages } from "@/i18n/messages/upload";

const UploadPractice = () => {
  const m = useMessages(uploadMessages);
  return (
    <DashboardLayout>
      <div className="max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">{m.title}</h1>
          <p className="text-muted-foreground mt-1">
            {m.subtitle}
          </p>
        </div>
        <UploadForm />
      </div>
    </DashboardLayout>
  );
};

export default UploadPractice;
