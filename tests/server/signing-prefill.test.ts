import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { composeNotes } from "../../src/lib/practiceSummary";
import {
  buildPrefillValues,
  fillSigningDocument,
  readChineseId,
  type AmlData,
  type PrefillDocument,
  type TemplateField,
  type TemplateSource,
} from "../../src/lib/signingPrefill";

const DIR = resolve(__dirname, "../../public/modelli-firma");
const source: TemplateSource = {
  pdf: async (document) => new Uint8Array(readFileSync(resolve(DIR, `${document}.pdf`))),
  fields: async () => JSON.parse(readFileSync(resolve(DIR, "fields.json"), "utf8")) as Record<PrefillDocument, TemplateField[]>,
};

// Numero di carta d'identita' cinese con cifra di controllo valida (nato il 12/03/1985, uomo).
const CHINESE_ID = "110105198503121234";

const practice = {
  practice_number: "VIES-2026-0007",
  policy_number: "VIES-2026-0007",
  client_name: "Shenzhen Example Trading Co., Ltd",
  owner_tax_code: "12345678903",
  beneficiary: "Agenzia delle Entrate",
  notes: composeNotes({
    specificFields: {
      vies_uscc: "91440300MA5EXAMPL1",
      vies_sede_contraente: "No. 8 Nanshan Road, Shenzhen, Guangdong",
      vies_legale_rappresentante: "Wang Wei 王伟",
      vies_documento_legale_rappresentante: CHINESE_ID,
      vies_data_nascita_legale_rappresentante: "12/03/1985",
      vies_rappresentante_fiscale: "Rossi Fiscale Srl",
      vies_codice_fiscale_rappresentante: "09876543210",
      vies_codice_fiscale_beneficiario: "80415740580",
    },
  }),
};

