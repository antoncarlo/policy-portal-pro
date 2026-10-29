import { describe, expect, it } from "vitest";
import { isOutOfCredit } from "../../supabase/functions/_shared/agent-errors";

describe("VIES agents: Anthropic API out of credit", () => {
  it("recognises the 400 the API answers when the credit balance is too low", () => {
    expect(
      isOutOfCredit(
        400,
        '400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}',
      ),
    ).toBe(true);
  });

  it("recognises the 402 billing error", () => {
    expect(isOutOfCredit(402, '402 {"type":"error","error":{"type":"billing_error","message":"Billing problem"}}')).toBe(true);
  });

  it("leaves a document the API cannot process to the document", () => {
    expect(isOutOfCredit(400, '400 {"type":"error","error":{"type":"invalid_request_error","message":"Could not process PDF"}}')).toBe(false);
    expect(isOutOfCredit(429, "429 rate limited")).toBe(false);
  });
});
