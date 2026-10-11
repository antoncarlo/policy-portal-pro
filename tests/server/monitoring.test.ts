import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { checkEnv } from "../../api/_lib/env";
import { captureServerError } from "../../api/_lib/monitoring";
import { buildErrorEnvelope, envelopeHeaders, parseDsn } from "../../src/lib/sentryEnvelope";

const DSN = "https://abc123publickey@o4500.ingest.de.sentry.io/4511122233";

describe("Sentry envelope without the SDK", () => {
  it("parses a DSN into the envelope address and the public key", () => {
    assert.deepEqual(parseDsn(DSN), { endpoint: "https://o4500.ingest.de.sentry.io/api/4511122233/envelope/", publicKey: "abc123publickey", dsn: DSN });
    assert.equal(parseDsn("https://key@sentry.example.com/sub/path/7")?.endpoint, "https://sentry.example.com/sub/path/api/7/envelope/");
  });

  it("rejects what is not a DSN", () => {
    for (const bad of [undefined, null, "", "not a url", "http://key@host/1", "https://host/1", "https://key@host/abc", "https://key@host/"]) {
      assert.equal(parseDsn(bad as string), null, String(bad));
    }
  });

  it("builds a three-line envelope with the message, the stack and the context", () => {
    const dsn = parseDsn(DSN)!;
    const error = new TypeError("Cannot read properties of null");
    const { eventId, body } = buildErrorEnvelope(dsn, {
      error,
      where: "react:/practices/:id",
      platform: "javascript",
      environment: "production",
      release: "abc123def456",
      userId: "user-1",
      tags: { language: "it" },
      extra: { reference: "ZX81QJ" },
      now: new Date("2026-10-11T12:00:00Z"),
      eventId: "0123456789abcdef0123456789abcdef",
    });
    assert.equal(eventId, "0123456789abcdef0123456789abcdef");
    const [header, item, payload] = body.split("\n").map((line) => JSON.parse(line));
    assert.deepEqual(header, { event_id: eventId, sent_at: "2026-10-11T12:00:00.000Z", dsn: DSN });
    assert.deepEqual(item, { type: "event" });
    assert.equal(payload.level, "error");
    assert.equal(payload.platform, "javascript");
    assert.equal(payload.exception.values[0].type, "TypeError");
    assert.equal(payload.exception.values[0].value, "Cannot read properties of null");
    assert.equal(payload.user.id, "user-1");
    assert.equal(payload.release, "abc123def456");
    assert.equal(payload.extra.reference, "ZX81QJ");
    assert.match(payload.extra.stack, /TypeError/);
    assert.equal(payload.timestamp, Date.parse("2026-10-11T12:00:00Z") / 1000);
  });

  it("anything thrown is reported, not only Error objects; the auth header carries the public key", () => {
    const dsn = parseDsn(DSN)!;
    const { body } = buildErrorEnvelope(dsn, { error: "plain text failure", where: "x", platform: "node" });
    assert.equal(JSON.parse(body.split("\n")[2]).exception.values[0].value, "plain text failure");
    assert.match(envelopeHeaders(dsn)["X-Sentry-Auth"], /sentry_key=abc123publickey/);
    assert.equal(envelopeHeaders(dsn)["Content-Type"], "application/x-sentry-envelope");
  });
});

describe("server error reporting", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("without a DSN nothing is sent", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubEnv("SENTRY_DSN", "");
    await captureServerError(new Error("boom"), "portal-actions");
    assert.equal(fetchSpy.mock.calls.length, 0);
  });

  it("with a DSN one POST goes to the envelope address, with the function and the user", async () => {
    const fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubEnv("SENTRY_DSN", DSN);
    await captureServerError(new Error("database down"), "portal-actions", { userId: "u-9", tags: { action: "renew_practice" } });
    assert.equal(fetchSpy.mock.calls.length, 1);
    const [address, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    assert.equal(address, "https://o4500.ingest.de.sentry.io/api/4511122233/envelope/");
    assert.equal(init.method, "POST");
    const payload = JSON.parse(String(init.body).split("\n")[2]);
    assert.equal(payload.transaction, "portal-actions");
    assert.equal(payload.user.id, "u-9");
    assert.equal(payload.tags.action, "renew_practice");
    assert.equal(payload.platform, "node");
  });

  it("a monitoring failure never reaches the caller", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    vi.stubEnv("SENTRY_DSN", DSN);
    await assert.doesNotReject(() => captureServerError(new Error("boom"), "x"));
  });
});

