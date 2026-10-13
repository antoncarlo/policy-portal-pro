import { describe, expect, it } from "vitest";
import { amlFromAgent, pickAmlDocuments, splitIndexedPath, type AgentAmlResult } from "../../src/lib/amlExtraction";

// Carta d'identita' cinese con cifra di controllo valida.
const GOOD_ID = "110105198503121234";

const result: AgentAmlResult = {
  company: { legal_form: "Società a responsabilità limitata", establishment_date: "05/06/2015", registered_capital: "RMB 1.000.000" },
  legal_representative: { name: "Wang Wei", sex: "m", birth_date: "12/03/1985", birth_place: "Beijing", nationality: "Cinese", residence: "No. 1 Chang'an Street, Beijing", residence_country: "Cina", id_number: GOOD_ID, id_expiry_date: "30/09/2033", id_authority: "Beijing PSB" },
  owners: [
    { name: "Wang Wei", share_percent: "60", nationality: "Cinese", control: "" },
    { name: "Li Na", share_percent: "40%", birth_date: "31/02/1990", id_number: "110105198503121235" },
  ],
  issues: ["Traduzione assente"],
};

describe("AML extraction", () => {
  it("turns the agent's answer into questionnaire data", () => {
    const { aml, issues } = amlFromAgent(result, new Date("2026-10-13"));
    expect(aml.contraente).toEqual({ forma_giuridica: "Società a responsabilità limitata", data_costituzione: "05/06/2015", capitale: "RMB 1.000.000" });
    expect(aml.rappresentante).toMatchObject({ nome: "Wang Wei", sesso: "M", data_nascita: "12/03/1985", doc_numero: GOOD_ID, doc_scadenza: "30/09/2033", residenza_nazione: "Cina" });
    expect(aml.titolari?.map((owner) => [owner.nome, owner.quota])).toEqual([["Wang Wei", "60%"], ["Li Na", "40%"]]);
    expect(issues).toContain("Traduzione assente");
  });

  it("drops what it cannot verify and says so", () => {
    const { aml, issues } = amlFromAgent(result, new Date("2026-10-13"));
    // data inesistente e numero con cifra di controllo errata: non si stampano
    expect(aml.titolari?.[1].data_nascita).toBe("");
    expect(aml.titolari?.[1].doc_numero).toBe("");
    expect(issues.some((issue) => /data non valida/.test(issue))).toBe(true);
    expect(issues.some((issue) => /cifra di controllo/.test(issue))).toBe(true);
  });

  it("flags an expired identity document", () => {
    const { issues } = amlFromAgent(result, new Date("2034-01-01"));
    expect(issues.some((issue) => /scaduto il 30\/09\/2033/.test(issue))).toBe(true);
  });

  it("keeps at most three beneficial owners and tells about the rest", () => {
    const many = { owners: [1, 2, 3, 4].map((n) => ({ name: `Socio ${n}`, share_percent: "25" })) };
    const { aml, issues } = amlFromAgent(many);
    expect(aml.titolari).toHaveLength(3);
    expect(issues.some((issue) => /4 nei documenti/.test(issue))).toBe(true);
  });

  it("copes with an empty answer", () => {
    const { aml, issues } = amlFromAgent({});
    expect(aml.titolari).toEqual([]);
    expect(aml.rappresentante?.nome).toBe("");
    expect(issues).toEqual([]);
  });

  it("picks the useful documents in order, readable and not too big", () => {
    const doc = (name: string, types: string[], extension = "pdf", size = 1000) => ({ file_name: name, file_path: `x#${name}`, file_extension: extension, file_size: size, requirement_matches: types });
    const { picked, skipped } = pickAmlDocuments([
      doc("ubo.pdf", ["ubo"]),
      doc("credito.pdf", ["report_credito"]),
      doc("licenza.pdf", ["licenza_commerciale"]),
      doc("mandato.pdf", ["mandato_rappresentanza"]),
      doc("id.docx", ["documento_identita"], "docx"),
      doc("id.jpg", ["documento_identita"], "jpg"),
      doc("grande.pdf", ["ubo"], "pdf", 50 * 1024 * 1024),
    ]);
    expect(picked.map((d) => d.file_name)).toEqual(["licenza.pdf", "id.jpg", "ubo.pdf", "credito.pdf"]);
    expect(skipped.length).toBe(2);
  });

  it("splits the indexed path into the ZIP and the file inside it", () => {
    expect(splitIndexedPath("vies-batch-files://lotto/zip-nominativi/3.zip#a.zip/b.pdf")).toEqual({ zipPath: "lotto/zip-nominativi/3.zip", inner: "a.zip/b.pdf" });
    expect(splitIndexedPath("lotto/zip-nominativi/3.zip#b.pdf")).toEqual({ zipPath: "lotto/zip-nominativi/3.zip", inner: "b.pdf" });
    expect(splitIndexedPath("zip-unarchived://3.zip#b.pdf")).toEqual({ zipPath: null, inner: "b.pdf" });
  });
});
