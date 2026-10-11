import assert from "node:assert/strict";
import * as crypto from "node:crypto";
import { describe, it } from "vitest";
import { verifyWebhookSignature } from "../../api/_lib/webhook-signature";

const SECRET = "whsec_test_secret";
const sign = (body: string, secret = SECRET) => `sha256=${crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
const verify = (rawBody: string, header: string | undefined, allowReencoded?: boolean) =>
  verifyWebhookSignature({ secret: SECRET, rawBody, header, allowReencoded });

describe("webhook signature on the exact bytes received", () => {
  it("accepts a signature over the bytes sent, whatever their formatting", () => {
    for (const body of [
      '{"a":1,"b":"è"}',
      '{ "a": 1,\n  "b": "è" }',
      '{"url":"https:\\/\\/example.com","name":"\\u00e8","n":318.0}',
      '{"b":2,"a":1}',
    ]) {
      assert.equal(verify(body, sign(body)), "exact", body);
    }
  });

  it("refuses a body changed by a single byte, a wrong secret, a missing or malformed header", () => {
    const body = '{"a":1}';
    assert.equal(verify('{"a":2}', sign(body)), "invalid");
    assert.equal(verify(body, sign(body, "other-secret")), "invalid");
    assert.equal(verify(body, undefined), "invalid");
    assert.equal(verify(body, ""), "invalid");
    assert.equal(verify(body, sign(body).replace("sha256=", "")), "invalid");
    assert.equal(verify(body, "sha256=zz"), "invalid");
    assert.equal(verify(body, `${sign(body)}00`), "invalid");
    assert.equal(verify(body, `sha1=${sign(body).slice(7)}`), "invalid");
  });

  it("a signature over the compact re-serialisation (the old rule) is still accepted but flagged", () => {
    const sent = '{ "a": 1,\n  "b": "è" }';
    const legacy = sign(JSON.stringify(JSON.parse(sent)));
    assert.equal(verify(sent, legacy), "reencoded");
  });

  it("the transition can be ended: only the exact bytes are accepted", () => {
    const sent = '{ "a": 1 }';
    const legacy = sign(JSON.stringify(JSON.parse(sent)));
    assert.equal(verify(sent, legacy, false), "invalid");
    assert.equal(verify(sent, sign(sent), false), "exact");
  });

  it("a body that is not JSON can only match as exact bytes", () => {
    assert.equal(verify("not json", sign("not json")), "exact");
    assert.equal(verify("not json", sign("{}")), "invalid");
  });

  it("the hex digest is case-insensitive", () => {
    const body = '{"a":1}';
    assert.equal(verify(body, sign(body).toUpperCase().replace("SHA256=", "sha256=")), "exact");
  });
});
