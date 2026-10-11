import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Deadlines of the information requested on a practice ("integrazioni"). Every day:
 *   - two days before the term (or on it): a reminder to the owner and the reference agent
 *   - the day after the term: a notice to the same people and to the administrators
 * Each goes out once per request (the columns on practice_workflow remember it; a new request starts over).
 * The emails themselves are sent by the notification queue (info_reminder, info_overdue events), so they
 * follow each person's addresses and switches and are written in the email log.
 */

export const REMINDER_DAYS_BEFORE = 2;
const DAY_MS = 24 * 60 * 60 * 1000;
const LIMIT = 2000;

interface WorkflowDue {
  practice_id: string;
  info_due_date: string;
  info_reminded_at: string | null;
  info_overdue_notified_at: string | null;
}

export interface InfoDeadlineSummary {
  reminders: number;
  overdue: number;
}

/** Marks the notice as sent only if nobody else has: two runs at once never queue it twice. */
async function claim(supabase: SupabaseClient, practiceId: string, patch: Record<string, string>, unsetColumn: string): Promise<boolean> {
  const { data, error } = await supabase.from('practice_workflow').update(patch).eq('practice_id', practiceId).is(unsetColumn, null).select('practice_id');
  if (error) throw new Error(`practice_workflow: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

export async function processInfoDeadlines(supabase: SupabaseClient, now = new Date()): Promise<InfoDeadlineSummary> {
  const summary: InfoDeadlineSummary = { reminders: 0, overdue: 0 };
  const today = now.toISOString().slice(0, 10);
  const horizon = new Date(now.getTime() + REMINDER_DAYS_BEFORE * DAY_MS).toISOString().slice(0, 10);

  const { data: due, error } = await supabase
    .from('practice_workflow')
    .select('practice_id, info_due_date, info_reminded_at, info_overdue_notified_at')
    .not('info_due_date', 'is', null)
    .lte('info_due_date', horizon)
    .is('info_overdue_notified_at', null)
    .limit(LIMIT);
  if (error) throw new Error(`practice_workflow: ${error.message}`);
  const rows = (due ?? []) as WorkflowDue[];
  if (rows.length === 0) return summary;

  // Only practices still waiting for the documents.
  const { data: practices, error: practicesError } = await supabase
    .from('practices')
    .select('id')
    .in('id', rows.map((row) => row.practice_id))
    .eq('status', 'integrazioni');
  if (practicesError) throw new Error(`practices: ${practicesError.message}`);
  const waiting = new Set(((practices ?? []) as Array<{ id: string }>).map((row) => row.id));

  const events: Array<{ event_type: 'info_reminder' | 'info_overdue'; practice_id: string; actor_id: null; payload: Record<string, string> }> = [];
  const stamp = now.toISOString();
  for (const row of rows) {
    if (!waiting.has(row.practice_id)) continue;
    if (row.info_due_date < today) {
      const patch = { info_overdue_notified_at: stamp, ...(row.info_reminded_at ? {} : { info_reminded_at: stamp }) };
      if (await claim(supabase, row.practice_id, patch, 'info_overdue_notified_at')) {
        events.push({ event_type: 'info_overdue', practice_id: row.practice_id, actor_id: null, payload: { due_date: row.info_due_date } });
        summary.overdue += 1;
      }
    } else if (!row.info_reminded_at) {
      if (await claim(supabase, row.practice_id, { info_reminded_at: stamp }, 'info_reminded_at')) {
        events.push({ event_type: 'info_reminder', practice_id: row.practice_id, actor_id: null, payload: { due_date: row.info_due_date } });
        summary.reminders += 1;
      }
    }
  }
  if (events.length > 0) {
    const { error: insertError } = await supabase.from('notification_events').insert(events);
    if (insertError) throw new Error(`notification_events: ${insertError.message}`);
  }
  return summary;
}
