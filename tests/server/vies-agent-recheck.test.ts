import { describe, expect, it } from "vitest";
import { readingSettings } from "../../supabase/functions/vies-document-agent/reading";

describe("VIES document agent: rereading of a code with a wrong check character", () => {
  it("reads every document with the everyday model, with no rereading note", () => {
    const settings = readingSettings(false);
    expect(settings.model).toBe("claude-sonnet-5-5");
    expect(settings.note).toBe("");
  });

  it("rereads with the more capable model, asking to count repeated digits and the length of each code", () => {
    const settings = readingSettings(true);
    expect(settings.model).toBe("claude-opus-5-5");
    expect(settings.note).toMatch(/cifra di controllo/);
    expect(settings.note).toMatch(/00/);
    expect(settings.note).toMatch(/18 caratteri/);
  });
});
