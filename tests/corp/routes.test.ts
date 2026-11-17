// Rotte del sito aziendale: italiano alla radice, inglese sotto /en/, ogni percorso con la barra finale.
import { describe, expect, it } from "vitest";
import { findPage, listPages, pathOf } from "../../src/corp/routes";
import { CORP } from "../../src/corp/config";
import { createRoutes } from "../../src/site-kit/routes";

describe("rotte del sito aziendale", () => {
  it("l'italiano sta alla radice e l'inglese sotto /en/", () => {
    expect(pathOf("home", "it")).toBe("/");
    expect(pathOf("home", "en")).toBe("/en/");
    expect(pathOf("privacy", "it")).toBe("/privacy/");
    expect(pathOf("privacy", "en")).toBe("/en/privacy/");
    expect(pathOf("cookie", "en")).toBe("/en/cookie/");
  });

  it("elenca ogni pagina in ogni lingua", () => {
    const pages = listPages();
    expect(pages).toHaveLength(6);
    expect(new Set(pages.map((page) => page.path)).size).toBe(6);
    expect(pages.every((page) => page.path.startsWith("/") && page.path.endsWith("/"))).toBe(true);
  });

  it("trova una pagina con o senza barra finale, e ignora la query", () => {
    expect(findPage("/en/cookie")).toEqual({ id: "cookie", lang: "en", path: "/en/cookie/" });
    expect(findPage("/privacy/?utm_source=x")).toEqual({ id: "privacy", lang: "it", path: "/privacy/" });
    expect(findPage("//")).toEqual({ id: "home", lang: "it", path: "/" });
  });

  it("non conosce il cinese ne' i percorsi del portale", () => {
    expect(findPage("/zh/")).toBeNull();
    expect(findPage("/auth")).toBeNull();
    expect(findPage("/blog/")).toBeNull();
  });

  it("la lingua predefinita per i motori e' l'italiano", () => {
    expect(CORP.xDefault).toBe("it");
    expect(CORP.langs).toEqual(["it", "en"]);
    expect(CORP.defaultOrigin).toBe("https://tecnomga.com");
  });
});

describe("kit: rotte di un sito qualunque", () => {
  const def = { ...CORP, langPrefix: { it: "/it", en: "" } };
  const routes = createRoutes(def, { home: { it: "", en: "" }, about: { it: "chi-siamo", en: "about" } });

  it("usa i prefissi e i tratti della definizione", () => {
    expect(routes.pathOf("about", "it")).toBe("/it/chi-siamo/");
    expect(routes.pathOf("about", "en")).toBe("/about/");
    expect(routes.pathOf("home", "en")).toBe("/");
  });

  it("un identificativo sconosciuto e' un errore, non un percorso inventato", () => {
    expect(() => routes.pathOf("nope" as never, "it")).toThrow();
  });
});
