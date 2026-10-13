/* eslint-disable @typescript-eslint/no-explicit-any -- scenario code written against loosely typed doubles */
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import net from "node:net";
import { afterAll } from "vitest";
import { FakeDb } from "../helpers/fakedb";
import { suite } from "../helpers/suite";

// ---- SMTP sink that keeps every recipient of every message -------------------------------------
const SMTP_PORT = 52527;
interface Mail { to: string[]; subject: string; text: string; raw: string; html: string }
const mails: Mail[] = [];
function decode(data: string): { subject: string; text: string; html: string } {
  const [head, ...rest] = data.split("\r\n\r\n");
  const body = rest.join("\r\n\r\n");
  let text = body;
  if (/quoted-printable/i.test(head)) text = Buffer.from(body.replace(/\r\n\.\./g, "\r\n.").replace(/=\r\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))), "latin1").toString("utf8");
  if (/content-transfer-encoding:\s*base64/i.test(head)) text = Buffer.from(body.replace(/\s/g, ""), "base64").toString();
  const raw = head.replace(/\r\n\s+/g, " ");
  const subjectLine = /^Subject:\s*(.*)$/im.exec(raw)?.[1] ?? "";
  const subject = subjectLine
    .replace(/(\?=)\s+(?==\?UTF-8\?)/gi, "$1")
    .replace(/=\?UTF-8\?([BQ])\?([^?]*)\?=/gi, (_, kind, value) =>
      kind.toUpperCase() === "B" ? Buffer.from(value, "base64").toString() : value.replace(/_/g, " ").replace(/=([0-9A-F]{2})/gi, (__: string, h: string) => String.fromCharCode(parseInt(h, 16))));
  return { subject, html: text, text: text.replace(/<[^>]+>/g, " ").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ") };
}
const server = net.createServer((sock) => {
  let inData = false, buf = "";
  let rcpts: string[] = [];
  sock.write("220 sink ESMTP\r\n");
  sock.on("data", (chunk) => {
    buf += chunk.toString('latin1');
    while (true) {
      if (inData) {
        const end = buf.indexOf("\r\n.\r\n");
        if (end < 0) return;
        const raw = Buffer.from(buf.slice(0, end), 'latin1').toString('utf8');
        const { subject, text, html } = decode(raw);
        mails.push({ to: rcpts, subject, text, raw, html });
        rcpts = []; buf = buf.slice(end + 5); inData = false; sock.write("250 queued\r\n"); continue;
      }
      const nl = buf.indexOf("\r\n"); if (nl < 0) return;
      const line = buf.slice(0, nl); buf = buf.slice(nl + 2);
      const cmd = line.toUpperCase();
      if (cmd.startsWith("EHLO")) sock.write("250-sink\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n");
      else if (cmd.startsWith("AUTH PLAIN")) sock.write("235 ok\r\n");
      else if (cmd.startsWith("AUTH LOGIN")) sock.write("334 VXNlcm5hbWU6\r\n");
      else if (cmd.startsWith("MAIL FROM")) sock.write("250 ok\r\n");
      else if (cmd.startsWith("RCPT TO")) { rcpts.push(line.slice(line.indexOf("<") + 1, line.indexOf(">"))); sock.write("250 ok\r\n"); }
      else if (cmd === "DATA") { inData = true; sock.write("354 go\r\n"); }
      else if (cmd === "QUIT") { sock.write("221 bye\r\n"); sock.end(); }
      else if (/^[A-Za-z0-9+/=]+$/.test(line)) sock.write("334 UGFzc3dvcmQ6\r\n");
      else sock.write("250 ok\r\n");
    }
  });
});
await new Promise<void>((resolve) => server.listen(SMTP_PORT, resolve));

Object.assign(process.env, {
  GMAIL_USER: "portale@tecnomga.com", GMAIL_APP_PASSWORD: "pw", SMTP_HOST: "127.0.0.1", SMTP_PORT: String(SMTP_PORT),
  PORTAL_URL: "https://portale.example.test", ADMIN_NOTIFICATION_EMAILS: "office@example.test",
});

const R = fileURLToPath(new URL("../..", import.meta.url)).replace(/\/$/, "");
const { dispatchNotifications, attributeQueuedEvents, labelQueuedEvents, sendNotificationSample, isEmailAddress } = await import("../../api/_lib/notification-dispatch");
const { runWorkflowAction } = await import("../../api/_lib/vies-workflow-actions");

