// Documento di polizza VIES: frontespizio (stessa griglia del modello di
// polizza accettato dall'Agenzia delle Entrate, senza carta intestata della
// compagnia) seguito dal testo della garanzia (Annex III) compilato con i dati
// della pratica. I dati della compagnia garante restano in bianco: li completa
// la compagnia all'emissione.
//
// Nessun import React / alias "@/": il modulo puo' essere usato anche lato server.

import { jsPDF } from "jspdf";
import { extractNotesSections, type SpecificFields } from "./practiceSummary.js";

export const VIES_POLICY_DOCUMENT_PREFIX = "Polizza_VIES";
export const VIES_POLICY_MIME_TYPE = "application/pdf";

export interface ViesPolicyPdfInput {
  practiceNumber: string;
  policyNumber?: string | null;
  contraente: { name: string; taxCode: string; domicile: string };
  beneficiario: { name: string; address: string; taxCode: string };
  rappresentante: { name: string; taxCode: string };
  guaranteedAmount: number;
  durationMonths: number;
  startDate: string;
  endDate: string;
  premium: { net: number; accessories: number; fees: number; taxes: number; gross: number };
  causale: string;
}

// ---------------------------------------------------------------------------
// Formattazione
// ---------------------------------------------------------------------------

const euro = (value: number) =>
  `Eur ${value.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true })}`;

const euroSymbol = (value: number) =>
  `€ ${value.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true })}`;

const dateIt = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
};

const UNITS = ["", "uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove", "dieci", "undici", "dodici",
  "tredici", "quattordici", "quindici", "sedici", "diciassette", "diciotto", "diciannove"];
const TENS = ["", "", "venti", "trenta", "quaranta", "cinquanta", "sessanta", "settanta", "ottanta", "novanta"];

const belowThousand = (n: number): string => {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  let out = hundreds === 0 ? "" : hundreds === 1 ? "cento" : `${UNITS[hundreds]}cento`;
  if (rest < 20) return out + UNITS[rest];
  const ten = TENS[Math.floor(rest / 10)];
  const unit = rest % 10;
  // "ventuno", "trentotto": la vocale finale cade davanti a uno/otto
  out += unit === 1 || unit === 8 ? ten.slice(0, -1) : ten;
  return out + UNITS[unit];
};

/** Importo in lettere come sul frontespizio: 50000 -> "CINQUANTAMILA/00". */
export const amountInWords = (value: number) => {
  const integer = Math.floor(value);
  const cents = Math.round((value - integer) * 100);
  const millions = Math.floor(integer / 1_000_000);
  const thousands = Math.floor((integer % 1_000_000) / 1000);
  const rest = integer % 1000;
  let words = "";
  if (millions) words += millions === 1 ? "unmilione" : `${belowThousand(millions)}milioni`;
  if (thousands) words += thousands === 1 ? "mille" : `${belowThousand(thousands)}mila`;
  words += belowThousand(rest);
  return `${(words || "zero").toUpperCase()}/${String(cents).padStart(2, "0")}`;
};

// jsPDF standard fonts are WinAnsi: keep typographic characters in that range.
const pdfText = (value: string) => value.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-");

// ---------------------------------------------------------------------------
// Dati dalla pratica
// ---------------------------------------------------------------------------

export interface ViesPolicyPracticeSource {
  practice_number: string;
  policy_number?: string | null;
  client_name: string;
  owner_tax_code: string | null;
  beneficiary: string | null;
  policy_start_date: string | null;
  policy_end_date: string | null;
  premium_net: number | null;
  premium_taxable: number | null;
  premium_taxes: number | null;
  premium_gross: number | null;
  notes: string | null;
}

const field = (fields: SpecificFields, key: string) => {
  const value = fields[key];
  return value === null || value === undefined ? "" : String(value).trim();
};

/** Campi obbligatori mancanti per generare il documento (vuoto = generabile). */
export const missingViesPolicyData = (input: ViesPolicyPdfInput) => {
  const missing: string[] = [];
  if (!input.contraente.name) missing.push("ragione sociale contraente");
  if (!input.contraente.taxCode) missing.push("partita IVA contraente");
  if (!input.contraente.domicile) missing.push("domicilio fiscale (sede del rappresentante)");
  if (!input.beneficiario.name) missing.push("beneficiario");
  if (!input.beneficiario.address) missing.push("indirizzo beneficiario");
  if (!input.rappresentante.name) missing.push("rappresentante fiscale");
  if (!input.rappresentante.taxCode) missing.push("codice fiscale rappresentante fiscale");
  if (!input.startDate || !input.endDate) missing.push("decorrenza e scadenza");
  if (!input.guaranteedAmount) missing.push("importo garantito");
  return missing;
};

