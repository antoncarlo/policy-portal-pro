import assert from "node:assert/strict";
import * as crypto from "node:crypto";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { FakeDb } from "../helpers/fakedb";

const mail = vi.hoisted(() => ({
  provider: "gmail" as "gmail" | "resend" | "none",
  sent: [] as Array<{ to: string | string[]; subject: string }>,
  next: { success: true, id: "msg-1" } as { success: boolean; id?: string; error?: string },
}));

vi.mock("../../api/_lib/mailer", async (original) => {
  const actual = await original<typeof import("../../api/_lib/mailer")>();
  return {
    ...actual,
    getMailProvider: () => mail.provider,
    sendMail: async (message: { to: string | string[]; subject: string }) => {
      mail.sent.push(message);
      return mail.next;
    },
  };
});

import { findSuppressed, sendMailLogged, SUPPRESSED_REASON } from "../../api/_lib/email-log";
import { applyResendEvent, handleResendWebhook, verifySvixSignature } from "../../api/_lib/resend-webhook";

const sb = (db: FakeDb) => db as never;
const SECRET_KEY = Buffer.from("super-secret-key-for-tests-1234567");
const SECRET = `whsec_${SECRET_KEY.toString("base64")}`;

function svixHeaders(rawBody: string, options: { id?: string; timestamp?: number; key?: Buffer } = {}) {
  const id = options.id ?? "msg_abc";
  const timestamp = String(options.timestamp ?? Math.floor(Date.now() / 1000));
  const signature = crypto.createHmac("sha256", options.key ?? SECRET_KEY).update(`${id}.${timestamp}.${rawBody}`).digest("base64");
  return { "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,${signature}` };
}

beforeEach(() => {
  mail.provider = "gmail";
  mail.sent = [];
  mail.next = { success: true, id: "msg-1" };
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe("every email is in the log", () => {
  it("writes one line per recipient with outcome, provider and the provider's message id", async () => {
    const db = new FakeDb();
    const result = await sendMailLogged(sb(db), { to: ["a@x.it", "b@x.it"], subject: "Oggetto", html: "<p>x</p>" }, { template: "notification_status_changed", notificationType: "status_changed", practiceId: "p1", recipientName: "Mario" });
    assert.equal(result.success, true);
    const rows = db.rows("email_logs");
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map((row) => row.recipient_email).sort(), ["a@x.it", "b@x.it"]);
    for (const row of rows) {
      assert.equal(row.status, "sent");
      assert.equal(row.resend_email_id, "msg-1");
      assert.equal(row.provider, "gmail");
      assert.equal(row.template_used, "notification_status_changed");
      assert.equal(row.practice_id, "p1");
      assert.equal(row.recipient_name, "Mario");
    }
  });

  it("a failed send is logged as failed with the reason", async () => {
    const db = new FakeDb();
    mail.next = { success: false, error: "550 mailbox unavailable" };
    const result = await sendMailLogged(sb(db), { to: "a@x.it", subject: "S", html: "" }, { template: "access_welcome" });
    assert.equal(result.success, false);
    assert.equal(db.rows("email_logs")[0].status, "failed");
    assert.match(db.rows("email_logs")[0].error_message, /mailbox unavailable/);
  });

  it("an address the provider reported as unreachable is not written to, and the attempt is logged", async () => {
    const db = new FakeDb();
    db.seed("email_suppressions", { email: "gone@x.it", reason: "bounced" });
    const result = await sendMailLogged(sb(db), { to: ["Gone@X.it", "ok@x.it"], subject: "S", html: "" }, { template: "t" });
    assert.equal(result.success, true);
    assert.deepEqual(mail.sent.map((message) => message.to), [["ok@x.it"]]);
    const byAddress = Object.fromEntries(db.rows("email_logs").map((row) => [row.recipient_email, row]));
    assert.equal(byAddress["ok@x.it"].status, "sent");
    assert.equal(byAddress["Gone@X.it"].status, "failed");
    assert.equal(byAddress["Gone@X.it"].error_message, SUPPRESSED_REASON);

    mail.sent = [];
    const none = await sendMailLogged(sb(db), { to: "gone@x.it", subject: "S", html: "" }, { template: "t" });
    assert.equal(none.success, false);
    assert.equal(mail.sent.length, 0);
  });

  it("a lookup problem on the suppression list does not stop the email", async () => {
    const db = new FakeDb();
    const broken = { from: (table: string) => (table === "email_suppressions" ? { select: () => ({ in: async () => ({ data: null, error: { message: "down" } }) }) } : db.from(table)) };
    assert.equal((await findSuppressed(broken as never, ["a@x.it"])).size, 0);
    assert.equal((await sendMailLogged(broken as never, { to: "a@x.it", subject: "S", html: "" }, { template: "t" })).success, true);
  });
});

describe("delivery reports from the provider", () => {
  const seedMail = (db: FakeDb, id = "re_1", recipients = ["cliente@x.it"]) => {
    for (const address of recipients) db.seed("email_logs", { resend_email_id: id, recipient_email: address, status: "sent", practice_id: null });
  };
  const event = (type: string, data: Record<string, unknown> = {}) => ({ type, data: { email_id: "re_1", to: ["cliente@x.it"], ...data } });

  it("delivered updates the line", async () => {
    const db = new FakeDb();
    seedMail(db);
    const outcome = await applyResendEvent(sb(db), event("email.delivered"));
    assert.equal(outcome.updated, 1);
    assert.equal(db.rows("email_logs")[0].status, "delivered");
  });

  it("a permanent bounce marks the line and closes the address", async () => {
    const db = new FakeDb();
    seedMail(db);
    const outcome = await applyResendEvent(sb(db), event("email.bounced", { bounce: { type: "Permanent", subType: "General", message: "mailbox does not exist" } }));
    assert.deepEqual(outcome.suppressed, ["cliente@x.it"]);
    assert.equal(db.rows("email_logs")[0].status, "bounced");
    assert.match(db.rows("email_logs")[0].delivery_detail, /mailbox does not exist/);
    assert.equal(db.rows("email_suppressions")[0].reason, "bounced");
  });

  it("a temporary bounce marks the line but leaves the address open", async () => {
    const db = new FakeDb();
    seedMail(db);
    const outcome = await applyResendEvent(sb(db), event("email.bounced", { bounce: { type: "Transient", subType: "MailboxFull" } }));
    assert.deepEqual(outcome.suppressed, []);
    assert.equal(db.rows("email_logs")[0].status, "bounced");
    assert.equal(db.rows("email_suppressions").length, 0);
  });

  it("a complaint closes the address", async () => {
    const db = new FakeDb();
    seedMail(db);
    const outcome = await applyResendEvent(sb(db), event("email.complained"));
    assert.deepEqual(outcome.suppressed, ["cliente@x.it"]);
    assert.equal(db.rows("email_suppressions")[0].reason, "complained");
  });

  it("only the addresses named in the report are touched when one message had several recipients", async () => {
    const db = new FakeDb();
    seedMail(db, "re_1", ["cliente@x.it", "altro@x.it"]);
    await applyResendEvent(sb(db), event("email.bounced", { bounce: { type: "Permanent" } }));
    const status = Object.fromEntries(db.rows("email_logs").map((row) => [row.recipient_email, row.status]));
    assert.deepEqual(status, { "cliente@x.it": "bounced", "altro@x.it": "sent" });
  });

  it("a late 'delivered' never undoes a bounce; the same report twice changes nothing more", async () => {
    const db = new FakeDb();
    seedMail(db);
    await applyResendEvent(sb(db), event("email.bounced", { bounce: { type: "Permanent" } }));
    await applyResendEvent(sb(db), event("email.delivered"));
    assert.equal(db.rows("email_logs")[0].status, "bounced");
    const again = await applyResendEvent(sb(db), event("email.bounced", { bounce: { type: "Permanent" } }));
    assert.deepEqual(again.suppressed, []);
    assert.equal(db.rows("email_suppressions").length, 1);
    assert.equal(db.rows("email_suppressions")[0].hits, 2);
  });

  it("events that mean nothing here, or about unknown emails, are ignored", async () => {
    const db = new FakeDb();
    seedMail(db);
    assert.equal((await applyResendEvent(sb(db), event("email.opened"))).handled, false);
    assert.equal((await applyResendEvent(sb(db), event("email.delivered", { email_id: "unknown" }))).updated, 0);
  });
});

describe("the webhook endpoint", () => {
  const call = (db: FakeDb, body: string, headers: Record<string, string | undefined>, ...secret: [string | undefined?]) =>
    handleResendWebhook(sb(db), secret.length > 0 ? secret[0] : SECRET, { headers, rawBody: body });

  it("verifies the Svix signature", () => {
    const body = '{"type":"email.delivered"}';
    const headers = svixHeaders(body);
    const check = (override: Partial<Parameters<typeof verifySvixSignature>[0]> = {}) =>
      verifySvixSignature({ secret: SECRET, id: headers["svix-id"], timestamp: headers["svix-timestamp"], signature: headers["svix-signature"], rawBody: body, ...override });
    assert.equal(check(), true);
    assert.equal(check({ rawBody: body + " " }), false);
    assert.equal(check({ secret: `whsec_${Buffer.from("another").toString("base64")}` }), false);
    assert.equal(check({ signature: undefined }), false);
    assert.equal(check({ signature: `v1,AAAA ${headers["svix-signature"]}` }), true);
    assert.equal(check({ nowSeconds: Math.floor(Date.now() / 1000) + 3600 }), false);
  });

  it("refuses a bad signature (401), answers 503 without a secret, 400 on garbage", async () => {
    const db = new FakeDb();
    const body = JSON.stringify({ type: "email.delivered", data: { email_id: "re_1", to: ["a@x.it"] } });
    assert.equal((await call(db, body, { ...svixHeaders(body), "svix-signature": "v1,AAAA" })).status, 401);
    assert.equal((await call(db, body, svixHeaders(body), undefined)).status, 503);
    assert.equal((await call(db, "not json", svixHeaders("not json"))).status, 400);
    assert.equal((await call(db, "{}", svixHeaders("{}"))).status, 400);
  });

  it("a signed report updates the log; a permanent bounce closes the address and tells the administrators", async () => {
    const db = new FakeDb();
    db.seed("email_logs", { resend_email_id: "re_9", recipient_email: "cliente@x.it", status: "sent" });
    db.seed("practices", { practice_number: "PR-2026-0042", client_email: "Cliente@X.it" });
    db.seed("user_roles", { user_id: "admin-1", role: "admin" });
    db.seed("profiles", { id: "admin-1", email: "admin@tecnomga.com", language: "it" });
    const body = JSON.stringify({ type: "email.bounced", data: { email_id: "re_9", to: ["cliente@x.it"], bounce: { type: "Permanent", message: "no such user" } } });
    const result = await call(db, body, svixHeaders(body));
    assert.equal(result.status, 200);
    assert.equal(result.body.suppressed, 1);
    assert.equal(db.rows("email_logs").find((row) => row.resend_email_id === "re_9")?.status, "bounced");

    const alert = mail.sent.find((message) => /Email non recapitabile/.test(message.subject));
    assert.ok(alert, "administrators are told");
    assert.ok((Array.isArray(alert.to) ? alert.to : [alert.to]).includes("admin@tecnomga.com"));
    const logged = db.rows("email_logs").find((row) => row.template_used === "admin_alert_bounce");
    assert.ok(logged, "the alert is in the log too");
  });
});