const { check, section, report } = suite();

const ADMIN1 = "a1000000-0000-4000-8000-000000000001";
const ADMIN2 = "a2000000-0000-4000-8000-000000000002";
const AGENT = "b1000000-0000-4000-8000-000000000003";
const COLL = "c1000000-0000-4000-8000-000000000004";
const COLL_ZH = "c2000000-0000-4000-8000-000000000005";
const OTHER_AGENT = "b2000000-0000-4000-8000-000000000006";
const OTHER_COLL = "c3000000-0000-4000-8000-000000000007";
const sb = (db: FakeDb) => db as any;

function world() {
  const db = new FakeDb();
  const person = (id: string, name: string, email: string, role: string, language = "it", parent: string | null = null, prefs: Record<string, boolean> | null = null) => {
    db.seed("profiles", { id, full_name: name, email, language, email_notifications: prefs });
    db.seed("user_roles", { user_id: id, role, parent_agent_id: parent });
  };
  person(ADMIN1, "Mario Admin", "mario@admin.test", "admin");
  person(ADMIN2, "Luca Admin", "luca@admin.test", "admin", "en");
  person(AGENT, "Anna Agente", "anna@agent.test", "agente");
  person(COLL, "Carlo Collaboratore", "carlo@coll.test", "collaboratore", "it", AGENT);
  person(COLL_ZH, "王伟", "wang@coll.test", "collaboratore", "zh", AGENT);
  person(OTHER_AGENT, "Olga Altra", "olga@agent.test", "agente");
  person(OTHER_COLL, "Otto Altro", "otto@coll.test", "collaboratore", "it", OTHER_AGENT);
  let n = 0;
  const practice = (user = COLL, status = "in_attesa", financial = "non_incassata", extra: Record<string, unknown> = {}) => {
    n += 1;
    return db.seed("practices", { practice_number: `PR-2026-${String(n).padStart(4, "0")}`, practice_type: "auto", client_name: `Cliente ${n}`, user_id: user, status, financial_status: financial, notes: null, ...extra });
  };
  return { db, practice };
}
const settle = (db: FakeDb, userId: string, patch: Record<string, unknown>) => {
  const row = db.rows("user_notification_settings").find((r) => r.user_id === userId);
  if (row) Object.assign(row, patch);
  else db.seed("user_notification_settings", { notification_emails: [], status_change: true, new_practice: true, documents: true, notes: true, ...patch, user_id: userId });
};
const flush = async (db: FakeDb) => dispatchNotifications(sb(db));
const to = (mail: Mail) => mail.to.slice().sort().join(",");
const recipients = (since: number) => mails.slice(since).map(to).sort();
const pending = (db: FakeDb) => db.rows("notification_events").filter((e) => !e.processed_at);
const update = (db: FakeDb, id: string, patch: Record<string, unknown>, actor: string | null) => {
  db.actor = actor;
  return db.from("practices").update(patch).eq("id", id).then((r: any) => { db.actor = null; return r; });
};

