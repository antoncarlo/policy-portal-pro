/* eslint-disable @typescript-eslint/no-explicit-any -- scenario code written against loosely typed doubles */
import assert from "node:assert/strict";
import { FakeDb } from "../helpers/fakedb";
import { suite } from "../helpers/suite";

// No mail channel: the emails are not under test here (the database queues them, the dispatcher is tested elsewhere).
Object.assign(process.env, { PORTAL_URL: "https://portale.example.test", GMAIL_USER: "", GMAIL_APP_PASSWORD: "", RESEND_API_KEY: "" });

const { runWorkflowAction, BULK_MAX } = await import("../../api/_lib/vies-workflow-actions");

const { check, section, report } = suite();
const rejects = async (fn: () => Promise<unknown>, code: string, status?: number) => {
  try {
    await fn();
  } catch (error: any) {
    assert.equal(error.code, code, `expected ${code}, got ${error.code}: ${error.message}`);
    if (status) assert.equal(error.status, status);
    return;
  }
  assert.fail(`expected ${code}`);
};

// The representative's portal receives the notifications: a stub that answers 200 and remembers what came.
const delivered: Array<{ url: string; body: any }> = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: any, init: any = {}) => {
  const url = typeof input === "string" ? input : input.url ?? String(input);
  if (!url.includes(".example.test")) return realFetch(input, init);
  let body: any = null;
  try { body = JSON.parse(String(init.body ?? "")); } catch { /* not json */ }
  delivered.push({ url, body });
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
}) as typeof fetch;

const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ADMIN = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const KEY = "11111111-1111-4111-8111-111111111111";

function world(opts: { webhook?: boolean } = {}) {
  const db = new FakeDb();
  db.seed("profiles", { id: OWNER, email: "owner@example.test", full_name: "Anna Rossi", language: "it" });
  db.seed("profiles", { id: ADMIN, email: "admin@example.test", full_name: "Mario Admin", language: "it" });
  db.seed("user_roles", { user_id: ADMIN, role: "admin" });
  db.seed("api_key_user_mapping", { api_key_id: KEY, user_id: OWNER });
  if (opts.webhook) db.seed("partner_webhooks", { api_key_id: KEY, url: "https://hooks.example.test/tecno", secret: "whsec_test_secret", active: true });
  let n = 0;
  const practice = (status = "in_lavorazione", financial_status: string | null = "non_incassata", extra: Record<string, unknown> = {}) => {
    n += 1;
    return db.seed("practices", { practice_number: `VIES-2026-${n}-ABCD1234`, practice_type: "vies", client_name: `Azienda ${n}`, user_id: OWNER, status, financial_status, ...extra });
  };
  const bulk = (ids: string[], status: string, note?: string, user = ADMIN) =>
    runWorkflowAction(db as any, user, "workflow_bulk_status", { practiceIds: ids, status, ...(note ? { note } : {}) }) as Promise<any>;
  return { db, practice, bulk };
}
const events = (db: FakeDb, id: string, type?: string) => db.rows("practice_events").filter((e) => e.practice_id === id && (!type || e.event_type === type));
const statusOf = (db: FakeDb, id: string) => db.rows("practices").find((p) => p.id === id)?.status;
const flowOf = (db: FakeDb, id: string) => db.rows("practice_workflow").find((w) => w.practice_id === id);

