/* eslint-disable @typescript-eslint/no-explicit-any -- scenario code written against loosely typed doubles */
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import http from "node:http";
import net from "node:net";
import * as crypto from "node:crypto";
import { afterAll } from "vitest";
import { FakeDb } from "../helpers/fakedb";
import { suite } from "../helpers/suite";

const SMTP_PORT = 52526;
const mails: { to: string; data: string }[] = [];
const smtpSink = net.createServer((sock) => {
  let inData = false, buf = "", rcpt = "";
  sock.write("220 sink ESMTP\r\n");
  sock.on("data", (chunk) => {
    buf += chunk.toString();
    while (true) {
      if (inData) {
        const end = buf.indexOf("\r\n.\r\n");
        if (end < 0) return;
        mails.push({ to: rcpt, data: buf.slice(0, end) }); buf = buf.slice(end + 5); inData = false; sock.write("250 queued\r\n"); continue;
      }
      const nl = buf.indexOf("\r\n"); if (nl < 0) return;
      const line = buf.slice(0, nl); buf = buf.slice(nl + 2);
      const cmd = line.toUpperCase();
      if (cmd.startsWith("EHLO")) sock.write("250-sink\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n");
      else if (cmd.startsWith("AUTH PLAIN")) sock.write("235 ok\r\n");
      else if (cmd.startsWith("AUTH LOGIN")) sock.write("334 VXNlcm5hbWU6\r\n");
      else if (cmd.startsWith("MAIL FROM")) sock.write("250 ok\r\n");
      else if (cmd.startsWith("RCPT TO")) { rcpt = line.slice(line.indexOf("<") + 1, line.indexOf(">")); sock.write("250 ok\r\n"); }
      else if (cmd === "DATA") { inData = true; sock.write("354 go\r\n"); }
      else if (cmd === "QUIT") { sock.write("221 bye\r\n"); sock.end(); }
      else if (/^[A-Za-z0-9+/=]+$/.test(line)) sock.write("334 UGFzc3dvcmQ6\r\n");
      else sock.write("250 ok\r\n");
    }
  });
}).listen(SMTP_PORT);

Object.assign(process.env, {
  GMAIL_USER: "portale@tecnomga.com", GMAIL_APP_PASSWORD: "pw", SMTP_HOST: "127.0.0.1", SMTP_PORT: String(SMTP_PORT),
  PORTAL_URL: "https://portale.example.test",
});

