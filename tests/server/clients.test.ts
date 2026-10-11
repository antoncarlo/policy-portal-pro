import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { ClientError, exportClientData, mergeClients } from "../../api/_lib/clients";
import { findDuplicateGroups, type ClientLite } from "../../src/lib/clientDuplicates";
import { FakeDb } from "../helpers/fakedb";

const sb = (db: FakeDb) => db as never;
const OWNER = "a0000000-0000-4000-8000-000000000001";
const OTHER = "a0000000-0000-4000-8000-000000000002";
const AGENT = "a0000000-0000-4000-8000-000000000003";
const ADMIN = "a0000000-0000-4000-8000-000000000004";

const lite = (id: string, extra: Partial<ClientLite> = {}): ClientLite => ({
  id, first_name: "Mario", last_name: "Rossi", company_name: null, email: null, tax_code: null, vat_number: null, phone: null, mobile: null, user_id: OWNER, created_at: `2026-0${id.length % 9 + 1}-01T00:00:00Z`, ...extra,
});

describe("duplicate groups", () => {
  it("links clients sharing a tax code, a VAT number or an email, ignoring case and spaces", () => {
    const groups = findDuplicateGroups([
      lite("a", { tax_code: "rssmra80a01h501u", created_at: "2026-01-01T00:00:00Z" }),
      lite("b", { tax_code: "RSS MRA80A01H501U", created_at: "2026-02-01T00:00:00Z" }),
      lite("c", { vat_number: "IT 0123", created_at: "2026-03-01T00:00:00Z" }),
      lite("d", { vat_number: "it0123", created_at: "2026-04-01T00:00:00Z" }),
      lite("e", { email: "Info@Ditta.it", created_at: "2026-05-01T00:00:00Z" }),
      lite("f", { email: " info@ditta.it ", created_at: "2026-06-01T00:00:00Z" }),
      lite("g", { email: "solo@x.it" }),
    ]);
    assert.deepEqual(groups.map((group) => group.clients.map((client) => client.id)), [["a", "b"], ["c", "d"], ["e", "f"]]);
    assert.deepEqual(groups.map((group) => group.reasons), [["tax_code"], ["vat_number"], ["email"]]);
  });

  it("chains: A and B share an email, B and C a tax code: one group of three, oldest first, with both reasons", () => {
    const groups = findDuplicateGroups([
      lite("c", { tax_code: "AAA", created_at: "2026-03-01T00:00:00Z" }),
      lite("a", { email: "x@y.it", created_at: "2026-01-01T00:00:00Z" }),
      lite("b", { email: "x@y.it", tax_code: "AAA", created_at: "2026-02-01T00:00:00Z" }),
    ]);
    assert.equal(groups.length, 1);
    assert.deepEqual(groups[0].clients.map((client) => client.id), ["a", "b", "c"]);
    assert.deepEqual(groups[0].reasons, ["tax_code", "email"]);
  });

  it("empty values never link anybody; no duplicates, no groups", () => {
    assert.deepEqual(findDuplicateGroups([lite("a", { email: "" , tax_code: "  " }), lite("b", { email: null }), lite("c", { email: "   " })]), []);
    assert.deepEqual(findDuplicateGroups([]), []);
  });
});

function world() {
  const db = new FakeDb();
  db.seed("user_roles", { user_id: OWNER, role: "agente", parent_agent_id: null });
  db.seed("user_roles", { user_id: OTHER, role: "agente", parent_agent_id: null });
  db.seed("user_roles", { user_id: ADMIN, role: "admin", parent_agent_id: null });
  db.seed("user_roles", { user_id: AGENT, role: "agente", parent_agent_id: null });
  const keep = db.seed("clients", { user_id: OWNER, first_name: "Mario", last_name: "Rossi", email: "mario@x.it", phone: null, tax_code: null, notes: "Cliente storico", created_at: "2026-01-01T00:00:00Z" });
  const dupA = db.seed("clients", { user_id: OWNER, first_name: "Mario", last_name: "Rossi", email: "mario@x.it", phone: "333111", tax_code: "RSSMRA", notes: "Preferisce la mattina", created_at: "2026-02-01T00:00:00Z" });
  const dupB = db.seed("clients", { user_id: OWNER, first_name: "M.", last_name: "Rossi", email: "mario@x.it", phone: "333222", tax_code: "ZZZ", notes: null, created_at: "2026-03-01T00:00:00Z" });
  const p1 = db.seed("practices", { practice_number: "PR-1", client_id: dupA.id, client_email: "mario@x.it", user_id: OWNER, created_at: "2026-02-02T00:00:00Z" });
  const p2 = db.seed("practices", { practice_number: "PR-2", client_id: dupB.id, client_email: "mario@x.it", user_id: OWNER, created_at: "2026-03-02T00:00:00Z" });
  const p3 = db.seed("practices", { practice_number: "PR-3", client_id: keep.id, client_email: "mario@x.it", user_id: OWNER, created_at: "2026-01-02T00:00:00Z" });
  return { db, keep, dupA, dupB, p1, p2, p3 };
}

const fails = (promise: Promise<unknown>, status: number, code: string) =>
  assert.rejects(() => promise, (error: unknown) => error instanceof ClientError && error.status === status && error.code === code);

