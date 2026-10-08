import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { FileText, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMessages } from "@/i18n";
import { dashboardMessages } from "@/i18n/messages/dashboard";

export const StatsCards = () => {
  const m = useMessages(dashboardMessages).stats;
  const [stats, setStats] = useState({
    total: 0,
    inProgress: 0,
    completed: 0,
    pending: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  // Counted by the database: reading the rows would stop at the first 1000.
  const loadStats = async () => {
    const count = async (status?: "in_lavorazione" | "completata" | "in_attesa") => {
      let query = supabase.from("practices").select("id", { count: "exact", head: true });
      if (status) query = query.eq("status", status);
      const { count: value } = await query;
      return value ?? 0;
    };
    const [total, inProgress, completed, pending] = await Promise.all([
      count(),
      count("in_lavorazione"),
      count("completata"),
      count("in_attesa"),
    ]);
    setStats({ total, inProgress, completed, pending });
  };

  const statsConfig = [
    {
      title: m.total,
      value: stats.total.toString(),
      change: m.totalHint,
      icon: FileText,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: m.inProgress,
      value: stats.inProgress.toString(),
      change: m.inProgressHint,
      icon: Clock,
      color: "text-chart-2",
      bgColor: "bg-chart-2/10",
    },
    {
      title: m.completed,
      value: stats.completed.toString(),
      change: m.completedHint,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-600/10",
    },
    {
      title: m.pending,
      value: stats.pending.toString(),
      change: m.pendingHint,
      icon: AlertCircle,
      color: "text-yellow-600",
      bgColor: "bg-yellow-600/10",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statsConfig.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <Icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                {stat.title}
              </p>
              <p className="text-3xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