function decodeMail(data: string): string {
  const [head, ...rest] = data.split("\r\n\r\n");
  const body = rest.join("\r\n\r\n");
  if (/quoted-printable/i.test(head)) return body.replace(/=\r\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  if (/base64/i.test(head)) return Buffer.from(body.replace(/\s/g, ""), "base64").toString();
  return body;
}

const R = fileURLToPath(new URL("../..", import.meta.url)).replace(/\/$/, "");
const { planTransition, applyWorkflowEvent, WorkflowError } = await import("../../api/_lib/vies-workflow");
const { stageOf, PRACTICE_STAGES } = await import("../../src/lib/practiceStages");
const { handlePortalCallback, signCallback, verifyCallbackSignature, parseCallbackEvent, redactForLog } = await import("../../api/_lib/vies-callback");
const { createLot, completeLot, lotStatus, IntakeError } = await import("../../api/_lib/vies-intake");
const { runWorkflowAction } = await import("../../api/_lib/vies-workflow-actions");
const { buildPortalPayload, readPortalRegistry, getConfiguredPortals } = await import("../../api/_lib/vies-orchestrator");
const { listSignedPracticeDocuments, readIncomingDocument, MAX_DOCUMENT_BYTES } = await import("../../api/_lib/vies-documents");
const { readRawBody } = await import("../../api/vies-connect");

const { check, section, report } = suite();
const rejects = async (fn: () => Promise<unknown>, code: string, status?: number) => {
  try { await fn(); } catch (error: any) {
    assert.equal(error.code, code, `expected code ${code}, got ${error.code}: ${error.message}`);
    if (status) assert.equal(error.status, status);
    return;
  }
  assert.fail(`expected ${code}`);
};

const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ADMIN = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
const pdfDoc = (name = "bozza.pdf") => ({ file_name: name, mime_type: "application/pdf", content_base64: PDF.toString("base64") });

function world() {
  const db = new FakeDb();
  db.seed("profiles", { id: OWNER, email: "owner@example.test", full_name: "Anna Rossi", language: "it", email_notifications: { status_change: true } });
  db.seed("profiles", { id: ADMIN, email: "admin@example.test", full_name: "Mario Admin", language: "it" });
  db.seed("user_roles", { user_id: ADMIN, role: "admin" });
  // The administrator is not under test here: these tests count the owner's emails.
  db.seed("user_notification_settings", { user_id: ADMIN, notification_emails: [], status_change: false, new_practice: false, documents: false, notes: false });
  let n = 0;
  const practice = (status = "in_lavorazione", financial_status: string | null = "non_incassata", extra: Record<string, unknown> = {}) => {
    n += 1;
    return db.seed("practices", { practice_number: `VIES-2026-${n}-ABCD1234`, practice_type: "vies", client_name: `Azienda ${n}`, user_id: OWNER, status, financial_status, ...extra });
  };
  return { db, practice };
}
function sentWorld() {
  const w = world();
  const original = w.practice;
  const practice = (...args: Parameters<typeof original>) => {
    const p = original(...args);
    w.db.seed("practice_workflow", { practice_id: p.id, target_portal: "co" });
    return p;
  };
  return { db: w.db, practice };
}
const events = (db: FakeDb, id: string, type?: string) => db.rows("practice_events").filter((e) => e.practice_id === id && (!type || e.event_type === type));
const sb = (db: FakeDb) => db as any;
const actor = { actor: { label: "Test" } };

section("A. Rules of passage");
await check("stages: seven, integrazioni is its own", () => {
  assert.deepEqual([...PRACTICE_STAGES], ["da_lavorare", "in_valutazione", "integrazioni", "deliberata", "da_emettere", "emessa", "non_deliberata"]);
  assert.equal(stageOf({ status: "integrazioni" }), "integrazioni");
  assert.equal(stageOf({ status: "approvata", financial_status: "non_incassata" }), "deliberata");
  assert.equal(stageOf({ status: "approvata", financial_status: null }), "deliberata");
  assert.equal(stageOf({ status: "approvata", financial_status: "incassata" }), "da_emettere");
  assert.equal(stageOf({ status: "approvata", financial_status: "provvigioni_ricevute" }), "da_emettere");
  assert.equal(stageOf({ status: "completata" }), "emessa");
  assert.equal(stageOf({ status: "rifiutata" }), "non_deliberata");
  assert.equal(stageOf({ status: "in_lavorazione" }), "da_lavorare");
});
await check("planTransition: normal path", () => {
  assert.deepEqual(planTransition("in_lavorazione", false, "sent"), { toStatus: "in_attesa", moves: true });
  assert.deepEqual(planTransition("in_attesa", false, "sent"), { toStatus: "in_attesa", moves: false });
  assert.deepEqual(planTransition("in_attesa", false, "info_requested"), { toStatus: "integrazioni", moves: true });
  assert.deepEqual(planTransition("integrazioni", false, "info_requested"), { toStatus: "integrazioni", moves: false });
  assert.deepEqual(planTransition("integrazioni", false, "info_provided"), { toStatus: "in_attesa", moves: true });
  assert.deepEqual(planTransition("integrazioni", false, "deliberated"), { toStatus: "approvata", moves: true });
  assert.deepEqual(planTransition("integrazioni", false, "rejected"), { toStatus: "rifiutata", moves: true });
  assert.deepEqual(planTransition("in_attesa", false, "deliberated"), { toStatus: "approvata", moves: true });
  assert.deepEqual(planTransition("approvata", false, "deliberated"), { toStatus: "approvata", moves: false });
  assert.deepEqual(planTransition("approvata", true, "issued"), { toStatus: "completata", moves: true });
  assert.deepEqual(planTransition("completata", true, "issued"), { toStatus: "completata", moves: false });
  assert.deepEqual(planTransition("rifiutata", false, "reopened"), { toStatus: "in_lavorazione", moves: true });
});
await check("planTransition: refusals", () => {
  const blocked = (status: string, paid: boolean, event: any, force = false) => { try { planTransition(status, paid, event, force); return false; } catch (e: any) { return e.code === "invalid_transition" && e.status === 409; } };
  assert.ok(blocked("approvata", true, "deliberated"), "already paid cannot be re-deliberated");
  assert.ok(blocked("approvata", true, "rejected"), "paid cannot be rejected");
  assert.ok(blocked("completata", true, "rejected"));
  assert.ok(blocked("rifiutata", false, "deliberated"));
  assert.ok(blocked("completata", true, "deliberated"));
  assert.ok(blocked("approvata", false, "issued"), "issue needs the payment");
  assert.ok(blocked("in_attesa", false, "issued"));
  assert.ok(blocked("in_lavorazione", false, "info_provided"));
  assert.ok(blocked("approvata", false, "info_provided"));
  assert.deepEqual(planTransition("in_attesa", false, "info_provided"), { toStatus: "in_attesa", moves: false }, "answering twice is harmless");
  assert.ok(blocked("approvata", false, "info_requested"));
  assert.ok(blocked("completata", true, "sent"));
  assert.ok(blocked("rifiutata", false, "sent"));
  // The administrator's override
  assert.ok(!blocked("approvata", false, "issued", true));
  assert.ok(!blocked("rifiutata", false, "deliberated", true));
  assert.ok(!blocked("completata", true, "sent", true));
});

section("B. Engine against the database");
await check("sent -> info requested -> info provided -> deliberated with draft -> paid -> issued", async () => {
  const { db, practice } = world();
  const p = practice();
  let r = await applyWorkflowEvent(sb(db), p.id, { type: "sent", portalId: "co", portalName: "Compagnia", reference: "REF-1" }, actor);
  assert.equal(r.to, "in_valutazione");
  const wf = db.rows("practice_workflow").find((x) => x.practice_id === p.id)!;
  assert.equal(wf.target_portal, "co"); assert.equal(wf.target_reference, "REF-1"); assert.ok(wf.sent_at);
  r = await applyWorkflowEvent(sb(db), p.id, { type: "info_requested", message: "Manca la visura" }, actor);
  assert.equal(r.to, "integrazioni");
  assert.ok(events(db, p.id, "workflow_info_requested")[0].description.includes("Manca la visura"));
  r = await applyWorkflowEvent(sb(db), p.id, { type: "info_provided" }, actor);
  assert.equal(r.to, "in_valutazione");
  r = await applyWorkflowEvent(sb(db), p.id, { type: "deliberated", paymentDueDate: "2026-11-30", note: "Premio confermato", draft: pdfDoc() }, actor);
  assert.equal(r.to, "deliberata"); assert.ok(r.documentId);
  const doc = db.rows("practice_documents")[0];
  assert.equal(doc.document_type, "bozza_deliberata"); assert.equal(doc.mime_type, "application/pdf");
  assert.ok(doc.file_path.startsWith(`${p.id}/bozza_deliberata-`), doc.file_path);
  assert.equal(doc.uploaded_by, OWNER);
  assert.ok(db.objects["practice-documents"].has(doc.file_path));
  const wf2 = db.rows("practice_workflow").find((x) => x.practice_id === p.id)!;
  assert.equal(wf2.payment_due_date, "2026-11-30"); assert.equal(wf2.deliberation_note, "Premio confermato");
  assert.ok(events(db, p.id, "workflow_deliberated")[0].description.includes("30/11/2026"));
  // history: status_change from the trigger as well
  assert.ok(events(db, p.id, "status_change").length >= 4);
  // paid
  db.rows("practices").find((x) => x.id === p.id)!.financial_status = "incassata";
  r = await applyWorkflowEvent(sb(db), p.id, { type: "issued", document: pdfDoc("polizza.pdf") }, actor);
  assert.equal(r.to, "emessa");
  assert.equal(db.rows("practice_documents").filter((d) => d.document_type === "polizza_emessa").length, 1);
});
await check("deliberated with the insurer's copy to sign; issued with every copy of the policy", async () => {
  const { db, practice } = world();
  const p = practice("in_attesa");
  const r = await applyWorkflowEvent(sb(db), p.id, { type: "deliberated", draft: pdfDoc("bozza.pdf"), companyCopy: pdfDoc("copia-compagnia.pdf") }, actor);
  assert.equal(r.to, "deliberata");
  const types = db.rows("practice_documents").filter((d) => d.practice_id === p.id).map((d) => d.document_type).sort();
  assert.deepEqual(types, ["bozza_deliberata", "polizza_copia_compagnia"]);
  assert.ok(db.rows("practice_documents").find((d) => d.document_type === "polizza_copia_compagnia")!.file_path.startsWith(`${p.id}/polizza_copia_compagnia-`));
  db.rows("practices").find((x) => x.id === p.id)!.financial_status = "incassata";
  await applyWorkflowEvent(sb(db), p.id, { type: "issued", documents: [pdfDoc("contraente.pdf"), pdfDoc("beneficiario.pdf"), pdfDoc("compagnia.pdf")] }, actor);
  assert.equal(db.rows("practice_documents").filter((d) => d.practice_id === p.id && d.document_type === "polizza_emessa").length, 3);
  assert.match(events(db, p.id, "workflow_issued")[0].description, /Polizza emessa, 3 copie/);
  // a bad copy among many: nothing is stored, the practice does not move
  const q = practice("approvata", "incassata");
  await rejects(() => applyWorkflowEvent(sb(db), q.id, { type: "issued", documents: [pdfDoc("ok.pdf"), { file_name: "x.pdf", mime_type: "application/pdf", content_base64: Buffer.from("not a pdf").toString("base64") }] }, actor), "invalid_document", 422);
  assert.equal(db.rows("practices").find((x) => x.id === q.id)!.status, "approvata");
});
await check("a rejected document changes nothing", async () => {
  const { db, practice } = world();
  const p = practice("in_attesa");
  await rejects(() => applyWorkflowEvent(sb(db), p.id, { type: "deliberated", draft: { file_name: "x.pdf", mime_type: "application/pdf", content_base64: Buffer.from("not a pdf").toString("base64") } }, actor), "invalid_document", 422);
  assert.equal(db.rows("practices")[0].status, "in_attesa");
  assert.equal(db.rows("practice_workflow").length, 0);
  assert.equal(db.rows("practice_documents").length, 0);
  await rejects(() => applyWorkflowEvent(sb(db), p.id, { type: "deliberated", draft: { file_name: "x.exe", mime_type: "application/x-msdownload", content_base64: "AAAA" } }, actor), "invalid_document");
  await rejects(() => applyWorkflowEvent(sb(db), p.id, { type: "deliberated", draft: { file_name: "x.pdf", content_base64: "%%%not base64" } }, actor), "invalid_document");
  assert.equal(db.rows("practices")[0].status, "in_attesa");
});
await check("a file the browser uploaded to the practice folder is checked and linked", async () => {
  const { db, practice } = world();
  const p = practice("in_attesa"), other = practice("in_attesa");
  const store = (db.objects["practice-documents"] ??= new Map());
  const path = `${p.id}/bozza_deliberata-123-bozza.pdf`;
  store.set(path, { bytes: PDF });
  const r = await runWorkflowAction(sb(db), ADMIN, "workflow_deliberate", { practiceId: p.id, paymentDueDate: "2026-12-20", draft: { file_name: "Bozza finale.pdf", mime_type: "application/pdf", storage_path: path } });
  assert.equal(r.to, "deliberata");
  const doc = db.rows("practice_documents")[0];
  assert.equal(doc.file_path, path); assert.equal(doc.document_type, "bozza_deliberata"); assert.equal(doc.file_name, "Bozza_finale.pdf"); assert.equal(doc.uploaded_by, ADMIN);
  assert.equal(store.size, 1, "no second copy");
  // outside the practice's folder, traversal, missing file
  for (const bad of [`${other.id}/x.pdf`, `${p.id}/../${other.id}/x.pdf`, `${p.id}//x.pdf`, "x.pdf", `${p.id}/nonexistent.pdf`]) {
    const q = practice("in_attesa");
    void q;
    await rejects(() => applyWorkflowEvent(sb(db), p.id, { type: "issued", document: { file_name: "x.pdf", storage_path: bad } }, { actor: { label: "t" }, force: true }), "invalid_document", 422);
  }
  // not a PDF: refused and removed
  const fake = `${other.id}/bozza-finta.pdf`;
  store.set(fake, { bytes: Buffer.from("MZ not a pdf") });
  await rejects(() => runWorkflowAction(sb(db), ADMIN, "workflow_deliberate", { practiceId: other.id, draft: { file_name: "x.pdf", mime_type: "application/pdf", storage_path: fake } }), "invalid_document", 422);
  assert.ok(!store.has(fake), "refused file removed");
  assert.equal(db.rows("practices").find((x) => x.id === other.id)!.status, "in_attesa");
  await rejects(() => runWorkflowAction(sb(db), ADMIN, "workflow_deliberate", { practiceId: other.id, draft: { file_name: "x.pdf" } }), "invalid_payload", 422);
});
await check("document limits: size, address, host", async () => {
  await assert.rejects(readIncomingDocument({ file_name: "big.pdf", content_base64: Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(MAX_DOCUMENT_BYTES)]).toString("base64") }), /troppo grande/);
  await assert.rejects(readIncomingDocument({ file_name: "a.pdf", url: "http://files.example.test/a.pdf" }, { documentHosts: ["files.example.test"] }), /https/);
  await assert.rejects(readIncomingDocument({ file_name: "a.pdf", url: "https://evil.example.test/a.pdf" }, { documentHosts: ["files.example.test"] }), /solo dal portale/);
  await assert.rejects(readIncomingDocument({ file_name: "a.pdf", url: "https://127.0.0.1/a.pdf" }, { documentHosts: ["files.example.test"] }), /solo dal portale/);
  await assert.rejects(readIncomingDocument({ file_name: "a.pdf", url: "https://files.example.test/a.pdf" }, { documentHosts: [] }), /solo dal portale/);
  await assert.rejects(readIncomingDocument({ file_name: "a.pdf" }), /né indirizzo/);
});
await check("storage failure leaves the practice where it was", async () => {
  const { db, practice } = world();
  const p = practice("in_attesa");
  db.failNextUpload = true;
  await rejects(() => applyWorkflowEvent(sb(db), p.id, { type: "deliberated", draft: pdfDoc() }, actor), "invalid_document");
  assert.equal(db.rows("practices")[0].status, "in_attesa");
});
await check("optimistic update: a practice changed meanwhile is a conflict", async () => {
  const { db, practice } = world();
  const p = practice("in_attesa");
  const client = sb(db);
  const original = client.from.bind(client);
  // After the engine read the practice, somebody rejects it.
  let flipped = false;
  client.from = (table: string) => {
    const q = original(table);
    if (table === "practices" && !flipped) {
      const orig = q.update.bind(q);
      q.update = (payload: any) => { if (!flipped) { flipped = true; db.rows("practices")[0].status = "rifiutata"; } return orig(payload); };
    }
    return q;
  };
  await rejects(() => applyWorkflowEvent(client, p.id, { type: "deliberated" }, actor), "conflict", 409);
});
await check("unknown practice", async () => {
  const { db } = world();
  await rejects(() => applyWorkflowEvent(sb(db), "00000000-0000-4000-8000-00000000ffff", { type: "sent", portalId: "x" }, actor), "practice_not_found", 404);
});

