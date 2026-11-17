// L'apertura animata della homepage: il mondo parte in grande e da solo, si allontana e poi compare il sito.
// La decide un piccolo script che gira prima che la pagina venga disegnata (sites/tecnomga/public/intro.js):
// qui lo si esegue cosi' com'e', con un browser finto, caso per caso.
import { existsSync, readFileSync, statSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { CORP, readCorpEnv } from "../../src/corp/config";
import { renderPage } from "../../src/corp/render";
import { pathOf } from "../../src/corp/routes";

const FILE = "sites/tecnomga/public/intro.js";
const assets = { css: ["/assets/corp.css"], js: "/assets/corp.js" };

interface Visit {
  page?: string;
  referrer?: string;
  hash?: string;
  reducedMotion?: boolean;
  navigation?: string;
  /** Parti del browser che mancano (browser vecchi). */
  missing?: Array<"matchMedia" | "performance">;
}
/** Esegue lo script per una visita e dice se ha acceso l'apertura (classe «intro» sulla pagina). */
const plays = (visit: Visit = {}): boolean => {
  const classes = new Set<string>();
  const sandbox: Record<string, unknown> = {
    document: {
      referrer: visit.referrer ?? "",
      documentElement: { getAttribute: (name: string) => (name === "data-page" ? (visit.page ?? "home") : null), classList: { add: (name: string) => classes.add(name) } },
    },
    location: { origin: "https://tecnomga.com", hash: visit.hash ?? "" },
    URL,
  };
  if (!visit.missing?.includes("matchMedia")) sandbox.matchMedia = (query: string) => ({ matches: /prefers-reduced-motion:\s*reduce/.test(query) && visit.reducedMotion === true });
  if (!visit.missing?.includes("performance")) sandbox.performance = { getEntriesByType: (type: string) => (type === "navigation" ? [{ type: visit.navigation ?? "navigate" }] : []) };
  vm.runInNewContext(readFileSync(FILE, "utf8"), sandbox);
  return classes.has("intro");
};

describe("apertura animata: quando parte", () => {
  it("parte al primo arrivo sulla homepage: indirizzo scritto a mano, da un motore di ricerca o da un altro sito", () => {
    expect(plays()).toBe(true);
    expect(plays({ referrer: "https://www.google.com/" })).toBe(true);
    expect(plays({ referrer: "https://portale.tecnomga.com/" })).toBe(true);
  });

  it("riparte se si ricarica la pagina", () => {
    expect(plays({ navigation: "reload" })).toBe(true);
  });

  it("non parte per chi arriva da un'altra pagina del sito, ne' tornando indietro", () => {
    expect(plays({ referrer: "https://tecnomga.com/privacy/" })).toBe(false);
    expect(plays({ referrer: "https://tecnomga.com/en/" })).toBe(false);
    expect(plays({ navigation: "back_forward" })).toBe(false);
  });

  it("non parte per chi ha chiesto meno movimento", () => {
    expect(plays({ reducedMotion: true })).toBe(false);
  });

  it("non parte per chi arriva dritto a una sezione, per esempio il preventivo", () => {
    expect(plays({ hash: "#preventivo" })).toBe(false);
  });

  it("riguarda solo la homepage", () => {
    expect(plays({ page: "privacy" })).toBe(false);
    expect(plays({ page: "cookie" })).toBe(false);
  });

  it("nel dubbio la pagina resta ferma: un browser senza gli strumenti per decidere, o un indirizzo di provenienza illeggibile, non la blocca", () => {
    expect(plays({ missing: ["matchMedia"] })).toBe(false);
    expect(plays({ missing: ["performance"] })).toBe(false);
    expect(plays({ referrer: "non e' un indirizzo" })).toBe(false);
  });
});

describe("apertura animata: nella pagina", () => {
  it("lo script e' un file del sito, piccolo, chiamato solo dalla homepage e prima dello stile", () => {
    expect(existsSync(FILE)).toBe(true);
    expect(statSync(FILE).size).toBeLessThan(1024);
    for (const lang of CORP.langs) {
      const head = renderPage(pathOf("home", lang), assets, readCorpEnv({}))!.split("</head>")[0];
      expect(head, lang).toContain('<script src="/intro.js"></script>');
      // Gira prima che la pagina venga disegnata: sta prima dei fogli di stile e non e' rimandato.
      expect(head.indexOf('<script src="/intro.js"></script>'), lang).toBeLessThan(head.indexOf('<link rel="stylesheet"'));
      for (const id of ["privacy", "cookie"] as const) expect(renderPage(pathOf(id, lang), assets, readCorpEnv({}))!, `${lang} ${id}`).not.toContain("/intro.js");
    }
  });

  it("nessuno script scritto dentro la pagina: la politica dei contenuti ammette solo file del sito", () => {
    for (const lang of CORP.langs) {
      const html = renderPage(pathOf("home", lang), assets, readCorpEnv({}))!;
      const inline = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter((match) => !/\ssrc=/.test(match[1]) && !/type="application\/ld\+json"/.test(match[1]));
      expect(inline, lang).toEqual([]);
    }
  });

  it("senza lo script, o senza che lo script la accenda, il testo dell'apertura e' visibile: lo stile nasconde qualcosa solo sotto «html.intro» e solo senza «riduci movimento»", () => {
    const css = readFileSync("src/corp/corp.css", "utf8");
    const start = css.indexOf("/* ---------- Apertura animata");
    expect(start).toBeGreaterThan(-1);
    const block = css.slice(start, css.indexOf("/* ----------", start + 10));
    expect(block).toContain("@media (prefers-reduced-motion: no-preference)");
    // Ogni regola che anima un elemento parte da «html.intro».
    const media = block.slice(block.indexOf("@media (prefers-reduced-motion: no-preference)"));
    const selectors = [...media.matchAll(/(?:^|\})\s*([^{}@]+)\{[^{}]*animation:/g)].flatMap((match) => match[1].split(",").map((selector) => selector.trim()));
    expect(selectors.length).toBeGreaterThanOrEqual(6);
    for (const selector of selectors) expect(selector, selector).toMatch(/^html\.intro /);
    // Fuori da quel blocco nessuna regola nomina l'apertura.
    expect(css.replace(block, "")).not.toContain("html.intro");
  });
});