describe("environment check", () => {
  const good = {
    VITE_SUPABASE_URL: "https://abc.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "x".repeat(40),
    GMAIL_USER: "portale@tecnomga.com",
    GMAIL_APP_PASSWORD: "abcd efgh ijkl mnop",
    CRON_SECRET: "c".repeat(24),
    WEBHOOK_SECRET: "w".repeat(24),
    WEBHOOK_DEFAULT_USER_ID: "a0000000-0000-4000-8000-000000000001",
    PORTAL_URL: "https://portale.tecnomga.com",
  };

  it("a complete configuration has no problem and reports the features that are on", () => {
    const report = checkEnv(good);
    assert.equal(report.ok, true);
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.warnings, []);
    assert.deepEqual(report.features, { mail: "gmail", deliveryReports: false, cron: true, partnerWebhook: true, viesConnector: false, monitoring: false });
  });

  it("the database address and the service key are blocking", () => {
    const report = checkEnv({});
    assert.equal(report.ok, false);
    assert.deepEqual(report.errors.map((issue) => issue.name).sort(), ["SUPABASE_SERVICE_ROLE_KEY", "VITE_SUPABASE_URL"]);
    assert.equal(checkEnv({ ...good, VITE_SUPABASE_URL: "http://insecure.example" }).ok, false);
    assert.equal(checkEnv({ ...good, SUPABASE_SERVICE_ROLE_KEY: "short" }).ok, false);
  });

  it("missing optional pieces are warnings that say what stops working", () => {
    const report = checkEnv({ VITE_SUPABASE_URL: good.VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: good.SUPABASE_SERVICE_ROLE_KEY });
    assert.equal(report.ok, true);
    const names = report.warnings.map((issue) => issue.name);
    assert.ok(names.includes("CRON_SECRET") && names.includes("WEBHOOK_SECRET") && names.some((name) => name.includes("RESEND_API_KEY")));
    assert.equal(report.features.mail, "none");
    assert.equal(report.features.cron, false);
  });

  it("malformed values are reported by name, never by value", () => {
    const report = checkEnv({
      ...good,
      CRON_SECRET: "short",
      WEBHOOK_DEFAULT_USER_ID: "not-a-uuid",
      PORTAL_URL: "http://portale.example",
      VIES_PORTALS: "{not json",
      ADMIN_NOTIFICATION_EMAILS: "ok@x.it, broken",
      SENTRY_DSN: "nope",
      EMAIL_FROM: "bad address",
    });
    const names = report.warnings.map((issue) => issue.name);
    for (const expected of ["CRON_SECRET", "WEBHOOK_DEFAULT_USER_ID", "PORTAL_URL", "VIES_PORTALS", "ADMIN_NOTIFICATION_EMAILS", "SENTRY_DSN", "EMAIL_FROM"]) {
      assert.ok(names.includes(expected), expected);
    }
    const text = JSON.stringify(report);
    for (const secret of ["not-a-uuid", "{not json", "bad address", "http://portale.example"]) assert.ok(!text.includes(secret), `leaked: ${secret}`);
  });

  it("Resend without the webhook secret warns that delivery reports are off; Gmail wins when both are set", () => {
    const resendOnly = { VITE_SUPABASE_URL: good.VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: good.SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY: "re_123", CRON_SECRET: good.CRON_SECRET, WEBHOOK_SECRET: good.WEBHOOK_SECRET, WEBHOOK_DEFAULT_USER_ID: good.WEBHOOK_DEFAULT_USER_ID };
    assert.ok(checkEnv(resendOnly).warnings.some((issue) => issue.name === "RESEND_WEBHOOK_SECRET"));
    assert.equal(checkEnv({ ...resendOnly, RESEND_WEBHOOK_SECRET: "whsec_abc" }).features.deliveryReports, true);
    assert.equal(checkEnv({ ...good, RESEND_API_KEY: "re_123" }).features.mail, "gmail");
  });
});
