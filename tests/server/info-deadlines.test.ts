import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { FakeDb } from "../helpers/fakedb";

const mail = vi.hoisted(() => ({
  sent: [] as Array<{ to: string | string[]; subject: string; html: string }>,
}));

vi.mock("../../api/_lib/mailer", async (original) => {
  const actual = await original<typeof import("../../api/_lib/mailer")>();
  return {
    ...actual,
    getMailProvider: () => "gmail" as const,
    sendMail: async (message: { to: string | string[]; subject: string; html: string }) => {
      mail.sent.push(message);
      return { success: true, id: `m${mail.sent.length}` };
    },
  };
});

import { processInfoDeadlines } from "../../api/_lib/info-deadlines";
import { dispatchNotifications } from "../../api/_lib/notification-dispatch";
import { applyWorkflowEvent, defaultInfoDueDate, INFO_REQUEST_DAYS, parseInfoDueDate, WorkflowError } from "../../api/_lib/vies-workflow";

const sb = (db: FakeDb) => db as never;
const AGENT = "a0000000-0000-4000-8000-000000000001";
const PARENT = "a0000000-0000-4000-8000-000000000002";
const ADMIN = "a0000000-0000-4000-8000-000000000003";
const day = (iso: string) => new Date(`${iso}T04:00:00Z`);

function world(due: string | null, status = "integrazioni") {
  const db = new FakeDb();
  db.seed("profiles", { id: AGENT, full_name: "Olga Agente", email: "olga@x.it", language: "it", email_notifications: {} });
  db.seed("profiles", { id: PARENT, full_name: "Paolo Referente", email: "paolo@x.it", language: "en", email_notifications: {} });
  db.seed("profiles", { id: ADMIN, full_name: "Mario Admin", email: "mario@tecnomga.com", language: "it", email_notifications: {} });
  db.seed("user_roles", { user_id: AGENT, role: "collaboratore", parent_agent_id: PARENT });
  db.seed("user_roles", { user_id: PARENT, role: "agente", parent_agent_id: null });
  db.seed("user_roles", { user_id: ADMIN, role: "admin", parent_agent_id: null });
  const practice = db.seed("practices", { practice_number: "PR-2026-0042", practice_type: "casa", client_name: "Rossi Srl", user_id: AGENT, status, financial_status: null });
  db.seed("practice_events", { practice_id: practice.id, event_type: "workflow_info_requested", description: "Integrazioni richieste: visura aggiornata e bilancio 2025" });
  if (due) db.seed("practice_workflow", { practice_id: practice.id, info_due_date: due, info_requested_at: "2026-10-01T00:00:00Z", info_reminded_at: null, info_overdue_notified_at: null });
  return { db, practice };
}

beforeEach(() => {
  mail.sent = [];
  vi.stubEnv("ADMIN_NOTIFICATION_EMAILS", "none");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the term of a request for information", () => {
  it("parses a due date: a real day, not past, within a year; empty means the default", () => {
    const now = day("2026-10-11");
    assert.equal(parseInfoDueDate("", now), null);
    assert.equal(parseInfoDueDate(undefined, now), null);
    assert.equal(parseInfoDueDate("2026-10-11", now), "2026-10-11");
    assert.equal(parseInfoDueDate("2027-01-31", now), "2027-01-31");
    for (const bad of ["2026-10-10", "2026-02-30", "11/10/2026", "2028-01-01", "domani", 42]) {
      assert.throws(() => parseInfoDueDate(bad, now), (error: unknown) => error instanceof WorkflowError && error.status === 422, String(bad));
    }
    assert.equal(defaultInfoDueDate(day("2026-10-11")), `2026-10-${11 + INFO_REQUEST_DAYS}`);
  });

  it("a request records the term; providing the information clears it; a new request starts over", async () => {
    const db = new FakeDb();
    db.seed("profiles", { id: ADMIN, full_name: "Mario Admin" });
    const practice = db.seed("practices", { practice_number: "PR-1", practice_type: "casa", client_name: "X", user_id: AGENT, status: "in_attesa", financial_status: null });
    const actor = { label: "Mario Admin", userId: ADMIN };

    await applyWorkflowEvent(sb(db), practice.id, { type: "info_requested", message: "visura", dueDate: "2026-12-24" }, { actor });
    let workflow = db.rows("practice_workflow")[0];
    assert.equal(workflow.info_due_date, "2026-12-24");
    assert.ok(workflow.info_requested_at);
    assert.equal(db.rows("practices")[0].status, "integrazioni");

    workflow.info_reminded_at = "2026-12-22T00:00:00Z";
    await applyWorkflowEvent(sb(db), practice.id, { type: "info_provided", message: "fatto" }, { actor });
    workflow = db.rows("practice_workflow")[0];
    assert.equal(workflow.info_due_date, null);
    assert.equal(workflow.info_reminded_at, null);

    await applyWorkflowEvent(sb(db), practice.id, { type: "info_requested", message: "altro" }, { actor });
    assert.equal(db.rows("practice_workflow")[0].info_due_date, defaultInfoDueDate());
  });
});

