import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Shield, Briefcase, UserCheck } from "lucide-react";
import { useMessages } from "@/i18n";
import { usersMessages } from "@/i18n/messages/users";

interface UserManagementStatsProps {
  stats: {
    total: number;
    admins: number;
    agents: number;
    collaborators: number;
  };
}

export const UserManagementStats = ({ stats }: UserManagementStatsProps) => {
  const m = useMessages(usersMessages).stats;
  const cards = [
    {
      key: "total",
      title: m.total,
      value: stats.total,
      icon: Users,
      color: "text-gray-600",
      bgColor: "bg-gray-100",
    },
    {
      key: "admins",
      title: m.admins,
      value: stats.admins,
      icon: Shield,
      color: "text-red-600",
      bgColor: "bg-red-100",
    },
    {
      key: "agents",
      title: m.agents,
      value: stats.agents,
      icon: Briefcase,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      key: "collaborators",
      title: m.collaborators,
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
          <Card key={card.key}>
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
