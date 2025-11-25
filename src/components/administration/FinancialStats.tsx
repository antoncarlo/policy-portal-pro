import { Card } from "@/components/ui/card";
import { Euro, TrendingUp, Clock, CheckCircle } from "lucide-react";

interface FinancialStatsProps {
  stats: {
    total_premium_amount: number;
    total_commission_amount: number;
    incassate_commission: number;
    provvigioni_ricevute_amount: number;
  };
}

export const FinancialStats = ({ stats }: FinancialStatsProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const statsCards = [
    {
      title: "Premi Totali",
      value: formatCurrency(stats.total_premium_amount),
      icon: Euro,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950",
      borderColor: "border-blue-200 dark:border-blue-800",
    },
    {
      title: "Provvigioni Totali",
      value: formatCurrency(stats.total_commission_amount),
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950",
      borderColor: "border-purple-200 dark:border-purple-800",
    },
    {
      title: "Da Ricevere",
      value: formatCurrency(stats.incassate_commission),
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950",
      borderColor: "border-orange-200 dark:border-orange-800",
    },
    {
      title: "Ricevute",
      value: formatCurrency(stats.provvigioni_ricevute_amount),
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950",
      borderColor: "border-green-200 dark:border-green-800",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statsCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card
            key={index}
            className={`p-6 border-2 ${stat.borderColor} ${stat.bgColor}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </p>
                <p className={`text-2xl font-bold ${stat.color} mt-2`}>
                  {stat.value}
                </p>
              </div>
              <Icon className={`h-10 w-10 ${stat.color}`} />
            </div>
          </Card>
        );
      })}
    </div>
  );
};
