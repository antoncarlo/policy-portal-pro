// Generazione del PDF "Ricapitolo Richiesta" per le pratiche Pet.
// Riproduce layout e testo della mail di preventivo inviata automaticamente
// agli utenti (Team Helpet), cosi' il partner e l'assuntore trovano tra i
// documenti della pratica lo stesso preventivo ricevuto dal cliente.
//
// Modulo condiviso tra frontend (UploadForm / pagina pratica) e Vercel
// Functions (/api/webhook-receive-policy): niente React, niente alias "@/".

import { jsPDF } from "jspdf";
import * as autoTableModule from "jspdf-autotable";
import type { PetCoverageSummary, PetSummary } from "./practiceSummary.js";
import { buildGuaranteeTable } from "./petQuoteEngine.js";
import { PET_QUOTE_HERO_HEIGHT, PET_QUOTE_HERO_JPEG_BASE64, PET_QUOTE_HERO_WIDTH } from "./petQuoteAssets.js";

// jspdf-autotable espone la funzione come default export sia nel build ESM
// (browser / Vite) sia in quello CommonJS (Node / Vercel Functions): il
// namespace import con fallback evita differenze di interop tra i due runtime.
type AutoTableFn = (doc: jsPDF, options: Record<string, unknown>) => void;
const autoTable: AutoTableFn =
  ((autoTableModule as unknown as { default?: AutoTableFn }).default ?? (autoTableModule as unknown as AutoTableFn));

interface AutoTableCellHook {
  section: string;
  column: { index: number };
  cell: { raw: unknown; styles: { textColor: [number, number, number] } };
}

export const PET_QUOTE_DOCUMENT_TYPE = "preventivo_pet";
export const PET_QUOTE_MIME_TYPE = "application/pdf";

const HELPET_MAGENTA: [number, number, number] = [155, 27, 150];
const TEXT_DARK: [number, number, number] = [33, 37, 41];
const TEXT_MUTED: [number, number, number] = [107, 114, 128];
const LINE_GREY: [number, number, number] = [209, 213, 219];

const SENDER_NAME = "Team Helpet";
const CONTACT_EMAIL = "assicurazioni@helpetapp.com";
const COMPLAINTS_EMAIL = "reclami@helpetapp.com";

export interface PetQuotePdfInput {
  practiceNumber: string;
  clientName: string;
  pet: PetSummary;
  generatedAt?: Date;
}

const BEFORE_SIGNING_BULLETS = [
  "puoi assicurare cani e gatti di qualsiasi razza o peso, che abbiano almeno 4 mesi compiuti e meno di 10 anni;",
  "devono essere animali di compagnia, quindi amici domestici e non allevati o custoditi per fini diversi;",
  "la copertura e' valida dalle ore 24.00 del 30° giorno successivo al pagamento del premio;",
  "gli animali PET che vuoi assicurare devono appartenere a te, avere microchip e libretto sanitario, ed e' possibile assicurare fino a un massimo di 3 animali;",
  "alla scadenza di ogni anno, la polizza si rinnova automaticamente, salvo tua disdetta da inviare almeno 30 giorni prima.",
];

const LEGAL_NOTES = [
  "Ai sensi della normativa sulla distribuzione assicurativa (Regolamento IVASS 40/2018), il presente scambio di comunicazioni elettroniche verra' conservato nel caso in cui la polizza assicurativa verra' perfezionata.",
  "Questo messaggio ed i suoi allegati sono da ritenersi riservati e confidenziali ed il relativo contenuto e' indirizzato unicamente alle persone indicate. La diffusione, copia o qualsiasi altra azione derivante dalla conoscenza di queste informazioni sono rigorosamente vietate. Qualora abbiate ricevuto questo messaggio per errore siete cortesemente pregati di darne immediata comunicazione al mittente e di provvedere alla distruzione dello stesso e dei suoi allegati. Grazie.",
  "This e-mail and any attachments hereto are confidential and may contain privileged information intended for the addressee(s) only. Dissemination, printing, or use by anyone else is unauthorized. If you are not the intended recipient, please delete this message and any attachments hereto and promptly advise the sender by return e-mail. Thank you.",
];

const COMPANY_FOOTER = [
  "Helpet Srl - Viale Parioli 74, 00197 Roma - P.IVA 15388071003",
  "Iscritta alla sezione B del RUI con il codice B000728380 - Vigilanza IVASS",
  `${CONTACT_EMAIL} | ${COMPLAINTS_EMAIL}`,
];

