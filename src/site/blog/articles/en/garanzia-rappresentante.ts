import type { Article } from "../../types";

// Same facts and sources as the Italian article (verified on 15 November 2026).
export const garanziaRappresentante: Article = {
  slug: "fiscal-representative-guarantee-vs-vies-guarantee",
  title: "Fiscal Representative's Guarantee or VIES Guarantee?",
  description: "Two guarantees in Italy: the fiscal representative's own, 30,000 to 2,000,000 euro for 48 months, and the company's VIES one, €50,000 for 36 months. Compared.",
  h1: "Fiscal representative's guarantee and VIES guarantee of the represented company: the differences",
  label: "Representative's guarantee and VIES guarantee",
  keyword: "fiscal representative's guarantee",
  summary:
    "They are two separate guarantees. The fiscal representative's guarantee is given by whoever takes on that role for two or more businesses: from 30,000 to 2,000,000 euro depending on how many are represented, for at least 48 months. The VIES guarantee is given by each represented non-EU company that wants to operate in VIES: at least €50,000 for at least 36 months.",
  sections: [
    {
      id: "confronto",
      heading: "The two guarantees side by side",
      blocks: [
        {
          type: "table",
          columns: ["Aspect", "Fiscal representative's guarantee", "VIES guarantee of the represented company"],
          rows: [
            ["Rule", "Article 17(3) of Presidential Decree 633/1972", "Article 35(7-quater) of Presidential Decree 633/1972"],
            ["Ministerial decree", "9 December 2024 (Official Gazette no. 297 of 19 December 2024)", "4 December 2024 (Official Gazette no. 292 of 13 December 2024)"],
            ["Order of the Italian Revenue Agency", "17 April 2025, ref. 186368/2025", "14 April 2025, ref. 178713/2025"],
            ["Who gives it", "Whoever takes on the role of fiscal representative for two or more businesses", "The represented business, not resident in the EU or the EEA"],
            ["What it is for", "Taking on and keeping the role of fiscal representative", "Asking for, or keeping, inclusion in VIES"],
            ["Minimum amount", "From 30,000 to 2,000,000 euro, depending on how many are represented", "€50,000"],
            ["Minimum duration", "48 months from delivery", "36 months from delivery"],
            ["Delivery", "In person, to the Provincial Directorate of the representative's tax domicile", "In person or through the fiscal representative, to the same Provincial Directorate"],
            ["If it is missing", "The VAT numbers of the represented businesses are closed by the office", "Removal from VIES by the office"],
          ],
        },
      ],
    },
    {
      id: "garanzia-del-rappresentante",
      heading: "The fiscal representative's guarantee",
      blocks: [
        {
          type: "p",
          text: "Legislative Decree 13/2024 added two conditions to Article 17(3) of Presidential Decree 633/1972 for anyone acting as a fiscal representative: personal requirements, to be attested in a declaration, and a guarantee graduated according to the number of businesses represented.",
        },
        {
          type: "table",
          columns: ["Businesses represented", "Minimum guaranteed value"],
          rows: [
            ["One", "No guarantee: the declaration of requirements is enough"],
            ["2 to 9", "€30,000"],
            ["10 to 50", "€100,000"],
            ["51 to 100", "€300,000"],
            ["101 to 1,000", "€1,000,000"],
            ["More than 1,000", "€2,000,000"],
          ],
        },
        {
          type: "list",
          items: [
            "The declaration attests that there are no convictions or pending criminal proceedings for financial offences, no serious and repeated breaches of tax and social security rules, and none of the conditions of Article 15(1) of Law 55/1990.",
            "If the representative is a company, the declaration is made by all its legal representatives.",
            "If the number represented rises into a higher band, a new guarantee is needed; after the positive outcome of the check, release of the previous one can be requested.",
            "Those already acting as fiscal representatives on 17 April 2025 had sixty days from that date to comply.",
          ],
        },
      ],
    },
    {
      id: "garanzia-vies",
      heading: "The VIES guarantee of the represented company",
      blocks: [
        {
          type: "p",
          text: "It concerns the company, not its representative: businesses not resident in the European Union or the European Economic Area that operate through a fiscal representative are included in VIES only after giving a guarantee of at least €50,000 for at least 36 months. Rules and deadlines are in the guide [VIES guarantee in Italy: what it is and who must give it](article:garanzia-vies); the forms allowed in [deposit, bank guarantee or surety bond](article:forme-garanzia).",
        },
      ],
    },
    {
      id: "quando-servono-entrambe",
      heading: "When both are needed",
      blocks: [
        {
          type: "p",
          text: "The two guarantees do not replace each other. For example: a firm that represents twelve non-EU companies gives its own guarantee in the band from ten to fifty businesses, and each of the twelve companies that wants to operate in VIES gives its own VIES guarantee.",
        },
        {
          type: "p",
          text: "This site is dedicated to the VIES guarantee of the represented company. Those handling the guarantees of several companies upload them to the portal in batches: see [handling a batch of 20 VIES applications](article:lotto-pratiche) and the page on [VIES surety bonds for fiscal representatives](page:representatives).",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Does someone who represents a single company have to give the fiscal representative's guarantee?",
      a: "No. Point 3.4 of the Italian Revenue Agency's order of 17 April 2025 exempts from the guarantee whoever intends to represent a single business; the declaration of personal requirements must still be filed. The represented company, if it is based outside the EU and the EEA and wants to operate in VIES, must give its own VIES guarantee all the same.",
    },
    {
      q: "Does the fiscal representative's guarantee also cover the companies represented?",
      a: "No. It is a guarantee about the representative's role and is made out to the Provincial Directorate competent for the representative's tax domicile. It does not replace the VIES guarantee, which each represented non-EU company gives for itself: at least €50,000 for at least 36 months, to ask for, or keep, inclusion in VIES.",
    },
    {
      q: "What happens to a fiscal representative who does not give the guarantee?",
      a: "The Italian Revenue Agency notifies the representative, by certified email or registered letter, that the procedure to close the VAT numbers of the represented businesses has started. From receipt there are sixty more days to file the declaration and give the guarantee; otherwise the VAT numbers of the represented businesses are closed by the office.",
    },
  ],
  sources: [
    { label: "Italian Revenue Agency, order of 17 April 2025, ref. 186368/2025: guarantee of fiscal representatives (in Italian)", href: "https://www.agenziaentrate.gov.it/portale/provvedimento-del-17-aprile-2025" },
    { label: "Italian Revenue Agency, order of 14 April 2025, ref. 178713/2025: VIES guarantee (in Italian)", href: "https://www.agenziaentrate.gov.it/portale/provvedimento-del-14-aprile-2025" },
    { label: "Normattiva, Presidential Decree no. 633 of 26 October 1972, Article 17 (in Italian)", href: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:presidente.repubblica:decreto:1972-10-26;633~art17" },
    { label: "Normattiva, Presidential Decree no. 633 of 26 October 1972, Article 35 (in Italian)", href: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:presidente.repubblica:decreto:1972-10-26;633~art35" },
  ],
};