describe("reminders and notices", () => {
  it("nothing before the reminder window", async () => {
    const { db } = world("2026-10-20");
    assert.deepEqual(await processInfoDeadlines(sb(db), day("2026-10-11")), { reminders: 0, overdue: 0 });
    assert.equal(db.rows("notification_events").length, 0);
  });

  it("two days before the term a reminder is queued, once", async () => {
    const { db, practice } = world("2026-10-13");
    assert.deepEqual(await processInfoDeadlines(sb(db), day("2026-10-11")), { reminders: 1, overdue: 0 });
    const [event] = db.rows("notification_events");
    assert.equal(event.event_type, "info_reminder");
    assert.equal(event.practice_id, practice.id);
    assert.equal(event.payload.due_date, "2026-10-13");
    assert.ok(db.rows("practice_workflow")[0].info_reminded_at);

    assert.deepEqual(await processInfoDeadlines(sb(db), day("2026-10-12")), { reminders: 0, overdue: 0 });
    assert.equal(db.rows("notification_events").length, 1);
  });

  it("the day after the term the notice is queued, once, and no reminder follows it", async () => {
    const { db } = world("2026-10-10");
    assert.deepEqual(await processInfoDeadlines(sb(db), day("2026-10-11")), { reminders: 0, overdue: 1 });
    assert.equal(db.rows("notification_events")[0].event_type, "info_overdue");
    assert.deepEqual(await processInfoDeadlines(sb(db), day("2026-10-12")), { reminders: 0, overdue: 0 });
    assert.equal(db.rows("notification_events").length, 1);
  });

  it("a reminder already sent is followed by the notice when the term passes", async () => {
    const { db } = world("2026-10-13");
    await processInfoDeadlines(sb(db), day("2026-10-11"));
    assert.deepEqual(await processInfoDeadlines(sb(db), day("2026-10-14")), { reminders: 0, overdue: 1 });
    assert.deepEqual(db.rows("notification_events").map((event) => event.event_type), ["info_reminder", "info_overdue"]);
  });

  it("practices that are no longer waiting for the information are left alone", async () => {
    const { db } = world("2026-10-10", "in_attesa");
    assert.deepEqual(await processInfoDeadlines(sb(db), day("2026-10-11")), { reminders: 0, overdue: 0 });
    assert.equal(db.rows("notification_events").length, 0);
  });
});

describe("the emails", () => {
  async function queue(due: string, today: string) {
    const { db, practice } = world(due);
    await processInfoDeadlines(sb(db), day(today));
    const summary = await dispatchNotifications(sb(db));
    return { db, practice, summary };
  }

  it("reminder: the owner and the reference agent, each in their language, with the term and what was asked", async () => {
    const { db, summary } = await queue("2026-10-13", "2026-10-11");
    assert.equal(summary.emails, 2);
    const recipients = mail.sent.flatMap((message) => (Array.isArray(message.to) ? message.to : [message.to])).sort();
    assert.deepEqual(recipients, ["olga@x.it", "paolo@x.it"], "not the administrators");
    const italian = mail.sent.find((message) => message.to.includes("olga@x.it"));
    const english = mail.sent.find((message) => message.to.includes("paolo@x.it"));
    assert.ok(italian && english);
    assert.equal(italian.subject, "Pratica n. PR-2026-0042: integrazioni da fornire entro il 13/10/2026");
    assert.match(italian.html, /visura aggiornata e bilancio 2025/);
    assert.equal(english.subject, "Practice no. PR-2026-0042: information due by 13/10/2026");
    assert.ok(db.rows("email_logs").some((row) => row.template_used === "notification_info_reminder"));
  });

  it("overdue: the same people and the administrators, who are told why", async () => {
    await queue("2026-10-10", "2026-10-11");
    const recipients = mail.sent.flatMap((message) => (Array.isArray(message.to) ? message.to : [message.to])).sort();
    assert.deepEqual(recipients, ["mario@tecnomga.com", "olga@x.it", "paolo@x.it"]);
    const admin = mail.sent.find((message) => message.to.includes("mario@tecnomga.com"));
    assert.ok(admin);
    assert.equal(admin.subject, "Pratica n. PR-2026-0042: integrazioni in ritardo");
    assert.match(admin.html, /termine è scaduto/);
    const agent = mail.sent.find((message) => message.to.includes("olga@x.it"));
    assert.doesNotMatch(agent?.html ?? "", /Ricevi questo avviso perché il termine è scaduto/);
  });

  it("a person who switched status notifications off is not written to", async () => {
    const { db } = world("2026-10-13");
    db.seed("user_notification_settings", { user_id: AGENT, notification_emails: [], status_change: false, new_practice: true, documents: true, notes: true });
    await processInfoDeadlines(sb(db), day("2026-10-11"));
    await dispatchNotifications(sb(db));
    const recipients = mail.sent.flatMap((message) => (Array.isArray(message.to) ? message.to : [message.to]));
    assert.deepEqual(recipients, ["paolo@x.it"]);
  });

  it("if the information arrived before the email went out, nothing is sent", async () => {
    const { db, practice } = world("2026-10-10");
    await processInfoDeadlines(sb(db), day("2026-10-11"));
    db.rows("practices").find((row) => row.id === practice.id)!.status = "in_attesa";
    const summary = await dispatchNotifications(sb(db));
    assert.equal(summary.emails, 0);
    assert.equal(mail.sent.length, 0);
  });
});
