/* eslint-disable @typescript-eslint/no-explicit-any -- scenario code written against loosely typed doubles */
import assert from "node:assert/strict";
import { vi } from "vitest";
import { FakeDb } from "../helpers/fakedb";
import { suite } from "../helpers/suite";

// The administrators' email is not under test here: the call is observed instead.
const alertCalls: Array<{ build: (language: string) => any; meta: any }> = [];
vi.mock("../../api/_lib/admin-alerts", () => ({
  alertAdmins: vi.fn(async (_supabase: unknown, build: (language: string) => any, meta: any) => {
    alertCalls.push({ build, meta });
    return { sent: 1, failed: 0, recipients: 1 };
  }),
}));

const { recordLoginFailure, MAX_REPORTS_PER_IP, MAX_LINES_PER_ADDRESS, ALERT_AFTER_FAILURES, MAX_ALERTS_PER_HOUR } = await import("../../api/_lib/login-failures");
const { resetLocalRateLimits } = await import("../../api/_lib/rate-limit");

const { check, section, report } = suite();

/** The fake database plus the two functions the report asks of it: the counters and which addresses are accounts. */
class Db extends FakeDb {
  accounts = new Set<string>(["anna@example.test"]);
  private counters = new Map<string, number>();
  rpc(fn: string, args: Record<string, any>) {
    if (fn === "auth_user_for_email") return Promise.resolve({ data: this.accounts.has(String(args.p_email)) ? [{ id: "u1", banned: false }] : [], error: null });
    if (fn === "rate_limit_hit") {
      // The same rule as the database function: calls are allowed while the count in the window stays within the limit.
      const count = (this.counters.get(args.p_bucket) ?? 0) + 1;
      this.counters.set(args.p_bucket, count);
      return Promise.resolve({ data: [{ allowed: count <= args.p_limit, retry_after: count <= args.p_limit ? 0 : 60 }], error: null });
    }
    return Promise.resolve({ data: null, error: { message: `unexpected function ${fn}` } });
  }
}
const world = () => {
  resetLocalRateLimits();
  alertCalls.length = 0;
  return new Db();
};
const lines = (db: FakeDb) => db.rows("audit_log").filter((row) => row.action === "session.login_failed");
const from = (n: number) => `203.0.113.${n}`;

section("A. What is written");
await check("a failed sign-in becomes one line, without anybody's identity and without a password", async () => {
  const db = world();
  const result = await recordLoginFailure(db as any, { email: "  Anna@Example.test ", ip: from(1), userAgent: "Mozilla/5.0 (Test)" });
  assert.deepEqual(result, { status: "recorded", written: true, alerted: false });
  const [line] = lines(db);
  assert.equal(lines(db).length, 1);
  assert.equal(line.source, "app");
  assert.equal(line.actor_id, null);
  assert.equal(line.table_name, "app");
  assert.equal(line.ip, from(1));
  assert.equal(line.user_agent, "Mozilla/5.0 (Test)");
  assert.deepEqual(line.details, { email: "anna@example.test", known_account: true });
  assert.ok(!JSON.stringify(line).toLowerCase().includes("password"), "no password anywhere in the line");
});
await check("an address that is not an account is told apart, in the line only", async () => {
  const db = world();
  await recordLoginFailure(db as any, { email: "nobody@example.test", ip: from(2) });
  assert.equal(lines(db)[0].details.known_account, false);
});
await check("a failing account lookup does not lose the line", async () => {
  const db = world();
  const original = db.rpc.bind(db);
  db.rpc = ((fn: string, args: Record<string, any>) => (fn === "auth_user_for_email" ? Promise.reject(new Error("down")) : original(fn, args))) as any;
  const result = await recordLoginFailure(db as any, { email: "anna@example.test", ip: from(3) });
  assert.equal(result.status, "recorded");
  assert.equal(lines(db).length, 1);
  assert.equal(lines(db)[0].details.known_account, false);
});
await check("a long user agent is cut", async () => {
  const db = world();
  await recordLoginFailure(db as any, { email: "anna@example.test", ip: from(4), userAgent: "x".repeat(1000) });
  assert.equal(lines(db)[0].user_agent.length, 300);
});

