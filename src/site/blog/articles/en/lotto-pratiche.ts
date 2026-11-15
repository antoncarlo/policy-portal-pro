import type { Article } from "../../types";

// Same workflow and sources as the Italian article (verified on 15 November 2026).
export const lottoPratiche: Article = {
  slug: "batch-of-20-vies-applications",
  title: "Batch of VIES Applications: Guide for Fiscal Representatives",
  description: "How a fiscal representative uploads up to 20 VIES applications in one batch: the Excel file, the document archives, the portal's checks and what comes next.",
  h1: "Handling a batch of 20 VIES applications: a guide for fiscal representatives",
  label: "Handling a batch of 20 applications",
  keyword: "batch of VIES applications",
  summary:
    "A batch holds up to 20 VIES applications uploaded together: one Excel file with the companies' data and one archive of documents for each company. The portal matches each row to its archive, reads the documents and flags what is missing. From there the batch moves as a single file: drafts, one statement of account, signatures in bulk, issued bonds.",
  sections: [
    {
      id: "cosa-serve",
      heading: "What you need to prepare the batch",
      blocks: [
        {
          type: "list",
          items: [
            "The Excel template of the batch, with three sheets: CONTRAENTE (policyholder), RAPPRESENTANTE FISCALE (fiscal representative) and BENEFICIARIO (beneficiary).",
            "In the CONTRAENTE sheet, one row per company, with the ZIP column giving the name of the archive that holds its documents.",
            "One ZIP archive per company, with the documents of the list.",
            "No more than 20 rows per batch.",
          ],
        },
        { type: "p", text: "The list of documents for each company is in the guide [documents for the Italian VIES bond](article:documenti)." },
      ],
    },
    {
      id: "come-compilare-excel",
      heading: "How to fill in the Excel file",
      blocks: [
        {
          type: "list",
          items: [
            "The ZIP column can hold a number, a short code or the client's internal code: it must match the name of the archive. Capital letters, spaces and the file extension do not matter.",
            "The company is identified by the Italian tax code or VAT number assigned by the Italian Revenue Agency: a foreign registration code in those columns is rejected with a message.",
            "The fiscal representative and the beneficiary are read from their own sheets.",
            "The beneficiary is the Provincial Directorate of the Revenue Agency competent for the tax domicile of the fiscal representative.",
          ],
        },
      ],
    },
    {
      id: "al-caricamento",
      heading: "What happens on upload",
      blocks: [
        {
          type: "steps",
          items: [
            { title: "Matching", text: "The portal matches each row of the Excel file to its archive and flags the archives that match no row." },
            { title: "Reading", text: "It opens the archives and reads the documents: while reading is in progress the row shows as being checked." },
            { title: "Comparison", text: "It compares the data in the documents with the Excel file and from one document to another." },
            { title: "Outcome", text: "Each row is either ready or says what is missing or does not match, with what to do." },
            { title: "Creating the batch", text: "With the ready rows you create the batch: each company becomes an application with its own number." },
          ],
        },
      ],
    },
    {
      id: "riga-bloccata",
      heading: "If a row stays blocked",
      blocks: [
        {
          type: "p",
          text: "A row is blocked by a missing, expired or illegible document. The blocked row does not enter the batch: the other companies go ahead, and the corrected one is uploaded in a later batch.",
        },
        {
          type: "p",
          text: "Automatic reading can get a difficult scan wrong. If a row is held up only by a document check and the document has been verified in another way, you can force it through on your own responsibility: the reason, the note, your name and the time stay recorded in the application.",
        },
      ],
    },
    {
      id: "dopo-la-creazione",
      heading: "After the batch is created",
      blocks: [
        {
          type: "p",
          text: "From here the batch follows the eight steps described in [from the request to the issued VIES bond](article:richiesta-polizza): one check of the drafts, one statement of account, signatures in bulk. For the signatures see [digitally signed bonds in .p7m format](article:firma-p7m).",
        },
        {
          type: "list",
          items: [
            "In the applications menu each batch has its own number and shows how many applications are at each stage.",
            "The documents of the whole batch download as a single archive, with one folder per application.",
            "The calendar of expiry dates lists the bonds and gives notice one month before they expire.",
          ],
        },
      ],
    },
    {
      id: "garanzia-del-rappresentante",
      heading: "The guarantee that concerns you",
      blocks: [
        {
          type: "p",
          text: "Whoever represents two or more businesses must also give a guarantee of their own, different from the VIES guarantee of the companies represented. Amounts and duration are in the guide [fiscal representative's guarantee and VIES guarantee](article:garanzia-rappresentante).",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Can I upload more than 20 applications?",
      a: "Yes, by splitting them into several batches: each batch holds up to 20 applications and has its own number, its own status and its own statement of account. All the batches stay available in the portal, with the summary of applications by stage, and can be searched, filtered and exported together with their applications.",
    },
    {
      q: "What must the document archive be called?",
      a: "As written in the ZIP column of the Excel file, in the row of that company: a number, a short code or the client's internal code. The portal matches row and archive regardless of capital letters, spaces and file extension, so the value in the Excel file and the file name may differ only in these details. One archive per company is needed.",
    },
    {
      q: "Who pays and who signs for the batch?",
      a: "Whoever uploaded the batch. The statement of account is made out to their company: they pay it by bank transfer and sign it for acceptance. After payment they digitally sign, in bulk, the copy of the bond meant for the insurance company and the pre-contractual documents of each application. The draft bond is not signed: it is checked before payment.",
    },
  ],
  sources: [
    { label: "Italian Revenue Agency, order of 14 April 2025, ref. 178713/2025 (in Italian)", href: "https://www.agenziaentrate.gov.it/portale/provvedimento-del-14-aprile-2025" },
    { label: "Normattiva, Presidential Decree no. 633 of 26 October 1972, Article 35: the fiscal representative's check of the documents (in Italian)", href: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:presidente.repubblica:decreto:1972-10-26;633~art35" },
    { label: "Italian Revenue Agency, order of 17 April 2025, ref. 186368/2025: guarantee of fiscal representatives (in Italian)", href: "https://www.agenziaentrate.gov.it/portale/provvedimento-del-17-aprile-2025" },
  ],
};
