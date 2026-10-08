// Estratti conto di un lotto VIES ("Excel Lotto N"), sullo schema degli estratti
// conto Tecno Advance MGA. Due tipi:
// - cliente: per il rappresentante fiscale che paga; polizze del lotto e totale
//   premi da pagare, senza provvigioni né ritenuta;
// - provvigioni (uso interno dell'agenzia, per incassare le provvigioni dalla
//   compagnia): polizze, provvigioni, data, premi, totale, ritenuta d'acconto e
//   totale versato = premi − provvigioni + ritenuta.
//
// Provvigione: percentuale sul premio netto (imponibile), non sul lordo.
//
// Nessun import React / alias "@/": il modulo è usabile anche fuori dal browser.

import { jsPDF } from "jspdf";
import * as autoTableModule from "jspdf-autotable";

type AutoTableFn = (doc: jsPDF, options: Record<string, unknown>) => void;
const autoTable: AutoTableFn =
  (autoTableModule as unknown as { default?: AutoTableFn }).default ?? (autoTableModule as unknown as AutoTableFn);

export const VIES_DEFAULT_WITHHOLDING_PERCENTAGE = 11.5;

export const TECNO_MGA_DETAILS = [
  "Tecno Advance MGA Broker Srl",
  "Iscr. IVASS n. B000746484",
  "P.Iva: 17460381001",
  "Sede Legale: Viale Parioli, 74 - 00197 Roma",
  "Sede Operativa: Via Michele Mercati, 18 - 00197 Roma",
  "Pec: tecnoadvancemgabroker@legalmail.it",
];

export type ViesStatementKind = "cliente" | "provvigioni";

export interface ViesStatementPolicy {
  contraente: string;
  policyNumber: string | null;
  practiceNumber: string;
  /** Data della polizza (decorrenza), YYYY-MM-DD. */
  date: string | null;
  premiumGross: number;
  premiumNet: number;
}

export interface ViesStatementImage {
  dataUrl: string;
  width: number;
  height: number;
}

interface StatementBase {
  lotNumber: number;
  /** Data di creazione del lotto, ISO. */
  lotDate: string;
  representative: { name: string; taxCode: string };
  policies: ViesStatementPolicy[];
  logo?: ViesStatementImage | null;
  signature?: ViesStatementImage | null;
}

export type ViesStatementInput =
  | (StatementBase & { kind: "cliente"; paidAt?: string | null })
  | (StatementBase & {
      kind: "provvigioni";
      companyName: string;
      commissionPercentage: number;
      withholdingPercentage: number;
      commissionsReceivedAt?: string | null;
    });

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const euro = (value: number) =>
  `€ ${value.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true })}`;

export const dateIt = (value: string | null | undefined) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
};

const pdfText = (value: string) => value.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-");

export interface ViesLotTotals {
  rows: Array<ViesStatementPolicy & { commission: number }>;
  /** Totale premi lordi: quanto paga il cliente. */
  premiums: number;
  /** Provvigioni: percentuale sul premio netto, arrotondata al centesimo per polizza. */
  commissions: number;
  /** Ritenuta d'acconto sulle provvigioni, troncata al centesimo come negli estratti Tecno MGA. */
  withholding: number;
  /** Totale versato alla compagnia: premi − provvigioni + ritenuta. */
  remitted: number;
}

export function computeViesLotTotals(
  policies: ViesStatementPolicy[],
  commissionPercentage: number,
  withholdingPercentage = 0,
): ViesLotTotals {
  const rows = policies.map((policy) => ({
    ...policy,
    commission: round2((policy.premiumNet * commissionPercentage) / 100),
  }));
  const premiums = round2(rows.reduce((total, row) => total + row.premiumGross, 0));
  const commissions = round2(rows.reduce((total, row) => total + row.commission, 0));
  // 239,27 × 11,5% = 27,516 → 27,51 (troncata, come nell'estratto conto di dicembre).
  const withholding = Math.floor(round2(((commissions * withholdingPercentage) / 100) * 1000) / 10 + 1e-6) / 100;
  return { rows, premiums, commissions, withholding, remitted: round2(premiums - commissions + withholding) };
}

