import type { Article } from "../../types";

// Same steps and sources as the Italian article (verified on 15 November 2026).
export const richiestaPolizza: Article = {
  slug: "from-request-to-issued-vies-bond",
  title: "VIES Bond: From the Request to Issue in the Tecno Portal",
  description: "The eight steps of a VIES surety bond application in the Tecno portal: upload, drafts, payment, signatures, issue. Who does what and what stays on record.",
  h1: "From the request to the issued VIES bond: how the portal works",
  label: "From the request to the issued bond",
  keyword: "VIES bond",
  summary:
    "A VIES surety bond application goes through eight steps: drafts, check, payment, confirmation, copies, signatures, sending to the insurance company and issue. Whoever uploaded the applications checks the drafts, pays and signs; Tecno submits the application to the insurer and uploads the issued bonds. Every step is recorded with who took it and when.",
  sections: [
    {
      id: "prima-del-lotto",
      heading: "First: upload and document check",
      blocks: [
        {
          type: "p",
          text: "It all starts with the upload: one Excel file with the companies' data and one archive of documents for each company. The portal reads the documents, compares them with the data and shows for each company whether the application is verified, still being checked or held up by a missing document. The list is in the guide [documents for the Italian VIES bond](article:documenti).",
        },
      ],
    },
    {
      id: "otto-passaggi",
      heading: "The eight steps",
      blocks: [
        {
          type: "table",
          columns: ["Step", "Who acts", "What happens"],
          rows: [
            ["1. Drafts", "Tecno", "The insurance company assesses the applications; Tecno uploads the draft bond of each application to the portal."],
            ["2. Check", "Whoever uploaded the applications", "Downloads the drafts, checks them and confirms they have been verified. The draft is not signed."],
            ["3. Payment", "Whoever uploaded the applications", "Downloads the statement of account, pays the balance, signs the statement and attaches it with the bank transfer receipt."],
            ["4. Confirmation", "Tecno", "Checks the documents and confirms receipt of payment: the applications move on to issue."],
            ["5. Copies", "Tecno", "Uploads, for each application, the copy of the bond meant for the insurance company, to be signed."],
            ["6. Signatures", "Whoever uploaded the applications", "Downloads the documents to sign, signs them digitally in bulk and uploads them: the portal puts each one back in its application."],
            ["7. Sending", "Tecno", "Sends the applications with all the signatures to the insurance company."],
            ["8. Issued", "Tecno", "Uploads the bonds issued by the insurance company: the batch is closed and everything can be downloaded."],
          ],
        },
        {
          type: "p",
          text: "At any time the portal shows where the batch stands and who has to take the next step. If new drafts arrive before payment, the check has to be repeated.",
        },
      ],
    },
    {
      id: "cosa-resta-tracciato",
      heading: "What stays on record",
      blocks: [
        {
          type: "list",
          items: [
            "The log of the batch: who took each step and when. It cannot be edited or deleted.",
            "The history of each application: draft attached, draft verified, payment recorded, copies sent to the insurance company.",
            "One email notice per step to whoever uploaded the applications, not one for each application.",
          ],
        },
      ],
    },
    {
      id: "dopo-emissione",
      heading: "After issue",
      blocks: [
        {
          type: "steps",
          items: [
            { title: "Delivery", text: "The bond is delivered to the competent Provincial Directorate of the Italian Revenue Agency, in person or through the fiscal representative." },
            { title: "The office's check", text: "The Provincial Directorate checks that the guarantee complies and communicates the outcome." },
            { title: "Inclusion in VIES", text: "From the date of that communication the company can ask to be included in VIES." },
            { title: "Expiry", text: "The portal's calendar flags the bond one month before it expires." },
          ],
        },
        {
          type: "p",
          text: "The rules on delivery, duration and the office's check are in the guide [VIES guarantee in Italy: what it is and who must give it](article:garanzia-vies).",
        },
      ],
    },
    {
      id: "una-sola-societa",
      heading: "And for a single company",
      blocks: [
        {
          type: "p",
          text: "The path is the same for a single application. If you have to give the guarantee for your own company, start from the page on the [Italian VIES guarantee for non-EU sellers](page:sellers) or write to us from the [contact form](section:contatti).",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Does the draft bond have to be signed?",
      a: "No. The draft is there to check that the details of the company, the fiscal representative and the beneficiary are correct before payment. Whoever uploaded the applications downloads it, checks it and confirms in the portal that this has been done. What is signed, after payment, is the copy of the bond meant for the insurance company and the pre-contractual documents.",
    },
    {
      q: "How is the premium paid?",
      a: "The portal prepares a single statement of account for the batch, with the bonds approved by the insurance company and the total of the premiums. Whoever uploaded the applications pays the balance by bank transfer, signs the statement and attaches it together with the receipt. When Tecno confirms receipt, all the applications of the batch move on to issue.",
    },
    {
      q: "Where do I find the issued bond?",
      a: "In the portal, inside the application and in the batch: when the insurance company issues the bonds, Tecno uploads them and the batch is closed. Whoever uploaded the applications receives an email notice and can download each bond, or the whole batch in a single archive with the documents of all the applications.",
    },
  ],
  sources: [
    { label: "Italian Revenue Agency, order of 14 April 2025, ref. 178713/2025 (in Italian)", href: "https://www.agenziaentrate.gov.it/portale/provvedimento-del-14-aprile-2025" },
    { label: "Italian Revenue Agency, inclusion in the VIES archive: legislation and guidance (in Italian)", href: "https://www.agenziaentrate.gov.it/portale/schede/istanze/inclusione-archivio-vies/normativa-e-prassi-partita-iva" },
  ],
};
