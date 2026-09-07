import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  FINANCIAL_STATUSES,
  prepareGetEndpoint,
  queryDate,
  queryInt,
  queryString,
  round2,
  tenantScopeFilter,
} from './_lib/partner-api.js';
import { PRACTICE_TYPE_LABELS } from '../src/lib/practiceSummary.js';

interface FinancialRow {
  id: string;
  practice_number: string;
  practice_type: string;
  status: string;
  financial_status: string | null;
  client_name: string;
  policy_number: string | null;
  premium_net: number | null;
  premium_gross: number | null;
  commission_percentage: number | null;
  commission_amount: number | null;
  payment_date: string | null;
  commission_received_date: string | null;
  created_at: string;
}

/**
 * GET /api/get-administration  (Amministrazione / Provvigioni)
 * Riepilogo finanziario delle pratiche del partner: premi, provvigioni, incassi
 * e stato di liquidazione, con elenco pratiche.
 *
 * Query: financial_status, from, to (created_at, YYYY-MM-DD), search,
 *        limit (default 100, max 500), offset
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const api = await prepareGetEndpoint(req, res, '/api/get-administration');
  if (!api) return;
  const { supabaseAdmin, ctx, respond } = api;

  const financialStatus = queryString(req, 'financial_status');
  const from = queryDate(req, 'from');
  const to = queryDate(req, 'to');
  const search = queryString(req, 'search');
  const limit = queryInt(req, 'limit', 100, 1, 500);
  const offset = queryInt(req, 'offset', 0, 0, 100_000);

  if (financialStatus && !(FINANCIAL_STATUSES as readonly string[]).includes(financialStatus)) {
    return res.status(422).json({ error: 'Valore financial_status non valido.', valid_values: FINANCIAL_STATUSES });
  }

  const select = 'id, practice_number, practice_type, status, financial_status, client_name, policy_number, premium_net, premium_gross, commission_percentage, commission_amount, payment_date, commission_received_date, created_at';

  // Base query (per il riepilogo consideriamo tutte le pratiche nel range, senza paginazione)
  const buildQuery = () => {
    let q = supabaseAdmin.from('practices').select(select).or(tenantScopeFilter(ctx));
    if (from) q = q.gte('created_at', `${from.slice(0, 10)}T00:00:00.000Z`);
    if (to) q = q.lte('created_at', `${to.slice(0, 10)}T23:59:59.999Z`);
    if (search) {
      const term = search.replace(/[%,()]/g, ' ').trim();
      if (term) q = q.or(`practice_number.ilike.%${term}%,client_name.ilike.%${term}%`);
    }
    return q;
  };

  const { data: allRows, error } = await buildQuery().order('created_at', { ascending: false }).limit(5000);
  if (error) {
    console.error('administration lookup failed:', error.message);
    return respond(503, { error: 'Servizio temporaneamente non disponibile.' }, { error_message: error.message });
  }

  const all = (allRows ?? []) as FinancialRow[];
  const sum = (rows: FinancialRow[], pick: (r: FinancialRow) => number | null) =>
    round2(rows.reduce((acc, r) => acc + (pick(r) ?? 0), 0));

  const nonIncassate = all.filter(r => (r.financial_status ?? 'non_incassata') === 'non_incassata');
  const incassate = all.filter(r => r.financial_status === 'incassata');
  const ricevute = all.filter(r => r.financial_status === 'provvigioni_ricevute');

  const summary = {
    total_practices: all.length,
    total_premium_gross: sum(all, r => r.premium_gross),
    total_premium_net: sum(all, r => r.premium_net),
    total_commission_amount: sum(all, r => r.commission_amount),
    non_incassate_count: nonIncassate.length,
    non_incassate_amount: sum(nonIncassate, r => r.premium_gross),
    incassate_count: incassate.length,
    incassate_amount: sum(incassate, r => r.premium_gross),
    incassate_commission: sum(incassate, r => r.commission_amount),
    provvigioni_ricevute_count: ricevute.length,
    provvigioni_ricevute_amount: sum(ricevute, r => r.commission_amount),
    commission_to_receive: sum([...nonIncassate, ...incassate], r => r.commission_amount),
  };

  const filtered = financialStatus
    ? all.filter(r => (r.financial_status ?? 'non_incassata') === financialStatus)
    : all;
  const page = filtered.slice(offset, offset + limit);

  return respond(200, {
    success: true,
    generated_at: new Date().toISOString(),
    filters: { financial_status: financialStatus, from, to, search },
    summary,
    total: filtered.length,
    limit,
    offset,
    count: page.length,
    practices: page.map(r => ({
      practice_id: r.id,
      practice_number: r.practice_number,
      practice_type: r.practice_type,
      practice_type_label: PRACTICE_TYPE_LABELS[r.practice_type] ?? r.practice_type,
      status: r.status,
      financial_status: r.financial_status ?? 'non_incassata',
      client_name: r.client_name,
      policy_number: r.policy_number,
      premium_net: r.premium_net,
      premium_gross: r.premium_gross,
      commission_percentage: r.commission_percentage,
      commission_amount: r.commission_amount,
      payment_date: r.payment_date,
      commission_received_date: r.commission_received_date,
      created_at: r.created_at,
    })),
  });
}
