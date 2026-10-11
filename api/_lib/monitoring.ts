import { buildErrorEnvelope, envelopeHeaders, parseDsn } from '../../src/lib/sentryEnvelope.js';

/**
 * Error reporting from the functions. With SENTRY_DSN set, an unexpected error is sent to Sentry (no SDK:
 * one small POST); without it nothing happens beyond the console log the caller already writes. It never
 * throws and never waits more than a few seconds, so a monitoring problem cannot break a request.
 */

const MAX_PER_MINUTE = 20;
let windowStart = 0;
let sent = 0;

export const monitoringEnabled = () => parseDsn(process.env.SENTRY_DSN) !== null;

export async function captureServerError(error: unknown, where: string, context: { userId?: string | null; tags?: Record<string, string>; extra?: Record<string, unknown> } = {}): Promise<void> {
  try {
    const dsn = parseDsn(process.env.SENTRY_DSN);
    if (!dsn) return;
    const now = Date.now();
    if (now - windowStart > 60_000) {
      windowStart = now;
      sent = 0;
    }
    if (sent >= MAX_PER_MINUTE) return;
    sent += 1;

    const { body } = buildErrorEnvelope(dsn, {
      error,
      where,
      platform: 'node',
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'production',
      release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12),
      userId: context.userId ?? null,
      tags: { runtime: 'vercel-function', region: process.env.VERCEL_REGION ?? 'local', ...context.tags },
      extra: context.extra,
    });
    await fetch(dsn.endpoint, { method: 'POST', headers: envelopeHeaders(dsn), body, signal: AbortSignal.timeout(4000) });
  } catch (reportError) {
    console.error('monitoring: report not sent:', reportError instanceof Error ? reportError.message : reportError);
  }
}
