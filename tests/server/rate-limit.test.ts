import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { hitRateLimit, resetLocalRateLimits, type RpcClient } from "../../api/_lib/rate-limit";
import { authenticateApiKey, getClientIp, RATE_LIMIT_KEY_MAX, rejectAuth } from "../../api/_lib/partner-api";
import { FakeDb } from "../helpers/fakedb";

/** What the database function does: one counter per bucket, allowed up to the limit. */
function counterDatabase() {
  const counters = new Map<string, number>();
  const calls: Array<Record<string, unknown>> = [];
  const client: RpcClient = {
    rpc: async (_fn, args = {}) => {
      calls.push(args);
      const bucket = String(args.p_bucket);
      const hits = (counters.get(bucket) ?? 0) + 1;
      counters.set(bucket, hits);
      const allowed = hits <= Number(args.p_limit);
      return { data: [{ allowed, retry_after: allowed ? 0 : 42, hits }], error: null };
    },
  };
  return { client, calls, counters };
}

beforeEach(() => {
  resetLocalRateLimits();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe("rate limit shared through the database", () => {
  it("counts every call in the database bucket and refuses past the limit", async () => {
    const db = counterDatabase();
    const results = [];
    for (let i = 0; i < 5; i += 1) results.push(await hitRateLimit(db.client, "ip:x:1.2.3.4", { limit: 3, windowSeconds: 60 }));
    assert.deepEqual(results.map((r) => r.allowed), [true, true, true, false, false]);
    assert.equal(results[3].retryAfter, 42);
    assert.equal(db.calls[0].p_window_seconds, 60);
  });

  it("different buckets are counted apart", async () => {
    const db = counterDatabase();
    await hitRateLimit(db.client, "a", { limit: 1, windowSeconds: 60 });
    assert.equal((await hitRateLimit(db.client, "b", { limit: 1, windowSeconds: 60 })).allowed, true);
    assert.equal((await hitRateLimit(db.client, "a", { limit: 1, windowSeconds: 60 })).allowed, false);
  });

  it("when the database fails, the instance still limits with its own counter", async () => {
    const broken: RpcClient = { rpc: async () => ({ data: null, error: { message: "connection refused" } }) };
    const results = [];
    for (let i = 0; i < 4; i += 1) results.push(await hitRateLimit(broken, "ip:y", { limit: 2, windowSeconds: 60 }));
    assert.deepEqual(results.map((r) => r.allowed), [true, true, false, false]);
    assert.ok(results[2].retryAfter >= 1 && results[2].retryAfter <= 60);
  });

  it("a thrown error or an unexpected answer is treated like a failure of the database", async () => {
    const throwing: RpcClient = { rpc: async () => { throw new Error("boom"); } };
    assert.equal((await hitRateLimit(throwing, "t", { limit: 1, windowSeconds: 60 })).allowed, true);
    assert.equal((await hitRateLimit(throwing, "t", { limit: 1, windowSeconds: 60 })).allowed, false);
    const odd: RpcClient = { rpc: async () => ({ data: [{}], error: null }) };
    assert.equal((await hitRateLimit(odd, "o", { limit: 1, windowSeconds: 60 })).allowed, true);
  });
});

describe("rate limit per API key", () => {
  const request = (key: string) => ({ headers: { "x-api-key": key } }) as never;

  it("a valid key is refused with 429 and Retry-After once it passes its minute budget", async () => {
    const database = new FakeDb();
    const { createHash } = await import("node:crypto");
    database.seed("api_keys", { id: "k1", key_hash: createHash("sha256").update("secret-key").digest("hex"), is_active: true, expires_at: null, name: "Broker" });
    const counters = new Map<string, number>();
    const db = Object.assign(database, {
      rpc: async (_fn: string, args: Record<string, unknown>) => {
        const hits = (counters.get(String(args.p_bucket)) ?? 0) + 1;
        counters.set(String(args.p_bucket), hits);
        const allowed = hits <= Number(args.p_limit);
        return { data: [{ allowed, retry_after: allowed ? 0 : 17, hits }], error: null };
      },
    });
    for (let i = 0; i < RATE_LIMIT_KEY_MAX; i += 1) assert.equal((await authenticateApiKey(request("secret-key"), db as never)).ok, true);
    const refused = await authenticateApiKey(request("secret-key"), db as never);
    assert.equal(refused.ok, false);
    if (refused.ok) return;
    assert.equal(refused.status, 429);
    assert.equal(refused.retryAfter, 17);

    const headers: Record<string, string> = {};
    let status = 0;
    const res = { setHeader: (name: string, value: string) => { headers[name] = value; }, status: (code: number) => { status = code; return { json: () => res }; } };
    rejectAuth(res as never, refused);
    assert.equal(status, 429);
    assert.equal(headers["Retry-After"], "17");
    assert.equal(counters.get("key:k1"), RATE_LIMIT_KEY_MAX + 1);
  });
});

describe("client address", () => {
  it("prefers the platform's headers over x-forwarded-for", () => {
    const ip = (headers: Record<string, string>) => getClientIp({ headers } as never);
    assert.equal(ip({ "x-vercel-forwarded-for": "203.0.113.5", "x-forwarded-for": "1.1.1.1" }), "203.0.113.5");
    assert.equal(ip({ "x-real-ip": "203.0.113.6", "x-forwarded-for": "1.1.1.1" }), "203.0.113.6");
    assert.equal(ip({ "x-forwarded-for": "198.51.100.7, 10.0.0.1" }), "198.51.100.7");
    assert.equal(ip({}), "unknown");
  });
});