describe("signing prefill", () => {
  it("reads birth date and sex from a valid Chinese ID and rejects an invalid one", () => {
    expect(readChineseId(CHINESE_ID)).toEqual({ valid: true, birth: "12/03/1985", sex: "M" });
    expect(readChineseId("110105198503121235").valid).toBe(false);
    expect(readChineseId("not an id")).toEqual({ valid: false, birth: "", sex: "" });
  });

  it("fills from the practice only what it knows, and leaves the rest out", () => {
    const values = buildPrefillValues(practice);
    expect(values).toMatchObject({
      pratica: "VIES-2026-0007",
      contraente: "Shenzhen Example Trading Co., Ltd",
      cf: "P.IVA 12345678903 · USCC 91440300MA5EXAMPL1",
      firmatario: "Rossi Fiscale Srl",
      firmatario_cf: "09876543210",
      qualita: "Rappresentante fiscale con procura speciale",
      sede_nazione: "Cina",
      lr_nome: "Wang Wei 王伟",
      lr_sesso: "M",
      lr_nascita: "12/03/1985",
      lr_cittadinanza: "Cinese",
      lr_doc_numero: CHINESE_ID,
      beneficiario: "Agenzia delle Entrate",
      beneficiario_cf: "80415740580",
    });
    // Mai inventato: senza lettura dei documenti questi restano vuoti.
    for (const key of ["forma", "costituzione", "lr_luogo", "lr_residenza", "lr_doc_scadenza", "te1_nome"]) expect(values[key]).toBeUndefined();
  });

  it("does not guess from an invalid ID number", () => {
    const values = buildPrefillValues({ ...practice, notes: composeNotes({ specificFields: { vies_documento_legale_rappresentante: "110105198503121235", vies_legale_rappresentante: "Wang Wei" } }) });
    expect(values.lr_sesso).toBeUndefined();
    expect(values.lr_cittadinanza).toBeUndefined();
    expect(values.lr_doc_tipo).toBeUndefined();
  });

  it("uses the company's policy number when it has one", () => {
    expect(buildPrefillValues({ ...practice, policy_number: "POL-123" }).pratica).toBe("VIES-2026-0007 · polizza POL-123");
  });

  it("adds what was read from the documents", () => {
    const aml: AmlData = {
      contraente: { forma_giuridica: "Società a responsabilità limitata", data_costituzione: "05/06/2015" },
      rappresentante: { luogo_nascita: "Beijing", residenza: "No. 1 Chang'an Street, Beijing", doc_scadenza: "30/09/2033" },
      titolari: [
        { nome: "Wang Wei", quota: "60%", cittadinanza: "Cinese" },
        { nome: "Li Na", quota: "40%" },
      ],
    };
    const values = buildPrefillValues(practice, aml);
    expect(values).toMatchObject({
      forma: "Società a responsabilità limitata",
      costituzione: "05/06/2015",
      lr_luogo: "Beijing",
      lr_doc_scadenza: "30/09/2033",
      te1_nome: "Wang Wei",
      te1_quota: "60%",
      te2_nome: "Li Na",
    });
    expect(values.te3_nome).toBeUndefined();
  });

  it("fills the single MUP: policy, declarant, e-mail for the durable medium, owners with place and date of birth", () => {
    const values = buildPrefillValues(
      { ...practice, policy_number: "POL-77", client_email: "societa@pec.example.it" },
      { titolari: [{ nome: "Wang Wei", luogo_nascita: "Beijing", data_nascita: "01/02/1980", quota: "60%", controllo: "diretto" }] },
    );
    expect(values).toMatchObject({
      polizza: "POL-77",
      email: "societa@pec.example.it",
      dichiarante: "Rossi Fiscale Srl",
      te1_nascita_luogo: "Beijing, 01/02/1980",
      te1_quota: "60% · diretto",
    });
    expect(buildPrefillValues({ ...practice, client_email: "vies-riga-1@placeholder.local" }).email).toBeUndefined();
    expect(buildPrefillValues(practice).polizza).toBe("VIES-2026-0007");
    // The tax code the Revenue Agency assigned to the foreign company, together with the VAT number.
    const withTaxCode = { ...practice, notes: composeNotes({ specificFields: { vies_codice_fiscale_contraente: "12345678903" } }) };
    expect(buildPrefillValues(withTaxCode).cf).toBe("C.F. 12345678903");
  });

  it("fills the premium, the insurer, the draft number and place and date of signing (Lot 1, draft 1514223)", () => {
    const values = buildPrefillValues({ ...practice, premium_gross: 2000, policy_start_date: "2026-11-09", draft_number: "1514223" });
    expect(values).toMatchObject({
      premio: "2.000,00",
      compagnia: "Markel Insurance SE, Stabilimento in Spagna",
      polizza: "1514223",
      pratica: "VIES-2026-0007 · bozza 1514223",
      luogo: "Roma",
      data: "09/11/2026",
      // No consulting fee and no commission (Italy4VAT, 9/11/2026): the client pays the premium only.
      onorario: "0,00",
      commissione: "0,00",
      commissione_pct: "0",
      totale: "2.000,00",
    });
    // The company's policy number, once there is one, goes next to the draft number.
    expect(buildPrefillValues({ ...practice, policy_number: "POL-123", draft_number: "1514223" })).toMatchObject({ polizza: "POL-123", pratica: "VIES-2026-0007 · bozza 1514223 · polizza POL-123" });
    // Without a premium or a date nothing is written: never invented.
    const bare = buildPrefillValues(practice);
    expect(bare.premio).toBeUndefined();
    expect(bare.data).toBeUndefined();
  });

  it("every template has its fields registered", async () => {
    const map = await source.fields();
    expect(map.mup.length).toBeGreaterThan(20);
    const keys = new Set(map.mup.map((field) => field.key));
    for (const key of ["pratica", "polizza", "contraente", "cf", "sede", "registro", "firmatario", "firmatario_cf", "dichiarante", "email", "te1_nome", "te1_quota", "te3_quota", "premio", "compagnia", "luogo", "data", "onorario", "commissione", "commissione_pct", "totale"]) expect(keys.has(key)).toBe(true);
    // Place and date of every signature block: assignment, recommendation, delivery, privacy, AML questionnaire.
    expect(map.mup.filter((field) => field.key === "data")).toHaveLength(5);
  });

  it("the MUP names the intermediary as in the RUI: Italy4VAT S.r.l., section E, its manager and the broker it works for", async () => {
    const { buildMup } = await import("../../scripts/signing-templates/mup-body.mjs");
    const html: string = buildMup({
      CO: { name: "Tecno Advance MGA Broker Srl", rui: "B000746484", legal: "Via Po, 102 - 00198 Roma", tel: "", pec: "", web: "" },
      f: (label: string) => label, row: (...cells: string[]) => cells.join(""), cb: (item: unknown) => String(item), on: (text: string) => ({ on: true, text }),
      opts: () => "", sign: () => "", placeDate: "", inl: (key: string) => `{${key}}`,
      stack: (...items: Array<string | { text: string }>) => items.map((item) => (typeof item === "string" ? `[ ] ${item}` : `[x] ${item.text}`)).join("\n"),
    });
    for (const text of [
      "Sezione E – n. E000821262 del 04/05/2026",
      "Stefano Schiaffino – RUI n. E000048035",
      "Via degli Scipioni 157 - 00192 Roma (RM)",
      "dal 23/10/2026",
      "iscritta al RUI dell’IVASS, Sezione E, n. E000821262",
      "€ {premio}",
      "{compagnia}",
      "+39 06 6821 0095",
      "rome@italy4vat.com",
      "https://italy4vat.com/it/",
      "pubblicato sul sito internet https://italy4vat.com/it/",
      "Contatti: e-mail rome@italy4vat.com",
      "€ {onorario} per ciascuna polizza",
      "€ {commissione} ({commissione_pct}% del premio)",
      "€ {totale}",
    ]) expect(html, text).toContain(text);
    // Nothing left to fill by hand but the PEC, which is not known yet.
    expect(html).not.toMatch(/€ _{4,}/);
    // No fee and no commission (9/11/2026): the assignment is free of charge and Sections V and VI say so.
    expect(html).toContain("l’incarico, a titolo gratuito,");
    expect(html).not.toContain("a titolo oneroso");
    expect(html).toContain("per la distribuzione della presente polizza non percepisce né commissioni incluse nel premio né onorari a carico del contraente");
    expect(html).not.toContain("percepisce un compenso costituito da");
    expect(html).not.toContain("distinto da quello su cui è accreditato l’onorario di consulenza");
    expect(html).toContain("[x] può percepire ulteriori compensi legati al raggiungimento di obiettivi quantitativi");
    expect(html).toContain("[ ] non percepisce incentivi");
    // Unchanged on purpose: the commissions sentence of the assignment and the separate premium account.
    expect(html).toContain("dai quali percepisce le commissioni indicate alla Sezione V del MUP");
    expect(html).toContain("L’onorario è distinto dal premio ed è accreditato su un conto diverso da quello separato riservato ai premi.");
  });

  for (const document of ["mup"] as const) {
    it(`writes the values on ${document} without changing its pages`, async () => {
      const values = buildPrefillValues(practice, { contraente: { forma_giuridica: "Società a responsabilità limitata" }, titolari: [{ nome: "Wang Wei", quota: "60%" }] });
      const blob = await fillSigningDocument(document, values, source);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const original = await PDFDocument.load(readFileSync(resolve(DIR, `${document}.pdf`)));
      const filled = await PDFDocument.load(bytes);
      expect(filled.getPageCount()).toBe(original.getPageCount());
      expect(blob.size).toBeGreaterThan(readFileSync(resolve(DIR, `${document}.pdf`)).length);
      if (process.env.WRITE_PREFILL_PREVIEW) writeFileSync(resolve(process.env.WRITE_PREFILL_PREVIEW, `${document}-filled.pdf`), bytes);
    });
  }

  it("never fails on characters the PDF font cannot write", async () => {
    const blob = await fillSigningDocument("mup", { contraente: "深圳市示例贸易有限公司", pratica: "VIES-1" }, source);
    expect(blob.size).toBeGreaterThan(1000);
  });
});
