import { describe, expect, it } from "vitest";
import { CONSENT_KEY, CONSENT_MAX_AGE_DAYS, googleTagsToLoad, gtagConsent, parseConsent, serializeConsent, validTagIds } from "../../src/site/consent-core";

const now = new Date("2026-11-15T12:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);
const ids = { ga4Id: "G-ABC123XYZ9", adsId: "AW-123456789" };

describe("cookie consent: the choice kept in the browser", () => {
  it("is kept under one key, for 180 days", () => {
    expect(CONSENT_KEY).toBe("tecno-consent-v1");
    expect(CONSENT_MAX_AGE_DAYS).toBe(180);
  });

  it("is written with the date and read back as it was", () => {
    const raw = serializeConsent({ statistics: true, marketing: false }, now);
    expect(parseConsent(raw, now)).toEqual({ statistics: true, marketing: false, decidedAt: "2026-11-15T12:00:00.000Z" });
  });

  it("counts as no choice when it is absent, unreadable, incomplete or not made of yes and no", () => {
    expect(parseConsent(null, now)).toBeNull();
    expect(parseConsent("", now)).toBeNull();
    expect(parseConsent("not json", now)).toBeNull();
    expect(parseConsent("null", now)).toBeNull();
    expect(parseConsent("[]", now)).toBeNull();
    expect(parseConsent(JSON.stringify({ statistics: true }), now)).toBeNull();
    expect(parseConsent(JSON.stringify({ statistics: "yes", marketing: false, decidedAt: now.toISOString() }), now)).toBeNull();
    expect(parseConsent(JSON.stringify({ statistics: true, marketing: false, decidedAt: "yesterday" }), now)).toBeNull();
  });

  it("expires after 180 days, and a choice dated in the future is not trusted", () => {
    const at = (date: Date) => serializeConsent({ statistics: true, marketing: true }, date);
    expect(parseConsent(at(daysAgo(179)), now)).not.toBeNull();
    expect(parseConsent(at(daysAgo(181)), now)).toBeNull();
    expect(parseConsent(at(new Date(now.getTime() + 2 * 86_400_000)), now)).toBeNull();
  });
});

describe("cookie consent: what Google is told and what is loaded", () => {
  const choice = (statistics: boolean, marketing: boolean) => ({ statistics, marketing, decidedAt: now.toISOString() });

  it("a refusal denies everything and loads nothing", () => {
    expect(gtagConsent(choice(false, false))).toEqual({ ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" });
    expect(googleTagsToLoad(choice(false, false), ids)).toEqual([]);
  });

  it("no choice yet loads nothing", () => {
    expect(googleTagsToLoad(null, ids)).toEqual([]);
  });

  it("statistics only: Analytics is loaded, advertising stays denied", () => {
    expect(gtagConsent(choice(true, false))).toEqual({ ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "granted" });
    expect(googleTagsToLoad(choice(true, false), ids)).toEqual(["G-ABC123XYZ9"]);
  });

  it("marketing only: Ads is loaded, statistics stay denied", () => {
    expect(gtagConsent(choice(false, true))).toEqual({ ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted", analytics_storage: "denied" });
    expect(googleTagsToLoad(choice(false, true), ids)).toEqual(["AW-123456789"]);
  });

  it("everything accepted: both, Analytics first", () => {
    expect(googleTagsToLoad(choice(true, true), ids)).toEqual(["G-ABC123XYZ9", "AW-123456789"]);
  });

  it("a category without its identifier loads nothing, and without identifiers nothing at all", () => {
    expect(googleTagsToLoad(choice(true, true), { ga4Id: "G-ABC123XYZ9" })).toEqual(["G-ABC123XYZ9"]);
    expect(googleTagsToLoad(choice(false, true), { ga4Id: "G-ABC123XYZ9" })).toEqual([]);
    expect(googleTagsToLoad(choice(true, true), {})).toEqual([]);
  });

  it("an identifier that is not one is ignored: nothing else can end up in the address of a script", () => {
    expect(validTagIds({ ga4Id: "G-ABC123XYZ9", adsId: "AW-123456789" })).toEqual({ ga4Id: "G-ABC123XYZ9", adsId: "AW-123456789" });
    expect(validTagIds({ ga4Id: "UA-1234-5", adsId: "AW-12x" })).toEqual({});
    expect(validTagIds({ ga4Id: "G-ABC&l=evil", adsId: "https://evil.example/x.js" })).toEqual({});
    expect(validTagIds({ ga4Id: " G-ABC123XYZ9 ", adsId: "" })).toEqual({ ga4Id: "G-ABC123XYZ9" });
    expect(googleTagsToLoad(choice(true, true), { ga4Id: "G-ABC&l=evil", adsId: "javascript:alert(1)" })).toEqual([]);
  });
});
