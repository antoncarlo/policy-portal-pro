import { describe, expect, it } from "vitest";
import { analyticsUrl } from "../../src/site-kit/analytics";

// Vercel Web Analytics riceve l'indirizzo di ogni pagina vista. Prima dell'invio si tolgono le parti che possono
// contenere dati di una persona o credenziali: il frammento (dove Supabase mette i token di accesso), i parametri
// diversi da quelli delle campagne (utm_*) e gli identificativi delle pratiche e dei clienti nel percorso.
describe("analyticsUrl: what Vercel Web Analytics receives of the page address", () => {
  it("keeps the address of a public page as it is", () => {
    expect(analyticsUrl("https://tecnomga.com/en/privacy/")).toBe("https://tecnomga.com/en/privacy/");
    expect(analyticsUrl("https://portale.tecnomga.com/blog/garanzia-vies-cos-e-chi-deve-prestarla/")).toBe(
      "https://portale.tecnomga.com/blog/garanzia-vies-cos-e-chi-deve-prestarla/",
    );
  });

  it("drops the fragment, where the sign-in links carry their tokens", () => {
    expect(analyticsUrl("https://portale.tecnomga.com/auth#access_token=eyJhbGci&refresh_token=abc&type=recovery")).toBe("https://portale.tecnomga.com/auth");
    expect(analyticsUrl("https://tecnomga.com/#preventivo")).toBe("https://tecnomga.com/");
  });

  it("keeps only the campaign parameters, in their order, and drops every other one", () => {
    expect(analyticsUrl("https://tecnomga.com/?gclid=XYZ&utm_source=google&code=123&utm_campaign=fideiussioni&email=a%40b.it")).toBe(
      "https://tecnomga.com/?utm_source=google&utm_campaign=fideiussioni",
    );
    expect(analyticsUrl("https://portale.tecnomga.com/auth?code=pkce-code&type=recovery")).toBe("https://portale.tecnomga.com/auth");
    expect(analyticsUrl("https://tecnomga.com/?UTM_SOURCE=linkedin")).toBe("https://tecnomga.com/?UTM_SOURCE=linkedin");
  });

  it("replaces the identifiers of practices and clients in the path", () => {
    expect(analyticsUrl("https://portale.tecnomga.com/practices/3f2b8c1e-4d5a-4b6c-9d7e-1a2b3c4d5e6f?tab=docs")).toBe("https://portale.tecnomga.com/practices/[id]");
    expect(analyticsUrl("https://portale.tecnomga.com/clients/3F2B8C1E-4D5A-4B6C-9D7E-1A2B3C4D5E6F/")).toBe("https://portale.tecnomga.com/clients/[id]/");
  });

  it("sends nothing when the address cannot be read", () => {
    expect(analyticsUrl("not an address")).toBeNull();
    expect(analyticsUrl("")).toBeNull();
  });
});