export const viesPolicyInputFromPractice = (practice: ViesPolicyPracticeSource): ViesPolicyPdfInput => {
  const fields = extractNotesSections(practice.notes).specificFields ?? {};
  const gross = practice.premium_gross ?? 0;
  const taxes = practice.premium_taxes ?? 0;
  const net = practice.premium_net ?? practice.premium_taxable ?? Math.max(gross - taxes, 0);
  const taxable = practice.premium_taxable ?? net;
  return {
    practiceNumber: practice.practice_number,
    // "VIES-..." is the portal's internal reference: the policy number is the company's.
    policyNumber: practice.policy_number && !/^VIES-/i.test(practice.policy_number) ? practice.policy_number : null,
    contraente: {
      name: practice.client_name,
      taxCode: practice.owner_tax_code ?? "",
      domicile: field(fields, "vies_domicilio_fiscale"),
    },
    beneficiario: {
      name: practice.beneficiary ?? "",
      address: field(fields, "vies_indirizzo_beneficiario"),
      taxCode: field(fields, "vies_codice_fiscale_beneficiario"),
    },
    rappresentante: {
      name: field(fields, "vies_rappresentante_fiscale"),
      taxCode: field(fields, "vies_codice_fiscale_rappresentante"),
    },
    guaranteedAmount: Number(fields.vies_importo_garantito ?? 0),
    durationMonths: Number(fields.vies_durata_mesi ?? 36),
    startDate: practice.policy_start_date ?? "",
    endDate: practice.policy_end_date ?? "",
    premium: {
      net,
      accessories: Math.max(Math.round((taxable - net) * 100) / 100, 0),
      fees: 0,
      taxes,
      gross,
    },
    causale: field(fields, "vies_oggetto_garanzia") || "POLIZZA FIDEIUSSORIA AI SENSI DELL'ART. 35, COMMA 7-QUATER, DEL DPR 633/1972.",
  };
};

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const PAGE_W = 210;
const PAGE_H = 297;
const M = 12;
const W = PAGE_W - 2 * M;
const INK: [number, number, number] = [30, 41, 59];
const FRAME: [number, number, number] = [42, 54, 96];
const MUTED: [number, number, number] = [100, 116, 139];
const BLANK = "______________________";

const setFont = (doc: jsPDF, size: number, bold = false, color: [number, number, number] = INK) => {
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setFontSize(size);
  doc.setTextColor(...color);
};

const label = (doc: jsPDF, text: string, x: number, y: number) => {
  setFont(doc, 7.5, true, FRAME);
  doc.text(pdfText(text), x, y);
};

const value = (doc: jsPDF, text: string, x: number, y: number, maxWidth?: number) => {
  setFont(doc, 9.5);
  const lines = maxWidth ? doc.splitTextToSize(pdfText(text), maxWidth) : [pdfText(text)];
  doc.text(lines, x, y);
  return lines.length;
};

const box = (doc: jsPDF, x: number, y: number, w: number, h: number) => {
  doc.setDrawColor(...FRAME);
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, h);
};

