// Documents of a VIES ZIP (one ZIP per practice), recognised by their content,
// never by file name: file names are unreliable. Only the client's documents are
// required; the fiscal representative's are recognised when present.
// - Text PDFs are classified here from their opening lines.
// - Scanned PDFs and images have no text: the document agent classifies them.

export type ViesDocumentSubject = "contraente" | "rappresentante";

export interface ViesDocumentType {
  id: string;
  label: string;
  subject: ViesDocumentSubject;
  /** Matched against the first lines of the text, lowercased and without spaces. */
  titlePatterns: RegExp[];
  /** Required in every ZIP. */
  required: boolean;
  /** Other types that stand in for this one (the Hong Kong company's certificates for the Chinese licence and credit report). */
  alsoSatisfiedBy?: string[];
}

// A Hong Kong company has no Chinese business licence nor credit report: its Certificate of
// Incorporation and/or Business Registration Certificate stand in for both.
const HONG_KONG_CERTIFICATES = ["certificato_costituzione_hk", "certificato_registrazione_hk"];

export const VIES_DOCUMENT_TYPES: ViesDocumentType[] = [
  {
    id: "licenza_commerciale",
    label: "Licenza commerciale (营业执照) con traduzione",
    subject: "contraente",
    titlePatterns: [/licenzacommerciale/, /businesslicen[cs]e/, /营业执照/],
    required: true,
    alsoSatisfiedBy: HONG_KONG_CERTIFICATES,
  },
  {
    id: "documento_identita",
    label: "Documento d'identità del legale rappresentante con traduzione",
    subject: "contraente",
    titlePatterns: [/identitycard/, /cartad'?identit/, /passaporto/, /passport/, /身份证/],
    required: true,
  },
  {
    id: "report_credito",
    label: "Report informazioni sul credito d'impresa (国家企业信用信息公示系统)",
    subject: "contraente",
    titlePatterns: [/informazionisulcredito/, /^rapportodidivulgazione/, /creditinformation/, /企业信用信息/],
    required: true,
    alsoSatisfiedBy: HONG_KONG_CERTIFICATES,
  },
  {
    id: "dichiarazione_sostitutiva",
    label: "Dichiarazione sostitutiva a supporto della fideiussione",
    subject: "contraente",
    titlePatterns: [/dichiarazionesostitutivaasupportodellafideiussione/, /保险担保出具所需声明/],
    required: true,
  },
  {
    id: "ubo",
    label: "Dichiarazione del titolare effettivo (UBO)",
    subject: "contraente",
    titlePatterns: [/beneficialownerdeclaration/, /dichiarazionedeltitolareeffettivo/, /最终受益人声明/],
    required: true,
  },
  {
    id: "mandato_rappresentanza",
    label: "Mandato di rappresentanza fiscale (税务代表授权书)",
    subject: "contraente",
    titlePatterns: [/mandatodirappresentanzafiscale/, /税务代表授权书/],
    required: true,
  },
  {
    id: "certificato_costituzione_hk",
    label: "Certificate of Incorporation di Hong Kong (公司註冊證明書)",
    subject: "contraente",
    titlePatterns: [/certificateofincorporation/, /公司註冊證明書/, /公司注册证明书/],
    required: false,
  },
  {
    id: "certificato_registrazione_hk",
    label: "Business Registration Certificate di Hong Kong (商業登記證)",
    subject: "contraente",
    titlePatterns: [/businessregistrationcertificate/, /商業登記證/, /商业登记证/],
    required: false,
  },
  {
    id: "visura_rappresentante",
    label: "Visura camerale del rappresentante fiscale",
    subject: "rappresentante",
    titlePatterns: [/visuraordinaria/, /visurastorica/],
    required: false,
  },
  {
    id: "bilancio_rappresentante",
    label: "Bilancio del rappresentante fiscale",
    subject: "rappresentante",
    titlePatterns: [/bilancio(abbreviato)?d'esercizio/, /bilanciod'esercizio/, /^\d{3}-bilancio/],
    required: false,
  },
  {
    id: "statuto_rappresentante",
    label: "Statuto del rappresentante fiscale",
    subject: "rappresentante",
    titlePatterns: [/^statuto/],
    required: false,
  },
];

export const VIES_DOCUMENT_TYPE_IDS = VIES_DOCUMENT_TYPES.map((type) => type.id);

/** The documents every ZIP must contain. */
export const VIES_REQUIRED_DOCUMENT_TYPES = VIES_DOCUMENT_TYPES.filter((type) => type.required);

/** The document types that fulfil a requirement: its own, or the ones that stand in for it. */
export const typesSatisfying = (requirementId: string) => [
  requirementId,
  ...(VIES_DOCUMENT_TYPES.find((type) => type.id === requirementId)?.alsoSatisfiedBy ?? []),
];

/** The required documents not covered by the given document types (those found in one ZIP). */
export const missingRequiredDocuments = (foundTypes: Iterable<string | null | undefined>) => {
  const found = new Set(foundTypes);
  return VIES_REQUIRED_DOCUMENT_TYPES.filter((type) => !typesSatisfying(type.id).some((id) => found.has(id)));
};

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
