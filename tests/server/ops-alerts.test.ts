import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { FakeDb } from "../helpers/fakedb";

const mail = vi.hoisted(() => ({
  provider: "gmail" as "gmail" | "none",
  sent: [] as Array<{ to: string | string[]; subject: string; html: string }>,
  next: { success: true, id: "m1" } as { success: boolean; id?: string; error?: string },
}));

vi.mock("../../api/_lib/mailer", async (original) => {
  const actual = await original<typeof import("../../api/_lib/mailer")>();
  return {
    ...actual,
    getMailProvider: () => mail.provider,
    sendMail: async (message: { to: string | string[]; subject: string; html: string }) => {
      mail.sent.push(message);
      return mail.next;
    },
  };
});

import { alertCronFailure, alertFailedDeliveries, sendDailyDigest } from "../../api/_lib/ops-alerts";
import { adminRecipients } from "../../api/_lib/admin-alerts";

const sb = (db: FakeDb) => db as never;

function world() {
  const db = new FakeDb();
  db.seed("user_roles", { user_id: "admin-it", role: "admin" });
  db.seed("user_roles", { user_id: "admin-en", role: "admin" });
  db.seed("user_roles", { user_id: "agent-1", role: "agente" });
  db.seed("profiles", { id: "admin-it", email: "mario@tecnomga.com", language: "it" });
  db.seed("profiles", { id: "admin-en", email: "john@tecnomga.com", language: "en" });
  db.seed("profiles", { id: "agent-1", email: "agente@x.it", language: "it" });
  db.seed("user_notification_settings", { user_id: "admin-en", notification_emails: ["ops@tecnomga.com", "john@tecnomga.com"] });
  return db;
}