// Readable file names ("Estratto conto Excel Lotto 1 - Nome.pdf"): only the characters
// that file systems reject are removed.
export const safeFileName = (value: string, maxLength = 90) => {
  const clean = Array.from(value, (char) => (char.charCodeAt(0) < 32 ? " " : char))
    .join("")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= maxLength) return clean;
  const cut = clean.slice(0, maxLength);
  return (cut.lastIndexOf(" ") > maxLength / 2 ? cut.slice(0, cut.lastIndexOf(" ")) : cut).trim();
};

export const buildViesStatementFileName = (input: Pick<ViesStatementInput, "kind" | "lotNumber" | "representative">) =>
  `${input.kind === "provvigioni" ? "Estratto provvigioni" : "Estratto conto"} Excel Lotto ${input.lotNumber} - ${safeFileName(input.representative.name)}.pdf`;

const policyCell = (row: ViesStatementPolicy) =>
  pdfText(`${row.contraente.toUpperCase()}\n${row.policyNumber ? `POLIZZA N. ${row.policyNumber}` : `PRATICA N. ${row.practiceNumber}`}`);

export function generateViesStatementPdf(input: ViesStatementInput): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const right = pageWidth - margin;
  const textWidth = pageWidth - margin * 2;
  const commission = input.kind === "provvigioni" ? input.commissionPercentage : 0;
  const withholding = input.kind === "provvigioni" ? input.withholdingPercentage : 0;
  const totals = computeViesLotTotals(input.policies, commission, withholding);

  // Intestazione: logo a sinistra, dati della società a destra.
  if (input.logo) {
    const logoWidth = 62;
    doc.addImage(input.logo.dataUrl, "PNG", margin, 16, logoWidth, (logoWidth * input.logo.height) / input.logo.width);
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 30, 30);
  TECNO_MGA_DETAILS.forEach((line, index) => doc.text(pdfText(line), right, 22 + index * 5, { align: "right" }));

  let y = 62;
  const paragraph = (text: string, options: { size: number; bold?: boolean; color?: [number, number, number]; gap: number }) => {
    doc.setFont("helvetica", options.bold ? "bold" : "normal");
    doc.setFontSize(options.size);
    doc.setTextColor(...(options.color ?? [30, 30, 30]));
    const lines = doc.splitTextToSize(pdfText(text), textWidth) as string[];
    doc.text(lines, margin, y);
    y += lines.length * options.size * 0.42 + options.gap;
  };

  const policyCount = `${totals.rows.length} ${totals.rows.length === 1 ? "polizza" : "polizze"}`;
  if (input.kind === "cliente") {
    paragraph(`ESTRATTO CONTO EXCEL LOTTO ${input.lotNumber}`, { size: 12, bold: true, gap: 4 });
    paragraph(`Estratto conto del lotto del ${dateIt(input.lotDate)} intestato a`, { size: 10, gap: 0.8 });
    paragraph(`${input.representative.name} (C.F. ${input.representative.taxCode})`, { size: 10, bold: true, gap: 1 });
    paragraph(`Fideiussioni VIES (art. 35, comma 7-quater, DPR 633/1972): ${policyCount}, premi comprensivi di imposte.`, {
      size: 9,
      color: [90, 90, 90],
      gap: 4,
    });
  } else {
    paragraph(`ESTRATTO CONTO PROVVIGIONI EXCEL LOTTO ${input.lotNumber}`, { size: 12, bold: true, gap: 4 });
    paragraph(`Estratto conto del lotto del ${dateIt(input.lotDate)} della ${input.companyName || "Compagnia ____________________"}`, {
      size: 10,
      bold: true,
      gap: 0.8,
    });
    paragraph(`Fideiussioni VIES del rappresentante fiscale ${input.representative.name} (C.F. ${input.representative.taxCode})`, {
      size: 9.5,
      gap: 1,
    });
    paragraph(
      `${policyCount}. Provvigione ${input.commissionPercentage.toLocaleString("it-IT")}% sul premio netto, ritenuta d'acconto ${input.withholdingPercentage.toLocaleString("it-IT")}%. Uso interno.`,
      { size: 9, color: [90, 90, 90], gap: 4 },
    );
  }

  const bold = { fontStyle: "bold" };
  const highlight = { fontStyle: "bold", fillColor: [242, 244, 247] };
  const tableStyles = {
    font: "helvetica",
    fontSize: 8.6,
    cellPadding: 1.7,
    textColor: [30, 30, 30],
    lineColor: [60, 60, 60],
    lineWidth: 0.2,
    valign: "middle",
    halign: "center",
  };
  const headStyles = { fillColor: [255, 255, 255], textColor: [30, 30, 30], fontStyle: "normal", halign: "center" };

  if (input.kind === "cliente") {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      head: [["POLIZZE", "DATA", "PREMI"]],
      body: [
        ...totals.rows.map((row) => [policyCell(row), dateIt(row.date), euro(row.premiumGross)]),
        [{ content: "TOTALE PREMI DA PAGARE", styles: bold }, "", { content: euro(totals.premiums), styles: highlight }],
      ],
      styles: tableStyles,
      headStyles,
      columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 28 }, 2: { cellWidth: "auto" } },
    });
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      head: [["POLIZZE", "PROVVIGIONI", "DATA", "PREMI"]],
      body: [
        ...totals.rows.map((row) => [policyCell(row), euro(row.commission), dateIt(row.date), euro(row.premiumGross)]),
        [{ content: "TOTALE", styles: bold }, { content: euro(totals.commissions), styles: bold }, "", { content: euro(totals.premiums), styles: bold }],
        [{ content: pdfText(`TOTALE R.A. (${input.withholdingPercentage.toLocaleString("it-IT")}%)`), styles: bold }, { content: euro(totals.withholding), styles: bold }, "", ""],
        [{ content: "TOTALE VERSATO", styles: bold }, "", "", { content: euro(totals.remitted), styles: highlight }],
      ],
      styles: tableStyles,
      headStyles,
      columnStyles: { 0: { cellWidth: 92 }, 1: { cellWidth: 28 }, 2: { cellWidth: 24 }, 3: { cellWidth: "auto" } },
    });
  }
  y = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 10;

  // Stato, piè di pagina e firma.
  if (y > pageHeight - 52) {
    doc.addPage();
    y = 30;
  }
  doc.setFontSize(10);
  const status =
    input.kind === "cliente"
      ? input.paidAt && `Saldato il ${dateIt(input.paidAt)}`
      : input.commissionsReceivedAt && `Provvigioni ricevute il ${dateIt(input.commissionsReceivedAt)}`;
  if (status) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 120, 60);
    doc.text(pdfText(status), margin, y);
  }
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  doc.text(
    pdfText(`${input.kind === "provvigioni" ? "Estratto provvigioni" : "Estratto conto"} Excel Lotto ${input.lotNumber} del ${dateIt(input.lotDate)}`),
    right,
    y,
    { align: "right" },
  );

  y += 10;
  const signatureWidth = 60;
  const signatureLeft = right - signatureWidth;
  doc.setFontSize(9.5);
  doc.text("Tecno Advance MGA Broker Srl", signatureLeft + signatureWidth / 2, y, { align: "center" });
  y += 3;
  if (input.signature) {
    const height = Math.min(24, (signatureWidth * input.signature.height) / input.signature.width);
    const width = (height * input.signature.width) / input.signature.height;
    const format = /^data:image\/jpe?g/i.test(input.signature.dataUrl) ? "JPEG" : "PNG";
    doc.addImage(input.signature.dataUrl, format, signatureLeft + (signatureWidth - width) / 2, y, width, height);
    y += height + 1;
  } else {
    y += 14;
  }
  doc.setDrawColor(60, 60, 60);
  doc.line(signatureLeft, y, right, y);
  doc.setFontSize(8.5);
  doc.setTextColor(90, 90, 90);
  doc.text("Firma", signatureLeft + signatureWidth / 2, y + 4, { align: "center" });

  return doc;
}

export const viesStatementPdfToBytes = (doc: jsPDF) => new Uint8Array(doc.output("arraybuffer"));