export function formatEur(value: number): string {
  const fixed = Math.abs(value).toFixed(2);
  const [intPart, decPart] = fixed.split(".");
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${value < 0 ? "-" : ""}${withThousands},${decPart}`;
}

function formatDateIt(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${d}/${m}/${date.getFullYear()}`;
}

/** Nome file del documento: "Ricapitolo Richiesta per <nome animale>.pdf". */
export function buildPetQuoteFileName(petName: string | null | undefined): string {
  const cleaned = (petName ?? "").trim().replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ");
  return `Ricapitolo Richiesta per ${cleaned || "il tuo PET"}.pdf`;
}

/** Il preventivo e' generabile solo se conosciamo le coperture o almeno il premio. */
export function canGeneratePetQuote(pet: PetSummary | null | undefined): pet is PetSummary {
  return Boolean(pet && (pet.coverages.length > 0 || pet.total_annual !== null));
}

/** Nome "commerciale" della copertura per l'elenco "Coperture incluse". */
function coverageDisplayName(c: PetCoverageSummary): string {
  if (c.category === "rsv") {
    const tier = c.id.includes("silver") ? "Silver" : c.id.includes("gold") ? "Gold" : "Platinum";
    const amount = c.name.replace(/^RSV\s+\w+\s+/i, "").replace("€", " EUR").trim();
    return `Rimborso Spese Veterinarie ${tier} ${amount}`.replace(/\s+/g, " ");
  }
  if (c.category === "rct") return `Responsabilita' Civile Terzi ${c.name.replace(/^RCT\s+/i, "").replace("€", " EUR")}`;
  return c.name;
}

function rsvMaxAmountLabel(c: PetCoverageSummary): string {
  // es. "RSV Gold 1.000€" -> "1.000,00 EUR"; "RSV Platinum 2.000€ + 500€" -> "2.000,00 EUR + 500,00 EUR"
  const amounts = c.name.match(/[\d.]+(?=€)/g) ?? [];
  if (amounts.length === 0) return "-";
  return amounts.map((a) => `${a},00 EUR`).join(" + ");
}

