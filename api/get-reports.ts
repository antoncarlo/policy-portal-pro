import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  addDaysIso,
  prepareGetEndpoint,
  queryDate,
  queryString,
  round2,
  tenantScopeFilter,
  todayIsoDate,
} from './_lib/partner-api.js';
import { PRACTICE_TYPE_LABELS } from '../src/lib/practiceSummary.js';

type Period = 'week' | 'month' | 'quarter' | 'year';

interface PracticeRow {
  id: string;
  practice_type: string;
  status: string;
  financial_status: string | null;
  premium_net: number | null;
  premium_gross: number | null;
  commission_amount: number | null;
  policy_end_date: string | null;
  created_at: string;
}

interface Aggregate {
  practices: number;
  premium_gross: number;
  premium_net: number;
  commission: number;
}

function aggregate(rows: PracticeRow[]): Aggregate {
  return rows.reduce<Aggregate>((acc, r) => ({
    practices: acc.practices + 1,
    premium_gross: round2(acc.premium_gross + (r.premium_gross ?? 0)),
    premium_net: round2(acc.premium_net + (r.premium_net ?? 0)),
    commission: round2(acc.commission + (r.commission_amount ?? 0)),
  }), { practices: 0, premium_gross: 0, premium_net: 0, commission: 0 });
}

function growth(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return round2(((current - previous) / previous) * 100);
}

function periodBounds(period: Period): { currentStart: Date; previousStart: Date } {
  const now = new Date();
  const currentStart = new Date(now);
  currentStart.setHours(0, 0, 0, 0);
  const previousStart = new Date(currentStart);

  switch (period) {
    case 'week': {
      const day = (currentStart.getDay() + 6) % 7; // lunedi' = 0
      currentStart.setDate(currentStart.getDate() - day);
      previousStart.setTime(currentStart.getTime());
      previousStart.setDate(previousStart.getDate() - 7);
      break;
    }
    case 'quarter': {
      currentStart.setMonth(Math.floor(currentStart.getMonth() / 3) * 3, 1);
      previousStart.setTime(currentStart.getTime());
      previousStart.setMonth(previousStart.getMonth() - 3);
      break;
    }
    case 'year': {
      currentStart.setMonth(0, 1);
      previousStart.setTime(currentStart.getTime());
      previousStart.setFullYear(previousStart.getFullYear() - 1);
      break;
    }
    default: {
      currentStart.setDate(1);
      previousStart.setTime(currentStart.getTime());
      previousStart.setMonth(previousStart.getMonth() - 1);
    }
  }
  return { currentStart, previousStart };
}