section("C. Callback from the company portal");
const SECRET = "s3cret-for-company";
const portals = [
  { id: "co", name: "Compagnia Alfa", url: "https://portal.alfa.test/api/in", apiKey: "k", callbackSecret: SECRET, documentHosts: ["files.alfa.test"] },
  { id: "nosecret", name: "Senza segreto", url: "https://x.test", apiKey: "k", callbackSecret: "", documentHosts: [] },
  { id: "other", name: "Altra", url: "https://other.test", apiKey: "k", callbackSecret: "other-secret", documentHosts: [] },
];
const now = Math.floor(Date.now() / 1000);
function signed(body: unknown, opts: { portal?: string; secret?: string; ts?: number; raw?: string } = {}) {
  const raw = opts.raw ?? JSON.stringify(body);
  const ts = String(opts.ts ?? now);
  return { rawBody: raw, nowSeconds: now, headers: { "x-portal-id": opts.portal ?? "co", "x-timestamp": ts, "x-signature": signCallback(opts.secret ?? SECRET, ts, raw) } };
}
const deliberated = (p: any, extra: Record<string, unknown> = {}, id = "evt-1") => ({
  event_id: id, event_type: "practice.deliberated", occurred_at: new Date().toISOString(),
  practice: { id: p.id }, data: { payment_due_date: "2026-12-15", note: "Ok", draft: pdfDoc("bozza-compagnia.pdf"), ...extra },
});

