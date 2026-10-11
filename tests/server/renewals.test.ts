import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { renewalPeriod, renewPractice, RenewalError } from "../../api/_lib/renewals";
import { FakeDb } from "../helpers/fakedb";

const sb = (db: FakeDb) => db as never;
const OWNER = "a0000000-0000-4000-8000-000000000001";
const AGENT = "a0000000-0000-4000-8000-000000000002";
const OTHER = "a0000000-0000-4000-8000-000000000003";
const ADMIN = "a0000000-0000-4000-8000-000000000004";
const NOW = new Date("2026-10-11T08:00:00Z");

function world(extra: Record<string, unknown> = {}) {
  const db = new FakeDb();
  db.seed("user_roles", { user_id: OWNER, role: "collaboratore", parent_agent_id: AGENT });
  db.seed("user_roles", { user_id: AGENT, role: "agente", parent_agent_id: null });
  db.seed("user_roles", { user_id: OTHER, role: "agente", parent_agent_id: null });
  db.seed("user_roles", { user_id: ADMIN, role: "admin", parent_agent_id: null });
  const practice = db.seed("practices", {
    practice_number: "PR-2025-0007", practice_type: "casa", status: "completata", client_name: "Rossi Srl", client_phone: "333", client_email: "rossi@x.it",
    client_id: "c-1", user_id: OWNER, beneficiary: "Banca X", owner_tax_code: "RSSMRA", pet_microchip: null, policy_start_date: "2025-11-20", policy_end_date: "2026-11-20",
    premium_net: 500, commission_percentage: 10, financial_status: "incassata", payment_date: "2025-11-01", policy_number: "POL-1", notes: "vecchie note", api_key_id: "k-1",
    ...extra,
  });
  return { db, practice };
}
const renew = (db: FakeDb, practiceId: string, actorId = OWNER) => renewPractice(sb(db), { practiceId, actorId, actorLabel: "Olga", now: NOW });
const fails = (promise: Promise<unknown>, status: number, code: string) =>
  assert.rejects(() => promise, (error: unknown) => error instanceof RenewalError && error.status === status && error.code === code);

describe("renewal period", () => {
  it("starts the day the old policy ends and lasts as long as the old one", () => {
    assert.deepEqual(renewalPeriod("2025-11-20", "2026-11-20"), { start: "2026-11-20", end: "2027-11-20" });
    assert.deepEqual(renewalPeriod("2026-01-01", "2026-07-01"), { start: "2026-07-01", end: "2026-12-29" });
  });
  it("a missing or odd start gives one year", () => {
    assert.deepEqual(renewalPeriod(null, "2026-11-20"), { start: "2026-11-20", end: "2027-11-20" });
    assert.deepEqual(renewalPeriod("2026-11-19", "2026-11-20"), { start: "2026-11-20", end: "2027-11-20" });
    assert.deepEqual(renewalPeriod(null, "2028-02-29"), { start: "2028-02-29", end: "2029-03-01" });
  });
});

describe("renewing a practice", () => {
  it("creates a linked practice with the client's data, the new period and nothing financial", async () => {
    const { db, practice } = world();
    const result = await renew(db, practice.id);
    const created = db.rows("practices").find((row) => row.id === result.practiceId)!;
    assert.equal(created.renewal_of, practice.id);
    assert.equal(created.user_id, OWNER);
    assert.equal(created.status, "in_lavorazione");
    assert.equal(created.practice_type, "casa");
    assert.equal(created.client_name, "Rossi Srl");
    assert.equal(created.client_email, "rossi@x.it");
    assert.equal(created.client_id, "c-1");
    assert.equal(created.beneficiary, "Banca X");
    assert.equal(created.policy_start_date, "2026-11-20");
    assert.equal(created.policy_end_date, "2027-11-20");
    assert.equal(created.notes, "Rinnovo della pratica PR-2025-0007");
    for (const field of ["premium_net", "commission_percentage", "financial_status", "payment_date", "policy_number", "api_key_id"]) {
      assert.equal(created[field], undefined, field);
    }
    assert.equal(db.rows("practices").find((row) => row.id === practice.id)!.status, "completata", "the old practice is untouched");
  });

  it("leaves a line in the history of both practices", async () => {
    const { db, practice } = world();
    const result = await renew(db, practice.id);
    const events = db.rows("practice_events").filter((event) => event.event_type.startsWith("renewal"));
    const onNew = events.find((event) => event.practice_id === result.practiceId);
    const onOld = events.find((event) => event.practice_id === practice.id);
    assert.match(onNew!.description, /Rinnovo della pratica PR-2025-0007 · Olga/);
    assert.match(onOld!.description, /Rinnovo avviato: pratica .* · Olga/);
  });

  it("only once: the second try is refused and shows the practice that renewed it", async () => {
    const { db, practice } = world();
    const first = await renew(db, practice.id);
    await assert.rejects(
      () => renew(db, practice.id),
      (error: unknown) => error instanceof RenewalError && error.status === 409 && error.code === "already_renewed" && error.message.includes(first.practiceNumber),
    );
    assert.equal(db.rows("practices").length, 2);
  });

  it("the owner, their agent and an administrator can renew; somebody else's agent cannot", async () => {
    for (const actor of [OWNER, AGENT, ADMIN]) {
      const { db, practice } = world();
      assert.ok((await renew(db, practice.id, actor)).practiceId, actor);
    }
    const { db, practice } = world();
    await fails(renew(db, practice.id, OTHER), 403, "forbidden");
    assert.equal(db.rows("practices").length, 1);
  });

  it("refuses what cannot be renewed", async () => {
    await fails(renew(world().db, "ffffffff-ffff-4fff-8fff-ffffffffffff"), 404, "practice_not_found");
    for (const [extra, status, code] of [
      [{ practice_type: "vies" }, 422, "not_renewable"],
      [{ status: "rifiutata" }, 422, "not_renewable"],
      [{ status: "integrazioni" }, 422, "not_renewable"],
      [{ policy_end_date: null }, 422, "no_end_date"],
      [{ policy_end_date: "2025-06-01", policy_start_date: "2024-06-01" }, 422, "too_late"],
    ] as const) {
      const { db, practice } = world(extra);
      await fails(renew(db, practice.id), status, code);
      assert.equal(db.rows("practices").length, 1);
    }
  });

  it("a policy that expired a few days ago can still be renewed", async () => {
    const { db, practice } = world({ policy_end_date: "2026-10-05", policy_start_date: "2025-10-05" });
    const result = await renew(db, practice.id);
    assert.equal(db.rows("practices").find((row) => row.id === result.practiceId)!.policy_start_date, "2026-10-05");
  });

  it("a notification event of the new practice names the person who renewed", async () => {
    const { db, practice } = world();
    db.defaults.notification_events = { attempts: 0, payload: {} };
    const original = db.afterInsert.bind(db);
    db.afterInsert = (table, row) => {
      original(table, row);
      if (table === "practices") db.seed("notification_events", { event_type: "practice_created", practice_id: row.id, actor_id: null, processed_at: null });
    };
    const result = await renew(db, practice.id, AGENT);
    const queued = db.rows("notification_events").find((event) => event.practice_id === result.practiceId);
    assert.equal(queued?.actor_id, AGENT);
  });
});
