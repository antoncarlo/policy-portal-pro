import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  FINANCIAL_STATUSES,
  PRACTICE_STATUSES,
  daysBetween,
  prepareGetEndpoint,
  queryDate,
  queryInt,
  queryString,
  tenantScopeFilter,
  todayIsoDate,
} from './_lib/partner-api.js';
import { PRACTICE_TYPE_LABELS, buildPracticeSummary, extractNotesSections } from '../src/lib/practiceSummary.js';

const API_TYPE_TO_DB: Record<string, string> = { rc: 'responsabilita_civile' };

/**
 * GET /api/get-practices
 * Elenco pratiche del partner (dashboard), con filtri e paginazione.
 *
 * Query: status, financial_status, practice_type, from, to (created_at, YYYY-MM-DD),
 *        search (numero pratica / cliente), limit (default 50, max 200), offset,
 *        include_summary=true per includere il riepilogo completo di ogni pratica.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const api = await prepareGetEndpoint(req, res, '/api/get-practices');
  if (!api) return;
  const { supabaseAdmin, ctx, respond } = api;

  const status = queryString(req, 'status');
  const financialStatus = queryString(req, 'financial_status');
  const practiceTypeRaw = queryString(req, 'practice_type')?.toLowerCase().replace(/\s+/g, '_');
  const practiceType = practiceTypeRaw ? API_TYPE_TO_DB[practiceTypeRaw] ?? practiceTypeRaw : undefined;
  const from = queryDate(req, 'from');
  const to = queryDate(req, 'to');
  const search = queryString(req, 'search');
  const limit = queryInt(req, 'limit', 50, 1, 200);
  const offset = queryInt(req, 'offset', 0, 0, 100_000);
  const includeSummary = queryString(req, 'include_summary') === 'true';

  if (status && !(PRACTICE_STATUSES as readonly string[]).includes(status)) {
    return res.status(422).json({ error: 'Valore status non valido.', valid_values: PRACTICE_STATUSES });
  }
  if (financialStatus && !(FINANCIAL_STATUSES as readonly string[]).includes(financialStatus)) {
    return res.status(422).json({ error: 'Valore financial_status non valido.', valid_values: FINANCIAL_STATUSES });
  }

  const select = 'id, practice_number, practice_type, status, financial_status, client_name, client_email, client_phone, beneficiary, owner_tax_code, pet_microchip, policy_number, policy_start_date, policy_end_date, premium_net, premium_taxable, premium_taxes, premium_gross, commission_percentage, commission_amount, payment_date, commission_received_date, notes, api_key_id, user_id, created_at, updated_at';

  let query = supabaseAdmin
    .from('practices')
    .select(select, { count: 'exact' })
    .or(tenantScopeFilter(ctx))
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);
  if (financialStatus) query = query.eq('financial_status', financialStatus);
  if (practiceType) query = query.eq('practice_type', practiceType);
  if (from) query = query.gte('created_at', `${from.slice(0, 10)}T00:00:00.000Z`);
  if (to) query = query.lte('created_at', `${to.slice(0, 10)}T23:59:59.999Z`);
  if (search) {
    const term = search.replace(/[%,()]/g, ' ').trim();
    if (term) query = query.or(`practice_number.ilike.%${term}%,client_name.ilike.%${term}%,client_email.ilike.%${term}%`);
  }

  const { data: practices, error, count } = await query;
  if (error) {
    console.error('practices list failed:', error.message);
    return respond(503, { error: 'Servizio temporaneamente non disponibile.' }, { error_message: error.message });
  }

  const rows = practices ?? [];

  // Conteggio documenti per pratica (una sola query)
  const docCounts: Record<string, number> = {};
  if (rows.length > 0) {
    const { data: docs } = await supabaseAdmin
      .from('practice_documents')
      .select('practice_id')
      .in('practice_id', rows.map(p => p.id));
    for (const d of docs ?? []) {
      docCounts[d.practice_id] = (docCounts[d.practice_id] ?? 0) + 1;
    }
  }

  const today = todayIsoDate();

  const items = rows.map(p => {
    const { textualNotes, specificFields } = extractNotesSections(p.notes);
    const base = {
      practice_id: p.id,
      practice_number: p.practice_number,
      practice_type: p.practice_type,
      practice_type_label: PRACTICE_TYPE_LABELS[p.practice_type] ?? p.practice_type,
      status: p.status,
      financial_status: p.financial_status,
      client: {
        name: p.client_name,
        email: p.client_email,
        phone: p.client_phone,
        beneficiary: p.beneficiary,
        tax_code: p.owner_tax_code,
      },
      policy: {
        number: p.policy_number,
        start_date: p.policy_start_date,
        end_date: p.policy_end_date,
        days_until_expiry: p.policy_end_date ? daysBetween(today, p.policy_end_date) : null,
      },
      quote: (p.premium_gross || p.premium_net) ? {
        premium_net: p.premium_net,
        premium_taxable: p.premium_taxable,
        premium_taxes: p.premium_taxes,
        premium_gross: p.premium_gross,
        commission_percentage: p.commission_percentage,
        commission_amount: p.commission_amount,
      } : null,
      payment_date: p.payment_date,
      commission_received_date: p.commission_received_date,
      pet_microchip: p.pet_microchip,
      notes: textualNotes || null,
      specific_fields: specificFields,
      documents_count: docCounts[p.id] ?? 0,
      created_at: p.created_at,
      updated_at: p.updated_at,
    };

    if (!includeSummary) return base;

    return {
      ...base,
      summary: buildPracticeSummary({
        practice_type: p.practice_type,
        client_name: p.client_name,
        client_email: p.client_email,
        client_phone: p.client_phone,
        beneficiary: p.beneficiary,
        owner_tax_code: p.owner_tax_code,
        pet_microchip: p.pet_microchip,
        policy_number: p.policy_number,
        policy_start_date: p.policy_start_date,
        policy_end_date: p.policy_end_date,
        premium_net: p.premium_net,
        premium_taxable: p.premium_taxable,
        premium_taxes: p.premium_taxes,
        premium_gross: p.premium_gross,
        commission_percentage: p.commission_percentage,
        commission_amount: p.commission_amount,
        specific_fields: specificFields,
      }),
    };
  });

  return respond(200, {
    success: true,
    total: count ?? items.length,
    limit,
    offset,
    count: items.length,
    filters: { status, financial_status: financialStatus, practice_type: practiceType, from, to, search },
    practices: items,
  });
}
