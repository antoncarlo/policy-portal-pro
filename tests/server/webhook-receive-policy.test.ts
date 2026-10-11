import assert from "node:assert/strict";
import * as crypto from "node:crypto";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { FakeDb } from "../helpers/fakedb";
import { mockRequest, mockResponse } from "../helpers/http";

const world = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => world.db }));

const SECRET = "whsec_test_secret";
const API_KEY = "ppp_test_key_123";
const sign = (body: string) => `sha256=${crypto.createHmac("sha256", SECRET).update(body, "utf8").digest("hex")}`;

type Handler = (req: never, res: never) => Promise<unknown>;
let handler: Handler;
let config: { api: { bodyParser: boolean } };
let db: FakeDb;

beforeEach(async () => {
  vi.stubEnv("WEBHOOK_SECRET", SECRET);
  vi.stubEnv("VITE_SUPABASE_URL", "http://localhost");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  db = Object.assign(new FakeDb(), {
    rpc: async (_fn: string, args: Record<string, unknown>) => ({ data: [{ allowed: true, retry_after: 0, hits: 1, bucket: args.p_bucket }], error: null }),
  });
  db.seed("api_keys", { id: "key-1", key_hash: crypto.createHash("sha256").update(API_KEY).digest("hex"), is_active: true, expires_at: null });
  world.db = db;
  const module = await import("../../api/webhook-receive-policy");
  handler = module.default as unknown as Handler;
  config = module.config as typeof config;
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function post(body: string, signature: string | undefined, extraHeaders: Record<string, string> = {}) {
  const { response, state } = mockResponse();
  const headers: Record<string, string> = { "content-type": "application/json", "x-api-key": API_KEY, ...extraHeaders };
  if (signature) headers["x-signature"] = signature;
  await handler(mockRequest({ headers, body }), response);
  return state;
}

// A body that passes signature and parsing but is stopped by the field validation that follows.
const INCOMPLETE = { source: "broker-x", practice_type: "casa" };

describe("webhook-receive-policy: signature on the raw body", () => {
  it("the function reads the body itself (the platform does not parse it)", () => {
    assert.equal(config.api.bodyParser, false);
  });

  it("a pretty-printed body signed as sent is accepted (reaches field validation)", async () => {
    const body = JSON.stringify(INCOMPLETE, null, 2);
    const state = await post(body, sign(body));
    assert.equal(state.status, 422);
    assert.deepEqual((state.body as { missing_fields: string[] }).missing_fields.sort(), ["client_email", "client_name", "client_phone"]);
    assert.equal(state.headers.warning, undefined);
  });

  it("non-ASCII characters and escaped slashes are signed as sent", async () => {
    const body = '{"source":"broker-x","practice_type":"casa","client_name":"Zoë \\/ Müller","note":"caffè"}';
    const state = await post(body, sign(body));
    assert.equal(state.status, 422);
  });

  it("a signature over the compact re-serialisation is still accepted, with a warning", async () => {
    const sent = JSON.stringify(INCOMPLETE, null, 4);
    const state = await post(sent, sign(JSON.stringify(INCOMPLETE)));
    assert.equal(state.status, 422);
    assert.match(state.headers.warning, /re-serialised/);
  });

  it("the transition can be switched off with WEBHOOK_REENCODED_SIGNATURE=off", async () => {
    vi.stubEnv("WEBHOOK_REENCODED_SIGNATURE", "off");
    const sent = JSON.stringify(INCOMPLETE, null, 4);
    const state = await post(sent, sign(JSON.stringify(INCOMPLETE)));
    assert.equal(state.status, 401);
  });

  it("a body changed after signing, or a missing signature, is refused", async () => {
    const body = JSON.stringify(INCOMPLETE);
    assert.equal((await post(body + " ", sign(body.replace("casa", "car")))).status, 401);
    assert.equal((await post(body, undefined)).status, 401);
  });

  it("valid signature on something that is not a JSON object: 400", async () => {
    for (const body of ["not json", "[1,2]", "null", '"text"']) {
      assert.equal((await post(body, sign(body))).status, 400, body);
    }
  });

  it("without a valid API key nothing is read: 401", async () => {
    const body = JSON.stringify(INCOMPLETE);
    assert.equal((await post(body, sign(body), { "x-api-key": "wrong" })).status, 401);
  });

  it("a key over its budget gets 429 with Retry-After, before the body is read", async () => {
    (db as unknown as { rpc: unknown }).rpc = async (_fn: string, args: Record<string, unknown>) => ({
      data: [{ allowed: !String(args.p_bucket).startsWith("key:"), retry_after: 9, hits: 999 }],
      error: null,
    });
    const body = JSON.stringify(INCOMPLETE);
    const state = await post(body, sign(body));
    assert.equal(state.status, 429);
    assert.equal(state.headers["retry-after"], "9");
  });

  it("every call is counted in the database, by address and by key", async () => {
    const buckets: string[] = [];
    (db as unknown as { rpc: unknown }).rpc = async (_fn: string, args: Record<string, unknown>) => {
      buckets.push(String(args.p_bucket));
      return { data: [{ allowed: true, retry_after: 0, hits: 1 }], error: null };
    };
    const body = JSON.stringify(INCOMPLETE);
    await post(body, sign(body), { "x-real-ip": "203.0.113.9" });
    assert.deepEqual(buckets, ["ip:webhook-receive-policy:203.0.113.9", "key:key-1"]);
  });
});