export function generatePetQuotePdf(input: PetQuotePdfInput): jsPDF {
  const { pet } = input;
  const generatedAt = input.generatedAt ?? new Date();
  const petName = (pet.name ?? "").trim() || "il tuo PET";
  const clientName = input.clientName.trim() || "Cliente";
  const coverages = pet.coverages;
  const totalAnnual = pet.total_annual ?? coverages.reduce((s, c) => s + c.price, 0);
  const totalMonthly = pet.total_monthly ?? Math.round((totalAnnual / 12) * 100) / 100;

  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  const ensureSpace = (height: number) => {
    if (y + height > pageHeight - 18) {
      doc.addPage();
      y = margin;
    }
  };

  const setText = (size: number, bold = false, color: [number, number, number] = TEXT_DARK) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
  };

  const paragraph = (
    text: string,
    opts: { size?: number; bold?: boolean; color?: [number, number, number]; gapAfter?: number; indent?: number } = {}
  ) => {
    const size = opts.size ?? 9.5;
    setText(size, opts.bold ?? false, opts.color ?? TEXT_DARK);
    const indent = opts.indent ?? 0;
    const lines = doc.splitTextToSize(text, contentWidth - indent) as string[];
    const lineHeight = size * 0.42;
    ensureSpace(lines.length * lineHeight);
    doc.text(lines, margin + indent, y);
    y += lines.length * lineHeight + (opts.gapAfter ?? 2.5);
  };

  /** Riga con una parte in grassetto seguita da testo normale (es. "Gentile Mario, ..."). */
  const richLine = (segments: Array<{ text: string; bold?: boolean; color?: [number, number, number] }>, size = 9.5, gapAfter = 2.5) => {
    ensureSpace(size * 0.42);
    let x = margin;
    const lineHeight = size * 0.42;
    for (const seg of segments) {
      setText(size, seg.bold ?? false, seg.color ?? TEXT_DARK);
      const words = seg.text.split(/(\s+)/);
      for (const w of words) {
        if (!w) continue;
        const width = doc.getTextWidth(w);
        if (x + width > pageWidth - margin && w.trim()) {
          y += lineHeight;
          ensureSpace(lineHeight);
          x = margin;
        }
        if (x === margin && !w.trim()) continue;
        doc.text(w, x, y);
        x += width;
      }
    }
    y += lineHeight + gapAfter;
  };

  const heading = (text: string, gapAfter = 1.5) => {
    ensureSpace(8);
    setText(9.5, true);
    doc.text(text, margin, y);
    y += 4 + gapAfter;
  };

  const rule = () => {
    ensureSpace(4);
    doc.setDrawColor(LINE_GREY[0], LINE_GREY[1], LINE_GREY[2]);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;
  };

  // ---------------------------------------------------------------------
  // Testata: immagine della mail Helpet (logo, forme magenta, cane) con il
  // claim sovrapposto nell'area bianca, come nella mail originale
  // ---------------------------------------------------------------------
  const heroWidth = contentWidth;
  const heroHeight = (heroWidth * PET_QUOTE_HERO_HEIGHT) / PET_QUOTE_HERO_WIDTH;
  const heroTop = 12;
  doc.addImage(`data:image/jpeg;base64,${PET_QUOTE_HERO_JPEG_BASE64}`, "JPEG", margin, heroTop, heroWidth, heroHeight, "helpet-hero", "FAST");

  setText(7.5, false, TEXT_MUTED);
  doc.text(`Rif. pratica ${input.practiceNumber} - Preventivo del ${formatDateIt(generatedAt)}`, pageWidth - margin, heroTop + heroHeight + 5, { align: "right" });

  // Il claim "Buone notizie: ecco il preventivo personalizzato..." e la zampa
  // fanno gia' parte dell'immagine, come nella mail originale.

  y = heroTop + heroHeight + 12;

  // ---------------------------------------------------------------------
  // Saluto
  // ---------------------------------------------------------------------
  richLine([{ text: "Gentile " }, { text: clientName, bold: true }, { text: ", ti ringraziamo per averci contattato." }], 9.5, 0.5);
  richLine([{ text: "Come ci hai chiesto, abbiamo formulato per te un preventivo per assicurare " }, { text: petName, bold: true }, { text: "." }], 9.5, 4);

  // ---------------------------------------------------------------------
  // Tabella garanzie
  // ---------------------------------------------------------------------
  paragraph("Coperture incluse nel preventivo", { size: 9.5, gapAfter: 1 });
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["#", "Nome Garanzia", "Di cosa si tratta", "Inclusa"]],
    body: buildGuaranteeTable(coverages).map((row) => [String(row.position), row.name, row.description, row.included ? "SI" : "NO"]),
    styles: { font: "helvetica", fontSize: 8, cellPadding: 1.8, textColor: TEXT_DARK, lineWidth: 0, valign: "middle" },
    headStyles: { fillColor: [255, 255, 255], textColor: TEXT_DARK, fontStyle: "bold", halign: "center" },
    bodyStyles: { fillColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 46, fontStyle: "bold" },
      2: { cellWidth: "auto" },
      3: { cellWidth: 16, halign: "center", fontStyle: "bold" },
    },
    didParseCell: (data: AutoTableCellHook) => {
      if (data.section === "body" && data.column.index === 3) {
        data.cell.styles.textColor = data.cell.raw === "SI" ? [22, 163, 74] : [220, 38, 38];
      }
    },
  });
  y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  y += 6;

  // ---------------------------------------------------------------------
  // Il tuo preventivo
  // ---------------------------------------------------------------------
  ensureSpace(30);
  paragraph("Il tuo preventivo", { size: 9.5, gapAfter: 3 });

  setText(8, true, TEXT_MUTED);
  doc.text("PREMIO ANNUALE", margin, y);
  setText(16, true, HELPET_MAGENTA);
  doc.text(formatEur(totalAnnual), pageWidth - margin, y + 0.5, { align: "right" });
  y += 5;
  doc.setDrawColor(LINE_GREY[0], LINE_GREY[1], LINE_GREY[2]);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;
  setText(8, false, TEXT_MUTED);
  doc.text("Rata Mensile", margin, y);
  setText(10, true, TEXT_DARK);
  doc.text(formatEur(totalMonthly), pageWidth - margin, y, { align: "right" });
  y += 7;

  heading("Coperture incluse", 0.5);
  paragraph(coverages.length > 0 ? coverages.map(coverageDisplayName).join(" | ") : pet.coverage_type_label ?? "-", { gapAfter: 3 });
  rule();

  heading("In allegato trovi la documentazione contrattuale completa:", 0.5);
  paragraph(
    "Condizioni Generali di Assicurazione (CGA), Documento di Informativa (DARI) e Documento di Informativa Precontrattuale (DBRI). Ti invitiamo a prendere visione di tutta la documentazione prima di procedere con la stipula.",
    { gapAfter: 4 }
  );

  heading("Come procedere", 0.5);
  richLine([
    { text: "Potrai stipulare la polizza prendendo contatto con noi all'indirizzo mail " },
    { text: CONTACT_EMAIL, color: HELPET_MAGENTA },
    { text: " oppure cliccando il bottone qui sotto." },
  ], 9.5, 0.5);
  richLine([{ text: "Importante:", bold: true }, { text: " per finalizzare l'acquisto dovrai avere almeno 18 anni compiuti e disporre di un documento di identita' valido." }], 9.5, 4);

  heading("Prima di stipulare la polizza, ricordati sempre che:", 1);
  for (const bullet of BEFORE_SIGNING_BULLETS) {
    setText(9.5);
    ensureSpace(5);
    doc.text("•", margin + 3, y);
    const lines = doc.splitTextToSize(bullet, contentWidth - 8) as string[];
    doc.text(lines, margin + 7, y);
    y += lines.length * 4 + 1;
  }
  y += 3;

  // ---------------------------------------------------------------------
  // Esempio di condizioni (per la copertura RSV scelta)
  // ---------------------------------------------------------------------
  const rsv = coverages.find((c) => c.category === "rsv");
  if (rsv) {
    const rsvName = coverageDisplayName(rsv);
    paragraph(`Esempio di condizioni: ${rsvName}`, { gapAfter: 1 });
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Nome Garanzia", "Massimale di Indennizzo", "Scoperto", "Esclusioni principali"]],
      body: [[
        rsvName,
        rsvMaxAmountLabel(rsv),
        "10% con minimo 100,00 EUR",
        "Non saranno indennizzati sinistri dovuti a patologie di origine preesistenti alla stipula della polizza.",
      ]],
      styles: { font: "helvetica", fontSize: 8, cellPadding: 1.8, textColor: TEXT_DARK, lineWidth: 0, valign: "middle" },
      headStyles: { fillColor: [255, 255, 255], textColor: TEXT_DARK, fontStyle: "bold", halign: "center" },
      bodyStyles: { fillColor: [255, 255, 255] },
      columnStyles: { 0: { cellWidth: 46 }, 1: { cellWidth: 32, halign: "center" }, 2: { cellWidth: 32, halign: "center" }, 3: { cellWidth: "auto" } },
    });
    y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
    y += 5;
  }

  // ---------------------------------------------------------------------
  // Documento richiesto + bottone
  // ---------------------------------------------------------------------
  heading("Documento richiesto per procedere", 0.5);
  richLine([
    { text: "Per completare la stipula della polizza dovrai allegare alla tua email una copia della tua " },
    { text: "Carta d'Identita' fronte e retro", bold: true },
    { text: " (o altro documento di identita' in corso di validita')." },
  ], 9.5, 0.5);
  paragraph("Ricordati di allegare il documento prima di inviare la mail.", { bold: true, gapAfter: 4 });

  ensureSpace(14);
  const buttonWidth = 48;
  doc.setFillColor(HELPET_MAGENTA[0], HELPET_MAGENTA[1], HELPET_MAGENTA[2]);
  doc.roundedRect(margin, y - 1, buttonWidth, 9, 2, 2, "F");
  setText(9.5, true, [255, 255, 255]);
  doc.text("Stipula Polizza", margin + buttonWidth / 2, y + 5, { align: "center" });
  doc.link(margin, y - 1, buttonWidth, 9, { url: `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Stipula polizza per ${petName} - Rif. ${input.practiceNumber}`)}` });
  y += 15;

  paragraph("Se hai avuto dubbi siamo a tua disposizione per aiutarti.", { gapAfter: 0.5 });
  richLine([{ text: "Un caro saluto e un abbraccio a " }, { text: petName, bold: true }, { text: "." }], 9.5, 4);
  paragraph(SENDER_NAME, { bold: true, gapAfter: 5 });

  // ---------------------------------------------------------------------
  // Note legali e footer societario
  // ---------------------------------------------------------------------
  for (const note of LEGAL_NOTES) paragraph(note, { size: 7.5, color: TEXT_MUTED, gapAfter: 2.5 });
  rule();
  for (const line of COMPANY_FOOTER) paragraph(line, { size: 7.5, color: TEXT_MUTED, gapAfter: 1 });

  // Piede pagina con numerazione
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    setText(7, false, TEXT_MUTED);
    doc.text(`Ricapitolo Richiesta per ${petName} - Rif. ${input.practiceNumber} - pagina ${i} di ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: "center" });
  }

  return doc;
}

/** Bytes del PDF (utilizzabili sia come Buffer in Node sia come Blob nel browser). */
export function petQuotePdfToBytes(doc: jsPDF): Uint8Array {
  return new Uint8Array(doc.output("arraybuffer"));
}
