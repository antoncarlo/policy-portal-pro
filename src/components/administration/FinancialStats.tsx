import { Card } from "@/components/ui/card";
import { Euro, TrendingUp, Clock, CheckCircle } from "lucide-react";
import { formatCurrency as formatLocaleCurrency, useMessages } from "@/i18n";
import { administrationMessages } from "@/i18n/messages/administration";

interface FinancialStatsProps {
  stats: {
    total_premium_amount: number;
    total_commission_amount: number;
    incassate_commission: number;
    provvigioni_ricevute_amount: number;
  };
}

export const FinancialStats = ({ stats }: FinancialStatsProps) => {
  const m = useMessages(administrationMessages).stats;
  const formatCurrency = (amount: number) => formatLocaleCurrency(amount);

  const statsCards = [
    {
      title: m.totalPremiums,
      value: formatCurrency(stats.total_premium_amount),
      icon: Euro,
      color: "text-blue-600",
      chip: "bg-blue-500/10",
    },
    {
      title: m.totalCommissions,
      value: formatCurrency(stats.total_commission_amount),
      icon: TrendingUp,
      color: "text-purple-600",
      chip: "bg-purple-500/10",
    },
    {
      title: m.toReceive,
      value: formatCurrency(stats.incassate_commission),
      icon: Clock,
      color: "text-orange-600",
      chip: "bg-orange-500/10",
    },
    {
      title: m.received,
      value: formatCurrency(stats.provvigioni_ricevute_amount),
      icon: CheckCircle,
      color: "text-green-600",
      chip: "bg-green-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statsCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card
            key={index}
            className="p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  {stat.title}
                </p>
                <p className={`font-serif text-2xl font-semibold tracking-tight ${stat.color} mt-2`}>
                  {stat.value}
                </p>
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.chip}`}>
                <Icon className={`h-6 w-6 ${stat.color}`} />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
