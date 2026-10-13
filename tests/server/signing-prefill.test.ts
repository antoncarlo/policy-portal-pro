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
      cf: "12345678903 · USCC 91440300MA5EXAMPL1",
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

  it("every template has its fields registered", async () => {
    const map = await source.fields();
    for (const document of ["privacy", "mup", "antiriciclaggio"] as const) expect(map[document].length).toBeGreaterThan(5);
    const keys = new Set(map.antiriciclaggio.map((field) => field.key));
    for (const key of ["pratica", "contraente", "cf", "forma", "sede", "lr_nome", "lr_doc_numero", "te1_nome", "te3_quota", "beneficiario"]) expect(keys.has(key)).toBe(true);
  });

  for (const document of ["privacy", "mup", "antiriciclaggio"] as const) {
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
