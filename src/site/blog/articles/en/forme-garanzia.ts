import type { Article } from "../../types";

// Same facts and sources as the Italian article (verified on 15 November 2026).
export const formeGaranzia: Article = {
  slug: "deposit-bank-guarantee-or-surety-bond",
  title: "Surety Bond, Deposit or Bank Guarantee for Italian VIES",
  description: "The Italian VIES guarantee can take three forms: a deposit of government securities, a bank guarantee or a surety bond. Who issues each and what it involves.",
  h1: "VIES guarantee: deposit, bank guarantee or surety bond",
  label: "Deposit, bank guarantee or surety bond",
  keyword: "surety bond",
  summary:
    "The VIES guarantee can be given in three forms: a deposit of government or government-guaranteed securities, a bank guarantee, or a surety bond issued by an insurance company. Minimum amount, duration and beneficiary are the same; what changes is who issues the guarantee and what is asked in return: the deposit of securities, a relationship with a bank, or the payment of a premium.",
  sections: [
    {
      id: "tre-forme",
      heading: "The three forms allowed",
      blocks: [
        {
          type: "p",
          text: "Point 2.3 of the Italian Revenue Agency's order of 14 April 2025 allows three forms: a deposit of government or government-guaranteed securities, a bank guarantee and a surety bond, the last two issued under Article 1 of Law no. 348 of 10 June 1982, the law that governs security given in favour of the State and other public bodies.",
        },
        {
          type: "table",
          columns: ["Form", "Who issues it", "What stays committed"],
          rows: [
            ["Deposit of government or government-guaranteed securities", "The entity with which the restricted deposit of the securities is set up.", "The securities, tied up for the whole life of the guarantee."],
            ["Bank guarantee", "A bank; Law 348/1982 also admits mutual guarantee consortia entered in the register and supervised by the Bank of Italy.", "The relationship with the bank that stands surety."],
            ["Surety bond", "An insurance company authorised for the suretyship class, operating in Italy under the right of establishment or the freedom to provide services.", "The premium paid to the insurer; no securities deposited."],
          ],
        },
      ],
    },
    {
      id: "cosa-non-cambia",
      heading: "What does not change from one form to another",
      blocks: [
        {
          type: "list",
          items: [
            "The minimum guaranteed value: €50,000 (point 2.3).",
            "The duration: no less than 36 months from delivery to the Provincial Directorate (point 2.7).",
            "The beneficiary: the Director for the time being of the Provincial Directorate competent for the tax domicile of the fiscal representative (point 2.4).",
            "The check: the Provincial Directorate checks that the guarantee complies and communicates the outcome (point 2.8).",
          ],
        },
        { type: "p", text: "Who must give it, and when, is explained in the guide [VIES guarantee in Italy: what it is and who must give it](article:garanzia-vies)." },
      ],
    },
    {
      id: "cosa-contiene",
      heading: "What the document must contain",
      blocks: [
        { type: "p", text: "The order attaches a template for each form and lists, in points 2.5 and 2.6, the information that cannot be missing." },
        {
          type: "table",
          columns: ["Information", "Deposit of securities", "Surety bond or bank guarantee"],
          rows: [
            ["Who asks to be included in VIES", "Yes", "Yes"],
            ["Who gives the guarantee", "The entity with which the restricted deposit is set up and any third party in whose name the securities are held", "The entity that stands surety for the policyholder"],
            ["Provincial Directorate that benefits", "Yes", "Yes"],
            ["Scope, duration and amount", "Yes", "Yes"],
            ["Clauses of its own", "Composition of the deposit", "Default of the policyholder, waiver of the benefit of prior enforcement, and subrogation"],
            ["Obligations of the parties, form of notices, competent court", "Yes", "Yes"],
          ],
        },
        {
          type: "p",
          text: "The waiver of the benefit of prior enforcement means that the Revenue Agency can turn directly to the surety, without first having to act against the guaranteed company. With subrogation, the surety that has paid takes over the rights against the company.",
        },
      ],
    },
    {
      id: "come-scegliere",
      heading: "How to choose",
      blocks: [
        {
          type: "p",
          text: "The choice belongs to the company and its adviser. Three things usually weigh: whether there are securities to tie up for at least 36 months, whether a bank will issue a guarantee to a company based outside the European Union, and the premium of a bond.",
        },
        {
          type: "p",
          text: "Tecno Advance MGA Broker Srl arranges the surety bond: the insurance company sets the premium after examining the documents. The steps are in [how to obtain the VIES surety bond](section:come-funziona), the factors of the premium in [how much the VIES surety bond costs](section:costo).",
        },
      ],
    },
  ],
  faq: [
    {
      q: "What is the difference between a deposit and a guarantee?",
      a: "With a deposit the company ties up its own government securities, or securities guaranteed by the State, in a deposit in favour of the Italian Revenue Agency. With a guarantee a third party, a bank or an insurance company, undertakes to pay in the company's place if it fails to perform: the company deposits no securities but obtains the surety's commitment.",
    },
    {
      q: "Is a surety bond worth as much as a bank guarantee?",
      a: "Yes. The Italian Revenue Agency's order of 14 April 2025 puts the surety bond and the bank guarantee on the same footing, both issued under Article 1 of Law 348/1982, and asks for the same content in both. The insurance company must be authorised to carry on the suretyship class of business.",
    },
    {
      q: "Can a cash deposit be paid for VIES?",
      a: "The Italian Revenue Agency's order of 14 April 2025 does not provide for a deposit of cash: point 2.3 lists a deposit of government or government-guaranteed securities, a surety bond and a bank guarantee. A company that does not want to tie up securities can therefore choose between a bank's guarantee and an insurance company's bond.",
    },
  ],
  sources: [
    { label: "Italian Revenue Agency, order of 14 April 2025, ref. 178713/2025 (in Italian)", href: "https://www.agenziaentrate.gov.it/portale/provvedimento-del-14-aprile-2025" },
    { label: "Normattiva, Law no. 348 of 10 June 1982, Article 1 (in Italian)", href: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:1982-06-10;348" },
    { label: "Italian Revenue Agency, inclusion in the VIES archive: legislation and guidance (in Italian)", href: "https://www.agenziaentrate.gov.it/portale/schede/istanze/inclusione-archivio-vies/normativa-e-prassi-partita-iva" },
  ],
};
