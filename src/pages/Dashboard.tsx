import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { PracticesList } from "@/components/dashboard/PracticesList";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { ExpiryWidget } from "@/components/dashboard/ExpiryWidget";
import { useMessages } from "@/i18n";
import { dashboardMessages } from "@/i18n/messages/dashboard";

const Dashboard = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const m = useMessages(dashboardMessages);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{m.title}</h1>
          <p className="text-muted-foreground mt-1">
            {m.subtitle}
          </p>
        </div>

        <StatsCards />

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <PracticesList searchQuery={searchQuery} onSearchChange={setSearchQuery} />
          </div>
          <div className="space-y-6">
            <ExpiryWidget />
            <RecentActivity />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