section("A. The passage goes through the company flow");
await check("several practices to 'in attesa': flow row, history, one result per practice", async () => {
  const { db, practice, bulk } = world();
  const [a, b, c] = [practice(), practice(), practice()];
  const result = await bulk([a.id, b.id, c.id], "in_attesa");
  assert.equal(result.ok, true);
  assert.equal(result.requested, 3);
  assert.equal(result.changed, 3);
  assert.equal(result.blocked, 0);
  for (const p of [a, b, c]) {
    assert.equal(statusOf(db, p.id), "in_attesa");
    assert.equal(flowOf(db, p.id)?.target_portal, "manuale", "the flow row records the send");
    assert.match(events(db, p.id, "workflow_sent")[0].description, /invio manuale/);
    assert.equal(events(db, p.id, "workflow_sent")[0].created_by, ADMIN);
  }
  assert.deepEqual(result.results.map((row: any) => row.outcome), ["changed", "changed", "changed"]);
  assert.equal(result.results[0].practiceNumber, a.practice_number);
  assert.equal(result.results[0].to, "in_valutazione");
});
await check("the representative who sent the practice is told, one notification per changed practice", async () => {
  const { db, practice, bulk } = world({ webhook: true });
  delivered.length = 0;
  const [a, b] = [practice("in_lavorazione", "non_incassata", { api_key_id: KEY }), practice("in_lavorazione", "non_incassata", { api_key_id: KEY })];
  const already = practice("in_attesa", "non_incassata", { api_key_id: KEY });
  await bulk([a.id, b.id, already.id], "in_attesa");
  const queued = db.rows("outbound_deliveries");
  assert.equal(queued.length, 2, "nothing is sent for the practice that was already there");
  assert.ok(queued.every((row) => row.event_type === "practice.in_review"), `unexpected events ${queued.map((q) => q.event_type)}`);
  assert.deepEqual(new Set(queued.map((row) => row.practice_id)), new Set([a.id, b.id]));
});
await check("a single line goes to the audit log, with the totals", async () => {
  const { db, practice, bulk } = world();
  const [a, b] = [practice(), practice("completata", "incassata")];
  await bulk([a.id, b.id], "in_attesa");
  const line = db.rows("audit_log").find((row) => row.action === "practice.bulk_status");
  assert.ok(line, "bulk change is audited");
  assert.equal(line.actor_id, ADMIN);
  assert.equal(line.details.status, "in_attesa");
  assert.equal(line.details.requested, 2);
  assert.equal(line.details.changed, 1);
});

section("B. What cannot pass is left alone and explained");
await check("already in that status: nothing recorded, the real portal is not overwritten", async () => {
  const { db, practice, bulk } = world();
  const p = practice("in_attesa");
  db.seed("practice_workflow", { practice_id: p.id, target_portal: "co", target_reference: "R-1" });
  const result = await bulk([p.id], "in_attesa");
  assert.equal(result.unchanged, 1);
  assert.equal(result.changed, 0);
  assert.equal(result.results[0].outcome, "unchanged");
  assert.equal(flowOf(db, p.id)?.target_portal, "co");
  assert.equal(flowOf(db, p.id)?.target_reference, "R-1");
  assert.equal(events(db, p.id).length, 0);
});
await check("a blocked practice does not stop the others, and says why", async () => {
  const { db, practice, bulk } = world();
  const issued = practice("completata", "incassata");
  const open = practice("in_attesa");
  const result = await bulk([issued.id, open.id], "approvata");
  assert.equal(result.changed, 1);
  assert.equal(result.blocked, 1);
  const blocked = result.results.find((row: any) => row.practiceId === issued.id);
  assert.equal(blocked.outcome, "blocked");
  assert.match(blocked.message, /già emessa/);
  assert.equal(statusOf(db, issued.id), "completata");
  assert.equal(statusOf(db, open.id), "approvata");
  assert.equal(flowOf(db, open.id)?.rejected_at, null);
  assert.ok(flowOf(db, open.id)?.deliberated_at, "the deliberation is recorded in the flow");
});
await check("issuing needs the payment: unpaid is blocked, paid goes through", async () => {
  const { db, practice, bulk } = world();
  const unpaid = practice("approvata", "non_incassata");
  const paid = practice("approvata", "incassata");
  const result = await bulk([unpaid.id, paid.id], "completata");
  assert.equal(result.results.find((row: any) => row.practiceId === unpaid.id).outcome, "blocked");
  assert.match(result.results.find((row: any) => row.practiceId === unpaid.id).message, /pagata/);
  assert.equal(statusOf(db, unpaid.id), "approvata");
  assert.equal(statusOf(db, paid.id), "completata");
  assert.ok(flowOf(db, paid.id)?.issued_at);
});
await check("an unknown practice is reported, not fatal", async () => {
  const { db, practice, bulk } = world();
  const p = practice();
  const result = await bulk(["00000000-0000-4000-8000-000000000000", p.id], "in_attesa");
  assert.equal(result.failed, 1);
  assert.equal(result.changed, 1);
  assert.equal(result.results[0].outcome, "missing");
  assert.equal(statusOf(db, p.id), "in_attesa");
});