await check("signature: right, wrong secret, altered body, stale, missing, malformed", () => {
  const raw = '{"a":1}';
  const ts = String(now);
  const sig = signCallback("k", ts, raw);
  assert.equal(sig, `sha256=${crypto.createHmac("sha256", "k").update(`${ts}.${raw}`).digest("hex")}`);
  const base = { secret: "k", timestamp: ts, signature: sig, rawBody: raw, nowSeconds: now };
  assert.deepEqual(verifyCallbackSignature(base), { ok: true });
  assert.equal((verifyCallbackSignature({ ...base, secret: "x" }) as any).code, "bad_signature");
  assert.equal((verifyCallbackSignature({ ...base, rawBody: '{"a":2}' }) as any).code, "bad_signature");
  assert.equal((verifyCallbackSignature({ ...base, timestamp: String(now - 301), signature: signCallback("k", String(now - 301), raw) }) as any).code, "stale_timestamp");
  assert.equal((verifyCallbackSignature({ ...base, timestamp: String(now + 301), signature: signCallback("k", String(now + 301), raw) }) as any).code, "stale_timestamp");
  assert.deepEqual(verifyCallbackSignature({ ...base, timestamp: String(now - 299), signature: signCallback("k", String(now - 299), raw) }), { ok: true });
  assert.equal((verifyCallbackSignature({ ...base, signature: undefined }) as any).code, "bad_signature");
  assert.equal((verifyCallbackSignature({ ...base, timestamp: undefined }) as any).code, "bad_timestamp");
  assert.equal((verifyCallbackSignature({ ...base, timestamp: "abc" }) as any).code, "bad_timestamp");
  assert.equal((verifyCallbackSignature({ ...base, signature: "sha256=00" }) as any).code, "bad_signature");
  assert.equal((verifyCallbackSignature({ ...base, signature: sig.replace("sha256=", "") }) as any).code, "bad_signature");
});
await check("authentication failures all answer 401 alike and touch nothing", async () => {
  const { db, practice } = sentWorld();
  const p = practice("in_attesa");
  const body = deliberated(p);
  const cases = [
    signed(body, { secret: "wrong" }),
    signed(body, { portal: "unknown" }),
    signed(body, { portal: "nosecret", secret: "" }),
    signed(body, { ts: now - 1000 }),
    { ...signed(body), headers: {} },
    { ...signed(body), rawBody: JSON.stringify(body) + " " },
  ];
  for (const request of cases) {
    const r = await handlePortalCallback(sb(db), portals, request);
    assert.equal(r.status, 401); assert.equal(r.body.error, "unauthorized");
  }
  assert.equal(db.rows("integration_events").length, 0);
  assert.equal(db.rows("practices")[0].status, "in_attesa");
});
await check("deliberated: practice moves, draft stored, owner mailed, event logged", async () => {
  const { db, practice } = sentWorld();
  const p = practice("in_attesa");
  const before = mails.length;
  const r = await handlePortalCallback(sb(db), portals, signed(deliberated(p)));
  assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.stage, "deliberata"); assert.equal(r.body.changed, true);
  assert.equal(db.rows("practices")[0].status, "approvata");
  assert.equal(db.rows("practice_documents")[0].document_type, "bozza_deliberata");
  const ev = db.rows("integration_events")[0];
  assert.equal(ev.status, "processed"); assert.equal(ev.practice_id, p.id); assert.equal(ev.portal_id, "co");
  assert.ok(!JSON.stringify(ev.payload).includes(PDF.toString("base64")), "content is not kept in the log");
  assert.match(JSON.stringify(ev.payload), /omesso/);
  assert.equal(mails.length, before + 1);
  const mail = mails.at(-1)!;
  assert.equal(mail.to, "owner@example.test");
  assert.match(mail.data, /deliberata/i);
  const text = decodeMail(mail.data);
  assert.match(text, /15\/12\/2026/);
  assert.match(text, /https:\/\/portale\.example\.test\/practices\/[0-9a-f-]{36}/);
  assert.match(text, /logo|tecno-mga-logo/);
});
await check("the same event twice is applied once", async () => {
  const { db, practice } = sentWorld();
  const p = practice("in_attesa");
  const request = signed(deliberated(p));
  const first = await handlePortalCallback(sb(db), portals, request);
  const mailsAfterFirst = mails.length;
  const second = await handlePortalCallback(sb(db), portals, request);
  assert.equal(first.status, 200); assert.equal(second.status, 200); assert.equal(second.body.duplicate, true);
  assert.equal(db.rows("practice_documents").length, 1, "draft not stored twice");
  assert.equal(db.rows("integration_events").length, 1);
  assert.equal(events(db, p.id, "workflow_deliberated").length, 1);
  assert.equal(mails.length, mailsAfterFirst, "no second email");
});
await check("an event that failed can be sent again and then applies", async () => {
  const { db, practice } = sentWorld();
  const p = practice("rifiutata");
  const request = signed(deliberated(p, {}, "evt-retry"));
  const first = await handlePortalCallback(sb(db), portals, request);
  assert.equal(first.status, 409); assert.equal(first.body.error, "invalid_transition");
  assert.equal(db.rows("integration_events")[0].status, "failed");
  db.rows("practices")[0].status = "in_attesa";
  const second = await handlePortalCallback(sb(db), portals, request);
  assert.equal(second.status, 200); assert.equal(second.body.stage, "deliberata");
  assert.equal(db.rows("integration_events").length, 1);
  assert.equal(db.rows("integration_events")[0].status, "processed");
});
await check("rejected, info requested, issued", async () => {
  const { db, practice } = sentWorld();
  const a = practice("in_attesa"), b = practice("in_attesa"), c = practice("approvata", "incassata");
  const rej = await handlePortalCallback(sb(db), portals, signed({ event_id: "r1", event_type: "practice.rejected", practice: { number: a.practice_number }, data: { reason: "Rischio non assicurabile" } }));
  assert.equal(rej.status, 200); assert.equal(rej.body.stage, "non_deliberata");
  assert.equal(db.rows("practice_workflow").find((w) => w.practice_id === a.id)!.rejection_reason, "Rischio non assicurabile");
  const info = await handlePortalCallback(sb(db), portals, signed({ event_id: "i1", event_type: "practice.info_requested", practice: { id: b.id }, data: { message: "Allegare il bilancio" } }));
  assert.equal(info.status, 200); assert.equal(info.body.stage, "integrazioni");
  const iss = await handlePortalCallback(sb(db), portals, signed({ event_id: "x1", event_type: "practice.issued", practice: { id: c.id }, data: { policy_number: "POL-77", document: pdfDoc("polizza.pdf") } }));
  assert.equal(iss.status, 200); assert.equal(iss.body.stage, "emessa");
  assert.equal(db.rows("practices").find((x) => x.id === c.id)!.policy_number, "POL-77");
  // an issue before the payment is refused
  const d = practice("approvata", "non_incassata");
  const early = await handlePortalCallback(sb(db), portals, signed({ event_id: "x2", event_type: "practice.issued", practice: { id: d.id }, data: {} }));
  assert.equal(early.status, 409);
  assert.equal(db.rows("practices").find((x) => x.id === d.id)!.status, "approvata");
});
await check("received: stores the portal's reference, then it can be used to find the practice", async () => {
  const { db, practice } = sentWorld();
  const p = practice("in_attesa");
  const rec = await handlePortalCallback(sb(db), portals, signed({ event_id: "rc1", event_type: "practice.received", practice: { id: p.id, reference: "ALFA-9981" } }));
  assert.equal(rec.status, 200);
  const wf = db.rows("practice_workflow").find((w) => w.practice_id === p.id)!;
  assert.equal(wf.target_reference, "ALFA-9981"); assert.equal(wf.target_portal, "co");
  assert.equal(db.rows("practices")[0].status, "in_attesa", "status untouched");
  const byRef = await handlePortalCallback(sb(db), portals, signed({ event_id: "rc2", event_type: "practice.info_requested", practice: { reference: "ALFA-9981" }, data: { message: "Serve il documento" } }));
  assert.equal(byRef.status, 200); assert.equal(byRef.body.practice_id, p.id);
});
await check("a portal answers only for the practices that went to it", async () => {
  const { db, practice } = sentWorld();
  const p = practice("in_attesa");
  db.rows("practice_workflow").find((w) => w.practice_id === p.id)!.target_portal = "other";
  const r = await handlePortalCallback(sb(db), portals, signed(deliberated(p)));
  assert.equal(r.status, 403); assert.equal(r.body.error, "practice_not_assigned");
  assert.equal(db.rows("practices")[0].status, "in_attesa");
  assert.equal(db.rows("integration_events")[0].status, "failed");
});
await check("a practice never sent to the portal is not its to change", async () => {
  const { db, practice } = world();
  const stranger = practice("in_attesa");
  const r = await handlePortalCallback(sb(db), portals, signed({ event_id: "ns1", event_type: "practice.rejected", practice: { id: stranger.id }, data: { reason: "x" } }));
  assert.equal(r.status, 403); assert.equal(r.body.error, "practice_not_assigned");
  assert.equal(db.rows("practices")[0].status, "in_attesa");
  // received cannot be used to claim it either
  const rec = await handlePortalCallback(sb(db), portals, signed({ event_id: "ns2", event_type: "practice.received", practice: { id: stranger.id, reference: "X" } }));
  assert.equal(rec.status, 403);
  assert.equal(db.rows("practice_workflow").length, 0);
  // sent before the flow existed: the completed send says where it went
  const legacy = practice("in_attesa"), elsewhere = practice("in_attesa");
  db.seed("vies_jobs", { external_reference: legacy.id, status: "completed", agent_result: { portal_id: "co", portal_name: "Compagnia" } });
  db.seed("vies_jobs", { external_reference: elsewhere.id, status: "completed", agent_result: { portal_id: "other" } });
  const ok = await handlePortalCallback(sb(db), portals, signed({ event_id: "ns3", event_type: "practice.rejected", practice: { id: legacy.id }, data: { reason: "No" } }));
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  const no = await handlePortalCallback(sb(db), portals, signed({ event_id: "ns4", event_type: "practice.rejected", practice: { id: elsewhere.id }, data: { reason: "No" } }));
  assert.equal(no.status, 403);
  // a job that is not completed does not count
  const failedSend = practice("in_attesa");
  db.seed("vies_jobs", { external_reference: failedSend.id, status: "failed", agent_result: { portal_id: "co" } });
  const f = await handlePortalCallback(sb(db), portals, signed({ event_id: "ns5", event_type: "practice.rejected", practice: { id: failedSend.id }, data: { reason: "No" } }));
  assert.equal(f.status, 403);
});
await check("not found, invalid payloads", async () => {
  const { db } = sentWorld();
  const missing = await handlePortalCallback(sb(db), portals, signed({ event_id: "n1", event_type: "practice.rejected", practice: { number: "NOPE" }, data: { reason: "x" } }));
  assert.equal(missing.status, 404);
  const bad: Array<[string, unknown]> = [
    ["no event id", { event_type: "practice.rejected", practice: { id: "x" }, data: { reason: "x" } }],
    ["unknown type", { event_id: "e", event_type: "practice.exploded", practice: { id: "x" } }],
    ["no practice", { event_id: "e", event_type: "practice.rejected", data: { reason: "x" } }],
    ["no reason", { event_id: "e", event_type: "practice.rejected", practice: { id: "x" }, data: {} }],
    ["no message", { event_id: "e", event_type: "practice.info_requested", practice: { id: "x" }, data: {} }],
    ["bad due date", { event_id: "e", event_type: "practice.deliberated", practice: { id: "x" }, data: { payment_due_date: "31/12/2026" } }],
    ["impossible due date", { event_id: "e", event_type: "practice.deliberated", practice: { id: "x" }, data: { payment_due_date: "2026-13-45" } }],
    ["draft without content", { event_id: "e", event_type: "practice.deliberated", practice: { id: "x" }, data: { draft: { file_name: "a.pdf" } } }],
    ["received without reference", { event_id: "e", event_type: "practice.received", practice: { id: "x" } }],
    ["bad date", { event_id: "e", event_type: "practice.rejected", occurred_at: "yesterday", practice: { id: "x" }, data: { reason: "x" } }],
    ["array body", []],
  ];
  for (const [label, body] of bad) {
    const r = await handlePortalCallback(sb(db), portals, signed(body));
    assert.equal(r.status, 400, `${label}: ${JSON.stringify(r.body)}`); assert.equal(r.body.error, "invalid_payload", label);
  }
  const notJson = await handlePortalCallback(sb(db), portals, signed(null, { raw: "{broken" }));
  assert.equal(notJson.status, 400); assert.equal(notJson.body.error, "invalid_json");
  assert.equal(db.rows("integration_events").filter((e) => e.status === "received").length, 0, "nothing left half-done");
});
await check("draft from a link: only the portal's own hosts", async () => {
  const { db, practice } = sentWorld();
  const p = practice("in_attesa");
  const r = await handlePortalCallback(sb(db), portals, signed({ event_id: "u1", event_type: "practice.deliberated", practice: { id: p.id }, data: { draft: { file_name: "b.pdf", url: "https://evil.test/b.pdf" } } }));
  assert.equal(r.status, 422); assert.equal(r.body.error, "invalid_document");
  assert.equal(db.rows("practices")[0].status, "in_attesa");
});
await check("occurred_at in the future is ignored, parse is strict about types", () => {
  const future = new Date(Date.now() + 3600_000).toISOString();
  const r = parseCallbackEvent({ event_id: "e", event_type: "practice.rejected", occurred_at: future, practice: { id: "x" }, data: { reason: "x" } });
  assert.ok(r.ok && r.event.occurredAt === undefined);
  const s = parseCallbackEvent({ event_id: 123, event_type: "practice.rejected", practice: { id: "x" }, data: { reason: "x" } });
  assert.ok(!s.ok);
  assert.deepEqual(redactForLog({ a: { content_base64: "AAAA" }, b: [{ content_base64: "BB" }] }), { a: { content_base64: "[omesso: 4 caratteri]" }, b: [{ content_base64: "[omesso: 2 caratteri]" }] });
});
await check("email respects the user's preference and language", async () => {
  const { db, practice } = sentWorld();
  const p = practice("in_attesa");
  db.rows("profiles")[0].email_notifications = { status_change: false };
  const before = mails.length;
  await handlePortalCallback(sb(db), portals, signed({ event_id: "m1", event_type: "practice.rejected", practice: { id: p.id }, data: { reason: "No" } }));
  assert.equal(mails.length, before, "opted out");
  const q = practice("in_attesa");
  db.rows("profiles")[0].email_notifications = { status_change: true }; db.rows("profiles")[0].language = "zh";
  await handlePortalCallback(sb(db), portals, signed({ event_id: "m2", event_type: "practice.info_requested", practice: { id: q.id }, data: { message: "补充材料" } }));
  assert.equal(mails.length, before + 1);
  assert.match(decodeMail(mails.at(-1)!.data), /lang="zh-CN"/);
});

