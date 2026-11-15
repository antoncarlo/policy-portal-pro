import type { Article } from "../../types";

// Same facts and sources as the Italian article (verified on 15 November 2026).
export const firmaP7m: Article = {
  slug: "digitally-signed-policies-p7m",
  title: "P7m Files: Digitally Signed VIES Bonds and How to Sign",
  description: "What a .p7m file is, what a digital signature is worth, how to open one and how to sign a VIES bond, and how the portal recognises signed files sent in bulk.",
  h1: "Digitally signed bonds (.p7m): what they are and how to sign them",
  label: "Digitally signed bonds (.p7m)",
  keyword: "p7m files",
  summary:
    "A .p7m file is an envelope that holds the original document and the digital signature of whoever signed it, in the CAdES format. Under Italian law a digital signature gives the document written form and the force of a signed private deed. VIES bonds arrive from the insurance company signed this way; the documents you sign can be uploaded to the portal all together.",
  sections: [
    {
      id: "cos-e",
      heading: "What a .p7m file is",
      blocks: [
        {
          type: "p",
          text: "It is the format in which a digital signature wraps a document: inside the file bond.pdf.p7m there are the original PDF, the signature and the certificate of the signer. The format is called CAdES and is one of the three that the Member States of the European Union recognise, with the signature inside the PDF (PAdES) and the one for XML files (XAdES).",
        },
        {
          type: "table",
          columns: ["Feature", "CAdES (.p7m)", "PAdES (.pdf)"],
          rows: [
            ["What it looks like", "A new file, with the .p7m extension, that contains the document.", "The same PDF, with the signature inside it."],
            ["What can be signed", "Any kind of file.", "PDF files only."],
            ["How it is read", "It takes a signature verification program, which extracts the document.", "It opens with an ordinary PDF reader."],
          ],
        },
      ],
    },
    {
      id: "valore",
      heading: "What a digital signature is worth",
      blocks: [
        {
          type: "list",
          items: [
            "A qualified electronic signature has the equivalent legal effect of a handwritten signature and is recognised in all Member States (Article 25 of Regulation (EU) No 910/2014).",
            "In Italy an electronic document with a digital signature meets the requirement of written form and has the force of a private deed under Article 2702 of the Civil Code (Article 20(1-bis) of the Digital Administration Code).",
            "The certificate must be valid at the time of signing: a signature made with an expired, revoked or suspended certificate counts as no signature (Article 24(4-bis)).",
          ],
        },
      ],
    },
    {
      id: "come-si-apre",
      heading: "How to open and verify it",
      blocks: [
        {
          type: "steps",
          items: [
            { title: "Open the envelope", text: "With the signing program of your certificate provider, or with one of the verification programs listed by the Agency for Digital Italy (AgID)." },
            { title: "Check the outcome", text: "The program shows who signed, when, and whether the certificate was valid." },
            { title: "Extract the document", text: "The original document, for example the PDF of the bond, is saved from the envelope." },
          ],
        },
      ],
    },
    {
      id: "come-si-firma",
      heading: "How to sign the documents of an application",
      blocks: [
        {
          type: "steps",
          items: [
            { title: "Download", text: "From the portal you download in a single archive the documents to sign for all the applications." },
            { title: "Sign", text: "You sign them with your digital signature, all together if your signing program allows it." },
            { title: "Upload", text: "You upload the archive, or the single files, as signed PDFs or as .p7m files." },
            { title: "Check", text: "The portal puts each file back in its application and lists the ones it did not recognise." },
          ],
        },
        {
          type: "p",
          text: "What is signed is the copy of the bond meant for the insurance company and the pre-contractual documents. The draft is not signed. The order of the steps is in [from the request to the issued VIES bond](article:richiesta-polizza); for those handling several companies, in [handling a batch of 20 VIES applications](article:lotto-pratiche).",
        },
      ],
    },
    {
      id: "come-riconosce",
      heading: "How the portal recognises signed files",
      blocks: [
        {
          type: "list",
          items: [
            "From the name of the file or folder: the application number or the draft number assigned by the insurance company.",
            "From the content: if the name is not enough, the portal opens the envelope and looks in the document for the application number, the draft number, the VAT number or the bond number.",
            "Even with two signatures: an envelope signed twice, one signature inside the other or side by side, is read all the same.",
            "The client's name alone is not enough to attach a signed document to an application.",
            "The copies of the bond meant for the beneficiary are not to be uploaded: they are for delivery to the Italian Revenue Agency. If you upload them, the portal sets them aside.",
          ],
        },
      ],
    },
    {
      id: "errori-da-evitare",
      heading: "Mistakes to avoid",
      blocks: [
        {
          type: "list",
          items: [
            "Signing with an expired certificate.",
            "Signing the draft instead of the copy of the bond that arrives after payment.",
            "Removing the application or draft number from the file name: the portal can recognise it from the content, but with the name it is immediate.",
          ],
        },
        {
          type: "p",
          text: "To whom the issued bond is delivered, and what happens next, is explained in the guide [VIES guarantee in Italy: what it is and who must give it](article:garanzia-vies).",
        },
      ],
    },
  ],
  faq: [
    {
      q: "How do you open a .p7m file?",
      a: "With a program that verifies digital signatures: the one supplied by your certificate provider or one of the programs listed by the Agency for Digital Italy. The program opens the envelope, shows who signed and whether the certificate was valid, and lets you save the original document, for example the PDF of the bond.",
    },
    {
      q: "Is a .p7m file worth as much as a document signed by hand?",
      a: "Yes, if the signature is a digital signature or another qualified electronic signature. Regulation (EU) No 910/2014 gives it the equivalent effect of a handwritten signature, and the Italian Digital Administration Code gives a document signed this way written form and the force of a private deed. The certificate must be valid at the time of signing.",
    },
    {
      q: "Can I upload all the signed files to the portal together?",
      a: "Yes. You can upload a single archive with the signed files of all the applications, or the single files, even mixing signed PDFs and .p7m files. The portal puts each file back in its application from the name or, if needed, from the content of the document, and lists the ones it could not recognise.",
    },
  ],
  sources: [
    { label: "EUR-Lex, Regulation (EU) No 910/2014 (eIDAS), Articles 3 and 25", href: "https://eur-lex.europa.eu/eli/reg/2014/910/oj" },
    { label: "EUR-Lex, Commission Implementing Decision (EU) 2015/1506 on electronic signature formats", href: "https://eur-lex.europa.eu/eli/dec_impl/2015/1506/oj" },
    { label: "Normattiva, Legislative Decree no. 82 of 7 March 2005, Digital Administration Code, Articles 20 and 24 (in Italian)", href: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2005-03-07;82" },
    { label: "Agency for Digital Italy (AgID), qualified electronic signature and verification software (in Italian)", href: "https://www.agid.gov.it/it/piattaforme/firma-elettronica-qualificata" },
  ],
};