describe("merging clients", () => {
  it("moves the practices, fills the gaps of the one that stays, keeps what it has, removes the others", async () => {
    const { db, keep, dupA, dupB, p1, p2, p3 } = world();
    const result = await mergeClients(sb(db), { keepId: keep.id, mergeIds: [dupA.id, dupB.id], actorId: OWNER });
    assert.equal(result.practicesMoved, 2);
    assert.deepEqual(result.merged.map((row) => row.id), [dupA.id, dupB.id]);
    assert.deepEqual(db.rows("clients").map((row) => row.id), [keep.id]);
    for (const practice of [p1, p2, p3]) assert.equal(db.rows("practices").find((row) => row.id === practice.id)!.client_id, keep.id);
    const kept = db.rows("clients")[0];
    assert.equal(kept.phone, "333111", "filled from the first one that has it");
    assert.equal(kept.tax_code, "RSSMRA");
    assert.equal(kept.email, "mario@x.it");
    assert.match(kept.notes, /^Cliente storico\n\n\[Unito da Mario Rossi\] Preferisce la mattina$/);
    assert.deepEqual(result.filled.sort(), ["notes", "phone", "tax_code"]);
  });

  it("an administrator can merge clients of anybody; somebody else cannot", async () => {
    const { db, keep, dupA } = world();
    await fails(mergeClients(sb(db), { keepId: keep.id, mergeIds: [dupA.id], actorId: OTHER }), 403, "forbidden");
    assert.equal(db.rows("clients").length, 3);
    await mergeClients(sb(db), { keepId: keep.id, mergeIds: [dupA.id], actorId: ADMIN });
    assert.equal(db.rows("clients").length, 2);
  });

  it("an agent can read their collaborators' clients but not merge them", async () => {
    const { db, keep, dupA } = world();
    db.rows("user_roles").find((row) => row.user_id === OWNER)!.role = "collaboratore";
    db.rows("user_roles").find((row) => row.user_id === OWNER)!.parent_agent_id = AGENT;
    await fails(mergeClients(sb(db), { keepId: keep.id, mergeIds: [dupA.id], actorId: AGENT }), 403, "forbidden");
  });

  it("refuses: nothing to merge, unknown client, the same one twice, too many", async () => {
    const { db, keep, dupA } = world();
    await fails(mergeClients(sb(db), { keepId: keep.id, mergeIds: [], actorId: OWNER }), 400, "nothing_to_merge");
    await fails(mergeClients(sb(db), { keepId: keep.id, mergeIds: [keep.id, keep.id], actorId: OWNER }), 400, "nothing_to_merge");
    await fails(mergeClients(sb(db), { keepId: keep.id, mergeIds: ["ffffffff-ffff-4fff-8fff-ffffffffffff"], actorId: OWNER }), 404, "client_not_found");
    await fails(mergeClients(sb(db), { keepId: keep.id, mergeIds: Array.from({ length: 21 }, (_, i) => `x${i}`), actorId: OWNER }), 400, "too_many");
    assert.equal(db.rows("clients").length, 3);
    assert.ok(dupA);
  });
});

describe("exporting a client's data", () => {
  it("everything held about the client: record, practices, history, document list (no files), emails sent", async () => {
    const { db, keep, dupA, p1 } = world();
    db.seed("practice_events", { practice_id: p1.id, event_type: "created", description: "Pratica creata", created_at: "2026-02-02T00:00:00Z" });
    db.seed("practice_documents", { practice_id: p1.id, file_name: "visura.pdf", file_path: "secret/path/visura.pdf", document_type: "visura", mime_type: "application/pdf", file_size: 10, created_at: "2026-02-03T00:00:00Z" });
    db.seed("email_logs", { recipient_email: "mario@x.it", subject: "Promemoria", template_used: "expiry_30_days", status: "sent", created_at: "2026-03-01T00:00:00Z" });
    db.seed("email_logs", { recipient_email: "altro@x.it", subject: "Non suo", template_used: "x", status: "sent" });
    const data = await exportClientData(sb(db), { clientId: dupA.id, actorId: OWNER, now: new Date("2026-10-11T08:00:00Z") });
    assert.equal(data.generated_at, "2026-10-11T08:00:00.000Z");
    assert.equal(data.client.id, dupA.id);
    assert.deepEqual(data.practices.map((practice) => practice.practice_number), ["PR-1"]);
    assert.equal(data.practice_events.length, 1);
    assert.deepEqual(data.documents.map((document) => document.file_name), ["visura.pdf"]);
    assert.ok(!JSON.stringify(data.documents).includes("secret/path"), "storage paths are internal");
    assert.deepEqual(data.emails_sent.map((mail) => mail.subject), ["Promemoria"]);
    assert.match(data.note, /conservati per il tempo previsto/);
    assert.ok(keep);
  });

  it("owner, administrator and the owner's agent can; others cannot; unknown client is 404", async () => {
    const { db, dupA } = world();
    db.rows("user_roles").find((row) => row.user_id === OWNER)!.role = "collaboratore";
    db.rows("user_roles").find((row) => row.user_id === OWNER)!.parent_agent_id = AGENT;
    for (const actor of [OWNER, ADMIN, AGENT]) assert.equal((await exportClientData(sb(db), { clientId: dupA.id, actorId: actor })).client.id, dupA.id, actor);
    await fails(exportClientData(sb(db), { clientId: dupA.id, actorId: OTHER }), 403, "forbidden");
    await fails(exportClientData(sb(db), { clientId: "ffffffff-ffff-4fff-8fff-ffffffffffff", actorId: OWNER }), 404, "client_not_found");
  });

  it("a client without practices exports just the record", async () => {
    const db = new FakeDb();
    const client = db.seed("clients", { user_id: OWNER, first_name: "Solo", last_name: "Anagrafica", email: null });
    const data = await exportClientData(sb(db), { clientId: client.id, actorId: OWNER });
    assert.deepEqual([data.practices, data.practice_events, data.documents, data.emails_sent], [[], [], [], []]);
  });
});
