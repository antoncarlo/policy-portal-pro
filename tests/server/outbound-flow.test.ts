/* eslint-disable @typescript-eslint/no-explicit-any -- scenario code written against loosely typed doubles */
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import http from "node:http";
import net from "node:net";
import { afterAll } from "vitest";
import { FakeDb } from "../helpers/fakedb";
import { suite } from "../helpers/suite";

const R = fileURLToPath(new URL("../..", import.meta.url)).replace(/\/$/, "");
Object.assign(process.env, { PORTAL_URL: "https://portale.example.test", GMAIL_USER: "", GMAIL_APP_PASSWORD: "", RESEND_API_KEY: "" });

const { emitPracticeEvent, emitLotEvent, attemptDelivery, processDueDeliveries, retryDeliveries, sendTestEvent, assertPublicHttpsUrl, MAX_ATTEMPTS, OUTBOUND_EVENT_TYPE } = await import("../../api/_lib/vies-outbound");
const { verifyCallbackSignature, handlePortalCallback, signCallback } = await import("../../api/_lib/vies-callback");
const { runWorkflowAction } = await import("../../api/_lib/vies-workflow-actions");
const { applyWorkflowEvent } = await import("../../api/_lib/vies-workflow");
const { lotStatus } = await import("../../api/_lib/vies-intake");
const { practiceBelongsToTenant } = await import("../../api/_lib/partner-api");

const { check, section, report } = suite();
const rejects = async (fn: () => Promise<unknown>, code: string, status?: number) => {
  try { await fn(); } catch (error: any) { assert.equal(error.code, code, `expected ${code}, got ${error.code}: ${error.message}`); if (status) assert.equal(error.status, status); return; }
  assert.fail(`expected ${code}`);
};

// ---- receivers: the representative's portal and the company's portal, behind public-looking https names ----
interface Received { host: string; path: string; headers: http.IncomingHttpHeaders; raw: string; body: any }
const received: Received[] = [];
const behaviour = { status: 200, hang: false };
const server = http.createServer((req, res) => {
  let raw = ""; req.on("data", (c) => (raw += c));
  req.on("end", () => {
    let body: any = null; try { body = JSON.parse(raw); } catch { /* not json */ }
    received.push({ host: String(req.headers["x-original-host"]), path: req.url ?? "", headers: req.headers, raw, body });
    res.writeHead(behaviour.status, { "content-type": "application/json" }); res.end(JSON.stringify({ ok: behaviour.status < 300, error: behaviour.status >= 300 ? "nope" : undefined }));
  });
});
await new Promise<void>((r) => server.listen(0, r));
const PORT = (server.address() as net.AddressInfo).port;
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: any, init: any = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url ?? String(input));
  if (!url.hostname.endsWith(".example.test")) return realFetch(input, init);
  if (behaviour.hang) throw Object.assign(new Error("This operation was aborted"), { name: "AbortError" });
  return realFetch(`http://127.0.0.1:${PORT}${url.pathname}${url.search}`, { ...init, headers: { ...(init.headers ?? {}), "x-original-host": url.hostname } });
}) as typeof fetch;

const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ADMIN = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const KEY = "11111111-1111-4111-8111-111111111111";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
const SECRET = "whsec_test_secret";
const PORTAL_SECRET = "company-callback-secret";

