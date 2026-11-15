/* eslint-disable @typescript-eslint/no-explicit-any -- scenario code written against loosely typed doubles */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { FakeDb } from "../helpers/fakedb";
import { mockRequest, mockResponse } from "../helpers/http";
import type { MailMessage, MailResult } from "../../api/_lib/mailer";

const world = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => world.db }));

const { CONTACT_MAX_PER_HOUR, CONTACT_MIN_ELAPSED_MS, CONTACT_ROLES, handleContactRequest, isLikelyBot, validateContact } = await import("../../api/_lib/contact-requests");
const { resetLocalRateLimits } = await import("../../api/_lib/rate-limit");

/** The fake database plus the counter the limiter asks of it. */
class Db extends FakeDb {
  private counters = new Map<string, number>();
  buckets: string[] = [];
  failInsert = false;
  rpc(fn: string, args: Record<string, any>) {
    if (fn !== "rate_limit_hit") return Promise.resolve({ data: null, error: { message: `unexpected function ${fn}` } });
    const count = (this.counters.get(args.p_bucket) ?? 0) + 1;
    this.counters.set(args.p_bucket, count);
    this.buckets.push(String(args.p_bucket));
    return Promise.resolve({ data: [{ allowed: count <= args.p_limit, retry_after: count <= args.p_limit ? 0 : 1800 }], error: null });
  }
  from(table: string) {
    if (table === "contact_requests" && this.failInsert) {
      const failing: any = { insert: () => failing, update: () => failing, select: () => failing, eq: () => failing, single: async () => ({ data: null, error: { message: "database down" } }), then: (resolve: any) => resolve({ data: null, error: { message: "database down" } }) };
      return failing;
    }
    return super.from(table);
  }
}

const valid = (over: Record<string, unknown> = {}) => ({
  name: "Anna Rossi",
  company: "Studio Rossi & Associati",
  role: "fiscal_representative",
  country: "Italia",
  email: "anna.rossi@example.test",
  phone: "+39 06 1234567",
  volume: "20 al mese",
  message: "Vorremmo una quotazione per venti società cinesi.",
  consent: true,
  lang: "it",
  page: "/",
  website: "",
  elapsedMs: 8000,
  ...over,
});

function setup(mail: (message: MailMessage) => Promise<MailResult> = async () => ({ success: true, id: "m1" })) {
  resetLocalRateLimits();
  const db = new Db();
  const sent: MailMessage[] = [];
  const deps = {
    supabase: db as any,
    sendMail: async (message: MailMessage) => {
      sent.push(message);
      return mail(message);
    },
    now: () => new Date("2026-11-15T10:00:00Z"),
  };
  const send = (body: unknown, ip = "203.0.113.7", contentType = "application/json") => handleContactRequest(deps, { body, ip, contentType });
  return { db, sent, send };
}
const rows = (db: FakeDb) => db.rows("contact_requests");

describe("contact form: what is accepted", () => {
  it("takes a complete request and trims it", () => {
    const result = validateContact(valid({ name: "  Anna   Rossi ", email: " Anna.Rossi@Example.test " }));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.name, "Anna Rossi");
    assert.equal(result.value.email, "anna.rossi@example.test");
    assert.equal(result.value.role, "fiscal_representative");
    assert.equal(result.value.lang, "it");
  });

  it("phone and expected applications are optional, the language falls back to Italian, the page must be a path", () => {
    const result = validateContact(valid({ phone: "", volume: undefined, lang: "de", page: "https://evil.example/x" }));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.phone, undefined);
    assert.equal(result.value.volume, undefined);
    assert.equal(result.value.lang, "it");
    assert.equal(result.value.page, undefined);
  });

  it("names every field that is missing or wrong", () => {
    const empty = validateContact({});
    assert.deepEqual(empty.ok ? [] : empty.fields.sort(), ["company", "consent", "country", "email", "message", "name", "role"]);
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ name: "" }, "name"],
      [{ name: "x".repeat(121) }, "name"],
      [{ company: "x".repeat(121) }, "company"],
      [{ role: "hacker" }, "role"],
      [{ country: "x".repeat(81) }, "country"],
      [{ email: "not-an-address" }, "email"],
      [{ email: `${"a".repeat(195)}@example.test` }, "email"],
      [{ phone: "1".repeat(41) }, "phone"],
      [{ volume: "x".repeat(41) }, "volume"],
      [{ message: "troppo" }, "message"],
      [{ message: "x".repeat(4001) }, "message"],
      [{ consent: false }, "consent"],
      [{ consent: "no" }, "consent"],
    ];
    for (const [over, field] of cases) {
      const result = validateContact(valid(over));
      assert.deepEqual(result.ok ? [] : result.fields, [field], JSON.stringify(over).slice(0, 60));
    }
    for (const body of [null, "text", 42, []]) assert.equal(validateContact(body).ok, false);
  });

  it("accepts every role the form offers", () => {
    assert.deepEqual([...CONTACT_ROLES], ["fiscal_representative", "professional_firm", "broker", "foreign_company", "other"]);
    for (const role of CONTACT_ROLES) assert.equal(validateContact(valid({ role })).ok, true, role);
  });

  it("keeps a line break out of the one-line fields, so nothing can add a header to the email", () => {
    const result = validateContact(valid({ company: "Acme\r\nBcc: victim@example.test", name: "Anna\nRossi" }));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(!/[\r\n]/.test(result.value.company));
    assert.ok(!/[\r\n]/.test(result.value.name));
  });

  it("tells a program from a person: the trap field filled in, or a form sent in under three seconds", () => {
    const person = validateContact(valid());
    assert.ok(person.ok);
    if (!person.ok) return;
    assert.equal(isLikelyBot(person.value), false);
    assert.equal(isLikelyBot({ ...person.value, website: "https://spam.example" }), true);
    assert.equal(isLikelyBot({ ...person.value, elapsedMs: CONTACT_MIN_ELAPSED_MS - 1 }), true);
    assert.equal(isLikelyBot({ ...person.value, elapsedMs: undefined }), true);
    assert.equal(isLikelyBot({ ...person.value, elapsedMs: CONTACT_MIN_ELAPSED_MS }), false);
  });
});

