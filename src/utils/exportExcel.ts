import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface PracticeDetail {
  practice_number: string;
  practice_type: string;
  status: string;
  client_name: string;
  client_email: string;
  agent_name: string;
  company_name: string;
  annual_premium: number;
  agent_commission: number;
  policy_start_date: string;
  policy_end_date: string;
  created_at: string;
  payment_frequency: string;
  notes: string;
}

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

interface ExportOptions {
  startDate: string;
  endDate: string;
  period: string;
}

export async function exportToExcel(
  practices: PracticeDetail[],
  stats: ProductionStats | null,
  options: ExportOptions
) {
  // Crea un nuovo workbook
  const wb = XLSX.utils.book_new();

  // Sheet 1: Riepilogo
  const summaryData = [
    ['REPORT PRODUZIONE ASSICURATIVA'],
    ['Tecno Advance MGA'],
    [''],
    ['Periodo', `${options.startDate} - ${options.endDate}`],
    ['Data Generazione', format(new Date(), 'dd/MM/yyyy HH:mm', { locale: it })],
    [''],
    ['STATISTICHE GENERALI'],
    ['Totale Pratiche', stats?.total_practices || 0],
    ['Premi Totali', formatCurrency(stats?.total_premium || 0)],
    ['Provvigioni Totali', formatCurrency(stats?.total_commission || 0)],
    ['Premio Medio', formatCurrency(stats?.avg_premium || 0)],
  ];

  const ws_summary = XLSX.utils.aoa_to_sheet(summaryData);
  
  // Stile per il titolo
  ws_summary['!cols'] = [{ wch: 25 }, { wch: 20 }];
  
  XLSX.utils.book_append_sheet(wb, ws_summary, 'Riepilogo');

  // Sheet 2: Dettaglio Pratiche
  const practicesData = practices.map(p => ({
    'Numero Pratica': p.practice_number,
    'Tipo': p.practice_type,
    'Stato': p.status,
    'Cliente': p.client_name,
    'Email Cliente': p.client_email,
    'Agente': p.agent_name,
    'Compagnia': p.company_name,
    'Premio Annuo': p.annual_premium,
    'Provvigione': p.agent_commission,
    'Data Inizio': p.policy_start_date ? format(new Date(p.policy_start_date), 'dd/MM/yyyy') : '',
    'Data Fine': p.policy_end_date ? format(new Date(p.policy_end_date), 'dd/MM/yyyy') : '',
    'Data Creazione': format(new Date(p.created_at), 'dd/MM/yyyy'),
    'Frequenza Pagamento': p.payment_frequency,
    'Note': p.notes || '',
  }));

  const ws_practices = XLSX.utils.json_to_sheet(practicesData);
  
  // Auto-size columns
  const max_width = practicesData.reduce((w, r) => Math.max(w, Object.keys(r).length), 10);
  ws_practices['!cols'] = Array(max_width).fill({ wch: 15 });
  
  XLSX.utils.book_append_sheet(wb, ws_practices, 'Dettaglio Pratiche');

  // Sheet 3: Pratiche per Tipo
  if (stats?.practices_by_type) {
    const typeData = Object.entries(stats.practices_by_type).map(([type, count]) => ({
      'Tipo Polizza': type,
      'Numero Pratiche': count,
      'Percentuale': `${((count / stats.total_practices) * 100).toFixed(1)}%`,
    }));

    const ws_type = XLSX.utils.json_to_sheet(typeData);
    ws_type['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws_type, 'Per Tipo');
  }

  // Sheet 4: Pratiche per Stato
  if (stats?.practices_by_status) {
    const statusData = Object.entries(stats.practices_by_status).map(([status, count]) => ({
      'Stato': status,
      'Numero Pratiche': count,
      'Percentuale': `${((count / stats.total_practices) * 100).toFixed(1)}%`,
    }));

    const ws_status = XLSX.utils.json_to_sheet(statusData);
    ws_status['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws_status, 'Per Stato');
  }

  // Sheet 5: Trend Mensile
  if (stats?.practices_by_month) {
    const monthData = stats.practices_by_month.map(m => ({
      'Mese': m.month,
      'Pratiche': m.count,
      'Premi': m.premium,
      'Provvigioni': m.commission,
      'Premio Medio': m.count > 0 ? (m.premium / m.count).toFixed(2) : 0,
    }));

    const ws_month = XLSX.utils.json_to_sheet(monthData);
    ws_month['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws_month, 'Trend Mensile');
  }

  // Sheet 6: Top Agenti
  if (stats?.top_agents && stats.top_agents.length > 0) {
    const agentsData = stats.top_agents.map((agent, index) => ({
      'Posizione': index + 1,
      'Agente': agent.agent_name,
      'Pratiche': agent.practices_count,
      'Premi Totali': agent.total_premium,
      'Provvigioni': agent.total_commission,
      'Premio Medio': (agent.total_premium / agent.practices_count).toFixed(2),
    }));

    const ws_agents = XLSX.utils.json_to_sheet(agentsData);
    ws_agents['!cols'] = [{ wch: 10 }, { wch: 25 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws_agents, 'Top Agenti');
  }

  // Genera il file
  const fileName = `Report_Produzione_${options.startDate.replace(/\//g, '-')}_${options.endDate.replace(/\//g, '-')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR'
  }).format(value);
}
