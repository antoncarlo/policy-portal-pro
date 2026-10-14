/* eslint-disable @typescript-eslint/no-explicit-any -- scenario code written against loosely typed doubles */
import assert from "node:assert/strict";
import net from "node:net";
import { afterAll } from "vitest";
import { FakeDb } from "../helpers/fakedb";
import { suite } from "../helpers/suite";

const SMTP_PORT = 52527;
const mails: { to: string; rcpts: string[]; data: string }[] = [];
const smtpSink = net.createServer((sock) => {
  let inData = false, buf = "", rcpts: string[] = [];
  sock.write("220 sink ESMTP\r\n");
  sock.on("data", (chunk) => {
    buf += chunk.toString();
    while (true) {
      if (inData) {
        const end = buf.indexOf("\r\n.\r\n");
        if (end < 0) return;
        mails.push({ to: rcpts.join(","), rcpts, data: buf.slice(0, end) }); buf = buf.slice(end + 5); inData = false; sock.write("250 queued\r\n"); continue;
      }
      const nl = buf.indexOf("\r\n"); if (nl < 0) return;
      const line = buf.slice(0, nl); buf = buf.slice(nl + 2);
      const cmd = line.toUpperCase();
      if (cmd.startsWith("EHLO")) sock.write("250-sink\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n");
      else if (cmd.startsWith("AUTH PLAIN")) sock.write("235 ok\r\n");
      else if (cmd.startsWith("AUTH LOGIN")) sock.write("334 VXNlcm5hbWU6\r\n");
      else if (cmd.startsWith("MAIL FROM")) { rcpts = []; sock.write("250 ok\r\n"); }
      else if (cmd.startsWith("RCPT TO")) { rcpts = [...rcpts, line.slice(line.indexOf("<") + 1, line.indexOf(">"))]; sock.write("250 ok\r\n"); }
      else if (cmd === "DATA") { inData = true; sock.write("354 go\r\n"); }
      else if (cmd === "QUIT") { sock.write("221 bye\r\n"); sock.end(); }
      else if (/^[A-Za-z0-9+/=]+$/.test(line)) sock.write("334 UGFzc3dvcmQ6\r\n");
      else sock.write("250 ok\r\n");
    }
  });
}).listen(SMTP_PORT);

Object.assign(process.env, {
  GMAIL_USER: "portale@tecnomga.com", GMAIL_APP_PASSWORD: "pw", SMTP_HOST: "127.0.0.1", SMTP_PORT: String(SMTP_PORT),
  PORTAL_URL: "https://portale.example.test", ADMIN_NOTIFICATION_EMAILS: "none",
});

const { runWorkflowAction } = await import("../../api/_lib/vies-workflow-actions");
const { lotCycleOf, LOT_STEPS } = await import("../../src/lib/lotCycle");

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
const OTHER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const BATCH = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
const pdfDoc = (name = "bozza.pdf") => ({ file_name: name, mime_type: "application/pdf", content_base64: PDF.toString("base64") });
const sb = (db: FakeDb) => db as any;

function world() {
  const db = new FakeDb();
  db.seed("profiles", { id: OWNER, email: "owner@example.test", full_name: "Anna Rossi", language: "it", email_notifications: {} });
  db.seed("profiles", { id: ADMIN, email: "admin@example.test", full_name: "Mario Admin", language: "it" });
  db.seed("profiles", { id: OTHER, email: "other@example.test", full_name: "Altro Cliente", language: "it" });
  db.seed("user_roles", { user_id: ADMIN, role: "admin" });
  // The rep chose two communication addresses in the settings.
  db.seed("user_notification_settings", { user_id: OWNER, notification_emails: ["rep1@example.test", "rep2@example.test"], status_change: true, new_practice: true, documents: true, notes: true });
  db.seed("vies_fiscal_representatives", { id: "rep-1", name: "Rappresentante Srl", tax_code: "12345678901" });
  db.rows("vies_batches").push({ id: BATCH, name: "Excel Lotto 3 · VIES", lot_number: 3, user_id: OWNER, fiscal_representative_id: "rep-1", created_at: new Date().toISOString() });
  const practices = [1, 2, 3].map((n) =>
    db.seed("practices", { practice_number: `VIES-2026-${n}-ABCD1234`, practice_type: "vies", client_name: `Azienda ${n}`, user_id: OWNER, status: n === 3 ? "rifiutata" : "in_attesa", financial_status: "non_incassata", vies_batch_id: BATCH }),
  );
  for (const p of practices) db.seed("practice_workflow", { practice_id: p.id, target_portal: "co" });
  return { db, practices };
}