section("A. Status changes: who is written to");
await check("change by an administrator: the owner and the reference agent, nobody else", async () => {
  const { db, practice } = world();
  const p = practice(COLL);
  await update(db, p.id, { status: "approvata" }, ADMIN1);
  const before = mails.length;
  const summary = await flush(db);
  assert.equal(summary.emails, 2);
  assert.deepEqual(recipients(before), ["anna@agent.test", "carlo@coll.test"]);
});
await check("personal text: practice number, deliberated, what to do, link, in the reader's words", async () => {
  const { db, practice } = world();
  const p = practice(COLL);
  db.seed("practice_workflow", { practice_id: p.id, payment_due_date: "2026-12-20", deliberation_note: "Premio da versare in unica soluzione" });
  await update(db, p.id, { status: "approvata" }, ADMIN1);
  const before = mails.length;
  await flush(db);
  const coll = mails.slice(before).find((m) => m.to.includes("carlo@coll.test"))!;
  assert.equal(coll.subject, `Pratica n. ${p.practice_number}: deliberata`);
  assert.match(coll.text, /Gentile Carlo Collaboratore,/);
  assert.match(coll.text, new RegExp(`La pratica n\\. ${p.practice_number} \\(Auto · Cliente \\d+\\) è stata deliberata\\.`));
  assert.match(coll.text, /Entra nel portale per controllare le azioni da fare: scarica la bozza, firma i documenti nella sezione «Documenti da firmare» e procedi al pagamento entro il 20\/12\/2026\./);
  assert.match(coll.text, /Nota: Premio da versare in unica soluzione/);
  assert.match(coll.raw, /tecno-mga-logo/);
  assert.ok(coll.html.includes(`https://portale.example.test/practices/${p.id}`));
  const agent = mails.slice(before).find((m) => m.to.includes("anna@agent.test"))!;
  assert.match(agent.text, /Gentile Anna Agente,/);
  assert.match(agent.text, /di Carlo Collaboratore/, "the agent sees whose practice it is");
  assert.doesNotMatch(coll.text, /di Carlo Collaboratore/);
});
await check("change by the system (company portal, API): the administrators hear too", async () => {
  const { db, practice } = world();
  const p = practice(COLL);
  await update(db, p.id, { status: "approvata" }, null);
  const before = mails.length;
  await flush(db);
  assert.deepEqual(recipients(before), ["anna@agent.test", "carlo@coll.test", "luca@admin.test", "mario@admin.test"]);
  const luca = mails.slice(before).find((m) => m.to.includes("luca@admin.test"))!;
  assert.equal(luca.subject, `Practice no. ${p.practice_number}: approved`, "English administrator, English email");
  assert.match(luca.text, /Dear Luca Admin,/);
  assert.match(luca.text, /has been approved/);
});
await check("the person who acted is never written to about it", async () => {
  const { db, practice } = world();
  const p = practice(COLL);
  await update(db, p.id, { status: "approvata" }, COLL);
  const before = mails.length;
  await flush(db);
  assert.ok(!recipients(before).includes("carlo@coll.test"));
});
await check("a collaborator of another agent is not touched", async () => {
  const { db, practice } = world();
  const p = practice(OTHER_COLL);
  await update(db, p.id, { status: "approvata" }, ADMIN1);
  const before = mails.length;
  await flush(db);
  assert.deepEqual(recipients(before), ["otto@coll.test", "olga@agent.test"].sort());
});
await check("every stage has its own words (it)", async () => {
  const cases: Array<[Record<string, unknown>, string, RegExp]> = [
    [{ status: "integrazioni" }, "integrazioni richieste", /servono delle integrazioni/],
    [{ status: "rifiutata" }, "non deliberata", /non è stata deliberata/],
    [{ status: "completata" }, "polizza emessa", /polizza della pratica .* è stata emessa/],
    [{ status: "in_lavorazione" }, "in lavorazione", /è tornata in lavorazione/],
  ];
  for (const [patch, label, pattern] of cases) {
    const { db, practice } = world();
    const p = practice(COLL);
    await update(db, p.id, patch, ADMIN1);
    const before = mails.length;
    await flush(db);
    const mail = mails.slice(before).find((m) => m.to.includes("carlo@coll.test"))!;
    assert.ok(mail, label);
    assert.match(mail.subject, new RegExp(label));
    assert.match(mail.text, pattern);
  }
});
await check("information requested carries the request; rejected carries the reason", async () => {
  const { db, practice } = world();
  const p = practice(COLL);
  db.seed("practice_events", { practice_id: p.id, event_type: "workflow_info_requested", description: "Integrazioni richieste: visura camerale aggiornata" });
  await update(db, p.id, { status: "integrazioni" }, ADMIN1);
  let before = mails.length;
  await flush(db);
  assert.match(mails.slice(before).find((m) => m.to.includes("carlo@coll.test"))!.text, /servono delle integrazioni: visura camerale aggiornata\./);

  const q = practice(COLL);
  db.seed("practice_workflow", { practice_id: q.id, rejection_reason: "Rischio fuori appetito" });
  await update(db, q.id, { status: "rifiutata" }, ADMIN1);
  before = mails.length;
  await flush(db);
  assert.match(mails.slice(before).find((m) => m.to.includes("carlo@coll.test"))!.text, /non è stata deliberata: Rischio fuori appetito\./);
});
await check("payment recorded: 'pagamento registrato', still no action needed", async () => {
  const { db, practice } = world();
  const p = practice(COLL, "approvata", "non_incassata");
  await update(db, p.id, { financial_status: "incassata" }, ADMIN1);
  const before = mails.length;
  await flush(db);
  const mail = mails.slice(before).find((m) => m.to.includes("carlo@coll.test"))!;
  assert.match(mail.subject, /pagamento registrato/);
  assert.match(mail.text, /la polizza è in emissione/);
});
await check("a change inside the same stage is not news", async () => {
  const { db, practice } = world();
  const p = practice(COLL, "approvata", "non_incassata");
  await update(db, p.id, { financial_status: null }, ADMIN1);
  const before = mails.length;
  const summary = await flush(db);
  assert.equal(mails.length, before);
  assert.equal(summary.emails, 0);
  assert.equal(pending(db).length, 0, "the event is consumed");
});

