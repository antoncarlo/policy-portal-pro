import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { assertCanDelete, getUserFootprint, OffboardingError, reassignUserData } from "../../api/_lib/offboarding";
import { FakeDb } from "../helpers/fakedb";

const OLD = "a0000000-0000-4000-8000-000000000001";
const NEW_AGENT = "a0000000-0000-4000-8000-000000000002";
const NEW_COLLAB = "a0000000-0000-4000-8000-000000000003";
const ADMIN = "a0000000-0000-4000-8000-000000000004";
const COLLEAGUE = "a0000000-0000-4000-8000-000000000005";
const sb = (db: FakeDb) => db as never;

function world({ practices = 3, clients = 2, collaborators = 0 } = {}) {
  const db = new FakeDb();
  const person = (id: string, name: string, role: string, parent: string | null = null) => {
    db.seed("profiles", { id, full_name: name });
    db.seed("user_roles", { user_id: id, role, parent_agent_id: parent });
  };
  person(OLD, "Olga Uscente", "agente");
  person(NEW_AGENT, "Nuovo Agente", "agente");
  person(NEW_COLLAB, "Un Collaboratore", "collaboratore", NEW_AGENT);
  person(ADMIN, "Mario Admin", "admin");
  for (let i = 0; i < collaborators; i += 1) person(`b0000000-0000-4000-8000-0000000000${String(i).padStart(2, "0")}`, `Collaboratore ${i}`, "collaboratore", OLD);
  for (let i = 0; i < practices; i += 1) db.seed("practices", { practice_number: `PR-2026-${i}`, user_id: OLD, status: "in_lavorazione" });
  for (let i = 0; i < clients; i += 1) db.seed("clients", { user_id: OLD, name: `Cliente ${i}` });
  return db;
}

describe("offboarding: what the user still owns", () => {
  it("counts practices, clients, collaborators, lots and mapped API keys", async () => {
    const db = world({ collaborators: 2 });
    db.seed("vies_batches", { user_id: OLD });
    db.seed("api_key_user_mapping", { user_id: OLD, api_key_id: "k" });
    const footprint = await getUserFootprint(sb(db), OLD);
    assert.deepEqual(footprint, { practices: 3, clients: 2, collaborators: 2, batches: 1, apiKeys: 1 });
  });

  it("an account that still owns practices, clients or collaborators cannot be deleted", async () => {
    for (const options of [{ practices: 1, clients: 0 }, { practices: 0, clients: 1 }, { practices: 0, clients: 0, collaborators: 1 }]) {
      const db = world(options);
      await assert.rejects(
        () => assertCanDelete(sb(db), OLD),
        (error: unknown) => error instanceof OffboardingError && error.status === 409 && error.code === "user_has_data",
      );
    }
  });

  it("an account with nothing left can be deleted", async () => {
    const db = world({ practices: 0, clients: 0 });
    await assertCanDelete(sb(db), OLD);
  });
});

describe("offboarding: handing everything over", () => {
  it("moves practices (with a line in each history), clients, lots, fiscal representatives, received lots and API keys", async () => {
    const db = world();
    db.seed("vies_batches", { user_id: OLD });
    db.seed("vies_jobs", { user_id: OLD });
    db.seed("vies_batch_documents", { user_id: OLD });
    db.seed("vies_fiscal_representatives", { user_id: OLD });
    db.seed("vies_intake_lots", { owner_user_id: OLD });
    db.seed("api_key_user_mapping", { user_id: OLD, api_key_id: "k" });
    const result = await reassignUserData(sb(db), { fromUserId: OLD, toUserId: NEW_AGENT, actorId: ADMIN, actorLabel: "Mario Admin" });

    assert.equal(result.moved, 3);
    assert.ok(db.rows("practices").every((practice) => practice.user_id === NEW_AGENT));
    assert.ok(db.rows("clients").every((client) => client.user_id === NEW_AGENT));
    for (const table of ["vies_batches", "vies_jobs", "vies_batch_documents", "vies_fiscal_representatives", "api_key_user_mapping"]) {
      assert.ok(db.rows(table).every((row) => row.user_id === NEW_AGENT), table);
    }
    assert.ok(db.rows("vies_intake_lots").every((row) => row.owner_user_id === NEW_AGENT));

    const history = db.rows("practice_events").filter((event) => event.event_type === "reassigned");
    assert.equal(history.length, 3);
    assert.match(history[0].description, /Pratica riassegnata da Olga Uscente a Nuovo Agente · Mario Admin/);
    assert.equal(history[0].created_by, ADMIN);

    const footprint = await getUserFootprint(sb(db), OLD);
    assert.deepEqual(footprint, { practices: 0, clients: 0, collaborators: 0, batches: 0, apiKeys: 0 });
    await assertCanDelete(sb(db), OLD);
  });

  it("the collaborators of an agent go to the new agent", async () => {
    const db = world({ practices: 0, clients: 0, collaborators: 2 });
    await reassignUserData(sb(db), { fromUserId: OLD, toUserId: NEW_AGENT, actorId: ADMIN, actorLabel: "Admin" });
    const parents = db.rows("user_roles").filter((row) => row.role === "collaboratore").map((row) => row.parent_agent_id);
    assert.ok(parents.every((parent) => parent === NEW_AGENT));
  });

  it("an administrator can take the collaborators too", async () => {
    const db = world({ practices: 0, clients: 0, collaborators: 1 });
    await reassignUserData(sb(db), { fromUserId: OLD, toUserId: ADMIN, actorId: ADMIN, actorLabel: "Admin" });
    assert.equal((await getUserFootprint(sb(db), OLD)).collaborators, 0);
  });

  it("a large portfolio is handed over in pages, none left behind", async () => {
    const db = world({ practices: 1250, clients: 0 });
    const result = await reassignUserData(sb(db), { fromUserId: OLD, toUserId: NEW_AGENT, actorId: ADMIN, actorLabel: "Admin" });
    assert.equal(result.moved, 1250);
    assert.equal(db.rows("practices").filter((practice) => practice.user_id === OLD).length, 0);
    assert.equal(db.rows("practice_events").filter((event) => event.event_type === "reassigned").length, 1250);
  });

  it("refuses: same user, unknown target, target without role, collaborators to a collaborator", async () => {
    const db = world({ collaborators: 1 });
    const expect = (promise: Promise<unknown>, code: string, status: number) =>
      assert.rejects(() => promise, (error: unknown) => error instanceof OffboardingError && error.code === code && error.status === status);
    await expect(reassignUserData(sb(db), { fromUserId: OLD, toUserId: OLD, actorId: ADMIN, actorLabel: "A" }), "same_user", 400);
    await expect(reassignUserData(sb(db), { fromUserId: OLD, toUserId: "ffffffff-ffff-4fff-8fff-ffffffffffff", actorId: ADMIN, actorLabel: "A" }), "target_not_found", 404);
    db.seed("profiles", { id: COLLEAGUE, full_name: "Senza ruolo" });
    await expect(reassignUserData(sb(db), { fromUserId: OLD, toUserId: COLLEAGUE, actorId: ADMIN, actorLabel: "A" }), "target_without_role", 422);
    await expect(reassignUserData(sb(db), { fromUserId: OLD, toUserId: NEW_COLLAB, actorId: ADMIN, actorLabel: "A" }), "target_not_agent", 422);
    // nothing moved by the refusals
    assert.equal(db.rows("practices").filter((practice) => practice.user_id === OLD).length, 3);
  });
});
