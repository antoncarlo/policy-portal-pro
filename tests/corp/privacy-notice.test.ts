// Informativa privacy generale di Tecno Advance MGA Broker, pubblicata dal sito aziendale in
// /documenti/informativa-privacy.pdf (vi porta anche il vecchio indirizzo WordPress, a cui rimanda il portale).
// Il testo e' quello della versione di dicembre 2025, senza le parti che non riguardano Tecno MGA.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { NOTICE_FILE, noticeText } from "../../scripts/legal/privacy-notice.mjs";

const text = noticeText();

describe("informativa privacy generale (PDF del sito aziendale)", () => {
  it("riguarda solo Tecno Advance MGA Broker: nessuna traccia di Helpet, del vecchio sito, dell'App o di contitolari", () => {
    for (const word of [/Helpet/i, /tecnoinsurance/i, /Maugeri/i, /Contitolar/i, /\bApp\b/, /epidemiolog/i, /privacy@tecnomga\.com/, /dpo@tecnomga\.com/, /Privacy Shield/i]) {
      expect(text, String(word)).not.toMatch(word);
    }
  });

  it("indica il titolare con sede e partita IVA, e info@tecnomga.com come unico recapito, anche per il DPO", () => {
    expect(text).toContain("Tecno Advance MGA Broker Srl, con sede legale in Via Po 102, 00198 Roma");
    expect(text).toContain("P. IVA 17460381001");
    expect(text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g)?.every((address) => address === "info@tecnomga.com")).toBe(true);
    expect(text).toMatch(/Responsabile della Protezione dei Dati[\s\S]*info@tecnomga\.com/);
    expect(text).not.toMatch(/00197 Roma \(RM\)/);
    expect(text).toContain("tecnomga.com");
  });

  it("per i trasferimenti fuori dallo Spazio economico europeo cita il Data Privacy Framework, non il Privacy Shield annullato nel 2020", () => {
    expect(text).toContain("Data Privacy Framework");
  });

  it("i rimandi interni portano a punti che esistono", () => {
    expect(text).toContain("2.1 Ulteriori finalità del trattamento");
    expect(text).not.toContain("Sezione I della presente Informativa");
  });

  it("il PDF pubblicato e' generato dal testo attuale", async () => {
    const pdf = await PDFDocument.load(readFileSync(NOTICE_FILE), { updateMetadata: false });
    const digest = createHash("sha256").update(text).digest("hex");
    expect(pdf.getKeywords()).toBe(`testo-sha256:${digest}`);
    expect(pdf.getTitle()).toBe("Informativa per il trattamento dei dati personali · Tecno Advance MGA Broker Srl");
  });
});

describe("un solo recapito per la privacy in tutti i documenti di Tecno MGA", () => {
  it("le pagine Privacy dei due siti, l'informativa generale e i modelli da firmare usano info@tecnomga.com; nessuno indica tecnoinsurance.com", () => {
    for (const file of ["src/corp/content/legal/it.ts", "src/corp/content/legal/en.ts", "src/site/content/it.ts", "src/site/content/en.ts", "src/site/content/zh.ts", "scripts/signing-templates/build.mjs"]) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toContain("antoncarlo@tecnomga.com");
      expect(source, file).not.toMatch(/tecnoinsurance/i);
    }
    expect(readFileSync("scripts/signing-templates/build.mjs", "utf8")).toContain('web: "www.tecnomga.com"');
  });

  it("il portale rimanda direttamente all'informativa sul sito aziendale e a nessun documento del vecchio sito WordPress (i termini e condizioni erano di Helpet)", () => {
    for (const file of ["src/site/config.ts", "src/pages/Auth.tsx"]) {
      const source = readFileSync(file, "utf8");
      expect(source, file).toContain("https://tecnomga.com/documenti/informativa-privacy.pdf");
      expect(source, file).not.toContain("wp-content");
    }
  });
});