section("B. Several changes at once: one email");
await check("three practices moved: one digest per person, with the list", async () => {
  const { db, practice } = world();
  const ps = [practice(COLL), practice(COLL), practice(COLL)];
  for (const p of ps) await update(db, p.id, { status: "approvata" }, ADMIN1);
  const before = mails.length;
  await flush(db);
  const mine = mails.slice(before).filter((m) => m.to.includes("carlo@coll.test"));
  assert.equal(mine.length, 1);
  assert.equal(mine[0].subject, "3 pratiche aggiornate");
  assert.match(mine[0].text, /3 pratiche hanno cambiato stato/);
  for (const p of ps) assert.ok(mine[0].text.includes(p.practice_number));
  assert.match(mine[0].text, /deliberata/);
  assert.match(mine[0].text, /Entra nel portale per controllare le azioni da fare\./);
});
await check("back and forth in the same run: nothing; through an intermediate state: one line, final state", async () => {
  const { db, practice } = world();
  const a = practice(COLL);
  await update(db, a.id, { status: "integrazioni" }, ADMIN1);
  await update(db, a.id, { status: "in_attesa" }, ADMIN1);
  const b = practice(COLL);
  await update(db, b.id, { status: "integrazioni" }, ADMIN1);
  await update(db, b.id, { status: "approvata" }, ADMIN1);
  const before = mails.length;
  await flush(db);
  const mine = mails.slice(before).filter((m) => m.to.includes("carlo@coll.test"));
  assert.equal(mine.length, 1);
  assert.equal(mine[0].subject, `Pratica n. ${b.practice_number}: deliberata`, "only b is news, and it is deliberata");
  assert.doesNotMatch(mine[0].text, /integrazioni richieste/i);
});
await check("a big list is cut at fifteen lines, with the count of the rest", async () => {
  const { db, practice } = world();
  for (let i = 0; i < 20; i += 1) { const p = practice(COLL); await update(db, p.id, { status: "approvata" }, ADMIN1); }
  const before = mails.length;
  await flush(db);
  const mail = mails.slice(before).find((m) => m.to.includes("carlo@coll.test"))!;
  assert.equal(mail.subject, "20 pratiche aggiornate");
  assert.equal((mail.text.match(/PR-2026-/g) ?? []).length, 15);
  assert.match(mail.text, /… e altre 5/);
});

