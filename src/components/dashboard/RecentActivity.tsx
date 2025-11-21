import { Card } from "@/components/ui/card";
import { FileText, User, CheckCircle, AlertCircle } from "lucide-react";

export const RecentActivity = () => {
  const activities = [
    {
      icon: FileText,
      title: "Nuova pratica creata",
      description: "PR-2024-001 - Mario Rossi",
      time: "2 ore fa",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      icon: CheckCircle,
      title: "Pratica approvata",
      description: "PR-2024-002 - Laura Bianchi",
      time: "4 ore fa",
      color: "text-green-600",
      bgColor: "bg-green-600/10",
    },
    {
      icon: AlertCircle,
      title: "Azione richiesta",
      description: "PR-2024-003 - Giuseppe Verdi",
      time: "1 giorno fa",
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    },
    {
      icon: User,
      title: "Nuovo cliente aggiunto",
      description: "Anna Ferrari",
      time: "2 giorni fa",
      color: "text-chart-2",
      bgColor: "bg-chart-2/10",
    },
    {
      icon: FileText,
      title: "Documenti caricati",
      description: "PR-2024-004 - Marco Colombo",
      time: "3 giorni fa",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
  ];

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold text-foreground mb-6">
        Attività Recente
      </h2>
      <div className="space-y-4">
        {activities.map((activity, index) => {
          const Icon = activity.icon;
          return (
            <div key={index} className="flex gap-3">
              <div className={`p-2 rounded-lg ${activity.bgColor} h-fit`}>
                <Icon className={`h-4 w-4 ${activity.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {activity.title}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {activity.description}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {activity.time}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