function setup(opts: { webhook?: boolean | "inactive"; viaKey?: boolean } = {}) {
  const db = new FakeDb();
  const client = db as any;
  db.seed("profiles", { id: OWNER, email: "owner@example.test", full_name: "Anna", language: "it", email_notifications: { status_change: true } });
  db.seed("profiles", { id: ADMIN, email: "admin@example.test", full_name: "Mario Admin", language: "it" });
  db.seed("user_roles", { user_id: ADMIN, role: "admin" });
  db.seed("api_keys", { id: KEY, name: "Broker Beta", key_prefix: "tmga_abcd", partner_email: "b@example.test", is_active: true });
  db.seed("api_key_user_mapping", { api_key_id: KEY, user_id: OWNER });
  if (opts.webhook !== false) db.seed("partner_webhooks", { api_key_id: KEY, url: "https://hooks.example.test/tecno", secret: SECRET, active: opts.webhook !== "inactive" });
  const lot = db.seed("vies_intake_lots", { api_key_id: KEY, source_portal: "broker-beta", source_reference: "LOTTO-1", owner_user_id: OWNER, status: "received", files: [] });
  let n = 0;
  const practice = (status = "in_attesa", financial_status: string | null = "non_incassata", extra: Record<string, unknown> = {}) => {
    n += 1;
    const p = db.seed("practices", { practice_number: `VIES-2026-${n}-ABCD1234`, practice_type: "vies", client_name: `Azienda ${n}`, user_id: OWNER, status, financial_status, api_key_id: opts.viaKey === false ? null : KEY, ...extra });
    db.seed("practice_workflow", { practice_id: p.id, source_portal: "broker-beta", source_reference: "LOTTO-1", target_portal: "co", target_reference: "ALFA-7" });
    return p;
  };
  return { db, client, practice, lot };
}
const sourceCalls = () => received.filter((r) => r.host === "hooks.example.test");
const companyCalls = () => received.filter((r) => r.host === "events.alfa.example.test");
const reset = () => { received.length = 0; behaviour.status = 200; behaviour.hang = false; };
const withPortals = () => Object.assign(process.env, {
  VIES_PORTALS: JSON.stringify([{ id: "co", name: "Compagnia Alfa", url: "https://portal.alfa.example.test/api/in", eventsUrl: "https://events.alfa.example.test/events", apiKeyEnv: "K_CO", callbackSecretEnv: "S_CO" }]),
  K_CO: "company-bearer-key", S_CO: PORTAL_SECRET,
});
withPortals();
const pdfDoc = () => ({ file_name: "bozza.pdf", mime_type: "application/pdf", content_base64: PDF.toString("base64") });