section("D. Lots sent in by another portal");
const ctx = (extra: Record<string, unknown> = {}) => ({ keyRecord: { id: "key-1", is_active: true, expires_at: null, name: "Broker Beta" }, keyId: "11111111-1111-4111-8111-111111111111", apiKeyMasked: "abcd****", mappedUserId: OWNER, isLegacy: false, ...extra });
const files = [
  { kind: "excel", file_name: "Lotto 2026-10.xlsx", size: 100 },
  { kind: "zip", file_name: "1.zip", size: 10 },
  { kind: "zip", file_name: "2.zip" },
  { kind: "visura", file_name: "visura rappresentante.pdf" },
];
await check("create: needs a key tied to a user", async () => {
  const { db } = world();
  await rejects(() => createLot(sb(db), ctx({ mappedUserId: null }) as any, { source_reference: "L1", files }), "key_not_mapped", 403);
  await rejects(() => createLot(sb(db), ctx({ isLegacy: true, keyId: undefined, keyRecord: null }) as any, { source_reference: "L1", files }), "key_not_mapped", 403);
});
await check("create: validates the declaration", async () => {
  const { db } = world();
  const c = ctx() as any;
  const bad: Array<[string, any]> = [
    ["no reference", { files }],
    ["odd reference", { source_reference: "a;b", files }],
    ["no files", { source_reference: "L", files: [] }],
    ["not an array", { source_reference: "L", files: "x" }],
    ["two excel", { source_reference: "L", files: [files[0], { kind: "excel", file_name: "b.xlsx" }] }],
    ["no excel", { source_reference: "L", files: [files[1]] }],
    ["bad kind", { source_reference: "L", files: [files[0], { kind: "exe", file_name: "a.exe" }] }],
    ["extension mismatch", { source_reference: "L", files: [files[0], { kind: "zip", file_name: "a.pdf" }] }],
    ["duplicate name", { source_reference: "L", files: [files[0], files[1], { kind: "zip", file_name: "1.ZIP" }] }],
    ["two visure", { source_reference: "L", files: [files[0], { kind: "visura", file_name: "a.pdf" }, { kind: "visura", file_name: "b.pdf" }] }],
    ["negative size", { source_reference: "L", files: [{ ...files[0], size: -5 }] }],
    ["huge size", { source_reference: "L", files: [{ ...files[0], size: 600 * 1024 * 1024 }] }],
    ["bad rows", { source_reference: "L", files, expected_rows: 0 }],
    ["not an object", "hello"],
  ];
  for (const [label, body] of bad) {
    try { await createLot(sb(db), c, body); assert.fail(`${label}: accepted`); } catch (e: any) { assert.ok(e instanceof IntakeError, `${label}: ${e.stack}`); assert.ok([400, 422].includes(e.status), `${label}: ${e.status}`); }
  }
  assert.equal(db.rows("vies_intake_lots").length, 0, "nothing stored for refused declarations");
  // path traversal in a name is flattened
  const ok = await createLot(sb(db), c, { source_reference: "L-T", files: [{ kind: "excel", file_name: "../../etc/passwd.xlsx" }] });
  assert.ok(ok.uploads[0].storage_path.startsWith(`${OWNER}/intake/${ok.lot_id}/`));
  assert.ok(!ok.uploads[0].storage_path.includes(".."));
});
await check("create -> upload -> complete -> status", async () => {
  const { db, practice } = world();
  const c = ctx() as any;
  const lot = await createLot(sb(db), c, { source_reference: "LOTTO-1", fiscal_representative: { name: "Rappresentante Srl", tax_code: "01234567890" }, expected_rows: 2, notes: "ottobre", files });
  assert.equal(lot.status, "uploading"); assert.equal(lot.uploads.length, 4);
  for (const u of lot.uploads) {
    assert.ok(u.storage_path.startsWith(`${OWNER}/intake/${lot.lot_id}/`), "owner id first: the storage rules read it");
    assert.match(u.storage_path.split("/")[0], /^[0-9a-f-]{36}$/);
    assert.match(u.upload_url, /^https:\/\//); assert.equal(u.method, "PUT");
  }
  const row = db.rows("vies_intake_lots")[0];
  assert.equal(row.source_portal, "broker-beta"); assert.equal(row.owner_user_id, OWNER); assert.equal(row.status, "uploading");
  assert.equal(row.fiscal_representative_tax_code, "01234567890"); assert.equal(row.api_key_id, c.keyId);
  // nothing uploaded yet
  await rejects(() => completeLot(sb(db), c, { lot_id: lot.lot_id }), "files_missing", 422);
  const store = (db.objects["vies-batch-files"] ??= new Map());
  const put = (path: string, size: number) => store.set(path, { bytes: Buffer.alloc(size, 1) });
  put(lot.uploads[0].storage_path, 100); put(lot.uploads[1].storage_path, 10); put(lot.uploads[2].storage_path, 55);
  try { await completeLot(sb(db), c, { lot_id: lot.lot_id }); assert.fail(); } catch (e: any) { assert.equal(e.code, "files_missing"); assert.deepEqual(e.extra.missing, ["visura_rappresentante.pdf"]); }
  put(lot.uploads[3].storage_path, 7);
  // a cut-short upload (declared 100, got 99)
  put(lot.uploads[0].storage_path, 99);
  try { await completeLot(sb(db), c, { lot_id: lot.lot_id }); assert.fail(); } catch (e: any) { assert.equal(e.code, "files_missing"); assert.deepEqual(e.extra.missing, ["Lotto_2026-10.xlsx"]); }
  put(lot.uploads[0].storage_path, 100);
  const done = await completeLot(sb(db), c, { lot_id: lot.lot_id });
  assert.equal(done.status, "received");
  const after = db.rows("vies_intake_lots")[0];
  assert.equal(after.status, "received"); assert.ok(after.received_at);
  assert.deepEqual(after.files.map((f: any) => [f.file_name, f.size, f.uploaded]), [["Lotto_2026-10.xlsx", 100, true], ["1.zip", 10, true], ["2.zip", 55, true], ["visura_rappresentante.pdf", 7, true]]);
  assert.equal(db.rows("integration_events").filter((e) => e.event_type === "lot.received").length, 1);
  // completing again is harmless; creating again is refused
  assert.equal((await completeLot(sb(db), c, { lot_id: lot.lot_id })).already_completed, true);
  await rejects(() => createLot(sb(db), c, { source_reference: "LOTTO-1", files }), "lot_already_exists", 409);
  // status, before and after processing
  let st = await lotStatus(sb(db), c, { lotId: lot.lot_id });
  assert.equal(st.lot.status, "received"); assert.deepEqual(st.practices, []);
  const p1 = practice("approvata", "non_incassata"), p2 = practice("in_attesa");
  const batch = db.seed("vies_batches", { user_id: OWNER });
  db.seed("vies_jobs", { batch_id: batch.id, row_number: 1, contraente: "Azienda Uno", external_reference: p1.id });
  db.seed("vies_jobs", { batch_id: batch.id, row_number: 2, contraente: "Azienda Due", external_reference: p2.id });
  db.seed("practice_workflow", { practice_id: p1.id, payment_due_date: "2026-12-01", deliberation_note: "ok" });
  Object.assign(db.rows("vies_intake_lots")[0], { batch_id: batch.id, status: "processed" });
  st = await lotStatus(sb(db), c, { sourceReference: "LOTTO-1" });
  assert.equal(st.lot.status, "processed");
  assert.deepEqual(st.practices.map((x: any) => [x.row_number, x.contraente, x.stage, x.payment_due_date]), [[1, "Azienda Uno", "deliberata", "2026-12-01"], [2, "Azienda Due", "in_valutazione", null]]);
  const list = await lotStatus(sb(db), c, {});
  assert.equal(list.lots.length, 1);
});
await check("a lot is visible only to its own key / user", async () => {
  const { db } = world();
  const mine = ctx() as any;
  const lot = await createLot(sb(db), mine, { source_reference: "SEGRETO", files });
  const stranger = ctx({ keyId: "99999999-9999-4999-8999-999999999999", mappedUserId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", keyRecord: { id: "k2", is_active: true, expires_at: null, name: "Broker Gamma" } }) as any;
  await rejects(() => lotStatus(sb(db), stranger, { lotId: lot.lot_id }), "lot_not_found", 404);
  await rejects(() => lotStatus(sb(db), stranger, { sourceReference: "SEGRETO" }), "lot_not_found", 404);
  await rejects(() => completeLot(sb(db), stranger, { lot_id: lot.lot_id }), "lot_not_found", 404);
  assert.deepEqual((await lotStatus(sb(db), stranger, {})).lots, []);
  // same reference from another source is another lot
  const other = await createLot(sb(db), stranger, { source_reference: "SEGRETO", files });
  assert.notEqual(other.lot_id, lot.lot_id);
});
await check("create again while still uploading: fresh upload addresses, same lot", async () => {
  const { db } = world();
  const c = ctx() as any;
  const a = await createLot(sb(db), c, { source_reference: "RETRY", files });
  const b = await createLot(sb(db), c, { source_reference: "RETRY", files: files.slice(0, 2) });
  assert.equal(a.lot_id, b.lot_id); assert.equal(b.uploads.length, 2);
  assert.equal(db.rows("vies_intake_lots").length, 1); assert.equal(db.rows("vies_intake_lots")[0].files.length, 2);
});

section("E. Administrator actions");
await check("only administrators", async () => {
  const { db, practice } = world();
  const p = practice("in_attesa");
  await rejects(() => runWorkflowAction(sb(db), OWNER, "workflow_reject", { practiceId: p.id, reason: "x" }), "forbidden", 403);
  await rejects(() => runWorkflowAction(sb(db), OWNER, "portal_status", {}), "forbidden", 403);
  assert.equal(db.rows("practices")[0].status, "in_attesa");
});
await check("manual flow: sent, deliberate with draft, payment, issue, reopen", async () => {
  const { db, practice } = world();
  const p = practice();
  const act = (a: any, body: any = {}) => runWorkflowAction(sb(db), ADMIN, a, { practiceId: p.id, ...body });
  assert.equal((await act("workflow_mark_sent", { portalName: "Portale compagnia", reference: "M-1" })).to, "in_valutazione");
  assert.match(events(db, p.id, "workflow_sent")[0].description, /Portale compagnia.*M-1/);
  assert.equal((await act("workflow_request_info", { message: "Manca il documento" })).to, "integrazioni");
  assert.equal((await act("workflow_provide_info", { message: "Inviato" })).to, "in_valutazione");
  const d = await act("workflow_deliberate", { paymentDueDate: "2026-12-31", note: "Ok", draft: pdfDoc() });
  assert.equal(d.to, "deliberata");
  assert.match(events(db, p.id, "workflow_deliberated")[0].description, /Mario Admin/);
  assert.equal(events(db, p.id, "workflow_deliberated")[0].created_by, ADMIN);
  assert.equal(db.rows("practice_documents")[0].uploaded_by, ADMIN);
  // not yet paid: cannot issue
  await rejects(() => act("workflow_issue"), "invalid_transition", 409);
  const paid = await act("workflow_register_payment", { paymentDate: "2026-12-10" });
  assert.equal(paid.stage, "da_emettere");
  const row = db.rows("practices")[0];
  assert.equal(row.financial_status, "incassata"); assert.equal(row.payment_date, "2026-12-10");
  assert.equal((await act("workflow_register_payment")).changed, false, "paying twice is harmless");
  await rejects(() => act("workflow_reject", { reason: "x" }), "invalid_transition", 409);
  assert.equal((await act("workflow_issue")).to, "emessa");
  assert.equal((await act("workflow_reopen", { reason: "errore" })).to, "da_lavorare");
  assert.ok(db.rows("practice_workflow")[0].deliberated_at === null, "reopening clears the answer");
});
await check("signed copies: the owner sends them once every signature is in; the admin may force; reopening clears it", async () => {
  const { db, practice } = world();
  const p = practice("in_attesa");
  const admin = (a: any, body: any = {}) => runWorkflowAction(sb(db), ADMIN, a, { practiceId: p.id, ...body });
  const owner = (a: any, body: any = {}) => runWorkflowAction(sb(db), OWNER, a, { practiceId: p.id, ...body });
  // not before the deliberation
  await rejects(() => owner("workflow_send_signed"), "invalid_transition", 409);
  await admin("workflow_deliberate", { draft: pdfDoc("bozza.pdf"), companyCopy: pdfDoc("copia.pdf") });
  const sign = (type: string, name: string) => db.seed("practice_documents", { practice_id: p.id, file_name: name, file_path: `${p.id}/${type}-1-${name}`, file_size: 10, mime_type: "application/pdf", document_type: type, uploaded_by: OWNER });
  sign("polizza_firmata", "polizza-firmata.pdf"); sign("privacy_firmata", "privacy.pdf"); sign("mup_firmato", "mup.pdf");
  // one signature missing: refused, with the names of what is missing
  await rejects(() => owner("workflow_send_signed"), "signatures_missing", 409);
  try { await owner("workflow_send_signed"); } catch (error: any) { assert.match(error.message, /antiriciclaggio/); }
  // another user's practice: not theirs to send
  const other = db.seed("profiles", { email: "x@example.test", full_name: "Altro" });
  await rejects(() => runWorkflowAction(sb(db), other.id, "workflow_send_signed", { practiceId: p.id }), "forbidden", 403);
  sign("antiriciclaggio_firmato", "aml.pdf");
  const sent: any = await owner("workflow_send_signed");
  assert.equal(sent.changed, true); assert.ok(sent.sentAt); assert.equal(sent.stage, "deliberata");
  assert.equal(db.rows("practice_workflow")[0].signed_sent_at, sent.sentAt);
  assert.match(events(db, p.id, "workflow_signed_sent")[0].description, /Copie firmate trasmesse alla compagnia \(Anna Rossi\)/);
  assert.equal(events(db, p.id, "workflow_signed_sent")[0].created_by, OWNER);
  // a second call is harmless; resend makes a new transmission
  assert.equal((await owner("workflow_send_signed")).changed, false);
  assert.equal((await admin("workflow_send_signed", { resend: true })).changed, true);
  assert.equal(events(db, p.id, "workflow_signed_sent").length, 2);
  // an administrator may force with a signature missing
  const q = practice("approvata", "non_incassata");
  await rejects(() => runWorkflowAction(sb(db), ADMIN, "workflow_send_signed", { practiceId: q.id }), "signatures_missing", 409);
  assert.equal((await runWorkflowAction(sb(db), ADMIN, "workflow_send_signed", { practiceId: q.id, force: true })).changed, true);
  // reopening clears the transmission
  await admin("workflow_reopen", { reason: "errore" });
  assert.equal(db.rows("practice_workflow")[0].signed_sent_at, null);
  // audit: one line per transmission
  assert.ok(db.rows("audit_log").some((row) => row.action === "practice.send_signed" && row.row_id === p.id), JSON.stringify(db.rows("audit_log").map((r) => r.action)));
});
await check("policy number: arrives after the approval; the portal's own VIES reference counts as none; the insurer's number is not overwritten by a callback", async () => {
  const { db, practice } = sentWorld();
  const p = practice("in_attesa");
  db.rows("practices").find((x) => x.id === p.id)!.policy_number = "VIES-0001";
  const admin = (a: any, body: any = {}) => runWorkflowAction(sb(db), ADMIN, a, { practiceId: p.id, ...body });
  await admin("workflow_deliberate", { draft: pdfDoc("bozza.pdf"), companyCopy: pdfDoc("copia.pdf") });
  assert.equal(db.rows("practices").find((x) => x.id === p.id)!.policy_number, "VIES-0001", "nothing at the approval");
  // after the approval the office records the number printed on the insurer's copy
  const saved: any = await admin("workflow_set_policy_number", { policyNumber: "  FID-2026-445  " });
  assert.equal(saved.changed, true); assert.equal(saved.policyNumber, "FID-2026-445");
  assert.equal(db.rows("practices").find((x) => x.id === p.id)!.policy_number, "FID-2026-445");
  assert.match(events(db, p.id, "workflow_policy_number")[0].description, /FID-2026-445 · Mario Admin/);
  assert.equal((await admin("workflow_set_policy_number", { policyNumber: "FID-2026-445" })).changed, false, "same number: nothing to do");
  await rejects(() => admin("workflow_set_policy_number", { policyNumber: "" }), "invalid_payload", 422);
  // only administrators
  await rejects(() => runWorkflowAction(sb(db), OWNER, "workflow_set_policy_number", { practiceId: p.id, policyNumber: "X-1" }), "forbidden", 403);
  assert.ok(db.rows("audit_log").some((row) => row.action === "practice.set_policy_number" && row.row_id === p.id), JSON.stringify(db.rows("audit_log").map((r) => r.action)));
  // a number sent by the company with a repeated approval replaces the portal's reference, never a real number
  const q = practice("in_attesa");
  db.rows("practices").find((x) => x.id === q.id)!.policy_number = "VIES-0002";
  await handlePortalCallback(sb(db), portals, signed({ event_id: "pn1", event_type: "practice.deliberated", practice: { id: q.id }, data: { policy_number: "POL-A", draft: pdfDoc("bozza.pdf") } }));
  assert.equal(db.rows("practices").find((x) => x.id === q.id)!.policy_number, "POL-A");
  await handlePortalCallback(sb(db), portals, signed({ event_id: "pn2", event_type: "practice.deliberated", practice: { id: q.id }, data: { policy_number: "POL-B", draft: pdfDoc("bozza2.pdf") } }));
  assert.equal(db.rows("practices").find((x) => x.id === q.id)!.policy_number, "POL-A", "an existing number stays");
});
await check("validation of what the administrator sends", async () => {
  const { db, practice } = world();
  const p = practice("in_attesa");
  const act = (a: any, body: any = {}) => runWorkflowAction(sb(db), ADMIN, a, { practiceId: p.id, ...body });
  await rejects(() => runWorkflowAction(sb(db), ADMIN, "workflow_reject", { reason: "x" }), "invalid_payload", 422);
  await rejects(() => act("workflow_reject", { reason: "  " }), "invalid_payload", 422);
  await rejects(() => act("workflow_request_info", {}), "invalid_payload", 422);
  await rejects(() => act("workflow_deliberate", { paymentDueDate: "domani" }), "invalid_payload", 422);
  await rejects(() => act("workflow_deliberate", { draft: { file_name: "a.pdf" } }), "invalid_payload", 422);
  await rejects(() => act("workflow_register_payment", {}), "invalid_transition", 409);
  assert.equal(db.rows("practices")[0].status, "in_attesa");
  // force: an administrator can correct a mistake
  const forced = await act("workflow_issue", { force: true });
  assert.equal(forced.to, "emessa");
});
await check("portal_status shows what is ready and never a secret", async () => {
  const { db } = world();
  Object.assign(process.env, { VIES_PORTALS: JSON.stringify([{ id: "co", name: "Compagnia Alfa", url: "https://portal.alfa.test/api/in", apiKeyEnv: "K_CO", callbackSecretEnv: "S_CO", documentHosts: ["files.alfa.test"] }, { id: "half", name: "Mezzo", url: "https://half.test", apiKeyEnv: "K_NONE" }]), K_CO: "KEY-VALUE", S_CO: "SECRET-VALUE" });
  const status: any = await runWorkflowAction(sb(db), ADMIN, "portal_status", {});
  assert.equal(status.callback_url, "https://portale.example.test/api/vies-portal-callback");
  assert.deepEqual(status.portals, [
    { id: "co", name: "Compagnia Alfa", host: "portal.alfa.test", can_send: true, can_receive: true, events_host: "portal.alfa.test" },
    { id: "half", name: "Mezzo", host: "half.test", can_send: false, can_receive: false, events_host: "half.test" },
  ]);
  assert.ok(!JSON.stringify(status).includes("KEY-VALUE") && !JSON.stringify(status).includes("SECRET-VALUE"));
  assert.deepEqual(getConfiguredPortals().map((p: any) => p.id), ["co"], "a portal without a key cannot be sent to");
  assert.equal(readPortalRegistry().find((p: any) => p.id === "co")!.callbackSecret, "SECRET-VALUE");
  delete process.env.VIES_PORTALS;
});

await check("a received lot is linked to the practices created from it", async () => {
  const { db, practice } = world();
  const a = practice(), b = practice();
  const lot = db.seed("vies_intake_lots", { source_portal: "broker-beta", source_reference: "LOTTO-9", owner_user_id: OWNER, status: "received", files: [] });
  const batch = db.seed("vies_batches", { user_id: ADMIN });
  db.seed("vies_jobs", { batch_id: batch.id, row_number: 1, external_reference: a.id });
  db.seed("vies_jobs", { batch_id: batch.id, row_number: 2, external_reference: b.id });
  await rejects(() => runWorkflowAction(sb(db), OWNER, "intake_link", { lotId: lot.id, batchId: batch.id }), "forbidden", 403);
  await rejects(() => runWorkflowAction(sb(db), ADMIN, "intake_link", { lotId: "nope", batchId: batch.id }), "lot_not_found", 404);
  await rejects(() => runWorkflowAction(sb(db), ADMIN, "intake_link", { lotId: lot.id, batchId: "nope" }), "batch_not_found", 404);
  const r: any = await runWorkflowAction(sb(db), ADMIN, "intake_link", { lotId: lot.id, batchId: batch.id });
  assert.equal(r.linked, 2);
  const flows = db.rows("practice_workflow");
  assert.deepEqual(flows.map((f) => [f.practice_id, f.source_portal, f.source_reference]).sort(), [[a.id, "broker-beta", "LOTTO-9"], [b.id, "broker-beta", "LOTTO-9"]].sort());
  const closed = db.rows("vies_intake_lots")[0];
  assert.equal(closed.status, "processed"); assert.equal(closed.batch_id, batch.id); assert.ok(closed.processed_at);
  await rejects(() => runWorkflowAction(sb(db), ADMIN, "intake_link", { lotId: lot.id, batchId: batch.id }), "invalid_transition", 409);
  // the source information survives the practice's later steps
  await applyWorkflowEvent(sb(db), a.id, { type: "sent", portalId: "co" }, actor);
  const flow = db.rows("practice_workflow").find((f) => f.practice_id === a.id)!;
  assert.equal(flow.source_portal, "broker-beta"); assert.equal(flow.target_portal, "co");
});

section("F. Sending to the company portal");
await check("payload carries the practice, the documents and how to answer", async () => {
  const { db, practice } = world();
  const p = practice();
  db.seed("practice_documents", { practice_id: p.id, file_name: "polizza.pdf", file_path: `${p.id}/1-polizza.pdf`, file_size: 10, mime_type: "application/pdf", document_type: null });
  db.seed("practice_documents", { practice_id: p.id, file_name: "1.zip", file_path: `vies-batch-files://${OWNER}/lotto/1.zip`, file_size: 99, mime_type: "application/zip", document_type: "altro" });
  db.seed("practice_documents", { practice_id: p.id, file_name: "vecchia-bozza.pdf", file_path: `${p.id}/b.pdf`, file_size: 5, mime_type: "application/pdf", document_type: "bozza_deliberata" });
  const documents = await listSignedPracticeDocuments(sb(db), p.id);
  assert.deepEqual(documents.map((d: any) => d.file_name), ["polizza.pdf", "1.zip"], "what came back from a portal is not sent again");
  assert.match(documents[0].download_url, /\/object\/sign\/practice-documents\//);
  assert.match(documents[1].download_url, /\/object\/sign\/vies-batch-files\/.*1\.zip/);
  assert.ok(Date.parse(documents[0].expires_at) > Date.now() + 2 * 24 * 3600 * 1000);
  const job: any = { id: "job-1", batch_id: "b-1", row_number: 3, progressivo: "3", contraente: "Azienda Tre", pec: "a@pec.it", raw_payload: { x: 1 } };
  const body: any = buildPortalPayload(job, portals[0] as any, p as any, documents);
  assert.equal(body.schema_version, 2); assert.equal(body.idempotency_key, "job-1");
  assert.deepEqual(body.practice, { id: p.id, number: p.practice_number, type: "vies", client_name: p.client_name });
  assert.equal(body.documents.length, 2);
  assert.equal(body.callback.url, "https://portale.example.test/api/vies-portal-callback"); assert.equal(body.callback.portal_id, "co");
  assert.ok(body.callback.events.includes("practice.deliberated"));
  assert.ok(!JSON.stringify(body).includes(SECRET), "the secret is never sent");
  // v1 fields are still there
  assert.equal(body.job_id, "job-1"); assert.equal(body.contraente, "Azienda Tre"); assert.equal(body.pec, "a@pec.it"); assert.deepEqual(body.raw_payload, { x: 1 });
  // a portal that cannot receive callbacks is not offered the address
  assert.equal((buildPortalPayload(job, { id: "x", callbackSecret: "" }, p as any, []) as any).callback, null);
});

section("G. Raw body reaches the signature check untouched");
await check("raw bytes over a real HTTP request, and the size limit", async () => {
  const { db, practice } = sentWorld();
  const p = practice("in_attesa");
  const seen: string[] = [];
  const server = http.createServer(async (req, res) => {
    try {
      const raw = await readRawBody(req as any);
      seen.push(raw);
      const result = await handlePortalCallback(sb(db), portals, { rawBody: raw, headers: { "x-portal-id": req.headers["x-portal-id"] as string, "x-timestamp": req.headers["x-timestamp"] as string, "x-signature": req.headers["x-signature"] as string } });
      res.writeHead(result.status, { "content-type": "application/json" }); res.end(JSON.stringify(result.body));
    } catch (error: any) { res.writeHead(error.status ?? 500); res.end(JSON.stringify({ error: error.code ?? "x" })); }
  });
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as net.AddressInfo).port;
  // Awkward but valid JSON: spacing, key order and unicode escapes that a re-serialization would change.
  const raw = `{ "event_id" : "http-1",\n "event_type":"practice.rejected", "practice":{"id":"${p.id}"},\n"data":{"reason":"Non assicurabile \\u00e0 è"} }`;
  const ts = String(Math.floor(Date.now() / 1000));
  const post = (body: string, sig: string) => fetch(`http://127.0.0.1:${port}/`, { method: "POST", headers: { "content-type": "application/json", "x-portal-id": "co", "x-timestamp": ts, "x-signature": sig }, body });
  const ok = await post(raw, signCallback(SECRET, ts, raw));
  assert.equal(ok.status, 200, await ok.text());
  assert.equal(seen[0], raw);
  assert.equal(db.rows("practices")[0].status, "rifiutata");
  assert.ok(db.rows("practice_workflow")[0].rejection_reason.includes("è"));
  const tampered = await post(raw.replace("http-1", "http-2"), signCallback(SECRET, ts, raw));
  assert.equal(tampered.status, 401);
  const huge = await post(" ".repeat(4 * 1024 * 1024 + 10), "sha256=00");
  assert.equal(huge.status, 413);
  server.close();
});

section("H. The simulator speaks the same contract");
await check("simulator: signature, callback and listen", async () => {
  const sim = await import(`${R}/scripts/vies-portal-simulator.mjs`);
  const ts = String(now);
  assert.equal(sim.sign("k", ts, '{"a":1}'), signCallback("k", ts, '{"a":1}'));
  const { db, practice } = world();
  const p = practice("in_attesa");
  db.seed("practice_workflow", { practice_id: p.id, target_portal: "co" });
  const server = http.createServer(async (req, res) => {
    const raw = await readRawBody(req as any);
    const result = await handlePortalCallback(sb(db), portals, { rawBody: raw, headers: { "x-portal-id": req.headers["x-portal-id"] as string, "x-timestamp": req.headers["x-timestamp"] as string, "x-signature": req.headers["x-signature"] as string } });
    res.writeHead(result.status, { "content-type": "application/json" }); res.end(JSON.stringify(result.body));
  });
  await new Promise<void>((r) => server.listen(0, r));
  const url = `http://127.0.0.1:${(server.address() as net.AddressInfo).port}/`;
  const ev = sim.buildEvent({ event: "deliberated", "practice-number": p.practice_number, due: "2026-12-31", note: "da simulatore", "event-id": "sim-1" });
  const ok = await sim.sendCallback({ url, portalId: "co", secret: SECRET, event: ev });
  assert.equal(ok.status, 200, ok.body);
  assert.equal(db.rows("practices")[0].status, "approvata");
  assert.equal(db.rows("practice_workflow")[0].payment_due_date, "2026-12-31");
  const bad = await sim.sendCallback({ url, portalId: "co", secret: "sbagliato", event: sim.buildEvent({ event: "rejected", "practice-number": p.practice_number }) });
  assert.equal(bad.status, 401);
  server.close();
  // listen: answers an outbound send with an external reference
  const { spawn } = await import("node:child_process");
  const child = spawn("node", [`${R}/scripts/vies-portal-simulator.mjs`, "listen", "--port", "4017", "--key", "K1"], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((r) => setTimeout(r, 700));
  const job: any = { id: "job-9", batch_id: "b", row_number: 1, contraente: "Azienda Nove", raw_payload: {} };
  const payload = buildPortalPayload(job, portals[0] as any, p as any, []);
  const denied = await fetch("http://127.0.0.1:4017/", { method: "POST", headers: { authorization: "Bearer nope" }, body: JSON.stringify(payload) });
  assert.equal(denied.status, 401);
  const answered = await fetch("http://127.0.0.1:4017/", { method: "POST", headers: { authorization: "Bearer K1", "idempotency-key": "job-9", "content-type": "application/json" }, body: JSON.stringify(payload) });
  const body: any = await answered.json();
  assert.equal(answered.status, 200); assert.match(body.external_reference, /^SIM-/);
  child.kill();
});

afterAll(() => {
  smtpSink.close();
});

report();
