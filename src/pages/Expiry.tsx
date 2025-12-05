import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ExpiryDashboard } from "@/components/expiry/ExpiryDashboard";
import { ExpiryCalendar } from "@/components/expiry/ExpiryCalendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, LayoutGrid } from "lucide-react";

const Expiry = () => {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="h-8 w-8" />
            Scadenzario Polizze
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitora e gestisci le scadenze delle polizze
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Calendario
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <ExpiryDashboard />
          </TabsContent>

          <TabsContent value="calendar" className="mt-6">
            <ExpiryCalendar />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Expiry;