section("I. Notifications to the representative");
await check("a step of the company reaches the representative, signed, with the draft to pay", async () => {
  reset();
  const { db, client, practice } = setup();
  const p = practice("in_attesa");
  const portals = [{ id: "co", name: "Compagnia Alfa", url: "https://portal.alfa.example.test/api/in", apiKey: "k", callbackSecret: PORTAL_SECRET, documentHosts: [], eventsUrl: "" }];
  const now = Math.floor(Date.now() / 1000);
  const body = { event_id: "e-1", event_type: "practice.deliberated", practice: { id: p.id }, data: { payment_due_date: "2026-12-20", note: "Premio ok", draft: pdfDoc() } };
  const raw = JSON.stringify(body);
  const res = await handlePortalCallback(client, portals, { rawBody: raw, nowSeconds: now, headers: { "x-portal-id": "co", "x-timestamp": String(now), "x-signature": signCallback(PORTAL_SECRET, String(now), raw) } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(sourceCalls().length, 1, "the representative is told once");
  assert.equal(companyCalls().length, 0, "the company is not told what it said itself");
  const call = sourceCalls()[0];
  assert.equal(call.path, "/tecno");
  assert.equal(call.headers["x-event-type"], "practice.deliberated");
  assert.equal(call.headers["x-partner-id"], KEY);
  assert.deepEqual(verifyCallbackSignature({ secret: SECRET, timestamp: call.headers["x-timestamp"] as string, signature: call.headers["x-signature"] as string, rawBody: call.raw }), { ok: true });
  assert.equal(call.headers["idempotency-key"], call.body.event_id);
  assert.equal(call.body.event_type, "practice.deliberated");
  assert.equal(call.body.stage, "deliberata");
  assert.equal(call.body.practice.number, p.practice_number);
  assert.equal(call.body.source.reference, "LOTTO-1");
  assert.equal(call.body.data.payment_due_date, "2026-12-20");
  assert.equal(call.body.data.note, "Premio ok");
  assert.equal(call.body.data.documents.length, 1);
  assert.equal(call.body.data.documents[0].document_type, "bozza_deliberata");
  assert.match(call.body.data.documents[0].download_url, /^https:\/\/fake\.supabase\.co\/storage\/v1\/object\/sign\/practice-documents\//);
  assert.ok(!call.raw.includes(SECRET), "the secret is never sent");
  const row = db.rows("outbound_deliveries")[0];
  assert.equal(row.status, "delivered"); assert.equal(row.attempts, 1); assert.equal(row.target_kind, "source"); assert.equal(row.target_id, KEY); assert.equal(row.last_http_status, 200);
});
await check("every step has its own event type; the company hears only what it cannot know", async () => {
  reset();
  const { client, practice, db } = setup();
  const p = practice("in_attesa");
  const kinds = ["sent", "info_requested", "info_provided", "deliberated", "rejected", "paid", "issued", "reopened"] as const;
  for (const kind of kinds) await emitPracticeEvent(client, { practiceId: p.id, kind, origin: "admin", details: { message: "m", reason: "r" } });
  assert.deepEqual(sourceCalls().map((c) => c.body.event_type), kinds.map((k) => OUTBOUND_EVENT_TYPE[k]));
  assert.deepEqual(sourceCalls().map((c) => c.body.event_type), ["practice.in_review", "practice.info_requested", "practice.info_provided", "practice.deliberated", "practice.rejected", "practice.paid", "practice.issued", "practice.reopened"]);
  assert.deepEqual(companyCalls().map((c) => c.body.event_type), ["practice.info_provided", "practice.paid", "practice.reopened"]);
  const byType = Object.fromEntries(sourceCalls().map((c) => [c.body.event_type, c.body.data]));
  assert.equal(byType["practice.info_requested"].message, "m"); assert.equal(byType["practice.rejected"].reason, "r"); assert.equal(byType["practice.reopened"].reason, "r");
  assert.equal(db.rows("outbound_deliveries").length, kinds.length + 3);
});
await check("the company is told about the payment and about integrations, with links to the documents", async () => {
  reset();
  const { client, practice, db } = setup();
  const p = practice("approvata", "incassata", { payment_date: "2026-11-02" });
  db.seed("practice_documents", { practice_id: p.id, file_name: "bilancio.pdf", file_path: `${p.id}/bilancio.pdf`, file_size: 10, mime_type: "application/pdf", document_type: null });
  db.seed("practice_documents", { practice_id: p.id, file_name: "bozza.pdf", file_path: `${p.id}/bozza.pdf`, file_size: 10, mime_type: "application/pdf", document_type: "bozza_deliberata" });
  await emitPracticeEvent(client, { practiceId: p.id, kind: "paid", origin: "admin" });
  await emitPracticeEvent(client, { practiceId: p.id, kind: "info_provided", origin: "admin", details: { message: "Inviato il bilancio" } });
  const [paid, info] = companyCalls();
  assert.equal(paid.path, "/events");
  assert.equal(paid.headers.authorization, "Bearer company-bearer-key");
  assert.equal(paid.headers["x-portal-id"], "co");
  assert.deepEqual(verifyCallbackSignature({ secret: PORTAL_SECRET, timestamp: paid.headers["x-timestamp"] as string, signature: paid.headers["x-signature"] as string, rawBody: paid.raw }), { ok: true });
  assert.equal(paid.body.schema_version, 2); assert.equal(paid.body.practice.number, p.practice_number); assert.equal(paid.body.practice.reference, "ALFA-7");
  assert.equal(paid.body.data.payment_date, "2026-11-02");
  assert.equal(info.body.data.message, "Inviato il bilancio");
  assert.deepEqual(info.body.data.documents.map((d: any) => d.file_name), ["bilancio.pdf"], "what the company already sent back is not returned");
  assert.ok(!paid.raw.includes("company-bearer-key") && !paid.raw.includes(PORTAL_SECRET));
});
await check("the admin's own actions notify the representative and the company", async () => {
  reset();
  const { client, practice, db } = setup();
  const p = practice("approvata", "non_incassata");
  const out: any = await runWorkflowAction(client, ADMIN, "workflow_register_payment", { practiceId: p.id, paymentDate: "2026-11-05" });
  assert.equal(out.stage, "da_emettere");
  assert.deepEqual(sourceCalls().map((c) => c.body.event_type), ["practice.paid"]);
  assert.deepEqual(companyCalls().map((c) => c.body.event_type), ["practice.paid"]);
  assert.equal(sourceCalls()[0].body.stage, "da_emettere");
  reset();
  await runWorkflowAction(client, ADMIN, "workflow_issue", { practiceId: p.id, policyNumber: "POL-9", document: pdfDoc() });
  assert.deepEqual(sourceCalls().map((c) => c.body.event_type), ["practice.issued"]);
  assert.equal(sourceCalls()[0].body.data.policy_number, "POL-9");
  assert.equal(sourceCalls()[0].body.data.documents[0].document_type, "polizza_emessa");
  assert.equal(companyCalls().length, 0);
  reset();
  const q = practice("in_attesa");
  await runWorkflowAction(client, ADMIN, "workflow_request_info", { practiceId: q.id, message: "Serve la visura" });
  await runWorkflowAction(client, ADMIN, "workflow_provide_info", { practiceId: q.id, message: "Eccola" });
  assert.deepEqual(sourceCalls().map((c) => c.body.event_type), ["practice.info_requested", "practice.info_provided"]);
  assert.deepEqual(companyCalls().map((c) => c.body.event_type), ["practice.info_provided"]);
  void db;
});
await check("nothing to send: no webhook, inactive webhook, practice not from a representative, unchanged step", async () => {
  for (const opts of [{ webhook: false }, { webhook: "inactive" }, { viaKey: false }] as const) {
    reset();
    const { client, practice, db } = setup(opts as any);
    const p = practice("in_attesa");
    const r = await emitPracticeEvent(client, { practiceId: p.id, kind: "deliberated", origin: "portal" });
    assert.deepEqual(r, { queued: 0, delivered: 0 }, JSON.stringify(opts));
    assert.equal(db.rows("outbound_deliveries").length, 0); assert.equal(received.length, 0);
  }
  reset();
  const { client, practice } = setup();
  const p = practice("approvata", "non_incassata");
  // a repeated call that changes nothing does not tell anybody again
  await runWorkflowAction(client, ADMIN, "workflow_provide_info", { practiceId: p.id, message: "x" }).catch(() => undefined);
  assert.equal(received.length, 0);
  // an unknown practice, a broken database: never throws
  assert.deepEqual(await emitPracticeEvent(client, { practiceId: "00000000-0000-4000-8000-00000000ffff", kind: "paid", origin: "admin" }), { queued: 0, delivered: 0 });
  const broken = { from() { throw new Error("db down"); } } as any;
  assert.deepEqual(await emitPracticeEvent(broken, { practiceId: p.id, kind: "paid", origin: "admin" }), { queued: 0, delivered: 0 });
});

section("J. Lots: processed and rejected");
await check("lot processed: the representative gets the practices created; they belong to its key", async () => {
  reset();
  const { client, practice, db, lot } = setup();
  const a = practice("in_lavorazione", "non_incassata", { api_key_id: null }), b = practice("in_lavorazione", "non_incassata", { api_key_id: null });
  const batch = db.seed("vies_batches", { user_id: ADMIN });
  db.seed("vies_jobs", { batch_id: batch.id, row_number: 1, contraente: "Azienda Uno", external_reference: a.id });
  db.seed("vies_jobs", { batch_id: batch.id, row_number: 2, contraente: "Azienda Due", external_reference: b.id });
  const r: any = await runWorkflowAction(client, ADMIN, "intake_link", { lotId: lot.id, batchId: batch.id });
  assert.equal(r.linked, 2); assert.equal(r.notified, true);
  assert.deepEqual(db.rows("practices").filter((x) => x.id === a.id || x.id === b.id).map((x) => x.api_key_id), [KEY, KEY]);
  const call = sourceCalls()[0];
  assert.equal(call.body.event_type, "lot.processed"); assert.equal(call.body.lot.lot_id, lot.id); assert.equal(call.body.lot.source_reference, "LOTTO-1"); assert.equal(call.body.lot.status, "processed");
  assert.deepEqual(call.body.data.practices.map((x: any) => [x.row_number, x.contraente, x.practice_number, x.stage]), [[1, "Azienda Uno", a.practice_number, "da_lavorare"], [2, "Azienda Due", b.practice_number, "da_lavorare"]]);
  // the representative reads them with its own key through the usual API
  assert.equal(practiceBelongsToTenant({ api_key_id: KEY, user_id: ADMIN }, { keyId: KEY, mappedUserId: OWNER, isLegacy: false } as any), true);
  assert.equal(practiceBelongsToTenant({ api_key_id: null, user_id: ADMIN }, { keyId: KEY, mappedUserId: OWNER, isLegacy: false } as any), false);
});
await check("lot rejected by the administrator: reason sent, lot closed once", async () => {
  reset();
  const { client, db, lot } = setup();
  await rejects(() => runWorkflowAction(client, ADMIN, "intake_reject", { lotId: lot.id }), "invalid_payload", 422);
  await rejects(() => runWorkflowAction(client, OWNER, "intake_reject", { lotId: lot.id, reason: "x" }), "forbidden", 403);
  const r: any = await runWorkflowAction(client, ADMIN, "intake_reject", { lotId: lot.id, reason: "Excel non conforme" });
  assert.equal(r.notified, true);
  assert.equal(db.rows("vies_intake_lots")[0].status, "rejected");
  const call = sourceCalls()[0];
  assert.equal(call.body.event_type, "lot.rejected"); assert.equal(call.body.data.reason, "Excel non conforme"); assert.equal(call.body.lot.status, "rejected");
  await rejects(() => runWorkflowAction(client, ADMIN, "intake_reject", { lotId: lot.id, reason: "ancora" }), "invalid_transition", 409);
  assert.equal(sourceCalls().length, 1);
});
await check("lot status carries the draft and the policy as links", async () => {
  const { client, practice, db, lot } = setup();
  const a = practice("approvata", "non_incassata"), b = practice("in_attesa");
  const batch = db.seed("vies_batches", { user_id: ADMIN });
  db.seed("vies_jobs", { batch_id: batch.id, row_number: 1, contraente: "Uno", external_reference: a.id });
  db.seed("vies_jobs", { batch_id: batch.id, row_number: 2, contraente: "Due", external_reference: b.id });
  db.seed("practice_documents", { practice_id: a.id, file_name: "bozza.pdf", file_path: `${a.id}/bozza.pdf`, file_size: 1, mime_type: "application/pdf", document_type: "bozza_deliberata" });
  db.seed("practice_documents", { practice_id: a.id, file_name: "visura.pdf", file_path: `${a.id}/v.pdf`, file_size: 1, mime_type: "application/pdf", document_type: null });
  Object.assign(db.rows("vies_intake_lots")[0], { batch_id: batch.id, status: "processed" });
  const ctx = { keyRecord: { id: KEY, is_active: true, expires_at: null, name: "Broker Beta" }, keyId: KEY, apiKeyMasked: "x", mappedUserId: OWNER, isLegacy: false } as any;
  const st: any = await lotStatus(client, ctx, { lotId: lot.id });
  assert.equal(st.practices[0].documents.length, 1); assert.equal(st.practices[0].documents[0].document_type, "bozza_deliberata");
  assert.match(st.practices[0].documents[0].download_url, /^https:\/\//);
  assert.equal(st.practices[1].documents, undefined);
});

section("K. Delivery, retries and refusals");
await check("a failing receiver: kept for another attempt with a growing delay, same event id", async () => {
  reset(); behaviour.status = 503;
  const { client, practice, db } = setup();
  const p = practice("in_attesa");
  const r = await emitPracticeEvent(client, { practiceId: p.id, kind: "paid", origin: "admin" });
  assert.deepEqual([r.queued, r.delivered], [2, 0]);
  const rows = db.rows("outbound_deliveries");
  for (const row of rows) { assert.equal(row.status, "pending"); assert.equal(row.attempts, 1); assert.match(row.last_error, /HTTP 503/); assert.equal(row.last_http_status, 503); assert.ok(Date.parse(row.next_attempt_at) > Date.now() + 30_000); }
  // not due yet: nothing is sent
  const before = received.length;
  assert.deepEqual(await processDueDeliveries(client), { attempted: 0, delivered: 0 });
  assert.equal(received.length, before);
  // due: delivered, with the SAME event id as the first attempt
  behaviour.status = 200;
  for (const row of rows) row.next_attempt_at = new Date(Date.now() - 1000).toISOString();
  const run = await processDueDeliveries(client);
  assert.deepEqual(run, { attempted: 2, delivered: 2 });
  assert.ok(rows.every((row) => row.status === "delivered" && row.attempts === 2 && row.last_error === null));
  const keys = received.map((c) => c.headers["idempotency-key"]);
  assert.equal(new Set(keys).size, 2); assert.equal(keys.length, 4);
  assert.deepEqual(received.slice(-2).map((c) => c.headers["x-delivery-attempt"]), ["2", "2"]);
});
await check("two runs at once deliver once", async () => {
  reset();
  const { client, practice, db } = setup();
  const p = practice("in_attesa");
  behaviour.status = 500;
  await emitPracticeEvent(client, { practiceId: p.id, kind: "sent", origin: "system" });
  behaviour.status = 200;
  const row = db.rows("outbound_deliveries")[0];
  row.next_attempt_at = new Date(Date.now() - 1000).toISOString();
  const [a, b] = await Promise.all([processDueDeliveries(client), processDueDeliveries(client)]);
  assert.equal(a.attempted + b.attempted, 1);
  assert.equal(received.filter((c) => c.body?.event_id === row.event_id && c.headers["x-delivery-attempt"] === "2").length, 1);
});
await check("a refusal that retrying cannot fix stops at once; retry by hand once fixed", async () => {
  reset(); behaviour.status = 401;
  const { client, practice, db } = setup();
  const p = practice("in_attesa");
  await emitPracticeEvent(client, { practiceId: p.id, kind: "deliberated", origin: "portal" });
  const row = db.rows("outbound_deliveries")[0];
  assert.equal(row.status, "failed"); assert.equal(row.attempts, 1); assert.match(row.last_error, /HTTP 401/);
  assert.deepEqual(await processDueDeliveries(client), { attempted: 0, delivered: 0 }, "a failed one is not retried by itself");
  behaviour.status = 200;
  const r = await retryDeliveries(client, { id: row.id });
  assert.deepEqual(r, { attempted: 1, delivered: 1 });
  assert.equal(db.rows("outbound_deliveries")[0].status, "delivered");
  // delivered ones are left alone
  assert.deepEqual(await retryDeliveries(client), { attempted: 0, delivered: 0 });
});
await check("429, 408 and timeouts are retried; the seventh failure gives up", async () => {
  reset(); behaviour.status = 429;
  const { client, practice, db } = setup({ viaKey: true });
  const p = practice("in_attesa");
  await emitPracticeEvent(client, { practiceId: p.id, kind: "deliberated", origin: "portal" });
  assert.equal(db.rows("outbound_deliveries")[0].status, "pending");
  behaviour.hang = true;
  const row = db.rows("outbound_deliveries")[0];
  const t = await attemptDelivery(client, { ...row, attempts: 1 });
  assert.equal(t.delivered, false); assert.match(t.error ?? "", /Nessuna risposta/);
  assert.equal(db.rows("outbound_deliveries")[0].status, "pending");
  behaviour.hang = false; behaviour.status = 500;
  const last = await attemptDelivery(client, { ...db.rows("outbound_deliveries")[0], attempts: MAX_ATTEMPTS - 1 });
  assert.equal(last.delivered, false);
  assert.equal(db.rows("outbound_deliveries")[0].status, "failed"); assert.equal(db.rows("outbound_deliveries")[0].attempts, MAX_ATTEMPTS);
});
await check("a target that is not set up fails clearly (and is not tried for nothing)", async () => {
  reset();
  const { client, practice, db } = setup();
  const p = practice("in_attesa");
  behaviour.status = 500;
  await emitPracticeEvent(client, { practiceId: p.id, kind: "sent", origin: "system" });
  const row = db.rows("outbound_deliveries")[0];
  // the representative switches the address off before the retry
  db.rows("partner_webhooks")[0].active = false;
  const r = await attemptDelivery(client, row);
  assert.equal(r.delivered, false); assert.match(r.error ?? "", /disattivat/);
  assert.equal(db.rows("outbound_deliveries")[0].status, "failed");
  // a webhook pointing inside the network is never called
  db.rows("partner_webhooks")[0].active = true; db.rows("partner_webhooks")[0].url = "https://127.0.0.1/hook";
  const before = received.length;
  const again = await attemptDelivery(client, { ...row, attempts: 0 });
  assert.match(again.error ?? "", /raggiungibile da Internet/);
  assert.equal(received.length, before);
});
await check("address rules: https, public, no credentials", () => {
  for (const ok of ["https://hooks.example.com/a", "https://203.0.113.9/x", "https://example.com:8443/hook?x=1"]) assert.doesNotThrow(() => assertPublicHttpsUrl(ok), ok);
  for (const bad of ["http://example.com/a", "https://localhost/a", "https://127.0.0.1/a", "https://10.0.0.5/a", "https://192.168.1.1/a", "https://172.16.0.1/a", "https://172.31.255.1/a", "https://169.254.169.254/latest", "https://[::1]/a", "https://[fd12::1]/a", "https://metadata.internal/a", "https://db.local/a", "https://user:pw@example.com/a", "ftp://example.com", "not a url", "https://100.64.0.1/a"]) assert.throws(() => assertPublicHttpsUrl(bad), undefined, bad);
  assert.doesNotThrow(() => assertPublicHttpsUrl("https://172.32.0.1/a"));
});

section("L. Settings: webhooks and deliveries");
await check("set, list, rotate, test, remove: the secret is shown once", async () => {
  reset();
  const db = new FakeDb(); const client = db as any;
  db.seed("profiles", { id: ADMIN, full_name: "Mario Admin" }); db.seed("user_roles", { user_id: ADMIN, role: "admin" });
  db.seed("api_keys", { id: KEY, name: "Broker Beta", key_prefix: "tmga_abcd", partner_email: "b@example.test", is_active: true });
  db.seed("api_keys", { id: "22222222-2222-4222-8222-222222222222", name: "Altro", key_prefix: "tmga_zzzz", partner_email: null, is_active: true });
  db.seed("api_key_user_mapping", { api_key_id: KEY, user_id: OWNER });
  await rejects(() => runWorkflowAction(client, OWNER, "webhook_list", {}), "forbidden", 403);
  await rejects(() => runWorkflowAction(client, ADMIN, "webhook_set", { apiKeyId: KEY }), "invalid_payload", 422);
  await rejects(() => runWorkflowAction(client, ADMIN, "webhook_set", { apiKeyId: KEY, url: "http://hooks.example.test/a" }), "invalid_url", 422);
  await rejects(() => runWorkflowAction(client, ADMIN, "webhook_set", { apiKeyId: KEY, url: "https://localhost/a" }), "invalid_url", 422);
  await rejects(() => runWorkflowAction(client, ADMIN, "webhook_set", { apiKeyId: "nope", url: "https://hooks.example.test/a" }), "key_not_found", 404);
  const made: any = await runWorkflowAction(client, ADMIN, "webhook_set", { apiKeyId: KEY, url: "https://hooks.example.test/tecno" });
  assert.match(made.secret, /^whsec_[0-9a-f]{64}$/); assert.equal(made.created, true);
  const stored = db.rows("partner_webhooks")[0];
  assert.equal(stored.secret, made.secret); assert.equal(stored.active, true);
  const list: any = await runWorkflowAction(client, ADMIN, "webhook_list", {});
  assert.equal(list.keys.length, 2);
  const mine = list.keys.find((k: any) => k.id === KEY);
  assert.equal(mine.webhook.url, "https://hooks.example.test/tecno"); assert.equal(mine.mapped, true);
  assert.ok(!JSON.stringify(list).includes(made.secret) && !("secret" in mine.webhook), "the list never shows the secret");
  assert.equal(list.keys.find((k: any) => k.id !== KEY).webhook, null);
  // change the address: same secret, none returned
  const changed: any = await runWorkflowAction(client, ADMIN, "webhook_set", { apiKeyId: KEY, url: "https://hooks.example.test/nuovo", active: false });
  assert.equal(changed.secret, null); assert.equal(db.rows("partner_webhooks")[0].secret, made.secret); assert.equal(db.rows("partner_webhooks")[0].active, false);
  // inactive: the test says so, nothing is sent
  const off: any = await runWorkflowAction(client, ADMIN, "webhook_test", { apiKeyId: KEY });
  assert.equal(off.delivered, false); assert.match(off.error, /disattivat/); assert.equal(received.length, 0);
  await runWorkflowAction(client, ADMIN, "webhook_set", { apiKeyId: KEY, active: true });
  const ok: any = await runWorkflowAction(client, ADMIN, "webhook_test", { apiKeyId: KEY });
  assert.equal(ok.delivered, true); assert.equal(ok.status, 200);
  const call = sourceCalls()[0];
  assert.equal(call.path, "/nuovo"); assert.equal(call.body.event_type, "practice.test");
  assert.deepEqual(verifyCallbackSignature({ secret: made.secret, timestamp: call.headers["x-timestamp"] as string, signature: call.headers["x-signature"] as string, rawBody: call.raw }), { ok: true });
  // rotate: a new secret, shown once, the old one no longer signs
  const rotated: any = await runWorkflowAction(client, ADMIN, "webhook_set", { apiKeyId: KEY, rotateSecret: true });
  assert.notEqual(rotated.secret, made.secret); assert.equal(db.rows("partner_webhooks")[0].secret, rotated.secret);
  await runWorkflowAction(client, ADMIN, "webhook_test", { apiKeyId: KEY });
  const c2 = sourceCalls()[1];
  assert.equal((verifyCallbackSignature({ secret: made.secret, timestamp: c2.headers["x-timestamp"] as string, signature: c2.headers["x-signature"] as string, rawBody: c2.raw }) as any).ok, false);
  assert.equal((verifyCallbackSignature({ secret: rotated.secret, timestamp: c2.headers["x-timestamp"] as string, signature: c2.headers["x-signature"] as string, rawBody: c2.raw }) as any).ok, true);
  // a receiver that refuses: the test reports why
  behaviour.status = 401;
  const refused: any = await runWorkflowAction(client, ADMIN, "webhook_test", { apiKeyId: KEY });
  assert.equal(refused.delivered, false); assert.equal(refused.status, 401); assert.match(refused.error, /HTTP 401/);
  // pending/failed counts show in the list
  const withFailures: any = await runWorkflowAction(client, ADMIN, "webhook_list", {});
  assert.equal(withFailures.keys.find((k: any) => k.id === KEY).failed, 2, "the one refused while switched off and the one refused with 401");
  behaviour.status = 200;
  const retried: any = await runWorkflowAction(client, ADMIN, "deliveries_retry", {});
  assert.equal(retried.delivered, 2);
  await runWorkflowAction(client, ADMIN, "webhook_remove", { apiKeyId: KEY });
  assert.equal(db.rows("partner_webhooks").length, 0);
});
await check("test the company's portal; a portal that is not configured is refused", async () => {
  reset();
  const db = new FakeDb(); const client = db as any;
  db.seed("user_roles", { user_id: ADMIN, role: "admin" });
  const ok: any = await runWorkflowAction(client, ADMIN, "portal_test", { portalId: "co" });
  assert.equal(ok.delivered, true);
  const call = companyCalls()[0];
  assert.equal(call.body.event_type, "practice.test"); assert.equal(call.headers.authorization, "Bearer company-bearer-key");
  assert.equal((verifyCallbackSignature({ secret: PORTAL_SECRET, timestamp: call.headers["x-timestamp"] as string, signature: call.headers["x-signature"] as string, rawBody: call.raw }) as any).ok, true);
  await rejects(() => runWorkflowAction(client, ADMIN, "portal_test", { portalId: "nope" }), "portal_not_found", 404);
  const status: any = await runWorkflowAction(client, ADMIN, "portal_status", {});
  assert.equal(status.portals[0].events_host, "events.alfa.example.test");
  const r = await runWorkflowAction(client, ADMIN, "deliveries_process", {});
  assert.deepEqual(r, { ok: true, attempted: 0, delivered: 0 });
});
await check("sendTestEvent on an unconfigured source says so", async () => {
  reset();
  const db = new FakeDb();
  const r = await sendTestEvent(db as any, { kind: "source", id: KEY, label: "x" });
  assert.equal(r.delivered, false); assert.match(r.error ?? "", /Nessun indirizzo/);
  assert.equal(db.rows("outbound_deliveries")[0].status, "failed");
});
section("M. The simulator receives and verifies notifications");
await check("simulator 'receive': verifies the signature of what this portal sends", async () => {
  const sim = await import(`${R}/scripts/vies-portal-simulator.mjs`);
  const { spawn } = await import("node:child_process");
  const child = spawn("node", [`${R}/scripts/vies-portal-simulator.mjs`, "receive", "--port", "4019", "--secret", SECRET], { stdio: ["ignore", "pipe", "pipe"] });
  let out = ""; child.stdout.on("data", (c) => (out += c));
  await new Promise((r) => setTimeout(r, 700));
  const raw = JSON.stringify({ event_id: "x", event_type: "practice.paid", practice: { number: "VIES-1" }, stage: "da_emettere", data: {} });
  const ts = String(Math.floor(Date.now() / 1000));
  const post = (signature: string) => realFetch("http://127.0.0.1:4019/", { method: "POST", headers: { "x-timestamp": ts, "x-signature": signature, "idempotency-key": "x" }, body: raw });
  assert.equal((await post(signCallback(SECRET, ts, raw))).status, 200);
  assert.equal((await post(signCallback("altro", ts, raw))).status, 401);
  assert.equal(sim.verifyNotification(SECRET, { "x-timestamp": ts, "x-signature": signCallback(SECRET, ts, raw) }, raw), null);
  assert.match(sim.verifyNotification(SECRET, { "x-timestamp": String(Number(ts) - 1000), "x-signature": signCallback(SECRET, String(Number(ts) - 1000), raw) }, raw) ?? "", /scaduto/);
  assert.match(out, /practice\.paid/); assert.match(out, /firma: valida/);
  child.kill();
});

void emitLotEvent;
void applyWorkflowEvent;

afterAll(() => {
  server.close();
});

report();
