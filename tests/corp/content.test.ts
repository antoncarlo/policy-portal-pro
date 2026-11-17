// I testi del sito aziendale: stessa forma nelle due lingue, nessuna promessa che non si puo' documentare.
import { describe, expect, it } from "vitest";
import { CORP } from "../../src/corp/config";
import { contentFor } from "../../src/corp/content";
import { FEATURED, PRODUCT_IDS } from "../../src/corp/products";

const it_ = contentFor("it");
const en = contentFor("en");

/** Tutte le stringhe di un oggetto, con il percorso della chiave. */
const strings = (value: unknown, path = ""): Array<[string, string]> => {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((item, index) => strings(item, `${path}[${index}]`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([key, item]) => strings(item, path ? `${path}.${key}` : key));
  return [];
};
const shape = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, shape(item)]));
  return typeof value;
};

describe("forma dei testi", () => {
  it("le due lingue hanno le stesse chiavi e lo stesso numero di voci", () => {
    expect(shape(en)).toEqual(shape(it_));
  });

  it("nessun testo e' vuoto o di riempimento", () => {
    for (const lang of CORP.langs) {
      for (const [path, text] of strings(contentFor(lang))) {
        expect(text.trim().length, `${lang} ${path}`).toBeGreaterThan(0);
        expect(text, `${lang} ${path}`).not.toMatch(/lorem|ipsum|todo|tbd|xxx/i);
      }
    }
  });
});

describe("cio' che il sito non promette", () => {
  it("nessun prezzo e nessun tempo di emissione", () => {
    for (const lang of CORP.langs) {
      for (const [path, text] of strings(contentFor(lang))) {
        expect(text, `${lang} ${path}`).not.toMatch(/€\s?\d|\d\s?€|\d[\d.,]*\s?(euro|eur)\b/i);
        expect(text, `${lang} ${path}`).not.toMatch(/\b(in|entro|within)\s+\d+\s*(ore|ora|giorni|giorno|minuti|hours?|days?|minutes?)\b/i);
      }
    }
  });

  it("nessun primato e nessun numero da vetrina", () => {
    for (const lang of CORP.langs) {
      for (const [path, text] of strings(contentFor(lang))) {
        expect(text, `${lang} ${path}`).not.toMatch(/\b(leader|migliore|migliori|i primi|il primo|n\.\s?1|numero uno|best|number one|leading)\b/i);
        expect(text, `${lang} ${path}`).not.toMatch(/\b(oltre|più di|over|more than)\s+\d+/i);
      }
    }
  });

  it("non parla di consulenza imparziale, che l'intermediario dichiara di non prestare", () => {
    for (const lang of CORP.langs) {
      for (const [path, text] of strings(contentFor(lang))) expect(text, `${lang} ${path}`).not.toMatch(/imparzial|indipendent|impartial|independent|consulenza personalizzata/i);
    }
  });
});

describe("prodotti", () => {
  it("sono undici, con i sei piu' venduti per primi", () => {
    expect(PRODUCT_IDS).toHaveLength(11);
    expect(FEATURED).toEqual(["fideiussioni", "car", "decennale-postuma", "rc-professionale", "d-and-o", "pet"]);
    expect(PRODUCT_IDS.slice(0, 6)).toEqual(FEATURED);
  });

  it("ognuno ha un nome e una riga di descrizione in ogni lingua", () => {
    for (const lang of CORP.langs) {
      const items = contentFor(lang).home.products.items;
      expect(Object.keys(items).sort()).toEqual([...PRODUCT_IDS].sort());
      for (const id of PRODUCT_IDS) {
        expect(items[id].name.length, `${lang} ${id}`).toBeGreaterThan(2);
        expect(items[id].line.length, `${lang} ${id}`).toBeGreaterThan(20);
        expect(items[id].line.length, `${lang} ${id}`).toBeLessThanOrEqual(120);
      }
    }
  });
});

describe("soci fondatori e societa' con cui Tecno lavora", () => {
  it("il testo sul gruppo e' quello approvato dal titolare, parola per parola", () => {
    expect(it_.home.founders.text).toBe(
      "I soci fondatori di Tecno MGA, Anton Carlo Santoro e Barbara Santoro, hanno fondato anche Helpet, realtà dedicata agli animali domestici cresciuta in Vittoria hub, l'incubatore di Vittoria Assicurazioni. Da questa esperienza nasce la nostra linea per i pet, sviluppata con Mapfre.",
    );
    expect(en.home.founders.text).toContain("Anton Carlo Santoro and Barbara Santoro");
    expect(en.home.founders.text).toContain("Vittoria hub");
    expect(en.home.founders.text).toContain("Mapfre");
  });

  it("l'elenco e' esattamente quello indicato dal titolare, uguale nelle due lingue", () => {
    expect(it_.home.companies.names).toEqual(["Generali", "AXA", "Vittoria", "Helpet", "Markel"]);
    expect(en.home.companies.names).toEqual(it_.home.companies.names);
  });

  it("Mapfre compare solo nel testo sui soci fondatori", () => {
    for (const lang of CORP.langs) {
      const found = strings(contentFor(lang)).filter(([, text]) => /mapfre/i.test(text)).map(([path]) => path);
      expect(found, lang).toEqual(["home.founders.text"]);
    }
  });

  it("Markel compare solo nell'elenco generale", () => {
    for (const lang of CORP.langs) {
      const found = strings(contentFor(lang)).filter(([, text]) => /markel/i.test(text)).map(([path]) => path);
      expect(found, lang).toEqual(["home.companies.names[4]"]);
    }
  });
});

describe("perche' un broker", () => {
  it("ogni affermazione normativa rimanda a una fonte ufficiale", () => {
    for (const lang of CORP.langs) {
      const { sources } = contentFor(lang).home.broker;
      expect(sources.length).toBeGreaterThan(0);
      for (const source of sources) expect(source.href).toMatch(/^https:\/\/(www\.normattiva\.it|www\.ivass\.it|ruipubblico\.ivass\.it)\//);
    }
  });
});