section("C. The other statuses");
await check("'rifiutata' needs the reason, and the reason is kept", async () => {
  const { db, practice, bulk } = world();
  const p = practice("in_attesa");
  await rejects(() => bulk([p.id], "rifiutata"), "invalid_payload", 422);
  await rejects(() => bulk([p.id], "rifiutata", "   "), "invalid_payload", 422);
  assert.equal(statusOf(db, p.id), "in_attesa", "nothing was touched by the refused calls");
  const result = await bulk([p.id], "rifiutata", "Rischio non assicurabile");
  assert.equal(result.changed, 1);
  assert.equal(statusOf(db, p.id), "rifiutata");
  assert.equal(flowOf(db, p.id)?.rejection_reason, "Rischio non assicurabile");
  assert.match(events(db, p.id, "workflow_rejected")[0].description, /Rischio non assicurabile/);
});
await check("'integrazioni' needs the request and sets the deadline", async () => {
  const { db, practice, bulk } = world();
  const p = practice("in_attesa");
  await rejects(() => bulk([p.id], "integrazioni"), "invalid_payload", 422);
  const result = await bulk([p.id], "integrazioni", "Manca la visura camerale");
  assert.equal(result.changed, 1);
  assert.equal(statusOf(db, p.id), "integrazioni");
  assert.match(String(flowOf(db, p.id)?.info_due_date), /^\d{4}-\d{2}-\d{2}$/, "7 days to answer by default");
  assert.match(events(db, p.id, "workflow_info_requested")[0].description, /Manca la visura camerale/);
});
await check("from 'integrazioni' back to 'in attesa' answers the request and clears the deadline", async () => {
  const { db, practice, bulk } = world();
  const p = practice("integrazioni");
  db.seed("practice_workflow", { practice_id: p.id, info_due_date: "2099-01-01", target_portal: "co" });
  const result = await bulk([p.id], "in_attesa", "Documenti arrivati");
  assert.equal(result.changed, 1);
  assert.equal(statusOf(db, p.id), "in_attesa");
  assert.equal(flowOf(db, p.id)?.info_due_date, null);
  assert.equal(flowOf(db, p.id)?.target_portal, "co", "the portal it was sent to is kept");
  assert.equal(events(db, p.id, "workflow_info_provided").length, 1);
  assert.equal(events(db, p.id, "workflow_sent").length, 0);
});
await check("'in lavorazione' reopens and clears the company's answer", async () => {
  const { db, practice, bulk } = world();
  const p = practice("rifiutata");
  db.seed("practice_workflow", { practice_id: p.id, rejected_at: "2026-10-01T10:00:00Z", rejection_reason: "x" });
  const result = await bulk([p.id], "in_lavorazione", "Rivalutazione");
  assert.equal(result.changed, 1);
  assert.equal(statusOf(db, p.id), "in_lavorazione");
  assert.equal(flowOf(db, p.id)?.rejected_at, null);
  assert.equal(flowOf(db, p.id)?.rejection_reason, null);
  assert.match(events(db, p.id, "workflow_reopened")[0].description, /Rivalutazione/);
});

section("D. Who and how many");
await check("only administrators", async () => {
  const { db, practice, bulk } = world();
  const p = practice();
  await rejects(() => bulk([p.id], "in_attesa", undefined, OWNER), "forbidden", 403);
  assert.equal(statusOf(db, p.id), "in_lavorazione");
});
await check("validation: status, empty list, too many, duplicates", async () => {
  const { db, practice, bulk } = world();
  const p = practice();
  await rejects(() => bulk([p.id], "inventato"), "invalid_payload", 422);
  await rejects(() => bulk([], "in_attesa"), "invalid_payload", 422);
  await rejects(() => runWorkflowAction(db as any, ADMIN, "workflow_bulk_status", { status: "in_attesa" }), "invalid_payload", 422);
  await rejects(() => bulk(Array.from({ length: BULK_MAX + 1 }, (_, i) => `id-${i}`), "in_attesa"), "invalid_payload", 422);
  const result = await bulk([p.id, p.id, p.id], "in_attesa");
  assert.equal(result.requested, 1, "the same practice is handled once");
  assert.equal(events(db, p.id, "workflow_sent").length, 1);
});

report();
