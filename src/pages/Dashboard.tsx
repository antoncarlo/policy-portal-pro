import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { PracticesList } from "@/components/dashboard/PracticesList";
import { RecentActivity } from "@/components/dashboard/RecentActivity";

const Dashboard = () => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Panoramica delle tue pratiche assicurative
          </p>
        </div>

        <StatsCards />

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <PracticesList searchQuery={searchQuery} onSearchChange={setSearchQuery} />
          </div>
          <div>
            <RecentActivity />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
