import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Shield, Briefcase, UserCheck } from "lucide-react";

interface UserManagementStatsProps {
  stats: {
    total: number;
    admins: number;
    agents: number;
    collaborators: number;
  };
}

export const UserManagementStats = ({ stats }: UserManagementStatsProps) => {
  const cards = [
    {
      title: "Totale Utenti",
      value: stats.total,
      icon: Users,
      color: "text-gray-600",
      bgColor: "bg-gray-100",
    },
    {
      title: "Admin",
      value: stats.admins,
      icon: Shield,
      color: "text-red-600",
      bgColor: "bg-red-100",
    },
    {
      title: "Agenti",
      value: stats.agents,
      icon: Briefcase,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Collaboratori",
      value: stats.collaborators,
      icon: UserCheck,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