const drawFrontPage = (doc: jsPDF, input: ViesPolicyPdfInput) => {
  let y = M;

  // Intestazione: numero polizza e codici compagnia (in bianco fino all'emissione)
  box(doc, M, y, W, 14);
  label(doc, "POLIZZA N.", M + 3, y + 5);
  setFont(doc, 14, true);
  doc.text(pdfText(input.policyNumber || ""), M + 3, y + 11.5);
  const codes = [
    ["Cod. ramo", ""],
    ["Cod. Agenzia", ""],
    ["Cod. Produttore", ""],
  ];
  codes.forEach(([title], index) => {
    const cx = M + 112 + index * 26;
    doc.line(cx, y, cx, y + 14);
    label(doc, title, cx + 2, y + 5);
  });
  y += 14;
  setFont(doc, 7.5, false, MUTED);
  doc.text(pdfText(`Rif. pratica ${input.practiceNumber}`), M, y + 4);
  y += 6;

  // Contraente
  box(doc, M, y, W, 30);
  label(doc, "CONTRAENTE", M + 3, y + 5);
  setFont(doc, 10.5, true);
  doc.text(doc.splitTextToSize(pdfText(input.contraente.name), W - 70), M + 3, y + 11);
  value(doc, input.contraente.domicile, M + 3, y + 19, W - 70);
  doc.line(M + W - 62, y + 22, M + W, y + 22);
  label(doc, "Cod. Fisc. / P.IVA", M + W - 60, y + 26);
  value(doc, input.contraente.taxCode, M + W - 34, y + 26.5);
  y += 30;

  // Beneficiario
  box(doc, M, y, W, 30);
  label(doc, "BENEFICIARIO", M + 3, y + 5);
  setFont(doc, 10.5, true);
  doc.text(doc.splitTextToSize(pdfText(input.beneficiario.name), W - 70), M + 3, y + 11);
  value(doc, input.beneficiario.address, M + 3, y + 21, W - 70);
  doc.line(M + W - 62, y + 22, M + W, y + 22);
  label(doc, "Cod. Fisc.", M + W - 60, y + 26);
  value(doc, input.beneficiario.taxCode, M + W - 34, y + 26.5);
  y += 30;

  // Causale
  box(doc, M, y, W, 20);
  label(doc, "CAUSALE", M + 3, y + 5);
  setFont(doc, 9, false);
  doc.text(doc.splitTextToSize(pdfText(input.causale), W - 6), M + 3, y + 10.5);
  setFont(doc, 8, false, MUTED);
  doc.text(
    doc.splitTextToSize(
      pdfText(`Contraente domiciliato presso il rappresentante fiscale ${input.rappresentante.name} (c.f. ${input.rappresentante.taxCode}).`),
      W - 6,
    ),
    M + 3,
    y + 16,
  );
  y += 24;

  setFont(doc, 11, true, FRAME);
  doc.text("LIQUIDAZIONE DEL PREMIO", PAGE_W / 2, y + 2, { align: "center" });
  y += 5;

  // Importo della garanzia
  box(doc, M, y, W, 12);
  label(doc, "IMPORTO DELLA GARANZIA", M + 3, y + 4.5);
  value(doc, euro(input.guaranteedAmount), M + 3, y + 10);
  setFont(doc, 8, false, MUTED);
  doc.text("diconsi", M + 45, y + 10);
  value(doc, `${amountInWords(input.guaranteedAmount)}#`, M + 58, y + 10);
  y += 12;

  // Durata
  const years = Math.floor(input.durationMonths / 12);
  const months = input.durationMonths % 12;
  box(doc, M, y, W, 13);
  label(doc, "DURATA INIZIALE (ai fini del calcolo del premio di perfezionamento) - PREMIO ALLA FIRMA", M + 3, y + 4.5);
  setFont(doc, 8, false, MUTED);
  doc.text("Anni", M + 3, y + 10.5);
  doc.text("Mesi", M + 22, y + 10.5);
  doc.text("Giorni", M + 41, y + 10.5);
  doc.text("Dal", M + 64, y + 10.5);
  doc.text("Al", M + 101, y + 10.5);
  value(doc, String(years), M + 11, y + 10.5);
  value(doc, String(months), M + 30, y + 10.5);
  value(doc, "0", M + 52, y + 10.5);
  value(doc, dateIt(input.startDate), M + 71, y + 10.5);
  value(doc, dateIt(input.endDate), M + 106, y + 10.5);
  doc.line(M + 140, y, M + 140, y + 13);
  doc.line(M + 163, y, M + 163, y + 13);
  label(doc, "Fraz.", M + 142, y + 4.5);
  value(doc, "///", M + 142, y + 10.5);
  label(doc, "Val.", M + 165, y + 4.5);
  value(doc, "EUR", M + 165, y + 10.5);
  y += 13;

  // Premio
  const premiumCols: Array<[string, string]> = [
    ["Premio netto", euro(input.premium.net)],
    ["Accessori", euro(input.premium.accessories)],
    ["Diritti", euro(input.premium.fees)],
    ["t.d.", ""],
    ["Imposte", euro(input.premium.taxes)],
    ["Totale", euro(input.premium.gross)],
  ];
  const widths = [36, 34, 32, 14, 36, W - 152];
  const drawPremiumRow = (title: string, values: boolean) => {
    box(doc, M, y, W, 13);
    if (title) label(doc, title, M + 3, y - 1.5);
    let cx = M;
    premiumCols.forEach(([colTitle, colValue], index) => {
      if (index > 0) doc.line(cx, y, cx, y + 13);
      label(doc, colTitle, cx + 2, y + 4.5);
      if (values) {
        setFont(doc, 9);
        doc.text(pdfText(colValue), cx + 2, y + 10.5);
      }
      cx += widths[index];
    });
    y += 13;
  };
  drawPremiumRow("", true);
  y += 6;
  drawPremiumRow("PROROGHE EVENTUALI", false);

  // Emissione e firme
  box(doc, M, y, W, 10);
  setFont(doc, 8.5, false, MUTED);
  doc.text(`Emessa ad un unico effetto in ${BLANK}`, M + 3, y + 6.5);
  doc.text(`il ${BLANK}`, M + 118, y + 6.5);
  y += 10;
  box(doc, M, y, W, 32);
  doc.line(M + W / 2, y, M + W / 2, y + 32);
  label(doc, "IL GARANTE", M + 15, y + 6);
  label(doc, "IL CONTRAENTE", M + W / 2 + 15, y + 6);
  y += 32;

  // Quietanza
  box(doc, M, y, W, 16);
  label(doc, "QUIETANZA DI PAGAMENTO", M + 3, y + 5);
  setFont(doc, 8.5, false, MUTED);
  doc.text(pdfText(`Si dichiara che il premio di ${euro(input.premium.gross)} è stato incassato il ${BLANK}`), M + 3, y + 12);
  y += 16;

  setFont(doc, 7.5, false, MUTED);
  doc.text("ESEMPLARE PER IL BENEFICIARIO/ENTE GARANTITO", M, PAGE_H - 8);
};

