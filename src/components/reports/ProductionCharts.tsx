import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface ProductionStats {
  total_practices: number;
  total_premium: number;
  total_commission: number;
  avg_premium: number;
  practices_by_type: Record<string, number>;
  practices_by_status: Record<string, number>;
  practices_by_month: Array<{
    month: string;
    count: number;
    premium: number;
    commission: number;
  }>;
  top_agents: Array<{
    agent_id: string;
    agent_name: string;
    practices_count: number;
    total_premium: number;
    total_commission: number;
  }>;
}

interface ProductionChartsProps {
  stats: ProductionStats;
}

export default function ProductionCharts({ stats }: ProductionChartsProps) {
  // Trend mensile pratiche e premi
  const monthlyTrendData = {
    labels: stats.practices_by_month?.map(m => {
      const [year, month] = m.month.split('-');
      return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('it-IT', { month: 'short', year: 'numeric' });
    }) || [],
    datasets: [
      {
        label: 'Pratiche',
        data: stats.practices_by_month?.map(m => m.count) || [],
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.5)',
        yAxisID: 'y',
      },
      {
        label: 'Premi (€)',
        data: stats.practices_by_month?.map(m => m.premium) || [],
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.5)',
        yAxisID: 'y1',
      },
    ],
  };

  const monthlyTrendOptions = {
    responsive: true,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Numero Pratiche',
        },
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Premi (€)',
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  };

  // Pratiche per tipo (Doughnut)
  const typeColors = [
    'rgba(99, 102, 241, 0.8)',
    'rgba(34, 197, 94, 0.8)',
    'rgba(234, 179, 8, 0.8)',
    'rgba(239, 68, 68, 0.8)',
    'rgba(168, 85, 247, 0.8)',
    'rgba(236, 72, 153, 0.8)',
    'rgba(14, 165, 233, 0.8)',
    'rgba(249, 115, 22, 0.8)',
    'rgba(132, 204, 22, 0.8)',
    'rgba(251, 146, 60, 0.8)',
  ];

  const practicesByTypeData = {
    labels: Object.keys(stats.practices_by_type || {}),
    datasets: [
      {
        label: 'Pratiche',
        data: Object.values(stats.practices_by_type || {}),
        backgroundColor: typeColors,
        borderColor: typeColors.map(c => c.replace('0.8', '1')),
        borderWidth: 1,
      },
    ],
  };

  const doughnutOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'right' as const,
      },
      title: {
        display: false,
      },
    },
  };

  // Provvigioni mensili (Bar)
  const commissionData = {
    labels: stats.practices_by_month?.map(m => {
      const [year, month] = m.month.split('-');
      return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('it-IT', { month: 'short' });
    }) || [],
    datasets: [
      {
        label: 'Provvigioni (€)',
        data: stats.practices_by_month?.map(m => m.commission) || [],
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: 'rgb(34, 197, 94)',
        borderWidth: 1,
      },
    ],
  };

  const barOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Provvigioni (€)',
        },
      },
    },
  };

  // Top agenti (Bar orizzontale)
  const topAgentsData = {
    labels: stats.top_agents?.slice(0, 5).map(a => a.agent_name) || [],
    datasets: [
      {
        label: 'Premi (€)',
        data: stats.top_agents?.slice(0, 5).map(a => a.total_premium) || [],
        backgroundColor: 'rgba(99, 102, 241, 0.8)',
        borderColor: 'rgb(99, 102, 241)',
        borderWidth: 1,
      },
      {
        label: 'Provvigioni (€)',
        data: stats.top_agents?.slice(0, 5).map(a => a.total_commission) || [],
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: 'rgb(34, 197, 94)',
        borderWidth: 1,
      },
    ],
  };

  const horizontalBarOptions = {
    indexAxis: 'y' as const,
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: false,
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Importo (€)',
        },
      },
    },
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Trend Mensile */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Trend Mensile</CardTitle>
          <CardDescription>Andamento pratiche e premi nel tempo</CardDescription>
        </CardHeader>
        <CardContent>
          <Line options={monthlyTrendOptions} data={monthlyTrendData} />
        </CardContent>
      </Card>

      {/* Pratiche per Tipo */}
      <Card>
        <CardHeader>
          <CardTitle>Distribuzione per Tipo</CardTitle>
          <CardDescription>Pratiche raggruppate per tipologia</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <div className="w-full max-w-md">
            <Doughnut options={doughnutOptions} data={practicesByTypeData} />
          </div>
        </CardContent>
      </Card>

      {/* Provvigioni Mensili */}
      <Card>
        <CardHeader>
          <CardTitle>Provvigioni Mensili</CardTitle>
          <CardDescription>Andamento provvigioni per mese</CardDescription>
        </CardHeader>
        <CardContent>
          <Bar options={barOptions} data={commissionData} />
        </CardContent>
      </Card>

      {/* Top 5 Agenti */}
      {stats.top_agents && stats.top_agents.length > 0 && (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Top 5 Agenti</CardTitle>
            <CardDescription>Agenti con maggior produzione</CardDescription>
          </CardHeader>
          <CardContent>
            <Bar options={horizontalBarOptions} data={topAgentsData} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
