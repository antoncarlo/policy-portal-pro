import { describe, expect, it } from "vitest";
import { contactReplyHref, contactRequestHeading, contactStatusChange, countToHandle, type ContactRequestRow } from "../../src/lib/contactRequests";

const row = (over: Partial<ContactRequestRow> = {}): ContactRequestRow => ({
  id: "r1",
  created_at: "2026-11-15T10:00:00Z",
  name: "Anna Rossi",
  company: "Studio Rossi & Associati",
  role: "fiscal_representative",
  country: "Italia",
  email: "anna.rossi@example.test",
  phone: null,
  volume: null,
  message: "Vorremmo una quotazione.",
  lang: "it",
  page: "/",
  email_sent: true,
  email_error: null,
  status: "new",
  handled_at: null,
  handled_by: null,
  site: "portal",
  product: null,
  ...over,
});
/** A quote request from the company site: no company, role or country, a product instead. */
const quote = (over: Partial<ContactRequestRow> = {}) => row({ id: "q1", name: "Marco Bianchi", company: null, role: null, country: null, email: "marco.bianchi@example.test", site: "corporate", product: "car", ...over });

describe("contact requests: the administrators' list", () => {
  it("marking a request as handled records who did it and when; reopening clears both", () => {
    const now = new Date("2026-11-16T08:30:00Z");
    expect(contactStatusChange("handled", "admin-1", now)).toEqual({ status: "handled", handled_at: "2026-11-16T08:30:00.000Z", handled_by: "admin-1" });
    expect(contactStatusChange("new", "admin-1", now)).toEqual({ status: "new", handled_at: null, handled_by: null });
  });

  it("only the state of a request is ever changed, never what was written", () => {
    for (const status of ["handled", "new"] as const) expect(Object.keys(contactStatusChange(status, "admin-1", new Date())).sort()).toEqual(["handled_at", "handled_by", "status"]);
  });

  it("counts the requests still to handle", () => {
    expect(countToHandle([row(), row({ id: "r2", status: "handled" }), row({ id: "r3" })])).toBe(2);
    expect(countToHandle([])).toBe(0);
  });

  it("the answer goes to who wrote, with a subject that says what it is about", () => {
    const href = contactReplyHref(row());
    expect(href.startsWith("mailto:anna.rossi@example.test?subject=")).toBe(true);
    expect(decodeURIComponent(href.split("subject=")[1])).toBe("Richiesta di contatto VIES: Studio Rossi & Associati");
    // An address is never trusted to be only an address.
    expect(contactReplyHref(row({ email: "a@b.c?bcc=victim@example.test&body=x" }))).toBe("mailto:a@b.c%3Fbcc%3Dvictim@example.test%26body%3Dx?subject=Richiesta%20di%20contatto%20VIES%3A%20Studio%20Rossi%20%26%20Associati");
  });

  it("a request is headed by the company, or by the person when no company was given", () => {
    expect(contactRequestHeading(row())).toBe("Studio Rossi & Associati");
    expect(contactRequestHeading(quote())).toBe("Marco Bianchi");
    expect(contactRequestHeading(quote({ company: "Edil Bianchi Srl" }))).toBe("Edil Bianchi Srl");
  });

  it("the answer to a quote request of the company site says so, and never mentions VIES", () => {
    const href = contactReplyHref(quote());
    expect(href.startsWith("mailto:marco.bianchi@example.test?subject=")).toBe(true);
    expect(decodeURIComponent(href.split("subject=")[1])).toBe("Richiesta di preventivo: Marco Bianchi");
    expect(decodeURIComponent(contactReplyHref(quote({ company: "Edil Bianchi Srl" })).split("subject=")[1])).toBe("Richiesta di preventivo: Edil Bianchi Srl");
  });
});
