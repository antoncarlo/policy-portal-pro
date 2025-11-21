import { Card } from "@/components/ui/card";
import { FileText, Clock, CheckCircle, AlertCircle } from "lucide-react";

export const StatsCards = () => {
  const stats = [
    {
      title: "Pratiche Totali",
      value: "124",
      change: "+12 questo mese",
      icon: FileText,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "In Elaborazione",
      value: "23",
      change: "5 da approvare",
      icon: Clock,
      color: "text-chart-2",
      bgColor: "bg-chart-2/10",
    },
    {
      title: "Completate",
      value: "89",
      change: "+8 questa settimana",
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-600/10",
    },
    {
      title: "Richieste Azioni",
      value: "12",
      change: "Da gestire",
      icon: AlertCircle,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
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