section("B. What is refused");
await check("not an address: nothing is written", async () => {
  const db = world();
  for (const email of [undefined, null, 42, "", "   ", "no-at-sign", "a@b", `${"x".repeat(250)}@example.test`, { toString: () => "a@b.c" }]) {
    assert.deepEqual(await recordLoginFailure(db as any, { email, ip: from(5) }), { status: "invalid" });
  }
  assert.equal(lines(db).length, 0);
});
await check("one caller cannot flood the log", async () => {
  const db = world();
  for (let i = 0; i < MAX_REPORTS_PER_IP; i += 1) assert.equal((await recordLoginFailure(db as any, { email: `user${i}@example.test`, ip: from(6) })).status, "recorded");
  const refused: any = await recordLoginFailure(db as any, { email: "more@example.test", ip: from(6) });
  assert.equal(refused.status, "rate_limited");
  assert.ok(refused.retryAfter >= 1);
  assert.equal(lines(db).length, MAX_REPORTS_PER_IP);
  // another caller is not affected
  assert.equal((await recordLoginFailure(db as any, { email: "more@example.test", ip: from(7) })).status, "recorded");
});
await check("one address cannot flood it either, from any number of places", async () => {
  const db = world();
  for (let i = 0; i < MAX_LINES_PER_ADDRESS + 5; i += 1) await recordLoginFailure(db as any, { email: "anna@example.test", ip: from(100 + i) });
  assert.equal(lines(db).length, MAX_LINES_PER_ADDRESS);
});
await check("an unknown caller address still counts as one caller", async () => {
  const db = world();
  for (let i = 0; i < MAX_REPORTS_PER_IP; i += 1) await recordLoginFailure(db as any, { email: `u${i}@example.test`, ip: null });
  assert.equal((await recordLoginFailure(db as any, { email: "u@example.test", ip: null })).status, "rate_limited");
});

section("C. The administrators hear of repeated failures");
await check("nothing before the threshold, one warning at it, none after", async () => {
  const db = world();
  for (let i = 1; i < ALERT_AFTER_FAILURES; i += 1) {
    assert.equal(((await recordLoginFailure(db as any, { email: "anna@example.test", ip: from(30 + i) })) as any).alerted, false, `failure ${i}`);
  }
  assert.equal(alertCalls.length, 0);
  const fifth: any = await recordLoginFailure(db as any, { email: "anna@example.test", ip: from(40) });
  assert.equal(fifth.alerted, true);
  assert.equal(alertCalls.length, 1);
  for (let i = 0; i < 5; i += 1) await recordLoginFailure(db as any, { email: "anna@example.test", ip: from(50 + i) });
  assert.equal(alertCalls.length, 1, "once per address and hour");
  assert.equal(alertCalls[0].meta.template, "admin_login_failures");
});
await check("failures of different addresses are not added together", async () => {
  const db = world();
  for (let i = 0; i < ALERT_AFTER_FAILURES + 3; i += 1) await recordLoginFailure(db as any, { email: `person${i}@example.test`, ip: from(60 + i) });
  assert.equal(alertCalls.length, 0);
});
await check("a flood of invented addresses cannot fill the administrators' mailbox", async () => {
  const db = world();
  for (let person = 0; person < MAX_ALERTS_PER_HOUR + 5; person += 1) {
    for (let i = 0; i < ALERT_AFTER_FAILURES; i += 1) await recordLoginFailure(db as any, { email: `flood${person}@example.test`, ip: from(120 + person * 6 + i) });
  }
  assert.equal(alertCalls.length, MAX_ALERTS_PER_HOUR, "the rest are still written to the log, only the emails stop");
  assert.equal(lines(db).length, (MAX_ALERTS_PER_HOUR + 5) * ALERT_AFTER_FAILURES);
});
await check("the warning names the address and whether it is an account, in each language", async () => {
  const db = world();
  for (let i = 0; i < ALERT_AFTER_FAILURES; i += 1) await recordLoginFailure(db as any, { email: "anna@example.test", ip: from(70 + i) });
  const build = alertCalls[0].build;
  const it = build("it"), en = build("en"), zh = build("zh");
  assert.match(it.subject, /anna@example\.test/);
  assert.match(it.paragraphs.join(" "), /corrisponde a un account/);
  assert.match(en.paragraphs.join(" "), /belongs to an account/);
  assert.match(zh.paragraphs.join(" "), /对应门户中的一个账户/);
  assert.ok(Array.isArray(it.closing) && it.closing.length === 1, "closing is a list, as the email template wants");
  assert.equal(build("fr").subject, it.subject, "an unknown language falls back to Italian");
  const stranger = world();
  for (let i = 0; i < ALERT_AFTER_FAILURES; i += 1) await recordLoginFailure(stranger as any, { email: "nobody@example.test", ip: from(80 + i) });
  assert.match(alertCalls[0].build("it").paragraphs.join(" "), /non corrisponde a nessun account/);
});

report();
