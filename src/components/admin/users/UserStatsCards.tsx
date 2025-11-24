import { Card } from "@/components/ui/card";
import { Users, Shield, Briefcase, UserCheck } from "lucide-react";

interface UserStatsCardsProps {
  totalUsers: number;
  adminCount: number;
  agentCount: number;
  collaboratorCount: number;
}

export const UserStatsCards = ({
  totalUsers,
  adminCount,
  agentCount,
  collaboratorCount,
}: UserStatsCardsProps) => {
  const stats = [
    {
      title: "Totali",
      value: totalUsers,
      icon: Users,
      gradient: "from-purple-50 to-purple-100",
      iconColor: "text-purple-600",
    },
    {
      title: "Admin",
      value: adminCount,
      icon: Shield,
      gradient: "from-red-50 to-red-100",
      iconColor: "text-red-600",
    },
    {
      title: "Agenti",
      value: agentCount,
      icon: Briefcase,
      gradient: "from-blue-50 to-blue-100",
      iconColor: "text-blue-600",
    },
    {
      title: "Collaboratori",
      value: collaboratorCount,
      icon: UserCheck,
      gradient: "from-green-50 to-green-100",
      iconColor: "text-green-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card
            key={stat.title}
            className={`p-6 bg-gradient-to-br ${stat.gradient} border-0 shadow-sm`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">
                  {stat.title}
                </p>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-full bg-white shadow-sm`}>
                <Icon className={`h-6 w-6 ${stat.iconColor}`} />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