beforeEach(() => {
  mail.provider = "gmail";
  mail.sent = [];
  mail.next = { success: true, id: "m1" };
  vi.stubEnv("ADMIN_NOTIFICATION_EMAILS", "none");
  // A healthy server configuration: the summary then reports only what happened.
  vi.stubEnv("VITE_SUPABASE_URL", "https://abc.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "k".repeat(40));
  vi.stubEnv("CRON_SECRET", "c".repeat(24));
  vi.stubEnv("WEBHOOK_SECRET", "w".repeat(24));
  vi.stubEnv("WEBHOOK_DEFAULT_USER_ID", "a0000000-0000-4000-8000-000000000001");
  vi.stubEnv("GMAIL_USER", "portale@tecnomga.com");
  vi.stubEnv("GMAIL_APP_PASSWORD", "abcdefghijklmnop");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("who the administrators are", () => {
  it("every administrator at the addresses chosen for them (or the sign-in email), in their language; nobody else", async () => {
    const recipients = await adminRecipients(sb(world()));
    assert.deepEqual(recipients.map((r) => `${r.email}:${r.language}`).sort(), ["john@tecnomga.com:en", "mario@tecnomga.com:it", "ops@tecnomga.com:en"]);
  });

  it("the office mailboxes are added, without duplicates", async () => {
    vi.stubEnv("ADMIN_NOTIFICATION_EMAILS", "info@tecnomga.com, MARIO@tecnomga.com");
    const recipients = await adminRecipients(sb(world()));
    assert.deepEqual(recipients.map((r) => r.email).sort(), ["info@tecnomga.com", "john@tecnomga.com", "mario@tecnomga.com", "ops@tecnomga.com"]);
  });
});

describe("deliveries that gave up", () => {
  const failed = (db: FakeDb, extra: Record<string, unknown> = {}) =>
    db.seed("outbound_deliveries", { status: "failed", attempts: 7, target_kind: "portal", target_id: "p1", target_label: "Portale Compagnia", event_type: "practice.info_provided", last_error: "HTTP 502", alerted_at: null, ...extra });

  it("the administrators are told once, in their language, and the delivery is marked", async () => {
    const db = world();
    const practice = db.seed("practices", { practice_number: "PR-2026-0007" });
    failed(db, { practice_id: practice.id });
    assert.deepEqual(await alertFailedDeliveries(sb(db)), { alerted: 1 });
    assert.equal(mail.sent.length, 2, "one email per language");
    const italian = mail.sent.find((m) => /consegna verso un portale esterno/.test(m.subject));
    const english = mail.sent.find((m) => /delivery to an external portal failed/.test(m.subject));
    assert.ok(italian && english);
    assert.match(italian.html, /Portale Compagnia/);
    assert.match(italian.html, /PR-2026-0007/);
    assert.match(italian.html, /HTTP 502/);
    assert.ok(db.rows("outbound_deliveries")[0].alerted_at);

    mail.sent = [];
    assert.deepEqual(await alertFailedDeliveries(sb(db)), { alerted: 0 });
    assert.equal(mail.sent.length, 0, "no second alert for the same delivery");
  });

  it("delivered or still-pending ones are not reported", async () => {
    const db = world();
    failed(db, { status: "delivered" });
    failed(db, { status: "pending" });
    assert.deepEqual(await alertFailedDeliveries(sb(db)), { alerted: 0 });
    assert.equal(mail.sent.length, 0);
  });

  it("when nobody can be told, the delivery stays to be reported at the next run", async () => {
    const db = world();
    failed(db);
    mail.provider = "none";
    assert.deepEqual(await alertFailedDeliveries(sb(db)), { alerted: 0 });
    assert.equal(db.rows("outbound_deliveries")[0].alerted_at, null);
    mail.provider = "gmail";
    assert.deepEqual(await alertFailedDeliveries(sb(db)), { alerted: 1 });
  });

  it("every alert is in the email log", async () => {
    const db = world();
    failed(db);
    await alertFailedDeliveries(sb(db));
    const logged = db.rows("email_logs").filter((row) => row.template_used === "admin_alert_delivery_failed");
    assert.equal(logged.length, 3);
  });
});

describe("daily summary", () => {
  const NOW = new Date("2026-10-11T04:00:00Z");

  it("says nothing when nothing is open", async () => {
    const summary = await sendDailyDigest(sb(world()), NOW);
    assert.equal(summary.sent, false);
    assert.equal(mail.sent.length, 0);
  });

  it("lists failed deliveries, unreachable clients that are about to expire and failed emails", async () => {
    const db = world();
    db.seed("outbound_deliveries", { status: "failed", attempts: 7, target_kind: "portal", target_id: "p1", target_label: "Portale Compagnia", event_type: "practice.issued", last_error: "timeout", alerted_at: "2026-10-10T00:00:00Z" });
    db.seed("email_suppressions", { email: "gone@x.it", reason: "bounced" });
    db.seed("practices", { practice_number: "PR-2026-0100", client_email: "Gone@X.it", policy_end_date: "2026-11-20" });
    db.seed("practices", { practice_number: "PR-2026-0101", client_email: "gone@x.it", policy_end_date: "2027-06-01" });
    db.seed("practices", { practice_number: "PR-2026-0102", client_email: "fine@x.it", policy_end_date: "2026-11-20" });
    db.seed("email_logs", { recipient_email: "a@x.it", status: "failed", error_message: "550 no such user", created_at: "2026-10-11T01:00:00Z" });
    db.seed("email_logs", { recipient_email: "b@x.it", status: "sent", created_at: "2026-10-11T01:00:00Z" });
    db.seed("email_logs", { recipient_email: "c@x.it", status: "failed", error_message: "old", created_at: "2026-10-01T01:00:00Z" });

    const summary = await sendDailyDigest(sb(db), NOW);
    assert.deepEqual(summary, { sent: true, failedDeliveries: 1, unreachableClients: 1, emailFailures: 1, configIssues: 0 });
    const italian = mail.sent.find((m) => /Riepilogo giornaliero/.test(m.subject));
    assert.ok(italian);
    assert.match(italian.html, /Portale Compagnia/);
    assert.match(italian.html, /gone@x\.it/);
    assert.match(italian.html, /PR-2026-0100/);
    assert.doesNotMatch(italian.html, /PR-2026-0101|PR-2026-0102/);
    assert.match(italian.html, /550 no such user/);
  });
});

describe("daily summary and the server configuration", () => {
  it("a blocking problem is reported every day, in the language of each administrator", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const summary = await sendDailyDigest(sb(world()), new Date("2026-10-11T04:00:00Z")); // a Sunday
    assert.equal(summary.sent, true);
    assert.equal(summary.configIssues, 1);
    const italian = mail.sent.find((m) => /Riepilogo giornaliero/.test(m.subject));
    const english = mail.sent.find((m) => /Daily summary/.test(m.subject));
    assert.ok(italian && english);
    assert.match(italian.html, /Configurazione del server da correggere \(1 bloccanti/);
    assert.match(italian.html, /SUPABASE_SERVICE_ROLE_KEY/);
    assert.match(english.html, /Server configuration to fix/);
  });

  it("warnings wait for Monday, and the values of the variables never appear", async () => {
    vi.stubEnv("CRON_SECRET", "short-secret");
    const sunday = await sendDailyDigest(sb(world()), new Date("2026-10-11T04:00:00Z"));
    assert.deepEqual({ sent: sunday.sent, configIssues: sunday.configIssues }, { sent: false, configIssues: 0 });
    const monday = await sendDailyDigest(sb(world()), new Date("2026-10-12T04:00:00Z"));
    assert.equal(monday.sent, true);
    assert.equal(monday.configIssues, 1);
    const html = mail.sent.map((m) => m.html).join("");
    assert.match(html, /CRON_SECRET/);
    assert.doesNotMatch(html, /short-secret/);
  });
});

describe("a task that stopped", () => {
  it("tells the administrators which and why", async () => {
    await alertCronFailure(sb(world()), "cron-vies-orchestrator", new Error("connection reset"));
    const italian = mail.sent.find((m) => /Attività automatica non riuscita/.test(m.subject));
    assert.ok(italian);
    assert.match(italian.html, /cron-vies-orchestrator/);
    assert.match(italian.html, /connection reset/);
  });
});
