import { useState, useEffect } from 'react';
import { supabase } from '../integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { 
  CalendarIcon, 
  Download, 
  TrendingUp, 
  TrendingDown,
  FileText,
  Users,
  DollarSign,
  Activity,
  AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import ProductionCharts from '../components/reports/ProductionCharts';
import { exportToExcel } from '../utils/exportExcel';
import { exportToPDF } from '../utils/exportPDF';


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

interface DashboardKPIs {
  current_period_practices: number;
  current_period_premium: number;
  current_period_commission: number;
  previous_period_practices: number;
  previous_period_premium: number;
  previous_period_commission: number;
  growth_practices: number;
  growth_premium: number;
  growth_commission: number;
  avg_premium: number;
  conversion_rate: number;
  active_agents: number;
  expiring_soon: number;
}

// Report Produzione - Dashboard Analytics e Export
export default function Reports() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setUserId(session.user.id);

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();

    if (roleData) {
      setUserRole(roleData.role);
    }
  };
  const [startDate, setStartDate] = useState<Date>(new Date(new Date().getFullYear(), 0, 1));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [stats, setStats] = useState<ProductionStats | null>(null);
  const [kpis, setKPIs] = useState<DashboardKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadData();
  }, [startDate, endDate, period]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Carica statistiche produzione
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_production_stats', {
          p_start_date: startDate.toISOString(),
          p_end_date: endDate.toISOString(),
          p_agent_id: userRole === 'agent' ? userId : null
        });

      if (statsError) throw statsError;
      if (statsData && statsData.length > 0) {
        setStats(statsData[0]);
      }

      // Carica KPI dashboard
      const { data: kpisData, error: kpisError } = await supabase
        .rpc('get_dashboard_kpis', {
          p_period: period
        });

      if (kpisError) throw kpisError;
      if (kpisData && kpisData.length > 0) {
        setKPIs(kpisData[0]);
      }
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setExporting(true);

      // Carica dettagli pratiche
      const { data, error } = await supabase
        .rpc('get_production_details', {
          p_start_date: startDate.toISOString(),
          p_end_date: endDate.toISOString(),
          p_agent_id: userRole === 'agent' ? userId : null
        });

      if (error) throw error;

      await exportToExcel(data, stats, {
        startDate: format(startDate, 'dd/MM/yyyy', { locale: it }),
        endDate: format(endDate, 'dd/MM/yyyy', { locale: it }),
        period
      });
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Errore durante l\'export Excel');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      setExporting(true);

      // Carica dettagli pratiche
      const { data, error } = await supabase
        .rpc('get_production_details', {
          p_start_date: startDate.toISOString(),
          p_end_date: endDate.toISOString(),
          p_agent_id: userRole === 'agent' ? userId : null
        });

      if (error) throw error;

      await exportToPDF(data, stats, kpis, {
        startDate: format(startDate, 'dd/MM/yyyy', { locale: it }),
        endDate: format(endDate, 'dd/MM/yyyy', { locale: it }),
        period
      });
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      alert('Errore durante l\'export PDF');
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Report Produzione</h1>
          <p className="text-muted-foreground">
            Analisi e statistiche delle pratiche assicurative
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleExportExcel}
            disabled={exporting}
          >
            <Download className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
          <Button 
            onClick={handleExportPDF}
            disabled={exporting}
          >
            <FileText className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Filtri */}
      <Card>
        <CardHeader>
          <CardTitle>Filtri Report</CardTitle>
          <CardDescription>Seleziona il periodo e i parametri per il report</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Periodo predefinito */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Periodo</label>
              <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Settimana</SelectItem>
                  <SelectItem value="month">Mese</SelectItem>
                  <SelectItem value="quarter">Trimestre</SelectItem>
                  <SelectItem value="year">Anno</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Data inizio */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Inizio</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !startDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'PPP', { locale: it }) : 'Seleziona data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Data fine */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Fine</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !endDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'PPP', { locale: it }) : 'Seleziona data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Pratiche */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pratiche</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.current_period_practices}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                {kpis.growth_practices >= 0 ? (
                  <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="mr-1 h-3 w-3 text-red-500" />
                )}
                <span className={kpis.growth_practices >= 0 ? 'text-green-500' : 'text-red-500'}>
                  {formatPercentage(kpis.growth_practices)}
                </span>
                <span className="ml-1">vs periodo precedente</span>
              </div>
            </CardContent>
          </Card>

          {/* Premi */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Premi Totali</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(kpis.current_period_premium)}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                {kpis.growth_premium >= 0 ? (
                  <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="mr-1 h-3 w-3 text-red-500" />
                )}
                <span className={kpis.growth_premium >= 0 ? 'text-green-500' : 'text-red-500'}>
                  {formatPercentage(kpis.growth_premium)}
                </span>
                <span className="ml-1">vs periodo precedente</span>
              </div>
            </CardContent>
          </Card>

          {/* Provvigioni */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Provvigioni</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(kpis.current_period_commission)}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                {kpis.growth_commission >= 0 ? (
                  <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="mr-1 h-3 w-3 text-red-500" />
                )}
                <span className={kpis.growth_commission >= 0 ? 'text-green-500' : 'text-red-500'}>
                  {formatPercentage(kpis.growth_commission)}
                </span>
                <span className="ml-1">vs periodo precedente</span>
              </div>
            </CardContent>
          </Card>

          {/* Scadenze Imminenti */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Scadenze (30gg)</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.expiring_soon}</div>
              <p className="text-xs text-muted-foreground">
                Pratiche in scadenza nei prossimi 30 giorni
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Grafici */}
      {stats && (
        <ProductionCharts stats={stats} />
      )}

      {/* Statistiche Dettagliate */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pratiche per Tipo */}
          <Card>
            <CardHeader>
              <CardTitle>Pratiche per Tipo</CardTitle>
              <CardDescription>Distribuzione per tipologia di polizza</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(stats.practices_by_type || {}).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{type}</span>
                    <span className="text-sm text-muted-foreground">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pratiche per Stato */}
          <Card>
            <CardHeader>
              <CardTitle>Pratiche per Stato</CardTitle>
              <CardDescription>Distribuzione per stato pratica</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(stats.practices_by_status || {}).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span className="text-sm font-medium capitalize">{status}</span>
                    <span className="text-sm text-muted-foreground">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Agenti */}
          {stats.top_agents && stats.top_agents.length > 0 && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Top Agenti</CardTitle>
                <CardDescription>Agenti con maggior produzione nel periodo</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats.top_agents.map((agent, index) => (
                    <div key={agent.agent_id} className="flex items-center justify-between border-b pb-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{agent.agent_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {agent.practices_count} pratiche
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{formatCurrency(agent.total_premium)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(agent.total_commission)} provvigioni
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