section("C. New practices, documents, notes: the administrators");
await check("new practice by a collaborator: administrators, reference agent and the office mailbox; not the uploader", async () => {
  const { db } = world();
  db.actor = COLL;
  await db.from("practices").insert({ practice_number: "PR-2026-9001", practice_type: "casa", client_name: "Bianchi Srl", user_id: COLL, status: "in_lavorazione", financial_status: "non_incassata" });
  db.actor = null;
  const before = mails.length;
  await flush(db);
  assert.deepEqual(recipients(before), ["anna@agent.test", "luca@admin.test", "mario@admin.test", "office@example.test"]);
  const mario = mails.slice(before).find((m) => m.to.includes("mario@admin.test"))!;
  assert.equal(mario.subject, "Nuova pratica n. PR-2026-9001 caricata da Carlo Collaboratore");
  assert.match(mario.text, /Carlo Collaboratore ha caricato la pratica n\. PR-2026-9001 \(Casa · Bianchi Srl\)\./);
  assert.match(mario.text, /Entra nel portale per valutarla\./);
  assert.ok(!mario.text.includes("di Carlo Collaboratore"), "the uploader is named once");
});
await check("the office mailbox is not written twice when an administrator already uses it", async () => {
  const { db } = world();
  settle(db, ADMIN1, { notification_emails: ["office@example.test", "mario@admin.test"] });
  db.actor = COLL;
  await db.from("practices").insert({ practice_number: "PR-2026-9002", practice_type: "casa", client_name: "Verdi", user_id: COLL, status: "in_lavorazione", financial_status: "non_incassata" });
  db.actor = null;
  const before = mails.length;
  await flush(db);
  const all = mails.slice(before).flatMap((m) => m.to);
  assert.equal(all.filter((a) => a === "office@example.test").length, 1);
  assert.deepEqual(mails.slice(before).find((m) => m.to.includes("mario@admin.test"))!.to.sort(), ["mario@admin.test", "office@example.test"]);
});
await check("documents that come with the upload are part of the 'new practice' email", async () => {
  const { db } = world();
  db.actor = COLL;
  const { data: p } = await db.from("practices").insert({ practice_number: "PR-2026-9003", practice_type: "auto", client_name: "Neri", user_id: COLL, status: "in_lavorazione", financial_status: "non_incassata" }).select("id").single();
  await db.from("practice_documents").insert({ practice_id: p.id, file_name: "libretto.pdf", uploaded_by: COLL, document_type: "libretto" });
  await db.from("practice_documents").insert({ practice_id: p.id, file_name: "carta.pdf", uploaded_by: COLL, document_type: "carta_identita" });
  db.actor = null;
  assert.equal(db.rows("notification_events").filter((e) => e.event_type === "documents_added").length, 0, "the trigger already left them out");
  const before = mails.length;
  await flush(db);
  assert.ok(mails.slice(before).every((m) => /Nuova pratica|New practice/.test(m.subject)), mails.slice(before).map((m) => m.subject).join(" | "));
});
await check("missing documents later: administrators and reference agent; the administrator is told to check the integrations", async () => {
  const { db, practice } = world();
  const p = practice(COLL, "integrazioni");
  db.actor = COLL;
  await db.from("practice_documents").insert({ practice_id: p.id, file_name: "visura.pdf", uploaded_by: COLL, document_type: "visura" });
  await db.from("practice_documents").insert({ practice_id: p.id, file_name: "bilancio.pdf", uploaded_by: COLL, document_type: "bilancio" });
  db.actor = null;
  const before = mails.length;
  await flush(db);
  assert.deepEqual(recipients(before), ["anna@agent.test", "luca@admin.test", "mario@admin.test"]);
  const mario = mails.slice(before).find((m) => m.to.includes("mario@admin.test"))!;
  assert.equal(mario.subject, `Nuovi documenti sulla pratica n. ${p.practice_number}`);
  assert.match(mario.text, /Carlo Collaboratore ha caricato dei documenti sulla pratica n\. .*: visura\.pdf, bilancio\.pdf\./);
  assert.match(mario.text, /segna le integrazioni come fornite/);
  const anna = mails.slice(before).find((m) => m.to.includes("anna@agent.test"))!;
  assert.doesNotMatch(anna.text, /segna le integrazioni/);
});
await check("an administrator adding a document tells the owner and the agent, not the other way round", async () => {
  const { db, practice } = world();
  const p = practice(COLL);
  db.actor = ADMIN1;
  await db.from("practice_documents").insert({ practice_id: p.id, file_name: "integrazione.pdf", uploaded_by: ADMIN1, document_type: "altro" });
  db.actor = null;
  const before = mails.length;
  await flush(db);
  assert.deepEqual(recipients(before), ["anna@agent.test", "carlo@coll.test", "luca@admin.test"]);
});
await check("notes changed by the collaborator: administrators and agent", async () => {
  const { db, practice } = world();
  const p = practice(COLL);
  await update(db, p.id, { notes: "Il cliente ha cambiato il numero" }, COLL);
  const before = mails.length;
  await flush(db);
  assert.deepEqual(recipients(before), ["anna@agent.test", "luca@admin.test", "mario@admin.test"]);
  assert.match(mails.at(-1)!.subject, /Note aggiornate sulla pratica n\./);
});
await check("a system-generated document just after creation is not a separate email", async () => {
  const { db } = world();
  db.actor = COLL;
  const { data: p } = await db.from("practices").insert({ practice_number: "PR-2026-9004", practice_type: "pet", client_name: "Gialli", user_id: COLL, status: "in_lavorazione", financial_status: "non_incassata" }).select("id").single();
  db.actor = null;
  await db.from("practice_documents").insert({ practice_id: p.id, file_name: "preventivo.zip", uploaded_by: COLL, document_type: "preventivo" });
  const before = mails.length;
  await flush(db);
  assert.ok(mails.slice(before).every((m) => /Nuova pratica|New practice/.test(m.subject)), mails.slice(before).map((m) => m.subject).join(" | "));
});