describe("contact form: what happens to a request", () => {
  it("a valid request is saved and sent to the VIES mailbox, with the answer going straight to who wrote", async () => {
    const { db, sent, send } = setup();
    const result = await send(valid());
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { ok: true });
    assert.equal(rows(db).length, 1);
    const [row] = rows(db);
    assert.equal(row.name, "Anna Rossi");
    assert.equal(row.company, "Studio Rossi & Associati");
    assert.equal(row.role, "fiscal_representative");
    assert.equal(row.email, "anna.rossi@example.test");
    assert.equal(row.lang, "it");
    assert.equal(row.page, "/");
    assert.equal(row.status, "new");
    assert.equal(row.email_sent, true);
    assert.equal(row.email_error, null);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, "vies@tecnomga.com");
    assert.equal(sent[0].replyTo, "anna.rossi@example.test");
    assert.equal(sent[0].subject, "Richiesta di contatto VIES: Studio Rossi & Associati (Italia)");
    assert.match(sent[0].html, /Vorremmo una quotazione per venti società cinesi\./);
    assert.match(sent[0].html, /Rappresentante fiscale/);
  });

  it("never stores the caller's address, in the request nor in the counters", async () => {
    const { db, send } = setup();
    await send(valid(), "198.51.100.23");
    assert.ok(!JSON.stringify(rows(db)).includes("198.51.100.23"));
    assert.ok(db.buckets.length > 0);
    assert.ok(!db.buckets.some((bucket) => bucket.includes("198.51.100.23")), db.buckets.join(" "));
  });

  it("the mailbox can be changed with CONTACT_INBOX", async () => {
    vi.stubEnv("CONTACT_INBOX", "prova@example.test");
    const { sent, send } = setup();
    await send(valid());
    assert.equal(sent[0].to, "prova@example.test");
  });

  it("whatever is typed reaches the email as text, never as HTML", async () => {
    const { sent, send } = setup();
    await send(valid({ message: 'Ciao <script>alert("x")</script> <img src=x onerror=alert(1)>', company: "<b>Acme</b>" }));
    assert.ok(!sent[0].html.includes("<script>"));
    assert.ok(!sent[0].html.includes("<img"));
    assert.ok(!sent[0].html.includes("<b>Acme</b>"));
    assert.ok(sent[0].html.includes("&lt;script&gt;"));
    assert.ok(sent[0].html.includes("&lt;b&gt;Acme&lt;/b&gt;"));
  });

  it("a request with something missing is refused with the list of fields, and nothing is saved or sent", async () => {
    const { db, sent, send } = setup();
    const result = await send(valid({ consent: false, email: "x" }));
    assert.equal(result.status, 400);
    assert.deepEqual(result.body, { ok: false, error: "invalid", fields: ["email", "consent"] });
    assert.equal(rows(db).length, 0);
    assert.equal(sent.length, 0);
  });

  it("a program gets the same answer as a person, but nothing is saved and no email leaves", async () => {
    const { db, sent, send } = setup();
    const trap = await send(valid({ website: "https://spam.example" }));
    const fast = await send(valid({ elapsedMs: 900 }));
    assert.deepEqual([trap.status, trap.body, fast.status, fast.body], [200, { ok: true }, 200, { ok: true }]);
    assert.equal(rows(db).length, 0);
    assert.equal(sent.length, 0);
  });

  it(`the ${CONTACT_MAX_PER_HOUR + 1}th request in an hour from the same caller is refused, another caller is not`, async () => {
    const { db, sent, send } = setup();
    for (let i = 0; i < CONTACT_MAX_PER_HOUR; i += 1) assert.equal((await send(valid({ message: `Richiesta numero ${i} di prova.` }))).status, 200);
    const refused = await send(valid());
    assert.equal(refused.status, 429);
    assert.deepEqual(refused.body, { ok: false, error: "rate_limited" });
    assert.equal(refused.headers?.["Retry-After"], "1800");
    assert.equal(rows(db).length, CONTACT_MAX_PER_HOUR);
    assert.equal(sent.length, CONTACT_MAX_PER_HOUR);
    assert.equal((await send(valid(), "203.0.113.99")).status, 200);
  });

  it("if the email cannot leave, the request stays saved with the reason and who wrote sees the confirmation all the same", async () => {
    const { db, send } = setup(async () => ({ success: false, error: "SMTP timeout" }));
    const result = await send(valid());
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { ok: true });
    const [row] = rows(db);
    assert.equal(row.email_sent, false);
    assert.equal(row.email_error, "SMTP timeout");
  });

  it("if the email service throws, the request stays saved too", async () => {
    const { db, send } = setup(async () => {
      throw new Error("connection refused");
    });
    const result = await send(valid());
    assert.equal(result.status, 200);
    assert.equal(rows(db)[0].email_sent, false);
    assert.match(rows(db)[0].email_error, /connection refused/);
  });

  it("if the database is down the email still leaves; if both fail, who wrote is told to try again", async () => {
    const mailOnly = setup();
    mailOnly.db.failInsert = true;
    const delivered = await mailOnly.send(valid());
    assert.equal(delivered.status, 200);
    assert.equal(mailOnly.sent.length, 1);

    const nothing = setup(async () => ({ success: false, error: "down" }));
    nothing.db.failInsert = true;
    const failed = await nothing.send(valid());
    assert.equal(failed.status, 500);
    assert.deepEqual(failed.body, { ok: false, error: "unavailable" });
  });

  it("only JSON is taken: a form posted from another site cannot use the endpoint", async () => {
    const { db, sent, send } = setup();
    const result = await send(valid(), "203.0.113.7", "application/x-www-form-urlencoded");
    assert.equal(result.status, 415);
    assert.equal(rows(db).length, 0);
    assert.equal(sent.length, 0);
  });
});

