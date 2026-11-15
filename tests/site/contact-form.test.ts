import { describe, expect, it } from "vitest";
import { validateContact, CONTACT_ROLES as SERVER_ROLES } from "../../api/_lib/contact-requests";
import { contactPayload, contactProblems, type ContactValues } from "../../src/site/client/logic";
import { LANGS } from "../../src/site/config";
import { contentFor } from "../../src/site/content";
import { CONTACT_ROLES } from "../../src/site/content/types";
import { renderPage } from "../../src/site/render";
import { pathOf } from "../../src/site/routes";

const filled = (over: Partial<ContactValues> = {}): ContactValues => ({
  name: "Anna Rossi",
  company: "Studio Rossi",
  role: "fiscal_representative",
  country: "Italia",
  email: "anna@example.test",
  phone: "",
  volume: "",
  message: "Vorremmo una quotazione per venti società.",
  consent: true,
  ...over,
});

describe("contact form in the browser", () => {
  it("finds nothing wrong in a complete request", () => {
    expect(contactProblems(filled())).toEqual({});
  });

  it("says what is wrong, field by field", () => {
    expect(contactProblems(filled({ name: "  ", company: "", role: "", country: "", email: "", message: "", consent: false }))).toEqual({
      name: "required",
      company: "required",
      role: "required",
      country: "required",
      email: "required",
      message: "required",
      consent: "consent",
    });
    expect(contactProblems(filled({ email: "anna@" }))).toEqual({ email: "email" });
    expect(contactProblems(filled({ message: "troppo" }))).toEqual({ message: "message" });
  });

  it("asks of the reader exactly what the server asks: the same fields are refused by both", () => {
    const samples: Array<Partial<ContactValues>> = [{}, { name: "" }, { company: " " }, { role: "" }, { role: "hacker" }, { country: "" }, { email: "x" }, { email: "a b@c.d" }, { message: "123456789" }, { message: "1234567890" }, { consent: false }, { name: "", email: "", consent: false }];
    for (const sample of samples) {
      const values = filled(sample);
      const server = validateContact({ ...values, lang: "it", elapsedMs: 9000 });
      expect(Object.keys(contactProblems(values)).sort(), JSON.stringify(sample)).toEqual(server.ok ? [] : [...server.fields].sort());
    }
  });

  it("offers the roles the server accepts, with a label in every language", () => {
    expect([...CONTACT_ROLES]).toEqual([...SERVER_ROLES]);
    for (const lang of LANGS) expect(Object.keys(contentFor(lang).contact.form.roles).sort()).toEqual([...SERVER_ROLES].sort());
  });

  it("sends what was typed, trimmed, with the language, the page, the trap field and the time taken", () => {
    const payload = contactPayload(filled({ name: "  Anna Rossi ", phone: " 06 123 ", volume: "" }), { lang: "en", page: "/en/", website: "", elapsedMs: 5123.7 });
    expect(payload).toEqual({
      name: "Anna Rossi",
      company: "Studio Rossi",
      role: "fiscal_representative",
      country: "Italia",
      email: "anna@example.test",
      phone: "06 123",
      volume: "",
      message: "Vorremmo una quotazione per venti società.",
      consent: true,
      lang: "en",
      page: "/en/",
      website: "",
      elapsedMs: 5124,
    });
    expect(validateContact(payload).ok).toBe(true);
  });

  it("the form in the page has the fields the server reads, the limits and the messages the script shows", () => {
    for (const lang of LANGS) {
      const html = renderPage(pathOf("home", lang), { css: [], js: "/x.js" }, { origin: "https://portale.tecnomga.com" }) as string;
      const form = html.slice(html.indexOf("<form"), html.indexOf("</form>"));
      for (const name of ["name", "company", "role", "country", "email", "phone", "volume", "message", "consent", "website"]) expect(form, `${lang}: ${name}`).toMatch(new RegExp(`name="${name}"`));
      // The limits of the server, declared on the fields (attribute names are case-insensitive in HTML).
      expect(form).toMatch(/name="name"[^>]*maxlength="120"/i);
      expect(form).toMatch(/name="message"[^>]*maxlength="4000"/i);
      const { fieldErrors } = contentFor(lang).contact.form;
      for (const key of ["required", "email", "message", "consent"] as const) expect(form).toContain(`data-error-${key}="${fieldErrors[key].replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`);
      expect(form).toContain(`data-lang="${lang}"`);
      expect(form).toContain('role="status"');
      expect(form).toContain("<noscript>");
    }
  });
});
