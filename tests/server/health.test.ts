import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { FakeDb } from "../helpers/fakedb";
import { mockRequest, mockResponse } from "../helpers/http";

const world = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => world.db }));

type Handler = (req: never, res: never) => Promise<unknown>;
let handler: Handler;

const CRON = "cron-secret-0123456789abcdef";
const SERVICE_KEY = "service-role-key-should-never-be-printed-123456";

beforeEach(async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://abc.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", SERVICE_KEY);
  vi.stubEnv("CRON_SECRET", CRON);
  vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "0123456789abcdef");
  const db = new FakeDb();
  db.seed("system_settings", {});
  world.db = db;
  handler = (await import("../../api/vies-connect")).default as unknown as Handler;
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function get(headers: Record<string, string> = {}, method = "GET") {
  const { response, state } = mockResponse();
  await handler(mockRequest({ method, headers, query: { route: "health" } }), response);
  return state;
}

describe("/api/health", () => {
  it("public: up, database answering, nothing about the configuration", async () => {
    const state = await get();
    assert.equal(state.status, 200);
    assert.equal(state.headers["cache-control"], "no-store");
    const body = state.body as Record<string, unknown>;
    assert.equal(body.status, "ok");
    assert.equal(body.database, "ok");
    assert.ok(typeof body.time === "string");
    assert.equal(body.environment, undefined);
    assert.equal(body.release, undefined);
  });

  it("with the cron secret: the release and the environment report, never a value", async () => {
    const state = await get({ authorization: `Bearer ${CRON}` });
    const body = state.body as { release: string; environment: { ok: boolean; features: Record<string, unknown> } };
    assert.equal(body.release, "0123456789ab");
    assert.equal(body.environment.ok, true);
    assert.equal(body.environment.features.cron, true);
    const text = JSON.stringify(state.body);
    assert.ok(!text.includes(SERVICE_KEY) && !text.includes(CRON));
  });

  it("a wrong secret gets the public answer only", async () => {
    const state = await get({ authorization: "Bearer wrong" });
    assert.equal((state.body as Record<string, unknown>).environment, undefined);
  });

  it("503 when the database does not answer", async () => {
    world.db = { from: () => ({ select: () => ({ limit: async () => ({ data: null, error: { message: "down" } }) }) }) };
    const state = await get();
    assert.equal(state.status, 503);
    assert.equal((state.body as Record<string, unknown>).database, "down");
  });

  it("503 and no database call when the essential configuration is missing", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const state = await get();
    assert.equal(state.status, 503);
    assert.equal((state.body as Record<string, unknown>).database, "unconfigured");
  });

  it("only GET and HEAD", async () => {
    assert.equal((await get({}, "POST")).status, 405);
  });
});
