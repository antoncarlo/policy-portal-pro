import type { AudienceContent, AudienceId } from "../types";

// Same verified facts as the Italian pages.
export const audiencePages: Record<AudienceId, AudienceContent> = {
  representatives: {
    lead: "If you represent non-EU companies, each one that wants to operate in VIES must give a guarantee of at least €50,000 for 36 months. In the Tecno portal you upload the applications in batches of up to 20, the documents are checked, you sign in bulk and you receive the issued bonds, with one statement of account per batch.",
    sections: [
      {
        id: "cosa-chiede-la-norma",
        heading: "What the law asks of those who represent non-EU companies",
        blocks: [
          {
            type: "p",
            text: "A business not resident in the European Union or the European Economic Area that operates through a fiscal representative is included in VIES only after a guarantee has been given: this is Article 35(7-quater) of Presidential Decree 633/1972. The guide [VIES guarantee in Italy: what it is and who must give it](article:garanzia-vies) sums up amount, duration and deadlines.",
          },
          {
            type: "list",
            items: [
              "The guarantee is made out to the Director for the time being of the Provincial Directorate competent for your tax domicile and is delivered to that Directorate, also through you.",
              "When you send the declaration with the request for inclusion in VIES you must check that the company's documents and information are complete and consistent with what you know.",
              "If you represent two or more businesses you must also give a guarantee of your own, separate from the VIES guarantee of the companies you represent.",
            ],
          },
        ],
      },
      {
        id: "nel-portale",
        heading: "How you work in the portal",
        blocks: [
          {
            type: "steps",
            items: [
              { title: "You upload the batch", text: "One Excel file with the companies' data and one archive of documents for each company: up to 20 applications per batch." },
              { title: "The portal checks the documents", text: "It reads each document, recognises what it is, compares the data and shows you at once what is missing or does not match." },
              { title: "You check the drafts and pay", text: "When the insurance company has assessed the applications you download the drafts, check them and receive a single statement of account for the batch." },
              { title: "You sign in bulk", text: "You download the documents to sign, sign them digitally and upload them together: each file goes back to its application." },
              { title: "You receive the issued bonds", text: "The final bonds, digitally signed by the insurance company, are ready to be delivered to the Provincial Directorate." },
            ],
          },
        ],
      },
      {
        id: "cosa-trovi",
        heading: "What you find in the portal",
        blocks: [
          {
            type: "list",
            items: [
              "The status of every application and every batch, with who has to take the next step.",
              "The calendar of expiry dates, with a notice one month before a bond expires.",
              "All the documents of a batch, downloadable in a single archive.",
              "The log of every step: who took it and when.",
              "The connection with your own software: firms and platforms can send applications and receive updates from their systems.",
            ],
          },
        ],
      },
      {
        id: "per-iniziare",
        heading: "What you need to start",
        blocks: [
          {
            type: "p",
            text: "Write to us from the [contact form](section:contatti) and tell us how many companies you represent: we open your access to the portal and send you the Excel template of the batch and the list of the [documents needed for each company](section:documenti).",
          },
        ],
      },
    ],
    faq: [
      {
        q: "How many applications can I upload together?",
        a: "Up to 20 applications per batch. Each batch starts from one Excel file with the companies' data and one archive of documents for each company. You can upload several batches: each has its own number, its own status and its own statement of account, and stays available in the portal with its applications and documents.",
      },
      {
        q: "Who signs the documents of the applications?",
        a: "In the portal the documents are signed by whoever uploaded the batch, with their own digital signature: after the insurance company's assessment they download the documents to sign for all the applications, sign them in bulk and upload them together. The draft bond is not signed: it is checked and confirmed before payment.",
      },
      {
        q: "Does the VIES guarantee of the represented company replace the fiscal representative's guarantee?",
        a: "No. They are two separate obligations. The VIES guarantee is given by each represented non-EU company that wants to operate in VIES. The fiscal representative's guarantee is given by whoever represents two or more businesses, for an amount that grows with the number represented, from 30,000 to 2,000,000 euro, for at least 48 months.",
      },
    ],
    cta: { title: "How many VIES applications do you handle?", text: "Tell us how many companies you represent: we open your access to the portal and send you the batch template.", button: "Get in touch" },
    guidesTitle: "Guides for fiscal representatives",
  },
  sellers: {
    lead: "If your company is based outside the European Union and the European Economic Area and operates in Italy with a fiscal representative, to enter or stay in VIES it must give the Italian Revenue Agency a guarantee of at least €50,000 for at least 36 months. With a surety bond you pay a premium and tie up no securities.",
    sections: [
      {
        id: "quando-ti-riguarda",
        heading: "When the guarantee concerns you",
        blocks: [
          {
            type: "list",
            items: [
              "The company is based outside the European Union and the European Economic Area.",
              "It meets its Italian VAT obligations through a fiscal representative.",
              "It wants to carry out intra-EU transactions, for which the VAT number must be included in the VIES archive.",
            ],
          },
          {
            type: "p",
            text: "The rules, with the official sources, are in the guide [VIES guarantee in Italy: what it is and who must give it](article:garanzia-vies).",
          },
        ],
      },
      {
        id: "cosa-fare",
        heading: "What you have to do",
        blocks: [
          {
            type: "steps",
            items: [
              { title: "Appoint a fiscal representative", text: "The company operates in Italy through a resident representative, who meets its VAT obligations on its behalf." },
              { title: "Prepare the documents", text: "Company document, identity document of the legal representative, extract from the register of the country of origin, beneficial owner declaration and fiscal representation mandate." },
              { title: "Apply for the bond", text: "You or your fiscal representative upload the documents to the portal; the insurance company assesses the application and sets the premium." },
              { title: "Receive the signed bond", text: "Once the premium has been paid the bond is issued and digitally signed by the insurance company." },
              { title: "Deliver it and ask for inclusion", text: "The bond is delivered to the Provincial Directorate of the Revenue Agency, also through the fiscal representative. After the office's check the company can ask to be included in VIES." },
            ],
          },
        ],
      },
      {
        id: "documenti",
        heading: "The documents we ask you for",
        blocks: [
          {
            type: "p",
            text: "The full list is in the section on [which documents are needed](section:documenti). Chinese companies need the report of the national enterprise credit information system; Hong Kong companies the Business Registration Certificate. The company document and the identity document of the legal representative must be uploaded with their translation.",
          },
        ],
      },
      {
        id: "nella-tua-lingua",
        heading: "In your language",
        blocks: [
          {
            type: "p",
            text: "The site and the portal are in English, Italian and Chinese. If you handle the applications of several companies, the page on [VIES surety bonds for fiscal representatives](page:representatives) explains how batches work.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Is the guarantee needed even if the company already has an Italian VAT number?",
        a: "Yes, if it wants to be included in VIES. A company that already has a VAT number gives the guarantee before asking for inclusion; one that has none yet gives it together with the declaration of start of activity. Companies that were already in VIES on 14 April 2025 had sixty days from that date to comply.",
      },
      {
        q: "Can I apply for the bond without going through the fiscal representative?",
        a: "Yes, you can write to us directly: we will tell you which documents are needed and how to upload them. The fiscal representative is involved in any case, because the guarantee is made out to the Provincial Directorate competent for the representative's tax domicile and the law asks the representative to check the company's documents when requesting inclusion in VIES.",
      },
      {
        q: "How much does the VIES surety bond cost?",
        a: "The cost is the premium of the bond, set by the insurance company after it has examined the documents. It depends on the amount guaranteed, the duration and the profile of the company. We publish no price list: we send a written quotation for each request, and asking for one does not commit you to buying the bond.",
      },
    ],
    cta: { title: "Do you sell in Europe from a non-EU country?", text: "Tell us where the company is based and who your fiscal representative is: we send you the list of documents and a written quotation.", button: "Get in touch" },
    guidesTitle: "Guides for non-EU companies",
  },
};
