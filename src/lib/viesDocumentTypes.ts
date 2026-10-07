// Documents required in every VIES ZIP (one ZIP per practice), recognised by
// their content, never by file name: file names are unreliable.
// - Text PDFs are classified here from their opening lines.
// - Scanned PDFs and images have no text: the document agent classifies them.

export type ViesDocumentSubject = "contraente" | "rappresentante";

export interface ViesDocumentType {
  id: string;
  label: string;
  subject: ViesDocumentSubject;
  /** Matched against the first lines of the text, lowercased and without spaces. */
  titlePatterns: RegExp[];
}

export const VIES_DOCUMENT_TYPES: ViesDocumentType[] = [
  {
    id: "licenza_commerciale",
    label: "Licenza commerciale (营业执照) con traduzione",
    subject: "contraente",
    titlePatterns: [/licenzacommerciale/, /businesslicen[cs]e/, /营业执照/],
  },
  {
    id: "documento_identita",
    label: "Documento d'identità del legale rappresentante con traduzione",
    subject: "contraente",
    titlePatterns: [/identitycard/, /cartad'?identit/, /passaporto/, /passport/, /身份证/],
  },
  {
    id: "report_credito",
    label: "Report informazioni sul credito d'impresa (国家企业信用信息公示系统)",
    subject: "contraente",
    titlePatterns: [/informazionisulcredito/, /^rapportodidivulgazione/, /creditinformation/, /企业信用信息/],
  },
  {
    id: "dichiarazione_sostitutiva",
    label: "Dichiarazione sostitutiva a supporto della fideiussione",
    subject: "contraente",
    titlePatterns: [/dichiarazionesostitutivaasupportodellafideiussione/, /保险担保出具所需声明/],
  },
  {
    id: "ubo",
    label: "Dichiarazione del titolare effettivo (UBO)",
    subject: "contraente",
    titlePatterns: [/beneficialownerdeclaration/, /dichiarazionedeltitolareeffettivo/, /最终受益人声明/],
  },
  {
    id: "mandato_rappresentanza",
    label: "Mandato di rappresentanza fiscale (税务代表授权书)",
    subject: "contraente",
    titlePatterns: [/mandatodirappresentanzafiscale/, /税务代表授权书/],
  },
  {
    id: "visura_rappresentante",
    label: "Visura camerale del rappresentante fiscale",
    subject: "rappresentante",
    titlePatterns: [/visuraordinaria/, /visurastorica/],
  },
  {
    id: "bilancio_rappresentante",
    label: "Bilancio del rappresentante fiscale",
    subject: "rappresentante",
    titlePatterns: [/bilancio(abbreviato)?d'esercizio/, /bilanciod'esercizio/, /^\d{3}-bilancio/],
  },
  {
    id: "statuto_rappresentante",
    label: "Statuto del rappresentante fiscale",
    subject: "rappresentante",
    titlePatterns: [/^statuto/],
  },
];

export const VIES_DOCUMENT_TYPE_IDS = VIES_DOCUMENT_TYPES.map((type) => type.id);

export const getViesDocumentType = (id: string | null | undefined) =>
  VIES_DOCUMENT_TYPES.find((type) => type.id === id) ?? null;

/**
 * Classifies a text PDF from its title: the first of its opening lines that
 * starts with a known title. A title quoted inside a sentence (e.g. a notarial
 * certificate naming the mandate it certifies) does not count.
 */
export const classifyDocumentText = (lines: string[]): string | null => {
  for (const line of lines.slice(0, 20)) {
    const compact = line.toLowerCase().replace(/\s+/g, "");
    for (const type of VIES_DOCUMENT_TYPES) {
      if (type.titlePatterns.some((pattern) => {
        const index = compact.search(pattern);
        return index >= 0 && index <= 12;
      })) return type.id;
    }
  }
  return null;
};