/** Paragrafi del testo di garanzia, con i dati della pratica. */
const guaranteeParagraphs = (input: ViesPolicyPdfInput): Array<{ text: string; bold?: boolean; center?: boolean; gap?: number }> => {
  const amount = euroSymbol(input.guaranteedAmount);
  const amountWords = amountInWords(input.guaranteedAmount).split("/")[0].toLowerCase();
  const office = input.beneficiario.name.replace(/^agenzia delle entrate\s*[-–,]?\s*/i, "") || input.beneficiario.name;
  const months = input.durationMonths;
  return [
    { text: `Polizza n° ${input.policyNumber || BLANK}`, bold: true, gap: 2 },
    { text: "POLIZZA FIDEIUSSORIA", bold: true, center: true },
    { text: "AI SENSI DELL'ART. 35, COMMA 7-QUATER, DEL DPR 633/1972", bold: true, center: true, gap: 3 },
    {
      text:
        `Rilasciata a ${input.contraente.name} (Soggetto non residente in uno Stato membro dell'Unione europea o in uno degli Stati aderenti allo Spazio economico europeo) ` +
        `(C.f. / P.IVA / National Tax Reference Number: ${input.contraente.taxCode}) (in seguito denominato/a "Contraente").`,
    },
    {
      text: `Domiciliato/a in ${input.contraente.domicile} presso il rappresentante fiscale ${input.rappresentante.name} (c.f. ${input.rappresentante.taxCode}).`,
    },
    {
      text: `Fino alla concorrenza di ${amount} (euro ${amountWords}/00) a favore dell'Agenzia delle entrate, ${office}.`,
      gap: 3,
    },
    { text: "PREMESSO", bold: true, center: true },
    {
      text:
        "- che il Contraente è soggetto non residente in uno Stato membro dell'Unione europea o in uno degli Stati aderenti allo Spazio economico europeo, " +
        "che adempie gli obblighi derivanti dall'applicazione delle norme in materia di imposta sul valore aggiunto tramite un rappresentante fiscale, " +
        "nominato ai sensi dell'articolo 17, terzo comma, del decreto del Presidente della Repubblica 26 ottobre 1972, n. 633;",
    },
    { text: "- che il Contraente intende essere incluso nella banca dati dei soggetti passivi che effettuano operazioni intracomunitarie;" },
    {
      text:
        "- che il Contraente è tenuto, ai sensi dell'articolo 35, comma 7-quater, del decreto del Presidente della Repubblica 26 ottobre 1972, n. 633, alla presentazione di garanzia;",
    },
    {
      text:
        `- che la garanzia, ai sensi del decreto del Vice Ministro dell'Economia e delle Finanze 4 dicembre 2024, è prestata per un valore massimale minimo di ${amount} ` +
        `e per un periodo minimo di ${months} mesi dalla data di presentazione della garanzia stessa alla ${office}.`,
      gap: 3,
    },
    { text: "CIÒ PREMESSO", bold: true, center: true },
    {
      text:
        `La sottoscritta ${BLANK} (di seguito la Società), con sede in ${BLANK}, Registro delle Imprese / C.F. / P.IVA ${BLANK}, ` +
        `iscritta al n. ${BLANK} dell'Elenco IVASS delle imprese di assicurazione e regolarmente autorizzata ad esercitare le assicurazioni nel ramo cauzioni, ` +
        `in regola con il disposto della Legge 10/06/1982 n. 348, PEC ${BLANK} e, per essa, ${BLANK} nato/a a ${BLANK} il ${BLANK} ` +
        `nella sua qualità di ${BLANK}, domiciliato per la carica presso la sede della Società, con la presente polizza fideiussoria si costituisce fideiussore del Contraente; ` +
        `il quale accetta per sé e per i propri successori e aventi causa, dichiarandosi con questi solidalmente tenuto alle obbligazioni derivanti dal presente contratto ` +
        `a favore dell'Agenzia delle entrate - ${office}, nella persona del direttore pro tempore, alle condizioni generali e particolari che seguono, ` +
        `a garanzia del pagamento dell'importo di ${amount}, e fino a ${months} mesi dalla data di presentazione presso l'Ufficio dell'Agenzia delle Entrate competente.`,
      gap: 3,
    },
    { text: "CONDIZIONI GENERALI DELLA GARANZIA TRA LA SOCIETÀ E L'AGENZIA DELLE ENTRATE", bold: true, center: true, gap: 1 },
    { text: "Art. 1 - Delimitazione della garanzia", bold: true },
    {
      text:
        "La Società garantisce all'Amministrazione finanziaria, per il periodo di tempo indicato all'art. 2 e fino alla concorrenza dell'importo complessivo garantito, " +
        "il pagamento totale o parziale delle somme dovute all'Amministrazione finanziaria a seguito di atti amministrativi notificati entro il periodo di validità del presente contratto.",
    },
    { text: "Art. 2 - Durata della garanzia", bold: true },
    {
      text:
        `La garanzia prestata con la presente polizza fideiussoria a favore del direttore pro tempore dell'ufficio dell'Agenzia delle entrate competente ha la validità di ${months} mesi ` +
        "dalla data di presentazione presso l'ufficio dell'Agenzia delle entrate competente; l'Agenzia delle entrate comunica alla Direzione Generale della Società la data di presentazione. " +
        "Decorso il termine di cui al periodo precedente, la garanzia cessa automaticamente ad ogni effetto.",
    },
    { text: "Art. 3 - Importo della garanzia", bold: true },
    {
      text:
        `La garanzia è prestata per l'importo di ${amount}. L'importo della garanzia sarà diminuito dell'ammontare richiesto a seguito della notifica di atto amministrativo ` +
        "dell'Agenzia delle entrate per il quale sia stata escussa la Società garante.",
    },
    { text: "Art. 4 - Inadempimento del Contraente", bold: true },
    { text: "L'eventuale mancato pagamento dei premi da parte del Contraente non potrà in nessun caso essere opposto all'Agenzia delle entrate." },
    { text: "Art. 5 - Obbligazioni delle parti contraenti", bold: true },
    {
      text:
        "La Società si obbliga a versare, senza eccezione alcuna, a meno che non abbia già provveduto il Contraente, le somme richieste dall'Agenzia delle entrate ai sensi dell'art. 1, " +
        "entro sessanta giorni dalla data di notifica al Contraente dell'atto amministrativo. L'Agenzia delle entrate provvederà, con lettera raccomandata A/R ovvero con altro idoneo mezzo, " +
        "a comunicare alla Società, in tempo utile e comunque almeno quindici giorni prima della scadenza dell'anzidetto termine, l'ammontare delle somme dovute e la data entro cui il relativo pagamento dovrà essere effettuato.",
    },
    { text: "Art. 6 - Rinuncia alla preventiva escussione", bold: true },
    { text: "La Società rinuncia espressamente al beneficio della preventiva escussione del Contraente di cui all'articolo 1944 del Codice Civile." },
    { text: "Art. 7 - Surrogazione", bold: true },
    {
      text:
        "La Società è surrogata, nei limiti delle somme pagate all'Agenzia delle entrate, in tutti i diritti, ragioni e azioni verso il Contraente, i suoi successori e aventi causa. " +
        "L'Agenzia delle entrate faciliterà le operazioni di recupero, fornendo alla Società tutti gli elementi in suo possesso.",
    },
    { text: "Art. 8 - Forma delle comunicazioni", bold: true },
    {
      text:
        "Tutti gli avvisi e le comunicazioni devono essere fatti per mezzo di lettera raccomandata o posta elettronica certificata (PEC) inviati alla Direzione Generale della Società che ha rilasciato la presente garanzia.",
    },
    { text: "Art. 9 - Foro competente", bold: true },
    {
      text: `In caso di controversia fra Società e Agenzia delle entrate è competente esclusivamente l'Autorità Giudiziaria del luogo ove ha sede l'Agenzia delle entrate - ${office}.`,
    },
    { text: "Art. 10 - Rinvio", bold: true },
    {
      text: "Per tutto quanto non espressamente regolato dal presente contratto e dalle sue eventuali appendici si applicano le disposizioni di legge.",
      gap: 4,
    },
    { text: `Emessa in ${BLANK} il ${BLANK}`, gap: 4 },
  ];
};

