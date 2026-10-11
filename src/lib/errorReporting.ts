import { buildErrorEnvelope, envelopeHeaders, parseDsn } from "@/lib/sentryEnvelope";

/**
 * Errors of the browser app. They are always logged to the console; with VITE_SENTRY_DSN set they are also
 * sent to Sentry (one small request, no SDK). The same error is sent once, and at most a few a minute, so
 * a loop of failures cannot flood the service or the browser.
 */

const dsn = parseDsn(import.meta.env.VITE_SENTRY_DSN as string | undefined);
const MAX_PER_MINUTE = 5;
const seen = new Set<string>();
let windowStart = 0;
let sentInWindow = 0;
let currentUserId: string | null = null;

export const setErrorReportingUser = (userId: string | null) => {
  currentUserId = userId;
};

export function reportError(error: unknown, where = "app", extra?: Record<string, unknown>): void {
  console.error(`[${where}]`, error);
  if (!dsn) return;
  try {
    const key = `${where}|${error instanceof Error ? `${error.name}:${error.message}` : String(error)}`;
    if (seen.has(key)) return;
    const now = Date.now();
    if (now - windowStart > 60_000) {
      windowStart = now;
      sentInWindow = 0;
    }
    if (sentInWindow >= MAX_PER_MINUTE) return;
    seen.add(key);
    sentInWindow += 1;

    const { body } = buildErrorEnvelope(dsn, {
      error,
      where: `${where}:${window.location.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ":id")}`,
      platform: "javascript",
      environment: import.meta.env.MODE,
      release: (import.meta.env.VITE_RELEASE as string | undefined) ?? undefined,
      userId: currentUserId,
      tags: { language: document.documentElement.lang },
      extra,
    });
    void fetch(dsn.endpoint, { method: "POST", headers: envelopeHeaders(dsn), body, keepalive: true }).catch(() => undefined);
  } catch {
    // Reporting must never break the app.
  }
}

/** Errors nobody caught (outside React) and promises that failed without a handler. */
export function installGlobalErrorHandlers(): void {
  window.addEventListener("error", (event) => {
    // Resource load errors (images, fonts) have no error object: not worth a report.
    if (event.error) reportError(event.error, "window");
  });
  window.addEventListener("unhandledrejection", (event) => reportError(event.reason ?? new Error("Unhandled rejection"), "promise"));
}