section("D. Choices of the administrator");
await check("addresses chosen for a user replace the sign-in email (up to three, one message)", async () => {
  const { db, practice } = world();
  settle(db, COLL, { notification_emails: ["carlo.lavoro@coll.test", "segreteria@coll.test"] });
  const p = practice(COLL);
  await update(db, p.id, { status: "approvata" }, ADMIN1);
  const before = mails.length;
  await flush(db);
  const mail = mails.slice(before).find((m) => m.to.includes("segreteria@coll.test"))!;
  assert.deepEqual(mail.to.sort(), ["carlo.lavoro@coll.test", "segreteria@coll.test"]);
  assert.ok(!recipients(before).includes("carlo@coll.test"));
});
await check("invalid or duplicate addresses are dropped; with none left the sign-in email is used", async () => {
  const { db, practice } = world();
  settle(db, COLL, { notification_emails: ["non-un-indirizzo", "a b@x.test"] });
  const p = practice(COLL);
  await update(db, p.id, { status: "approvata" }, ADMIN1);
  const before = mails.length;
  await flush(db);
  assert.ok(recipients(before).includes("carlo@coll.test"));
  assert.equal(isEmailAddress("a@b.co"), true); assert.equal(isEmailAddress("a@b"), false); assert.equal(isEmailAddress("a@b.co, c@d.co"), false);
});
await check("event types can be turned off per user (status, new practice, documents, notes)", async () => {
  const { db, practice } = world();
  settle(db, AGENT, { status_change: false });
  settle(db, ADMIN1, { new_practice: false, documents: false, notes: false });
  const p = practice(COLL);
  await update(db, p.id, { status: "approvata" }, ADMIN2);
  db.actor = COLL;
  await db.from("practices").insert({ practice_number: "PR-2026-9100", practice_type: "casa", client_name: "X", user_id: COLL, status: "in_lavorazione", financial_status: "non_incassata" });
  await db.from("practice_documents").insert({ practice_id: p.id, file_name: "d.pdf", uploaded_by: COLL, document_type: "altro" });
  db.actor = null;
  await update(db, p.id, { notes: "x" }, COLL);
  const before = mails.length;
  await flush(db);
  const got = recipients(before);
  assert.ok(!got.includes("mario@admin.test"), "Mario muted everything but status");
  assert.ok(got.includes("luca@admin.test"));
  const anna = mails.slice(before).filter((m) => m.to.includes("anna@agent.test"));
  assert.ok(anna.every((m) => !/deliberata/.test(m.subject)), "Anna has no status email");
  assert.ok(anna.length >= 1, "but she still has the others");
});
await check("the person's own switches in their profile are honoured too", async () => {
  const { db, practice } = world();
  db.rows("profiles").find((r) => r.id === COLL)!.email_notifications = { status_change: false, new_practice: true, new_document: true };
  const p = practice(COLL);
  await update(db, p.id, { status: "approvata" }, ADMIN1);
  const before = mails.length;
  await flush(db);
  assert.ok(!recipients(before).includes("carlo@coll.test"));
  assert.ok(recipients(before).includes("anna@agent.test"));
});
await check("people without an email address are skipped without trouble", async () => {
  const { db, practice } = world();
  db.rows("profiles").find((r) => r.id === COLL)!.email = null;
  const p = practice(COLL);
  await update(db, p.id, { status: "approvata" }, ADMIN1);
  const before = mails.length;
  const summary = await flush(db);
  assert.deepEqual(recipients(before), ["anna@agent.test"]);
  assert.equal(summary.failed, 0);
});

section("E. Languages");
await check("Chinese reader: Chinese subject and text, lang attribute", async () => {
  const { db, practice } = world();
  const p = practice(COLL_ZH);
  await update(db, p.id, { status: "approvata" }, ADMIN1);
  const before = mails.length;
  await flush(db);
  const mail = mails.slice(before).find((m) => m.to.includes("wang@coll.test"))!;
  assert.match(mail.subject, /^申请 PR-2026-\d+：已核准$/);
  assert.match(mail.text, /王伟，您好：/);
  assert.match(mail.text, /已核准/);
  assert.match(mail.html, /lang="zh-CN"/);
});

