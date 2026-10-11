/**
 * A minimal Sentry client without the SDK: it builds the "envelope" of one error event and the address to
 * send it to. Browser and server functions share it. Without a DSN nothing is built, nothing is sent.
 * Sentry shows the message, the raw stack (in "additional data"), the page or function, the user id and the release.
 */

export interface ParsedDsn {
  /** Where to POST the envelope. */
  endpoint: string;
  publicKey: string;
  dsn: string;
}

export function parseDsn(dsn: string | undefined | null): ParsedDsn | null {
  if (!dsn) return null;
  try {
    const url = new URL(dsn.trim());
    const projectId = url.pathname.replace(/^\/+|\/+$/g, '').split('/').pop();
    if (url.protocol !== 'https:' || !url.username || !projectId || !/^\d+$/.test(projectId)) return null;
    const prefix = url.pathname.replace(/^\/+|\/+$/g, '').split('/').slice(0, -1).join('/');
    return {
      endpoint: `${url.protocol}//${url.host}${prefix ? `/${prefix}` : ''}/api/${projectId}/envelope/`,
      publicKey: url.username,
      dsn: dsn.trim(),
    };
  } catch {
    return null;
  }
}

export interface ErrorEventInput {
  error: unknown;
  /** Where it happened: a page path, a function name. */
  where: string;
  platform: 'javascript' | 'node';
  environment?: string;
  release?: string;
  userId?: string | null;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  now?: Date;
  eventId?: string;
}

const newEventId = () => {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export function buildErrorEnvelope(dsn: ParsedDsn, input: ErrorEventInput): { eventId: string; body: string } {
  const eventId = input.eventId ?? newEventId();
  const now = input.now ?? new Date();
  const error = input.error instanceof Error ? input.error : new Error(typeof input.error === 'string' ? input.error : JSON.stringify(input.error));
  const event = {
    event_id: eventId,
    timestamp: now.getTime() / 1000,
    platform: input.platform,
    level: 'error',
    logger: input.where,
    environment: input.environment,
    release: input.release,
    transaction: input.where,
    user: input.userId ? { id: input.userId } : undefined,
    tags: input.tags,
    exception: { values: [{ type: error.name || 'Error', value: clip(error.message || String(error), 1000) }] },
    extra: { ...input.extra, stack: error.stack ? clip(error.stack, 6000) : undefined },
  };
  const header = JSON.stringify({ event_id: eventId, sent_at: now.toISOString(), dsn: dsn.dsn });
  const item = JSON.stringify({ type: 'event' });
  return { eventId, body: `${header}\n${item}\n${JSON.stringify(event)}` };
}

/** Headers for the POST: the public key travels in X-Sentry-Auth. */
export function envelopeHeaders(dsn: ParsedDsn): Record<string, string> {
  return {
    'Content-Type': 'application/x-sentry-envelope',
    'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=portal-minimal/1.0, sentry_key=${dsn.publicKey}`,
  };
}
