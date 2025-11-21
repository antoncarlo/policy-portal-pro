import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { FileText, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const StatsCards = () => {
  const [stats, setStats] = useState({
    total: 0,
    inProgress: 0,
    completed: 0,
    pending: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const { data: practices } = await supabase
      .from("practices")
      .select("status");

    if (practices) {
      const total = practices.length;
      const inProgress = practices.filter(p => p.status === "in_lavorazione").length;
      const completed = practices.filter(p => p.status === "completata").length;
      const pending = practices.filter(p => p.status === "in_attesa").length;

      setStats({ total, inProgress, completed, pending });
    }
  };

  const statsConfig = [
    {
      title: "Pratiche Totali",
      value: stats.total.toString(),
      change: "Totale pratiche",
      icon: FileText,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "In Lavorazione",
      value: stats.inProgress.toString(),
      change: "Pratiche attive",
      icon: Clock,
      color: "text-chart-2",
      bgColor: "bg-chart-2/10",
    },
    {
      title: "Completate",
      value: stats.completed.toString(),
      change: "Pratiche concluse",
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-600/10",
    },
    {
      title: "In Attesa",
      value: stats.pending.toString(),
      change: "Da gestire",
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