section("F. Reliability");
await check("the immediate flush and the daily run never send the same email twice", async () => {
  const { db, practice } = world();
  const p = practice(COLL);
  await update(db, p.id, { status: "approvata" }, ADMIN1);
  const before = mails.length;
  await Promise.all([flush(db), flush(db), flush(db)]);
  await flush(db);
  assert.equal(mails.slice(before).filter((m) => m.to.includes("carlo@coll.test")).length, 1);
  assert.equal(pending(db).length, 0);
});
await check("mail service down: the events stay in the queue; later they go out", async () => {
  const { db, practice } = world();
  const p = practice(COLL);
  await update(db, p.id, { status: "approvata" }, ADMIN1);
  process.env.SMTP_PORT = "1"; // nothing listens here
  const before = mails.length;
  const first = await flush(db);
  assert.equal(mails.length, before);
  assert.ok(first.failed >= 1 && first.released >= 1, JSON.stringify(first));
  const queued = pending(db);
  assert.equal(queued.length, 1 + 0, "one event, back in the queue");
  assert.equal(queued[0].attempts, 1);
  assert.ok(queued[0].last_error);
  assert.ok(db.rows("email_logs").some((r) => r.status === "failed"));
  process.env.SMTP_PORT = String(SMTP_PORT);
  await flush(db);
  assert.equal(pending(db).length, 0);
  assert.ok(mails.slice(before).some((m) => m.to.includes("carlo@coll.test")));
});
await check("after five failures the event is dropped with its reason, not retried for ever", async () => {
  const { db, practice } = world();
  const p = practice(COLL);
  await update(db, p.id, { status: "approvata" }, ADMIN1);
  process.env.SMTP_PORT = "1";
  for (let i = 0; i < 6; i += 1) await flush(db);
  process.env.SMTP_PORT = String(SMTP_PORT);
  assert.equal(pending(db).length, 0);
  const event = db.rows("notification_events")[0];
  assert.equal(event.attempts, 5);
  assert.ok(event.processed_at && event.last_error);
});
await check("events older than three days are expired, not sent", async () => {
  const { db, practice } = world();
  const p = practice(COLL);
  await update(db, p.id, { status: "approvata" }, ADMIN1);
  db.rows("notification_events")[0].created_at = new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString();
  const before = mails.length;
  const summary = await flush(db);
  assert.equal(summary.expired, 1);
  assert.equal(mails.length, before);
  assert.equal(db.rows("notification_events")[0].last_error, "expired");
});
await check("no mail service configured: nothing is claimed, the queue is kept", async () => {
  const { db, practice } = world();
  const p = practice(COLL);
  await update(db, p.id, { status: "approvata" }, ADMIN1);
  const saved = { u: process.env.GMAIL_USER, p: process.env.GMAIL_APP_PASSWORD };
  delete process.env.GMAIL_USER; delete process.env.GMAIL_APP_PASSWORD;
  const summary = await flush(db);
  process.env.GMAIL_USER = saved.u; process.env.GMAIL_APP_PASSWORD = saved.p;
  assert.equal(summary.skipped, "no_mail_provider");
  assert.equal(pending(db).length, 1);
});
await check("a practice deleted before the email: the event is consumed quietly", async () => {
  const { db, practice } = world();
  const p = practice(COLL);
  await update(db, p.id, { status: "approvata" }, ADMIN1);
  db.tables["practices"] = [];
  const before = mails.length;
  const summary = await flush(db);
  assert.equal(mails.length, before);
  assert.equal(summary.failed, 0);
  assert.equal(pending(db).length, 0);
});
await check("every email leaves a row in the email log", async () => {
  const { db, practice } = world();
  const p = practice(COLL);
  await update(db, p.id, { status: "approvata" }, ADMIN1);
  await flush(db);
  const rows = db.rows("email_logs");
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => r.status === "sent" && r.notification_type === "status_changed" && r.practice_id === p.id));
  assert.deepEqual(rows.map((r) => r.recipient_email).sort(), ["anna@agent.test", "carlo@coll.test"]);
});
await check("a lot of 1200 practices becomes one email per person, not 1200 and not several", async () => {
  const { db } = world();
  db.actor = COLL;
  for (let i = 0; i < 1200; i += 1) {
    db.rows("practices").push({ id: db.uuid(), practice_number: `PR-2026-${10000 + i}`, practice_type: "vies", client_name: `Azienda ${i}`, user_id: COLL, status: "in_lavorazione", financial_status: "non_incassata" });
    db.afterInsert("practices", db.rows("practices").at(-1)!);
  }
  db.actor = null;
  assert.equal(pending(db).length, 1200);
  const before = mails.length;
  const summary = await flush(db);
  assert.equal(summary.claimed, 1200);
  assert.equal(pending(db).length, 0);
  const mario = mails.slice(before).filter((m) => m.to.includes("mario@admin.test"));
  assert.equal(mario.length, 1);
  assert.equal(mario[0].subject, "1200 nuove pratiche caricate da Carlo Collaboratore");
  assert.match(mario[0].text, /… e altre 1185/);
});

