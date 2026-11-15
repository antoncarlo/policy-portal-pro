import type { Article } from "../../types";

// Same facts and sources as the Italian article (verified on 15 November 2026).
export const venditoriMarketplace: Article = {
  slug: "non-eu-sellers-italian-vat-and-vies",
  title: "Italian VAT Number and VIES for Non-EU Sellers: The Steps",
  description: "From the fiscal representative to inclusion in VIES: the steps for a non-EU company that sells in Italy and across Europe, with the €50,000 guarantee explained.",
  h1: "Non-EU sellers: Italian VAT number and VIES, step by step",
  label: "Non-EU sellers: Italian VAT and VIES",
  keyword: "Italian VAT number",
  summary:
    "A non-EU company that wants to carry out intra-EU transactions from Italy appoints a fiscal representative, obtains a VAT number, gives a guarantee of at least €50,000 for at least 36 months and, once the Italian Revenue Agency has checked it, asks to be included in VIES. Without the guarantee there is no inclusion.",
  sections: [
    {
      id: "quando-serve",
      heading: "When an Italian VAT number and VIES are needed",
      blocks: [
        {
          type: "p",
          text: "Whether and when a foreign company has to register for VAT in Italy depends on how it sells and where the goods leave from: that is for its tax adviser to assess. This guide is about the next step: the company registers in Italy and wants to carry out intra-EU transactions, that is, trade with VAT-registered businesses in other Member States. For that, the VAT number must be included in the VIES archive.",
        },
        {
          type: "p",
          text: "The rule on the guarantee applies to every company based outside the European Union and the European Economic Area that operates through a fiscal representative: for example in China, Japan, India, Pakistan, the United States, Brazil or Vietnam.",
        },
      ],
    },
    {
      id: "rappresentante-o-identificazione",
      heading: "Fiscal representative or direct registration",
      blocks: [
        {
          type: "table",
          columns: ["Route", "Who can use it", "VIES guarantee"],
          rows: [
            ["Direct registration", "Businesses established in another Member State, or in a third country with which there are instruments of mutual assistance on indirect taxation.", "It does not concern this route: the rule is about those who operate through a fiscal representative."],
            ["Fiscal representative", "The other non-resident businesses with no permanent establishment in Italy.", "Yes, for those based outside the EU and the EEA that want to operate in VIES."],
          ],
        },
        {
          type: "p",
          text: "The fiscal representative is resident in Italy, is appointed in the forms laid down by Article 1(4) of Presidential Decree 441/1997 and is jointly and severally liable with the company for its VAT obligations. The appointment must be made known to the other party before the transaction.",
        },
      ],
    },
    {
      id: "i-passi",
      heading: "The steps, in order",
      blocks: [
        {
          type: "steps",
          items: [
            { title: "Appointing the fiscal representative", text: "The company chooses a representative resident in Italy and gives the mandate." },
            { title: "Declaration of start of activity", text: "The declaration asks for the VAT number; for entities other than natural persons the form is AA7." },
            { title: "Option for VIES", text: "In the declaration, or later online, the company states that it intends to carry out intra-EU transactions." },
            { title: "Guarantee", text: "A company with no VAT number yet gives the guarantee together with the declaration of start of activity; one that already has it, before asking for inclusion." },
            { title: "The office's check", text: "The Provincial Directorate of the Italian Revenue Agency checks that the guarantee complies and communicates the outcome." },
            { title: "Inclusion in VIES", text: "From the date of that communication the company can ask to be included." },
          ],
        },
      ],
    },
    {
      id: "la-garanzia",
      heading: "The guarantee, in short",
      blocks: [
        {
          type: "list",
          items: [
            "At least €50,000, for at least 36 months from delivery.",
            "In favour of the Director for the time being of the Provincial Directorate competent for the tax domicile of the fiscal representative.",
            "In one of three forms, compared in [deposit, bank guarantee or surety bond](article:forme-garanzia).",
          ],
        },
        {
          type: "p",
          text: "A surety bond takes the documents listed in [documents for the Italian VIES bond](article:documenti). The full picture of the rules is in [VIES guarantee in Italy: what it is and who must give it](article:garanzia-vies).",
        },
      ],
    },
    {
      id: "restare-nel-vies",
      heading: "How to stay in VIES",
      blocks: [
        {
          type: "list",
          items: [
            "File the recapitulative statements of intra-EU transactions: if none is filed for four consecutive quarters, the Agency presumes that the business no longer intends to carry them out and removes it, after giving notice.",
            "Keep an eye on the expiry of the guarantee, which lasts at least 36 months from delivery.",
          ],
        },
        {
          type: "p",
          text: "If your company is in this position, the page on the [Italian VIES guarantee for non-EU sellers](page:sellers) explains how to apply for the bond.",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Can a non-EU company have an Italian VAT number without a fiscal representative?",
      a: "Only if it can register directly: direct registration is open to businesses established in another Member State of the European Union, or in a third country with which there are legal instruments of mutual assistance on indirect taxation. In the other cases a non-resident business with no permanent establishment operates through a fiscal representative resident in Italy.",
    },
    {
      q: "Is the VIES guarantee given before or after the VAT number?",
      a: "It depends. A company with no VAT number yet gives the guarantee together with the declaration of start of activity in which it asks to be included in VIES. A company that already has a VAT number gives it before asking for inclusion. Either way, inclusion can be requested only after the Provincial Directorate has checked the guarantee and communicated the outcome.",
    },
    {
      q: "What happens if the company does not use VIES for a year?",
      a: "If no recapitulative statement of intra-EU transactions is filed for four consecutive quarters, the Italian Revenue Agency presumes that the business no longer intends to carry them out and removes the VAT number from VIES, after sending a notice. This is Article 35(7-bis) of Presidential Decree 633/1972; from 2027 the rule is in Article 68(9) of the Consolidated VAT Act.",
    },
  ],
  sources: [
    { label: "Italian Revenue Agency, inclusion in the VIES archive: what it is (in Italian)", href: "https://www.agenziaentrate.gov.it/portale/schede/istanze/inclusione-archivio-vies/scheda-info-partite-iva_intra" },
    { label: "Italian Revenue Agency, order of 14 April 2025, ref. 178713/2025 (in Italian)", href: "https://www.agenziaentrate.gov.it/portale/provvedimento-del-14-aprile-2025" },
    { label: "Normattiva, Presidential Decree no. 633 of 26 October 1972, Article 17: fiscal representative (in Italian)", href: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:presidente.repubblica:decreto:1972-10-26;633~art17" },
    { label: "Normattiva, Presidential Decree no. 633 of 26 October 1972, Article 35 (in Italian)", href: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:presidente.repubblica:decreto:1972-10-26;633~art35" },
    { label: "Normattiva, Legislative Decree no. 10 of 19 January 2026, Consolidated VAT Act, Articles 68 and 70 (in Italian)", href: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2026-01-19;10" },
  ],
};
