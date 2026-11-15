import type { Article } from "../../types";

// Same facts and sources as the Italian article (verified on 15 November 2026).
export const garanziaVies: Article = {
  slug: "vies-guarantee-italy-explained",
  title: "VIES Guarantee in Italy: Who Needs It, Amount, Duration",
  description: "The Italian VIES guarantee is owed by non-EU companies with a fiscal representative in Italy: at least €50,000 for 36 months. Who must give it, when, to whom.",
  h1: "VIES guarantee in Italy: what it is and who must give it",
  label: "VIES guarantee: what it is and who needs it",
  keyword: "VIES guarantee",
  summary:
    "The VIES guarantee is what a company based outside the European Union and the European Economic Area, with a fiscal representative in Italy, gives to the Italian Revenue Agency to be included, or to stay, in VIES. It is worth at least €50,000, lasts at least 36 months from delivery and can be a deposit of securities, a bank guarantee or a surety bond.",
  sections: [
    {
      id: "chi-e-obbligato",
      heading: "Who must give the VIES guarantee",
      blocks: [
        {
          type: "p",
          text: "It is owed by taxable persons not resident in a Member State of the European Union or in a State of the European Economic Area that meet their Italian VAT obligations through a fiscal representative and intend to carry out intra-EU transactions. The rule is Article 35(7-quater) of Presidential Decree 633/1972; point 1.1 of the Italian Revenue Agency's order of 14 April 2025 applies it both to those asking to be included in VIES and to those who want to stay in it.",
        },
        {
          type: "list",
          items: [
            "The company is based outside the European Union and the European Economic Area.",
            "It operates in Italy with a fiscal representative appointed under Article 17(3) of Presidential Decree 633/1972.",
            "It wants to be included, or to stay, in the VIES database of businesses carrying out intra-EU transactions.",
          ],
        },
        {
          type: "p",
          text: "Companies established in the European Union or the European Economic Area are outside the obligation. If your company sells in Europe from a non-EU country, the page on the [Italian VIES guarantee for non-EU sellers](page:sellers) explains where to start.",
        },
      ],
    },
    {
      id: "importo-e-durata",
      heading: "How much, how long, in whose favour",
      blocks: [
        {
          type: "table",
          columns: ["Element", "Rule", "Where it is written"],
          rows: [
            ["Amount", "A minimum guaranteed value of €50,000.", "Order, point 2.3"],
            ["Duration", "No less than 36 months from the date of delivery to the Provincial Directorate.", "Order, point 2.7"],
            ["Form", "A deposit of government or government-guaranteed securities, a bank guarantee or a surety bond.", "Order, point 2.3"],
            ["Beneficiary", "The Director for the time being of the Provincial Directorate of the Revenue Agency competent for the tax domicile of the fiscal representative.", "Order, point 2.4"],
          ],
        },
        {
          type: "p",
          text: "With a surety bond the policyholder pays a premium and deposits no securities. The premium is set by the insurance company after it has examined the documents: the section on [how much the VIES surety bond costs](section:costo) explains what it depends on.",
        },
      ],
    },
    {
      id: "quando",
      heading: "When it must be given",
      blocks: [
        {
          type: "list",
          items: [
            "A company that already has an Italian VAT number gives the guarantee before asking to be included in VIES (point 2.1).",
            "A company that has no VAT number yet gives it together with the declaration of start of activity in which it asks for inclusion (point 2.2).",
            "A company that was already in VIES on 14 April 2025 had sixty days from that date to give it (point 3.1).",
          ],
        },
      ],
    },
    {
      id: "consegna",
      heading: "How it is delivered and what happens next",
      blocks: [
        {
          type: "steps",
          items: [
            { title: "Delivery", text: "The guarantee is delivered to the competent Provincial Directorate, in person or through the fiscal representative." },
            { title: "Check", text: "The Provincial Directorate checks that the guarantee meets the requirements." },
            { title: "Outcome", text: "The office communicates the outcome of the check to whoever gave the guarantee." },
            { title: "Request for inclusion", text: "From the date of that communication the company can ask to be included in VIES, in the way set out in the Revenue Agency's order of 15 December 2014." },
          ],
        },
      ],
    },
    {
      id: "senza-garanzia",
      heading: "What happens without the guarantee",
      blocks: [
        { type: "p", text: "For a company that is not yet in VIES the rule is simple: inclusion takes place only after the guarantee has been given." },
        {
          type: "p",
          text: "For a company that was already included and has not given it, the Revenue Agency notifies the fiscal representative, by certified email or registered letter, that the exclusion procedure has started. Sixty more days run from receipt; if the guarantee does not arrive, the VAT number is removed from VIES by the office itself (points 3.2-3.4).",
        },
        {
          type: "p",
          text: "The rule that applies to everyone remains: if no recapitulative statement of intra-EU transactions is filed for four consecutive quarters, the Agency presumes that the business no longer intends to carry them out and removes it from VIES, after giving notice (Article 35(7-bis)).",
        },
      ],
    },
    {
      id: "rappresentante-fiscale",
      heading: "What the fiscal representative must do",
      blocks: [
        {
          type: "p",
          text: "The same paragraph 7-quater gives the fiscal representative a task: when sending the declaration of start or change of activity with the request for inclusion in VIES, the representative must check that the documents and information supplied by the company are complete and match what the representative knows.",
        },
        {
          type: "p",
          text: "This is why anyone representing many companies needs an orderly check of the documents. The page on [VIES surety bonds for fiscal representatives](page:representatives) shows how the portal does it for batches of up to 20 applications.",
        },
      ],
    },
    {
      id: "dal-2027",
      heading: "From 2027 the article changes, the rule does not",
      blocks: [
        {
          type: "p",
          text: "Until 31 December 2026 the reference is Article 35(7-quater) of Presidential Decree 633/1972. From 1 January 2027 the Consolidated VAT Act applies (Legislative Decree no. 10 of 19 January 2026): the guarantee is in Article 68(10), with the same content, and references to the repealed provisions are read as references to the new ones (Article 170(3)).",
        },
      ],
    },
    {
      id: "come-ottenerla",
      heading: "How to obtain the surety bond",
      blocks: [
        {
          type: "p",
          text: "Tecno Advance MGA Broker Srl is an insurance intermediary: it collects and checks the documents, submits the application to the insurance company and delivers the issued, digitally signed bond. The steps are described in [how to obtain the VIES surety bond](section:come-funziona), the list in [which documents are needed](section:documenti).",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Does the VIES guarantee also apply to companies based in the European Union?",
      a: "No. The obligation applies to businesses not resident in a State of the European Union or the European Economic Area that operate in Italy through a fiscal representative. A company established in another Member State, even if it has a fiscal representative in Italy, does not have to give this guarantee to be included in VIES.",
    },
    {
      q: "Are the VIES guarantee and the fiscal representative's guarantee the same thing?",
      a: "No, they are two different guarantees. The VIES guarantee is given by the represented company: at least €50,000 for 36 months (Article 35(7-quater)). The fiscal representative's guarantee is given by whoever takes on the role for two or more businesses: from 30,000 to 2,000,000 euro depending on how many are represented, for at least 48 months (Article 17(3)).",
    },
    {
      q: "Who delivers the guarantee to the Italian Revenue Agency?",
      a: "The non-resident company delivers it, in person or through its fiscal representative, to the Provincial Directorate of the Revenue Agency competent for the representative's tax domicile. The guarantee is made out to the Director for the time being of that Directorate, which checks that it complies and communicates the outcome: from that communication the company can ask to be included in VIES.",
    },
    {
      q: "Which rules provide for the VIES guarantee?",
      a: "Paragraph 7-quater was added to Article 35 of Presidential Decree 633/1972 by Legislative Decree 13/2024. Criteria and methods are in the decree of the Minister of Economy and Finance of 4 December 2024 (Official Gazette no. 292 of 13 December 2024); the operating rules are in the Revenue Agency's order of 14 April 2025, ref. 178713/2025.",
    },
  ],
  sources: [
    { label: "Italian Revenue Agency, order of 14 April 2025, ref. 178713/2025 (in Italian)", href: "https://www.agenziaentrate.gov.it/portale/provvedimento-del-14-aprile-2025" },
    { label: "Italian Revenue Agency, inclusion in the VIES archive: legislation and guidance (in Italian)", href: "https://www.agenziaentrate.gov.it/portale/schede/istanze/inclusione-archivio-vies/normativa-e-prassi-partita-iva" },
    { label: "Normattiva, Presidential Decree no. 633 of 26 October 1972, Article 35 (in Italian)", href: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:presidente.repubblica:decreto:1972-10-26;633~art35" },
    { label: "Normattiva, Legislative Decree no. 10 of 19 January 2026, Consolidated VAT Act, Articles 68 and 170 (in Italian)", href: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2026-01-19;10" },
    { label: "FiscoOggi, the Revenue Agency's magazine: non-EU businesses with a representative, new rules to operate in VIES (in Italian)", href: "https://www.fiscooggi.it/portale/-/soggetti-extra-ue-con-rappresentante-nuove-regole-per-operare-nel-vies" },
  ],
};
