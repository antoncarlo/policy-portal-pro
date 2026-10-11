import type { SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest } from '@vercel/node';

/**
 * Application events in the audit log (table audit_log, source "app"): what the database triggers cannot
 * see, such as who created, disabled or deleted a user, who reset a second factor, who signed in. The
 * changes to the data themselves are recorded by the database (migration 20261017).
 *
 * Writing the line never makes the operation fail: a problem is logged and the operation goes on.
 */

export interface ActivityInput {
  /** The signed-in person who acted; null for the system. */
  actorId: string | null;
  action: string;
  /** What the action was about: a table and the id of the row, or just a label. */
  target?: { table?: string; id?: string | null };
  details?: Record<string, unknown>;
  req?: Pick<VercelRequest, 'headers'>;
}

const header = (req: ActivityInput['req'], name: string): string | undefined => {
  const value = req?.headers?.[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

/** The caller's address: the platform's own header first, then the first hop of x-forwarded-for. */
export function clientIp(req: ActivityInput['req']): string | null {
  const direct = header(req, 'x-vercel-forwarded-for') ?? header(req, 'x-real-ip');
  if (direct) return direct.split(',')[0].trim().slice(0, 64);
  const forwarded = header(req, 'x-forwarded-for');
  return forwarded ? forwarded.split(',')[0].trim().slice(0, 64) : null;
}

export async function logActivity(supabase: SupabaseClient, input: ActivityInput): Promise<void> {
  try {
    let role: string | null = input.actorId ? null : 'system';
    if (input.actorId) {
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', input.actorId).limit(1).maybeSingle();
      role = (data?.role as string | undefined) ?? null;
    }
    const { error } = await supabase.from('audit_log').insert({
      actor_id: input.actorId,
      actor_role: role,
      source: 'app',
      table_name: input.target?.table ?? 'app',
      row_id: input.target?.id ?? null,
      action: input.action,
      details: input.details ?? null,
      ip: clientIp(input.req),
      user_agent: header(input.req, 'user-agent')?.slice(0, 300) ?? null,
    });
    if (error) console.error('audit: riga non scritta:', error.message);
  } catch (error) {
    console.error('audit:', error instanceof Error ? error.message : error);
  }
}
