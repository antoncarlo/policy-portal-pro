import { describe, expect, it } from "vitest";
import { isMisreadOf } from "../../src/lib/viesCodes";

describe("VIES codes: a code read badly against one read well", () => {
  it("recognises a code with a dropped character (CNTBA03717: one 0 of 00 missed)", () => {
    expect(isMisreadOf("9144030MA5GX639XR", "91440300MA5GX639XR")).toBe(true);
  });

  it("recognises a doubled or a misread character", () => {
    expect(isMisreadOf("914403000MA5GX639XR", "91440300MA5GX639XR")).toBe(true);
    expect(isMisreadOf("91440300MA5GX639X8", "91440300MA5GX639XR")).toBe(true);
  });

  it("does not take another company's code for a misreading", () => {
    expect(isMisreadOf("91440300MA5GX0J87X", "91440300MA5GX639XR")).toBe(false);
    expect(isMisreadOf("18678521008", "91440300MA5GX639XR")).toBe(false);
  });
});