section("G. Through the server paths");
await check("an administrator's action from the portal: the administrator is not mailed about their own action", async () => {
  const { db, practice } = world();
  const p = practice(COLL, "in_attesa");
  db.seed("practice_workflow", { practice_id: p.id, target_portal: "co" });
  const before = mails.length;
  const result = await runWorkflowAction(sb(db), ADMIN1, "workflow_request_info", { practiceId: p.id, message: "Serve la visura camerale" });
  assert.equal(result.ok, true);
  const got = recipients(before);
  assert.deepEqual(got, ["anna@agent.test", "carlo@coll.test"], "owner and agent only: the actor is an administrator, the other one is not bothered either");
  assert.match(mails.slice(before).find((m) => m.to.includes("carlo@coll.test"))!.text, /servono delle integrazioni: Serve la visura camerale\./);
});
await check("payment registered by an administrator: owner and agent, in time", async () => {
  const { db, practice } = world();
  const p = practice(COLL, "approvata", "non_incassata");
  const before = mails.length;
  await runWorkflowAction(sb(db), ADMIN1, "workflow_register_payment", { practiceId: p.id });
  assert.deepEqual(recipients(before), ["anna@agent.test", "carlo@coll.test"]);
});
await check("an API client's practice names the client in the email to the administrators", async () => {
  const { db } = world();
  const row = db.seed("practices", { practice_number: "PR-2026-9500", practice_type: "pet", client_name: "Rossi", user_id: OTHER_COLL, status: "in_lavorazione", financial_status: "non_incassata" });
  db.seed("notification_events", { event_type: "practice_created", practice_id: row.id, actor_id: null, attempts: 0, payload: {} });
  await labelQueuedEvents(sb(db), row.id, "Helpet API");
  const before = mails.length;
  await flush(db);
  const mario = mails.slice(before).find((m) => m.to.includes("mario@admin.test"))!;
  assert.equal(mario.subject, "Nuova pratica n. PR-2026-9500 caricata da Helpet API");
});
await check("attributeQueuedEvents only names events still waiting and without author", async () => {
  const { db, practice } = world();
  const p = practice(COLL);
  await update(db, p.id, { status: "approvata" }, null);
  db.rows("notification_events")[0].processed_at = new Date().toISOString();
  await update(db, p.id, { status: "completata" }, null);
  await attributeQueuedEvents(sb(db), p.id, ADMIN1, new Date(Date.now() - 1000));
  const rows = db.rows("notification_events");
  assert.equal(rows[0].actor_id, null, "already processed: untouched");
  assert.equal(rows[1].actor_id, ADMIN1);
});

section("H. Test email from the user dialog");
await check("sample goes to the chosen addresses, in the user's language, marked as a test", async () => {
  const { db } = world();
  settle(db, ADMIN2, { notification_emails: ["luca.mobile@admin.test"] });
  const before = mails.length;
  const result = await sendNotificationSample(sb(db), ADMIN2);
  assert.deepEqual(result, { sent: true, to: ["luca.mobile@admin.test"] });
  assert.match(mails.at(-1)!.subject, /^\[Test\] Practice no\. PR-2026-0001: approved$/);
  assert.equal(mails.length, before + 1);
  const unknown = await sendNotificationSample(sb(db), "ffffffff-ffff-4fff-8fff-ffffffffffff");
  assert.equal(unknown.sent, false);
});

afterAll(() => {
  server.close();
});

report();