const events = (db: FakeDb, type?: string) => db.rows("vies_lot_events").filter((e) => e.batch_id === BATCH && (!type || e.event_type === type));
const flow = (db: FakeDb) => db.rows("vies_lot_flow").find((row) => row.batch_id === BATCH);
const mailsTo = (address: string) => mails.filter((mail) => mail.rcpts.includes(address)).length;

section("A. the cycle, as a pure function");
await check("steps in order; the first one not done is the current step; waiting practices do not count", () => {
  assert.deepEqual([...LOT_STEPS], ["drafts", "verify", "payment", "payment_check", "copies", "sign", "send", "issued"]);
  const practice = (over: Record<string, unknown>) => ({ id: "x", practice_number: "P", status: "approvata", financial_status: "non_incassata", hasDraft: true, hasCompanyCopy: false, signaturesComplete: false, issuedCopies: 0, ...over });
  const waiting = lotCycleOf(null, [practice({ id: "1", status: "in_attesa" }), practice({ id: "2", status: "rifiutata" })] as any);
  assert.equal(waiting.active.length, 0); assert.equal(waiting.waiting.length, 1);
  const state = lotCycleOf({ drafts_uploaded_at: "2026-10-01", drafts_confirmed_at: "2026-10-02" }, [practice({ id: "1" }), practice({ id: "2", hasDraft: false })] as any);
  assert.equal(state.current, "payment"); assert.deepEqual(state.missing.drafts, ["P"]);
  assert.equal(state.steps.find((step) => step.id === "verify")!.actor, "collaborator");
  assert.equal(state.steps.find((step) => step.id === "copies")!.actor, "admin");
  const closed = lotCycleOf({ closed_at: "2026-10-30" }, [practice({ issuedCopies: 4 })] as any);
  assert.equal(closed.current, null); assert.equal(closed.closed, true);
});

section("B. a lot goes through its cycle");
const { db, practices } = world();
const [p1, p2, p3] = practices;
const admin = (action: any, body: any = {}) => runWorkflowAction(sb(db), ADMIN, action, { batchId: BATCH, ...body });
const owner = (action: any, body: any = {}) => runWorkflowAction(sb(db), OWNER, action, { batchId: BATCH, ...body });

await check("approving with the draft for a whole lot sends no email per practice (quiet), a single approval does", async () => {
  const before = mails.length;
  await runWorkflowAction(sb(db), ADMIN, "workflow_deliberate", { practiceId: p1.id, draft: pdfDoc("bozza-1.pdf"), quiet: true });
  assert.equal(mails.length, before, "quiet: no email for the practice");
  assert.equal(db.rows("practices").find((p) => p.id === p1.id)!.status, "approvata");
  assert.equal(db.rows("notification_events").filter((e) => e.practice_id === p1.id && !e.processed_at).length, 0, "the queued events are closed");
  // Without `quiet` the practice's own email still goes to the rep's communication addresses.
  await runWorkflowAction(sb(db), ADMIN, "workflow_deliberate", { practiceId: p2.id, draft: pdfDoc("bozza-2.pdf") });
  assert.equal(mails.length, before + 1, "one email, to the two addresses the rep chose");
  assert.deepEqual([...mails[before].rcpts].sort(), ["rep1@example.test", "rep2@example.test"]);
});

await check("drafts uploaded: only an administrator; at least one practice; one email to the rep's addresses, none to the administrators", async () => {
  await rejects(() => owner("lot_record_step", { step: "drafts_uploaded", summary: { files: 2, attached: 2 } }), "forbidden", 403);
  await rejects(() => admin("lot_record_step", { step: "drafts_uploaded", summary: { files: 2, attached: 0 } }), "nothing_attached", 422);
  const before = mails.length;
  await admin("lot_record_step", { step: "drafts_uploaded", summary: { files: 3, attached: 2, unmatched: ["strano.pdf"] } });
  assert.ok(flow(db)!.drafts_uploaded_at); assert.equal(flow(db)!.drafts_uploaded_by, ADMIN);
  assert.match(events(db, "drafts_uploaded")[0].description, /2 pratiche collegate su 3 file, 1 non riconosciuti · Mario Admin/);
  assert.equal(mails.length - before, 1); assert.deepEqual([...mails[before].rcpts].sort(), ["rep1@example.test", "rep2@example.test"]); assert.equal(mailsTo("admin@example.test"), 0);
  assert.ok(db.rows("audit_log").some((row) => row.action === "lot.drafts_uploaded" && row.row_id === BATCH));
});