/**
 * GET /api/get-reports  (Report Produzione)
 * Statistiche di produzione delle pratiche del partner: totali, distribuzione
 * per tipologia/stato, andamento mensile e KPI con confronto periodo precedente.
 *
 * Query: start_date, end_date (YYYY-MM-DD; default anno corrente), period (week|month|quarter|year, default month)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const api = await prepareGetEndpoint(req, res, '/api/get-reports');
  if (!api) return;
  const { supabaseAdmin, ctx, respond } = api;

  const today = todayIsoDate();
  const startDate = queryDate(req, 'start_date')?.slice(0, 10) ?? `${today.slice(0, 4)}-01-01`;
  const endDate = queryDate(req, 'end_date')?.slice(0, 10) ?? today;
  const periodRaw = queryString(req, 'period') ?? 'month';
  if (!['week', 'month', 'quarter', 'year'].includes(periodRaw)) {
    return res.status(422).json({ error: 'Valore period non valido.', valid_values: ['week', 'month', 'quarter', 'year'] });
  }
  const period = periodRaw as Period;
  if (startDate > endDate) {
    return res.status(422).json({ error: 'start_date deve essere precedente o uguale a end_date.' });
  }

  const select = 'id, practice_type, status, financial_status, premium_net, premium_gross, commission_amount, policy_end_date, created_at';

  // Estraiamo un intervallo ampio (dall'inizio del periodo precedente dei KPI o dallo start_date)
  const { previousStart, currentStart } = periodBounds(period);
  const fetchStart = new Date(Math.min(previousStart.getTime(), new Date(startDate).getTime()));

  const { data, error } = await supabaseAdmin
    .from('practices')
    .select(select)
    .or(tenantScopeFilter(ctx))
    .gte('created_at', fetchStart.toISOString())
    .order('created_at', { ascending: true })
    .limit(5000);

  if (error) {
    console.error('reports lookup failed:', error.message);
    return respond(503, { error: 'Servizio temporaneamente non disponibile.' }, { error_message: error.message });
  }

  const all = (data ?? []) as PracticeRow[];
  const rangeStartIso = `${startDate}T00:00:00.000Z`;
  const rangeEndIso = `${endDate}T23:59:59.999Z`;
  const inRange = all.filter(r => r.created_at >= rangeStartIso && r.created_at <= rangeEndIso);

  // Totali
  const totals = aggregate(inRange);
  const avgPremium = totals.practices > 0 ? round2(totals.premium_gross / totals.practices) : 0;

  // Distribuzioni
  const byType: Record<string, Aggregate & { label: string }> = {};
  const byStatus: Record<string, number> = {};
  const byFinancialStatus: Record<string, number> = {};
  const byMonthMap: Record<string, PracticeRow[]> = {};

  for (const r of inRange) {
    const typeEntry = byType[r.practice_type] ?? { label: PRACTICE_TYPE_LABELS[r.practice_type] ?? r.practice_type, practices: 0, premium_gross: 0, premium_net: 0, commission: 0 };
    typeEntry.practices += 1;
    typeEntry.premium_gross = round2(typeEntry.premium_gross + (r.premium_gross ?? 0));
    typeEntry.premium_net = round2(typeEntry.premium_net + (r.premium_net ?? 0));
    typeEntry.commission = round2(typeEntry.commission + (r.commission_amount ?? 0));
    byType[r.practice_type] = typeEntry;

    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    const fs = r.financial_status ?? 'non_incassata';
    byFinancialStatus[fs] = (byFinancialStatus[fs] ?? 0) + 1;

    const month = r.created_at.slice(0, 7);
    (byMonthMap[month] ??= []).push(r);
  }

  const byMonth = Object.keys(byMonthMap)
    .sort()
    .map(month => ({ month, ...aggregate(byMonthMap[month]) }));

  // KPI periodo corrente vs precedente
  const currentRows = all.filter(r => new Date(r.created_at) >= currentStart);
  const previousRows = all.filter(r => {
    const d = new Date(r.created_at);
    return d >= previousStart && d < currentStart;
  });
  const current = aggregate(currentRows);
  const previous = aggregate(previousRows);

  const in30Days = addDaysIso(30);
  const expiringSoon = all.filter(r =>
    r.policy_end_date && r.policy_end_date >= today && r.policy_end_date <= in30Days && r.status !== 'rifiutata'
  ).length;

  const closed = inRange.filter(r => ['approvata', 'completata', 'rifiutata'].includes(r.status)).length;
  const won = inRange.filter(r => ['approvata', 'completata'].includes(r.status)).length;

  return respond(200, {
    success: true,
    generated_at: new Date().toISOString(),
    range: { start_date: startDate, end_date: endDate },
    totals: {
      total_practices: totals.practices,
      total_premium_gross: totals.premium_gross,
      total_premium_net: totals.premium_net,
      total_commission: totals.commission,
      avg_premium: avgPremium,
      conversion_rate: closed > 0 ? round2((won / closed) * 100) : null,
    },
    practices_by_type: byType,
    practices_by_status: byStatus,
    practices_by_financial_status: byFinancialStatus,
    practices_by_month: byMonth,
    kpis: {
      period,
      current_period_start: currentStart.toISOString().slice(0, 10),
      previous_period_start: previousStart.toISOString().slice(0, 10),
      current_period_practices: current.practices,
      current_period_premium: current.premium_gross,
      current_period_commission: current.commission,
      previous_period_practices: previous.practices,
      previous_period_premium: previous.premium_gross,
      previous_period_commission: previous.commission,
      growth_practices: growth(current.practices, previous.practices),
      growth_premium: growth(current.premium_gross, previous.premium_gross),
      growth_commission: growth(current.commission, previous.commission),
      expiring_soon: expiringSoon,
    },
  });
}
