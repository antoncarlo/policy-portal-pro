import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Euro, FileText, Percent, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { stageOf, PRACTICE_STAGES } from "@/lib/practiceStages";
import { formatCurrency, useLanguage, useMessages } from "@/i18n";
import { practiceTypeLabel } from "@/i18n/messages/domain";
import { myWorkMessages } from "@/i18n/messages/myWork";
import { workflowMessages } from "@/i18n/messages/workflow";

interface Row {
  id: string;
  status: string;
  financial_status: string | null;
  practice_type: string;
  premium_gross: number | null;
  commission_amount: number | null;
  created_at: string;
}

const MONTHS = 6;
const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

/**
 * Statistiche del proprio lavoro (agenti e collaboratori). I numeri vengono dalle pratiche che l'utente puo' vedere:
 * il database applica gia' il suo perimetro (le proprie e, per un agente, quelle dei collaboratori).
 */
export const MyWorkStatistics = () => {
  const m = useMessages(myWorkMessages).stats;
  const stages = useMessages(workflowMessages).stages;
  const language = useLanguage();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAllRows<Row>((from, to) =>
      supabase
        .from("practices")
        .select("id, status, financial_status, practice_type, premium_gross, commission_amount, created_at")
        .order("id")
        .range(from, to),
    )
      .then((found) => !cancelled && setRows(found))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const figures = useMemo(() => {
    const list = rows ?? [];
    const byStage = new Map<string, number>();
    const byType = new Map<string, number>();
    const trend = new Map<string, number>();
    const now = new Date();
    for (let back = MONTHS - 1; back >= 0; back -= 1) trend.set(monthKey(new Date(now.getFullYear(), now.getMonth() - back, 1)), 0);
    let premium = 0;
    let commission = 0;
    for (const row of list) {
      const stage = stageOf(row);
      byStage.set(stage, (byStage.get(stage) ?? 0) + 1);
      byType.set(row.practice_type, (byType.get(row.practice_type) ?? 0) + 1);
      premium += Number(row.premium_gross ?? 0);
      commission += Number(row.commission_amount ?? 0);
      const key = monthKey(new Date(row.created_at));
      if (trend.has(key)) trend.set(key, (trend.get(key) ?? 0) + 1);
    }
    return {
      total: list.length,
      toPay: byStage.get("deliberata") ?? 0,
      premium,
      commission,
      stages: PRACTICE_STAGES.map((stage) => ({ name: stages[stage], value: byStage.get(stage) ?? 0 })),
      types: [...byType.entries()].sort((a, b) => b[1] - a[1]).map(([type, value]) => ({ name: practiceTypeLabel(type, language), value })),
      trend: [...trend.entries()].map(([month, count]) => ({ month, count })),
    };
  }, [rows, language, stages]);

  if (failed) return <Card className="p-6 text-sm text-destructive">{m.error}</Card>;
  if (!rows) return <Card className="p-6 text-sm text-muted-foreground">{m.loading}</Card>;

  const cards = [
    { icon: FileText, label: m.practices, value: String(figures.total) },
    { icon: Wallet, label: m.openToPay, value: String(figures.toPay) },
    { icon: Euro, label: m.premium, value: formatCurrency(figures.premium) },
    { icon: Percent, label: m.commission, value: formatCurrency(figures.commission) },
  ];

  return (
    <div className="space-y-4" data-testid="my-statistics">
      <Card className="p-6">
        <h2 className="text-xl font-semibold">{m.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{m.intro}</p>
      </Card>
      {figures.total === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">{m.empty}</Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map(({ icon: Icon, label, value }) => (
              <Card key={label} className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon className="h-4 w-4" />
                  {label}
                </div>
                <p className="mt-2 text-2xl font-semibold tabular-nums" data-testid={`my-stat-${label}`}>{value}</p>
              </Card>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <h3 className="mb-3 font-medium">{m.byStage}</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={figures.stages} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <h3 className="mb-3 font-medium">{m.byType}</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={figures.types} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
          <Card className="p-4">
            <h3 className="mb-3 font-medium">{m.trend}</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={figures.trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
