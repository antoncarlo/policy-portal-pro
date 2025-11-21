import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card } from "@/components/ui/card";

const Settings = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Impostazioni</h1>
          <p className="text-muted-foreground mt-1">
            Configura le impostazioni del portale
          </p>
        </div>

        <Card className="p-6">
          <div className="text-center py-12 text-muted-foreground">
            Pagina impostazioni in sviluppo
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
