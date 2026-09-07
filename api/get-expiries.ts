import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  PRACTICE_STATUSES,
  addDaysIso,
  daysBetween,
  prepareGetEndpoint,
  queryBool,
  queryInt,
  queryString,
  tenantScopeFilter,
  todayIsoDate,
} from './_lib/partner-api.js';
import { PRACTICE_TYPE_LABELS } from '../src/lib/practiceSummary.js';

const API_TYPE_TO_DB: Record<string, string> = { rc: 'responsabilita_civile' };

type Urgency = 'expired' | 'urgent' | 'soon' | 'upcoming';

function getUrgency(days: number): Urgency {
  if (days < 0) return 'expired';
  if (days <= 7) return 'urgent';
  if (days <= 30) return 'soon';
  return 'upcoming';
}

/**
 * GET /api/get-expiries  (Scadenzario)
 * Polizze del partner in scadenza nei prossimi N giorni, con stato delle
 * notifiche di scadenza (90/60/30/7 giorni).
 *
 * Query: days_ahead (default 90, max 365), practice_type, status,
 *        include_expired=true per includere anche le polizze gia' scadute (ultimi 90 giorni).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const api = await prepareGetEndpoint(req, res, '/api/get-expiries');
  if (!api) return;
  const { supabaseAdmin, ctx, respond } = api;

  const daysAhead = queryInt(req, 'days_ahead', 90, 1, 365);
  const includeExpired = queryBool(req, 'include_expired', false);
  const status = queryString(req, 'status');
  const practiceTypeRaw = queryString(req, 'practice_type')?.toLowerCase().replace(/\s+/g, '_');
  const practiceType = practiceTypeRaw ? API_TYPE_TO_DB[practiceTypeRaw] ?? practiceTypeRaw : undefined;

  if (status && !(PRACTICE_STATUSES as readonly string[]).includes(status)) {
    return res.status(422).json({ error: 'Valore status non valido.', valid_values: PRACTICE_STATUSES });
  }

  const today = todayIsoDate();
  const rangeStart = includeExpired ? addDaysIso(-90) : today;
  const rangeEnd = addDaysIso(daysAhead);

  let query = supabaseAdmin
    .from('practices')
    .select('id, practice_number, practice_type, status, financial_status, client_name, client_email, client_phone, policy_number, policy_start_date, policy_end_date, premium_gross, user_id, api_key_id')
    .or(tenantScopeFilter(ctx))
    .not('policy_end_date', 'is', null)
    .gte('policy_end_date', rangeStart)
    .lte('policy_end_date', rangeEnd)
    .order('policy_end_date', { ascending: true })
    .limit(1000);

  if (status) query = query.eq('status', status);
  else query = query.neq('status', 'rifiutata');
  if (practiceType) query = query.eq('practice_type', practiceType);

  const { data: practices, error } = await query;
  if (error) {
    console.error('expiries lookup failed:', error.message);
    return respond(503, { error: 'Servizio temporaneamente non disponibile.' }, { error_message: error.message });
  }

  const rows = practices ?? [];

  // Stato notifiche di scadenza
  const notificationsByPractice: Record<string, Record<string, boolean>> = {};
  if (rows.length > 0) {
    const { data: notifications } = await supabaseAdmin
      .from('expiry_notifications')
      .select('practice_id, notification_type, sent, email_sent')
      .in('practice_id', rows.map(p => p.id));
    for (const n of notifications ?? []) {
      const entry = notificationsByPractice[n.practice_id] ?? {};
      entry[n.notification_type] = Boolean(n.sent || n.email_sent);
      notificationsByPractice[n.practice_id] = entry;
    }
  }

  const expiries = rows.map(p => {
    const days = daysBetween(today, p.policy_end_date as string);
    const n = notificationsByPractice[p.id] ?? {};
    return {
      practice_id: p.id,
      practice_number: p.practice_number,
      practice_type: p.practice_type,
      practice_type_label: PRACTICE_TYPE_LABELS[p.practice_type] ?? p.practice_type,
      status: p.status,
      financial_status: p.financial_status,
      client: { name: p.client_name, email: p.client_email, phone: p.client_phone },
      policy_number: p.policy_number,
      policy_start_date: p.policy_start_date,
      policy_end_date: p.policy_end_date,
      premium_gross: p.premium_gross,
      days_until_expiry: days,
      urgency: getUrgency(days),
      notifications: {
        '90_days': n['90_days'] ?? false,
        '60_days': n['60_days'] ?? false,
        '30_days': n['30_days'] ?? false,
        '7_days': n['7_days'] ?? false,
      },
    };
  });

  const summary = {
    expired: expiries.filter(e => e.urgency === 'expired').length,
    urgent: expiries.filter(e => e.urgency === 'urgent').length,
    soon: expiries.filter(e => e.urgency === 'soon').length,
    upcoming: expiries.filter(e => e.urgency === 'upcoming').length,
    total: expiries.length,
  };

  return respond(200, {
    success: true,
    generated_at: new Date().toISOString(),
    reference_date: today,
    days_ahead: daysAhead,
    include_expired: includeExpired,
    summary,
    expiries,
  });
}
