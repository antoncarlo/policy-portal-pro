import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";

const smtp = vi.hoisted(() => ({ sent: [] as Array<Record<string, unknown>> }));
vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({
      sendMail: async (message: Record<string, unknown>) => {
        smtp.sent.push(message);
        return { messageId: "m1", rejected: [] };
      },
    }),
  },
}));

const { sendMail } = await import("../../api/_lib/mailer");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  smtp.sent.length = 0;
});

describe("email: the address the answer goes to", () => {
  it("Gmail: a message with replyTo carries it, one without does not", async () => {
    vi.stubEnv("GMAIL_USER", "portale@example.test");
    vi.stubEnv("GMAIL_APP_PASSWORD", "abcd efgh ijkl mnop");
    assert.equal((await sendMail({ to: "vies@example.test", subject: "S", html: "<p>x</p>", replyTo: "anna@example.test" })).success, true);
    assert.equal((await sendMail({ to: "vies@example.test", subject: "S", html: "<p>x</p>" })).success, true);
    assert.equal(smtp.sent[0].replyTo, "anna@example.test");
    assert.equal("replyTo" in smtp.sent[1], false);
  });

  it("Resend: a message with replyTo carries it as reply_to, one without does not", async () => {
    vi.stubEnv("GMAIL_USER", "");
    vi.stubEnv("GMAIL_APP_PASSWORD", "");
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    const bodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
      bodies.push(JSON.parse(init.body));
      return { ok: true, json: async () => ({ id: "r1" }) };
    });
    assert.equal((await sendMail({ to: "vies@example.test", subject: "S", html: "<p>x</p>", replyTo: "anna@example.test" })).success, true);
    assert.equal((await sendMail({ to: "vies@example.test", subject: "S", html: "<p>x</p>" })).success, true);
    assert.equal(bodies[0].reply_to, "anna@example.test");
    assert.equal("reply_to" in bodies[1], false);
  });
});