const drawGuarantee = (doc: jsPDF, input: ViesPolicyPdfInput) => {
  doc.addPage();
  let y = M + 4;
  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_H - 16) {
      doc.addPage();
      y = M + 4;
    }
  };

  setFont(doc, 7.5, false, MUTED);
  doc.text(pdfText(`Annex III - testo della garanzia - Rif. pratica ${input.practiceNumber}`), M, M - 2);

  for (const paragraph of guaranteeParagraphs(input)) {
    setFont(doc, paragraph.center ? 10 : 9, Boolean(paragraph.bold));
    const lines = doc.splitTextToSize(pdfText(paragraph.text), W) as string[];
    const height = lines.length * 4.1;
    ensureSpace(height + 2);
    if (paragraph.center) doc.text(lines, PAGE_W / 2, y, { align: "center" });
    else doc.text(lines, M, y, { align: "justify", maxWidth: W });
    y += height + 1.2 + (paragraph.gap ?? 0);
  }

  const signatures = (heading?: string) => {
    ensureSpace(26);
    if (heading) {
      setFont(doc, 8.5);
      const lines = doc.splitTextToSize(pdfText(heading), W) as string[];
      doc.text(lines, M, y);
      y += lines.length * 4.1 + 2;
    }
    label(doc, "IL CONTRAENTE", M + 20, y + 2);
    label(doc, "LA SOCIETÀ", M + W / 2 + 20, y + 2);
    doc.setDrawColor(...MUTED);
    doc.line(M + 5, y + 16, M + W / 2 - 10, y + 16);
    doc.line(M + W / 2 + 5, y + 16, M + W - 5, y + 16);
    y += 22;
  };
  signatures();
  signatures(
    "Si approvano specificatamente gli articoli 1, 2, 4, 5, 6, 7 e 9 ai sensi e agli effetti di cui agli articoli 1341 e 1342 c.c.",
  );
};

const addPageNumbers = (doc: jsPDF) => {
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    setFont(doc, 7.5, false, MUTED);
    doc.text(`${page} di ${total}`, PAGE_W - M, PAGE_H - 8, { align: "right" });
  }
};

export const generateViesPolicyPdf = (input: ViesPolicyPdfInput): jsPDF => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setProperties({
    title: `Polizza VIES ${input.contraente.name}`,
    subject: "Polizza fideiussoria art. 35, comma 7-quater, DPR 633/1972",
  });
  drawFrontPage(doc, input);
  drawGuarantee(doc, input);
  addPageNumbers(doc);
  return doc;
};

export const viesPolicyPdfToBytes = (doc: jsPDF) => new Uint8Array(doc.output("arraybuffer"));

export const buildViesPolicyFileName = (input: ViesPolicyPdfInput) => {
  const safe = input.contraente.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return `${VIES_POLICY_DOCUMENT_PREFIX}_${safe || input.practiceNumber}.pdf`;
};
