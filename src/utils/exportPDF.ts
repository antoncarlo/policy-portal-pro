import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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

interface ExportOptions {
  startDate: string;
  endDate: string;
  period: string;
}

export async function exportToPDF(
  practices: PracticeDetail[],
  stats: ProductionStats | null,
  kpis: DashboardKPIs | null,
  options: ExportOptions
) {
  const doc = new jsPDF();
  let yPos = 20;

  // Header
  doc.setFontSize(20);
  doc.setTextColor(99, 102, 241); // Primary color
  doc.text('REPORT PRODUZIONE ASSICURATIVA', 105, yPos, { align: 'center' });
  
  yPos += 10;
  doc.setFontSize(14);
  doc.setTextColor(100, 100, 100);
  doc.text('Tecno Advance MGA', 105, yPos, { align: 'center' });
  
  yPos += 15;
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Periodo: ${options.startDate} - ${options.endDate}`, 20, yPos);
  doc.text(`Generato: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: it })}`, 150, yPos);
  
  yPos += 10;

  // KPI Section
  if (kpis) {
    doc.setFontSize(14);
    doc.setTextColor(99, 102, 241);
    doc.text('KPI Principali', 20, yPos);
    yPos += 8;

    const kpiData = [
      ['Pratiche Periodo Corrente', kpis.current_period_practices.toString(), formatGrowth(kpis.growth_practices)],
      ['Premi Totali', formatCurrency(kpis.current_period_premium), formatGrowth(kpis.growth_premium)],
      ['Provvigioni Totali', formatCurrency(kpis.current_period_commission), formatGrowth(kpis.growth_commission)],
      ['Premio Medio', formatCurrency(kpis.avg_premium), '-'],
      ['Tasso Conversione', `${kpis.conversion_rate.toFixed(1)}%`, '-'],
      ['Agenti Attivi', kpis.active_agents.toString(), '-'],
      ['Scadenze Imminenti (30gg)', kpis.expiring_soon.toString(), '-'],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [['Metrica', 'Valore', 'Crescita']],
      body: kpiData,
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241] },
      styles: { fontSize: 9 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Statistiche Generali
  if (stats) {
    // Check if new page is needed
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.setTextColor(99, 102, 241);
    doc.text('Statistiche Generali', 20, yPos);
    yPos += 8;

    const statsData = [
      ['Totale Pratiche', stats.total_practices.toString()],
      ['Premi Totali', formatCurrency(stats.total_premium)],
      ['Provvigioni Totali', formatCurrency(stats.total_commission)],
      ['Premio Medio', formatCurrency(stats.avg_premium)],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [['Descrizione', 'Valore']],
      body: statsData,
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241] },
      styles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 80, halign: 'right' },
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Pratiche per Tipo
    if (stats.practices_by_type && Object.keys(stats.practices_by_type).length > 0) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(12);
      doc.setTextColor(99, 102, 241);
      doc.text('Distribuzione per Tipo', 20, yPos);
      yPos += 6;

      const typeData = Object.entries(stats.practices_by_type).map(([type, count]) => [
        type,
        count.toString(),
        `${((count / stats.total_practices) * 100).toFixed(1)}%`,
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Tipo Polizza', 'Pratiche', '%']],
        body: typeData,
        theme: 'striped',
        headStyles: { fillColor: [99, 102, 241] },
        styles: { fontSize: 9 },
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // Trend Mensile
    if (stats.practices_by_month && stats.practices_by_month.length > 0) {
      if (yPos > 220) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(12);
      doc.setTextColor(99, 102, 241);
      doc.text('Trend Mensile', 20, yPos);
      yPos += 6;

      const monthData = stats.practices_by_month.map(m => [
        m.month,
        m.count.toString(),
        formatCurrency(m.premium),
        formatCurrency(m.commission),
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Mese', 'Pratiche', 'Premi', 'Provvigioni']],
        body: monthData,
        theme: 'striped',
        headStyles: { fillColor: [99, 102, 241] },
        styles: { fontSize: 8 },
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // Top Agenti
    if (stats.top_agents && stats.top_agents.length > 0) {
      if (yPos > 220) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(12);
      doc.setTextColor(99, 102, 241);
      doc.text('Top 10 Agenti', 20, yPos);
      yPos += 6;

      const agentsData = stats.top_agents.slice(0, 10).map((agent, index) => [
        (index + 1).toString(),
        agent.agent_name,
        agent.practices_count.toString(),
        formatCurrency(agent.total_premium),
        formatCurrency(agent.total_commission),
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['#', 'Agente', 'Pratiche', 'Premi', 'Provvigioni']],
        body: agentsData,
        theme: 'striped',
        headStyles: { fillColor: [99, 102, 241] },
        styles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 60 },
          2: { cellWidth: 25, halign: 'center' },
          3: { cellWidth: 40, halign: 'right' },
          4: { cellWidth: 40, halign: 'right' },
        },
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;
    }
  }

  // Dettaglio Pratiche (nuova pagina)
  if (practices && practices.length > 0) {
    doc.addPage();
    yPos = 20;

    doc.setFontSize(14);
    doc.setTextColor(99, 102, 241);
    doc.text('Dettaglio Pratiche', 20, yPos);
    yPos += 8;

    const practicesData = practices.map(p => [
      p.practice_number,
      p.practice_type,
      p.client_name,
      p.agent_name,
      formatCurrency(p.annual_premium),
      formatCurrency(p.agent_commission),
      p.status,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['N. Pratica', 'Tipo', 'Cliente', 'Agente', 'Premio', 'Provv.', 'Stato']],
      body: practicesData,
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241] },
      styles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 20 },
        2: { cellWidth: 35 },
        3: { cellWidth: 30 },
        4: { cellWidth: 25, halign: 'right' },
        5: { cellWidth: 25, halign: 'right' },
        6: { cellWidth: 20, halign: 'center' },
      },
    });
  }

  // Footer su tutte le pagine
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Pagina ${i} di ${pageCount}`,
      105,
      290,
      { align: 'center' }
    );
    doc.text(
      'Tecno Advance MGA - Report Riservato',
      105,
      285,
      { align: 'center' }
    );
  }

  // Salva il PDF
  const fileName = `Report_Produzione_${options.startDate.replace(/\//g, '-')}_${options.endDate.replace(/\//g, '-')}.pdf`;
  doc.save(fileName);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatGrowth(value: number): string {
  if (value === 0) return '-';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}
