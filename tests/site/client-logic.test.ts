import { describe, expect, it } from "vitest";
import { lineProgress, noticeLanguage, pageLanguage, shouldPlayVideo } from "../../src/site/client/logic";

describe("public site: decisions taken in the browser", () => {
  it("reads the language of the page from its lang attribute", () => {
    expect(pageLanguage("it")).toBe("it");
    expect(pageLanguage("en")).toBe("en");
    expect(pageLanguage("zh-Hans")).toBe("zh");
    expect(pageLanguage("")).toBe("it");
  });

  it("offers the browser's language only when the site has it and the page is in another one", () => {
    expect(noticeLanguage("it", ["en-US", "en"])).toBe("en");
    expect(noticeLanguage("it", ["zh-CN", "zh", "en"])).toBe("zh");
    expect(noticeLanguage("en", ["it-IT", "it"])).toBe("it");
    // The first language of the browser that the site speaks decides: an Italian reader on the Italian page sees nothing.
    expect(noticeLanguage("it", ["it-IT", "en-US"])).toBeNull();
    expect(noticeLanguage("en", ["ur-PK", "en-GB"])).toBeNull();
    expect(noticeLanguage("it", ["hi-IN", "ur-PK"])).toBeNull();
    expect(noticeLanguage("zh", ["zh-TW"])).toBeNull();
    expect(noticeLanguage("it", [])).toBeNull();
  });

  it("plays the opening video only when the reader has not asked for less motion or less data", () => {
    expect(shouldPlayVideo({ reducedMotion: false })).toBe(true);
    expect(shouldPlayVideo({ reducedMotion: true })).toBe(false);
    expect(shouldPlayVideo({ reducedMotion: false, saveData: true })).toBe(false);
    expect(shouldPlayVideo({ reducedMotion: false, effectiveType: "2g" })).toBe(false);
    expect(shouldPlayVideo({ reducedMotion: false, effectiveType: "slow-2g" })).toBe(false);
    expect(shouldPlayVideo({ reducedMotion: false, effectiveType: "4g" })).toBe(true);
  });

  it("draws the line of the steps as the list crosses the screen, never less than nothing nor more than all", () => {
    const viewport = 1000;
    expect(lineProgress({ top: 1200, height: 600 }, viewport)).toBe(0);
    expect(lineProgress({ top: 800, height: 600 }, viewport)).toBe(0);
    expect(lineProgress({ top: -2000, height: 600 }, viewport)).toBe(1);
    const middle = lineProgress({ top: 400, height: 600 }, viewport);
    expect(middle).toBeGreaterThan(0.3);
    expect(middle).toBeLessThan(0.7);
    expect(lineProgress({ top: 300, height: 600 }, viewport)).toBeGreaterThan(middle);
  });
});