await check("confirming the drafts: the lot's rep or an administrator, not another client; asks for every draft; logs on the lot and on each practice", async () => {
  await rejects(() => runWorkflowAction(sb(db), OTHER, "lot_confirm_drafts", { batchId: BATCH }), "forbidden", 403);
  const missing = db.seed("practice_documents", { practice_id: "none" });
  void missing;
  const confirmed: any = await owner("lot_confirm_drafts");
  assert.equal(confirmed.changed, true); assert.equal(confirmed.practices, 2);
  assert.ok(flow(db)!.drafts_confirmed_at);
  assert.match(events(db, "drafts_confirmed")[0].description, /Bozze verificate e confermate: 2 pratiche · Anna Rossi/);
  assert.equal(db.rows("practice_events").filter((e) => e.event_type === "lot_drafts_confirmed").length, 2);
  assert.equal((await owner("lot_confirm_drafts")).changed, false, "a second confirmation is harmless");
});

await check("new drafts uploaded before the payment ask for the confirmation again", async () => {
  await admin("lot_record_step", { step: "drafts_uploaded", summary: { files: 1, attached: 1 } });
  assert.equal(flow(db)!.drafts_confirmed_at, null);
  assert.equal(events(db, "drafts_uploaded")[1].details.confirmation_reset, true);
  await owner("lot_confirm_drafts");
  assert.ok(flow(db)!.drafts_confirmed_at);
});

await check("payment: needs the signed statement and the transfer, really uploaded; the administrators get no email", async () => {
  db.strictSignedUrls = true;
  const statement = { kind: "estratto_conto_firmato", storage_path: `${BATCH}/estratto.pdf.p7m`, file_name: "estratto.pdf.p7m", mime_type: "application/pkcs7-mime", size: 10 };
  const transfer = { kind: "bonifico", storage_path: `${BATCH}/bonifico.pdf`, file_name: "bonifico.pdf", mime_type: "application/pdf", size: 10 };
  await rejects(() => owner("lot_submit_payment", { documents: [statement] }), "documents_missing", 422);
  await rejects(() => owner("lot_submit_payment", { documents: [statement, { ...transfer, storage_path: "altro-lotto/bonifico.pdf" }] }), "invalid_payload", 422);
  await rejects(() => owner("lot_submit_payment", { documents: [statement, transfer] }), "document_not_found", 422);
  await db.storage.from("vies-lot-documents").upload(statement.storage_path, Buffer.from("p7m"));
  await db.storage.from("vies-lot-documents").upload(transfer.storage_path, PDF);
  const before = mails.length;
  const done: any = await owner("lot_submit_payment", { documents: [statement, transfer] });
  assert.equal(done.changed, true); assert.ok(flow(db)!.payment_submitted_at);
  assert.equal(db.rows("vies_lot_documents").filter((d) => d.batch_id === BATCH).length, 2);
  assert.equal(mails.length, before, "no email: the administrators see it in the lot");
  assert.match(events(db, "payment_submitted")[0].description, /Estratto conto pagato: estratto.pdf.p7m, bonifico.pdf · Anna Rossi/);
});

await check("payment confirmed by an administrator only: every approved practice becomes paid, one email to the rep, no email per practice", async () => {
  await rejects(() => owner("lot_confirm_payment"), "forbidden", 403);
  const before = mails.length;
  const done: any = await admin("lot_confirm_payment", { paymentDate: "2026-10-20" });
  assert.equal(done.registered, 2);
  for (const p of [p1, p2]) {
    const row = db.rows("practices").find((x) => x.id === p.id)!;
    assert.equal(row.financial_status, "incassata"); assert.equal(row.payment_date, "2026-10-20");
  }
  assert.equal(db.rows("practices").find((x) => x.id === p3.id)!.financial_status, "non_incassata", "the rejected practice is left alone");
  assert.equal(db.rows("vies_batches").find((b) => b.id === BATCH)!.paid_at, "2026-10-20");
  assert.equal(mails.length - before, 1, "one email for the lot, to the chosen addresses");
  assert.equal(db.rows("practice_events").filter((e) => e.event_type === "workflow_paid").length, 2);
  assert.equal((await admin("lot_confirm_payment")).changed, false);
});