describe("POST /api/contact", () => {
  type Handler = (req: never, res: never) => Promise<unknown>;
  let handler: Handler;
  let db: Db;

  beforeEach(async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key-for-tests-0123456789");
    vi.stubEnv("SMTP_HOST", "");
    resetLocalRateLimits();
    db = new Db();
    world.db = db;
    handler = (await import("../../api/vies-connect")).default as unknown as Handler;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const call = async (method: string, body?: unknown, headers: Record<string, string> = { "content-type": "application/json" }) => {
    const { response, state } = mockResponse();
    const request = mockRequest({ method, headers, query: { route: "contact" } }) as any;
    request.body = body;
    await handler(request as never, response);
    return state;
  };

  it("answers only to POST", async () => {
    const state = await call("GET");
    assert.equal(state.status, 405);
    assert.equal(state.headers.allow, "POST");
    assert.equal(rows(db).length, 0);
  });

  it("saves a valid request and is never cached; without an email service the request stays saved", async () => {
    const state = await call("POST", valid());
    assert.equal(state.status, 200);
    assert.deepEqual(state.body, { ok: true });
    assert.equal(state.headers["cache-control"], "no-store");
    assert.equal(rows(db).length, 1);
    assert.equal(rows(db)[0].email_sent, false);
  });

  it("refuses a request with fields missing", async () => {
    const state = await call("POST", { name: "Anna" });
    assert.equal(state.status, 400);
    assert.equal((state.body as any).error, "invalid");
  });

  it("reads the request also when the platform hands over the bytes instead of the parsed body", async () => {
    for (const shape of ["stream", "string", "buffer"] as const) {
      const { response, state } = mockResponse();
      const json = JSON.stringify(valid({ message: `Richiesta arrivata come ${shape}, da leggere.` }));
      const request = mockRequest({ method: "POST", headers: { "content-type": "application/json" }, query: { route: "contact" }, body: shape === "stream" ? json : undefined }) as any;
      if (shape === "string") request.body = json;
      if (shape === "buffer") request.body = Buffer.from(json, "utf8");
      await handler(request as never, response);
      assert.equal(state.status, 200, shape);
    }
    assert.equal(rows(db).length, 3);
  });

  it("a body that is not JSON is an invalid request, not an error of the server", async () => {
    const { response, state } = mockResponse();
    const request = mockRequest({ method: "POST", headers: { "content-type": "application/json" }, query: { route: "contact" }, body: "{not json" }) as any;
    await handler(request as never, response);
    assert.equal(state.status, 400);
    assert.equal(rows(db).length, 0);
  });
});
