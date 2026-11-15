import type { Article } from "../../types";

// Same list, checks and sources as the Italian article (verified on 15 November 2026).
export const documenti: Article = {
  slug: "documents-for-vies-surety-bond",
  title: "Documents for the Italian VIES Bond of a Foreign Company",
  description: "The six documents needed for the Italian VIES surety bond of a non-EU company, the translations required and the mistakes that most often delay an application.",
  h1: "Documents for the Italian VIES bond of a foreign company",
  label: "Documents for the VIES bond",
  keyword: "documents for the Italian VIES bond",
  summary:
    "The VIES surety bond of a foreign company takes six documents: the company document, the identity document of the legal representative, an extract from the register of the home country, the beneficial owner declaration, the fiscal representation mandate and the declaration supporting the bond. The company document and the identity document are uploaded with their translation.",
  sections: [
    {
      id: "elenco",
      heading: "The six documents",
      blocks: [
        {
          type: "table",
          columns: ["Document", "What it is", "What it is for"],
          rows: [
            ["Company document", "The business licence or certificate of incorporation of the company, with translation.", "It identifies the company: name, registered office, registration codes."],
            ["Identity document of the legal representative", "A valid passport or identity card, with translation.", "It identifies who signs for the company."],
            ["Extract from the register of the home country", "For Chinese companies, the report of the national enterprise credit information system; for Hong Kong, the Business Registration Certificate.", "It confirms the company's registration details."],
            ["Beneficial owner declaration", "It names the natural person who owns or controls the company.", "It is needed for the anti-money-laundering checks."],
            ["Fiscal representation mandate", "The deed by which the company appointed its fiscal representative in Italy.", "It links the company to the fiscal representative and to the competent Provincial Directorate."],
            ["Declaration supporting the bond", "A self-declaration signed by the legal representative.", "It goes with the application to the insurance company."],
          ],
        },
        { type: "note", text: "The list may change with the company's country and the insurer's assessment: after the first contact we send the final one for your case." },
      ],
    },
    {
      id: "per-paese",
      heading: "What changes with the country",
      blocks: [
        {
          type: "list",
          items: [
            "China: the business licence with the 18-character unified social credit code, and the report of the national enterprise credit information system.",
            "Hong Kong: the Certificate of Incorporation or the Business Registration Certificate take the place of the business licence and the report.",
            "Other countries: the equivalent document issued by the local companies register, which we agree at the first contact.",
          ],
        },
      ],
    },
    {
      id: "come-vengono-controllati",
      heading: "How they are checked",
      blocks: [
        {
          type: "p",
          text: "Every document uploaded to the portal is read automatically: the portal recognises what it is, extracts its data and compares them from one document to another and with the data given in the application. A member of staff confirms the outcome before the application reaches the insurance company.",
        },
        {
          type: "list",
          items: [
            "The company name is the same in every document.",
            "The unified social credit code has the right check character: a code misread from a scan is spotted at once.",
            "The identity document of the legal representative has not expired.",
            "All the documents of the list are there: the missing ones are named.",
          ],
        },
        {
          type: "p",
          text: "The check also helps the fiscal representative, whom the law asks to verify that the company's documents are complete: the guide [VIES guarantee in Italy: what it is and who must give it](article:garanzia-vies) explains it.",
        },
      ],
    },
    {
      id: "errori-frequenti",
      heading: "The mistakes we see most often",
      blocks: [
        {
          type: "list",
          items: [
            "An expired identity document.",
            "Scans that are rotated, cropped or printed too small, from which the codes cannot be read.",
            "The company name written differently in the licence, the mandate and the declarations.",
            "A missing translation of the company document or the identity document.",
            "Very heavy files: the portal compresses large images before reading them, but a legible scan at normal resolution uploads faster.",
          ],
        },
        {
          type: "p",
          text: "If the Italian VAT number does not appear in the documents yet, because it was assigned after the mandate was signed, the portal verifies the company's identity from the other data.",
        },
      ],
    },
    {
      id: "come-si-caricano",
      heading: "How to upload them",
      blocks: [
        {
          type: "p",
          text: "The documents of each company are uploaded to the portal in a single archive. Anyone handling several companies uses batches, described on the page about [VIES surety bonds for fiscal representatives](page:representatives); a company that must give the guarantee for itself starts from the page on the [Italian VIES guarantee for non-EU sellers](page:sellers). What happens after the upload is in [from the request to the issued VIES bond](article:richiesta-polizza).",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Do the documents have to be translated?",
      a: "Yes. The company document and the identity document of the legal representative are uploaded with their translation, so that the insurance company and the portal can read the name, the registered office and the details of whoever signs. After the first contact we tell you which translations are needed for the company's country and in which language.",
    },
    {
      q: "Is an Italian VAT number needed to apply for the bond?",
      a: "Not necessarily at the time of upload. A company that has no VAT number yet gives the guarantee together with the declaration of start of activity, so documents signed earlier may not show it. In that case the company's identity is verified from the other data: name, registration codes, legal representative and fiscal representation mandate.",
    },
    {
      q: "Who is the beneficial owner?",
      a: "It is the natural person, or persons, to whom the direct or indirect ownership of the company, or its control, can ultimately be attributed: this is the definition in Article 20 of Legislative Decree 231/2007 on anti-money laundering. The beneficial owner declaration names these persons and is required for the anti-money-laundering checks on the application.",
    },
    {
      q: "What happens if a document is missing?",
      a: "The portal flags it at once: next to each company it shows the list of the documents present and of those missing, and the application does not go to the insurance company until the list is complete. The company's archive is uploaded again with the missing document and the check starts over; a member of staff confirms before sending.",
    },
  ],
  sources: [
    { label: "Italian Revenue Agency, order of 14 April 2025, ref. 178713/2025 (in Italian)", href: "https://www.agenziaentrate.gov.it/portale/provvedimento-del-14-aprile-2025" },
    { label: "Normattiva, Presidential Decree no. 633 of 26 October 1972, Article 35 (in Italian)", href: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:presidente.repubblica:decreto:1972-10-26;633~art35" },
    { label: "Normattiva, Legislative Decree no. 231 of 21 November 2007, Article 20, beneficial owner (in Italian)", href: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2007-11-21;231~art20" },
  ],
};