await check("policy copies for the company: only after the payment; one email for the lot", async () => {
  const fresh = world();
  const a = (action: any, body: any = {}) => runWorkflowAction(sb(fresh.db), ADMIN, action, { batchId: BATCH, ...body });
  await rejects(() => a("lot_record_step", { step: "copies_uploaded", summary: { files: 2, attached: 2 } }), "invalid_transition", 409);
  const before = mails.length;
  await admin("lot_record_step", { step: "copies_uploaded", summary: { files: 2, attached: 2 } });
  assert.ok(flow(db)!.copies_uploaded_at); assert.equal(mails.length - before, 1);
});

await check("an administrator attaches a document to a practice with a line in its history, and quietly", async () => {
  const before = mails.length;
  const doc: any = await runWorkflowAction(sb(db), ADMIN, "workflow_attach_document", { practiceId: p1.id, kind: "company_copy", document: pdfDoc("copia.pdf"), policyNumber: "POL-9", quiet: true });
  assert.equal(doc.changed, true);
  assert.ok(db.rows("practice_documents").some((d) => d.practice_id === p1.id && d.document_type === "polizza_copia_compagnia"));
  assert.equal(db.rows("practices").find((x) => x.id === p1.id)!.policy_number, "POL-9");
  assert.match(db.rows("practice_events").find((e) => e.event_type === "workflow_document_attached")!.description, /Polizza copia Compagnia allegata: copia.pdf · Mario Admin/);
  assert.equal(mails.length, before);
  await rejects(() => owner("workflow_attach_document", { practiceId: p1.id, kind: "company_copy", document: pdfDoc() } as any), "forbidden", 403);
  await rejects(() => runWorkflowAction(sb(db), ADMIN, "workflow_attach_document", { practiceId: p1.id, kind: "boh", document: pdfDoc() }), "invalid_payload", 422);
});

await check("signatures complete for the whole lot: logged once, administrators are not emailed; then sent to the company by an administrator", async () => {
  for (const p of [p1, p2]) {
    if (!db.rows("practice_documents").some((d) => d.practice_id === p.id && d.document_type === "polizza_copia_compagnia")) {
      db.seed("practice_documents", { practice_id: p.id, file_name: "copia.pdf", file_path: `${p.id}/c.pdf`, document_type: "polizza_copia_compagnia" });
    }
  }
  await rejects(() => admin("lot_mark_sent"), "signatures_missing", 409);
  const sign = (p: any) => ["polizza_firmata", "privacy_firmata", "mup_firmato", "antiriciclaggio_firmato"].forEach((type) => db.seed("practice_documents", { practice_id: p.id, file_name: `${type}.pdf.p7m`, file_path: `${p.id}/${type}`, document_type: type }));
  sign(p1);
  await runWorkflowAction(sb(db), OWNER, "workflow_send_signed", { practiceId: p1.id });
  assert.equal(events(db, "signatures_complete").length, 0, "one practice is not the lot");
  sign(p2);
  const before = mails.length;
  await runWorkflowAction(sb(db), OWNER, "workflow_send_signed", { practiceId: p2.id });
  assert.equal(events(db, "signatures_complete").length, 1);
  assert.equal(mails.length, before, "no email");
  const sent: any = await admin("lot_mark_sent", { reference: "email del 21/10" });
  assert.equal(sent.practices, 2); assert.ok(flow(db)!.sent_to_company_at);
  assert.match(events(db, "sent_to_company")[0].description, /inviati alla compagnia: 2 pratiche \(email del 21\/10\) · Mario Admin/);
  await rejects(() => owner("lot_mark_sent"), "forbidden", 403);
});

await check("issued policies: four copies per practice close the lot and the rep is told once", async () => {
  for (const p of [p1, p2]) for (let n = 1; n <= 4; n += 1) db.seed("practice_documents", { practice_id: p.id, file_name: `emessa-${n}.pdf`, file_path: `${p.id}/e${n}`, document_type: "polizza_emessa" });
  const before = mails.length;
  const done: any = await admin("lot_record_step", { step: "issued_uploaded", summary: { files: 8, attached: 2 } });
  assert.equal(done.closed, true); assert.ok(flow(db)!.closed_at);
  assert.equal(events(db, "closed").length, 1);
  assert.equal(mails.length - before, 1);
  // The register tells the whole story, in order.
  assert.deepEqual(events(db).map((e) => e.event_type).filter((t, i, all) => all.indexOf(t) === i), ["drafts_uploaded", "drafts_confirmed", "payment_submitted", "payment_confirmed", "copies_uploaded", "signatures_complete", "sent_to_company", "issued_uploaded", "closed"]);
});

afterAll(() => {
  smtpSink.close();
});

report();
