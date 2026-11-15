import { audiencePages } from "./audience/en";
import type { SiteContent } from "./types";

// Same facts as the Italian version, checked against the official texts (see it.ts). Italian terms are kept in
// brackets where a reader will meet them on the documents: Agenzia delle Entrate, Direzione Provinciale.
export const en: SiteContent = {
  meta: {
    home: {
      title: "VIES Guarantee Italy: €50,000 Surety Bond | Tecno MGA",
      description: "Surety bond for the Italian VIES guarantee: €50,000 for 36 months, for non-EU companies with a fiscal representative. See documents, steps and get in touch.",
      h1: "VIES guarantee in Italy for non-EU companies",
      label: "Home",
    },
    representatives: {
      title: "VIES Surety Bonds for Fiscal Representatives | Tecno MGA",
      description: "Manage the VIES surety bonds of the companies you represent in batches of up to 20: document checks, digital signatures and one statement, all in one portal.",
      h1: "VIES surety bonds for fiscal representatives",
      label: "Fiscal representatives",
    },
    sellers: {
      title: "Italy VIES Guarantee for Non-EU Sellers | Tecno MGA",
      description: "Selling in Italy from outside the EU? VIES registration takes a €50,000 guarantee for 36 months. See the documents, the steps and how to apply for the bond.",
      h1: "Italy VIES guarantee for non-EU sellers",
      label: "Non-EU sellers",
    },
    blog: {
      title: "VIES Guarantee Italy: Rules, Documents, Guides | Tecno MGA",
      description: "Guides to the Italian VIES guarantee: Article 35(7-quater), the documents you need, digitally signed bonds and how batches work in the Tecno portal. Read on.",
      h1: "Guides to the Italian VIES guarantee",
      label: "Guides",
    },
    privacy: {
      title: "Privacy Notice for the VIES Guarantee Site | Tecno MGA",
      description: "How Tecno Advance MGA Broker Srl handles the data of people who visit the VIES site and send a contact request: purposes, legal bases, retention, rights.",
      h1: "Privacy notice",
      label: "Privacy",
    },
    cookie: {
      title: "Cookies on the VIES Guarantee Site | Tecno MGA Broker",
      description: "Which cookies the Tecno Advance MGA Broker VIES site uses: technical ones always on, Google statistics and marketing only with consent. How to change it.",
      h1: "Cookies",
      label: "Cookies",
    },
  },
  nav: {
    items: [
      { anchor: "cos-e", label: "What it is" },
      { anchor: "per-chi", label: "Who it is for" },
      { anchor: "come-funziona", label: "How it works" },
      { anchor: "portale", label: "The portal" },
      { anchor: "documenti", label: "Documents" },
      { anchor: "costo", label: "Cost" },
      { anchor: "domande", label: "FAQ" },
      { anchor: "contatti", label: "Contact" },
    ],
    guides: "Guides",
    portal: "Client area",
    contact: "Get in touch",
    menu: "Open or close the menu",
    languages: "Site language",
    skip: "Skip to content",
    home: "Tecno Advance MGA Broker: home page",
  },
  hero: {
    lead: "The surety bond that companies based outside the EU and the EEA, with a fiscal representative in Italy, give to the Italian Revenue Agency to enter and stay in VIES. Request it online, follow every step, receive it digitally signed.",
    facts: [
      { value: "€50,000", label: "minimum value of the guarantee" },
      { value: "36 months", label: "minimum duration" },
      { value: "Art. 35(7-quater)", label: "Presidential Decree 633/1972" },
    ],
    primary: "Get in touch",
    secondary: "Client area",
    note: "For fiscal representatives, professional firms, brokers and foreign companies.",
    card: { title: "VIES surety bond", beneficiaryLabel: "In favour of", beneficiary: "Provincial Directorate of the Italian Revenue Agency", signed: "Digitally signed", status: "Issued" },
  },
  trust: {
    label: "Why work with Tecno MGA",
    items: [
      { title: "Registered insurance intermediary", text: "Section B of the Italian Single Register of Insurance Intermediaries (RUI), no. B000746484. The registration can be checked on the IVASS website." },
      { title: "Supervised by IVASS", text: "Insurance distribution in Italy is supervised by IVASS, the Italian insurance supervisory authority." },
      { title: "Documents checked", text: "Every application goes through an automatic document check and a review by a member of our staff before it reaches the insurer." },
      { title: "Digitally signed bonds", text: "The insurer issues the bond as a digitally signed document (.p7m), to be delivered to the competent Provincial Directorate." },
    ],
    ruiCheck: "Check the registration in the Single Register of Insurance Intermediaries",
  },
  whatIs: {
    title: "What is the VIES guarantee?",
    answer:
      "The VIES guarantee is the guarantee that a company not resident in the European Union or the European Economic Area, with a fiscal representative in Italy, gives to the Italian Revenue Agency to be included, or to stay, in the VIES database of intra-EU traders. It is worth at least €50,000 and lasts at least 36 months.",
    facts: [
      { term: "Who must give it", text: "Businesses not resident in an EU or EEA State that meet their Italian VAT obligations through a fiscal representative appointed under Article 17(3) of Presidential Decree 633/1972 and that intend to carry out intra-EU transactions." },
      { term: "Amount", text: "A minimum guaranteed amount of €50,000." },
      { term: "Duration", text: "No less than 36 months from the date of delivery to the Provincial Directorate of the Revenue Agency." },
      { term: "In whose favour", text: "The Director for the time being of the Provincial Directorate (Direzione Provinciale) of the Revenue Agency competent for the tax domicile of the fiscal representative. It is delivered to that Directorate, in person or through the fiscal representative." },
      { term: "When", text: "Before applying for inclusion in VIES for those that already hold an Italian VAT number; together with the start-of-activity declaration for those that do not have one yet." },
      { term: "After delivery", text: "The Provincial Directorate checks that the guarantee complies and communicates the outcome: from that communication, inclusion in VIES can be requested." },
    ],
    formsTitle: "Securities deposit, bank guarantee or surety bond",
    formsColumns: { form: "Form", issuer: "Who provides it", commitment: "What it involves" },
    forms: [
      { form: "Deposit of government or government-guaranteed securities", issuer: "A restricted deposit of the securities with a custodian", commitment: "The securities stay tied up for the whole life of the guarantee." },
      { form: "Bank guarantee", issuer: "A bank, under Article 1 of Law 348/1982", commitment: "It takes a bank willing to issue it to a company based outside the EU." },
      { form: "Surety bond", issuer: "An insurance company, under Article 1 of Law 348/1982", commitment: "The policyholder pays a premium and deposits no securities. This is the form we arrange." },
    ],
    lawTitle: "From 1 January 2027 the article changes, the rule does not",
    law: "Until 31 December 2026 the guarantee is required by Article 35(7-quater) of Presidential Decree 633/1972, implemented by the decree of the Minister of Economy and Finance of 4 December 2024 (Official Gazette no. 292 of 13 December 2024) and by the Revenue Agency's order ref. 178713/2025 of 14 April 2025. From 1 January 2027 the Consolidated VAT Act applies (Legislative Decree no. 10 of 19 January 2026, D.Lgs. 10/2026): the same rule is in Article 68(10), and references to the repealed provision are read as references to the new one (Article 170(3)).",
    sourcesTitle: "Official sources (in Italian)",
    sources: [
      { label: "Italian Revenue Agency, order of 14 April 2025, ref. 178713/2025", href: "https://www.agenziaentrate.gov.it/portale/provvedimento-del-14-aprile-2025" },
      { label: "Italian Revenue Agency, inclusion in the VIES archive: legislation and guidance", href: "https://www.agenziaentrate.gov.it/portale/schede/istanze/inclusione-archivio-vies/normativa-e-prassi-partita-iva" },
      { label: "Normattiva, Presidential Decree no. 633 of 26 October 1972, Article 35", href: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:presidente.repubblica:decreto:1972-10-26;633~art35" },
      { label: "Normattiva, Legislative Decree no. 10 of 19 January 2026, Consolidated VAT Act (Articles 68, 170 and 171)", href: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2026-01-19;10" },
      { label: "FiscoOggi, the Revenue Agency's magazine: non-EU businesses with a representative, new rules to operate in VIES", href: "https://www.fiscooggi.it/portale/-/soggetti-extra-ue-con-rappresentante-nuove-regole-per-operare-nel-vies" },
      { label: "European Commission, VIES VAT number validation", href: "https://ec.europa.eu/taxation_customs/vies/" },
    ],
    disclaimer: "General information, not tax or legal advice. For your own case, ask your fiscal representative or adviser.",
    updated: "Last updated",
  },
  audiences: {
    title: "Who needs a VIES surety bond?",
    items: [
      {
        title: "Fiscal representatives, firms and brokers",
        text: "Manage from one portal the VIES guarantees of all the companies you represent.",
        points: ["Batches of up to 20 applications with one Excel file and one folder of documents per company", "Automatic document check, with the list of what is missing", "Statement of account, digital signatures and issued bonds in the same place"],
        cta: "Tell us about your volumes",
        more: "VIES surety bonds for fiscal representatives",
      },
      {
        title: "Foreign companies selling in Italy and the EU",
        text: "You are based outside the EU and the EEA, you sell online or to European customers, and you have appointed a fiscal representative in Italy: to operate in VIES you need the guarantee.",
        points: ["Site and portal in English, Italian and Chinese", "A clear list of documents, with the translations required", "A digitally signed bond, to be delivered through your fiscal representative"],
        cta: "Ask how to start",
        more: "Italy VIES guarantee for non-EU sellers",
      },
    ],
  },
  audiencePages,
  steps: {
    title: "How do you get a VIES surety bond?",
    items: [
      { title: "Upload the documents", text: "The fiscal representative or the company uploads data and documents to the portal: one application at a time, or in batches of up to 20." },
      { title: "We check the application", text: "The portal reads the documents, checks that none is missing and that the data match. A member of our staff confirms and reports what is missing." },
      { title: "Draft and payment", text: "The insurer assesses the request and prepares the draft bond. You receive the statement of account and pay the premium." },
      { title: "Digital signature", text: "You download the documents to sign, sign them digitally and upload them again: the portal recognises each signed file and matches it to its application." },
      { title: "Bond issued", text: "You receive the final bond, digitally signed by the insurer, ready to be delivered to the Provincial Directorate of the Revenue Agency." },
    ],
    outcome: "After delivery, the Provincial Directorate checks the guarantee and communicates the outcome: from then on, inclusion in VIES can be requested.",
  },
  portal: {
    title: "The portal for fiscal representatives",
    features: [
      { title: "Automatic document check", text: "The portal reads the uploaded documents, recognises what each one is and checks that the company's data match across them." },
      { title: "Batches of up to 20 applications", text: "One Excel file with the data and one archive of documents per company: the batch is created in a single upload." },
      { title: "Digital signatures in bulk", text: "The documents to sign are downloaded together and uploaded together: each .p7m file goes back to its application." },
      { title: "Statement of account", text: "For each batch, a statement with the premiums of the approved bonds, to be paid before issue." },
      { title: "Status and expiry dates", text: "Every application shows where it stands. The expiry list shows the bonds approaching the end of their 36 months." },
      { title: "Connections with other systems", text: "Firms and platforms can send applications and receive updates from their own systems." },
    ],
    api: { text: "Do you work with your own software?", cta: "Read the API documentation" },
    mock: {
      title: "Sample batch",
      lot: "4 applications",
      columns: { company: "Company", documents: "Documents", status: "Status" },
      rows: [
        { company: "Alfa Trading Ltd", documents: "6 of 6", status: "Bond issued", tone: "done" },
        { company: "Beta Home Co.", documents: "6 of 6", status: "Being signed", tone: "progress" },
        { company: "Gamma Tech Ltd", documents: "6 of 6", status: "Under review", tone: "waiting" },
        { company: "Delta Sports Co.", documents: "5 of 6", status: "One document missing", tone: "missing" },
      ],
      note: "Sample data, not related to real clients.",
    },
  },
  documents: {
    title: "Which documents are needed?",
    items: [
      { title: "Company document", text: "Business licence or certificate of incorporation of the foreign company, with translation." },
      { title: "Identity document of the legal representative", text: "Valid passport or identity card, with translation." },
      { title: "Extract from the register of the home country", text: "For Chinese companies, the report of the national enterprise credit information system; for Hong Kong, the Business Registration Certificate." },
      { title: "Beneficial owner declaration", text: "It states who controls the company; it is needed for anti-money-laundering checks." },
      { title: "Fiscal representation mandate", text: "The deed by which the company appointed its fiscal representative in Italy." },
      { title: "Declaration supporting the surety bond", text: "A self-declaration signed by the company's legal representative." },
    ],
    note: "The list may change with the company's country and the insurer's assessment: after the first contact we send the final one for your case.",
  },
  cost: {
    title: "How much does a VIES surety bond cost?",
    answer:
      "The cost of a VIES surety bond is the premium of the policy, set by the insurance company once it has examined the documents. It depends on the guaranteed amount, the duration and the profile of the foreign company. We publish no price list: we send a written quotation for each request, and the premium is paid before issue.",
    factors: [
      { title: "Guaranteed amount", text: "The legal minimum is €50,000." },
      { title: "Duration", text: "At least 36 months from delivery to the Revenue Agency." },
      { title: "Company profile", text: "Company documents, business carried out and country of establishment." },
      { title: "Number of applications", text: "Those managing several companies submit their requests in batches." },
    ],
    cta: "Ask for a quotation",
    note: "Asking for a quotation does not commit you to taking out the bond.",
  },
  faq: {
    title: "Frequently asked questions",
    items: [
      {
        q: "Who must give the VIES guarantee in Italy?",
        a: "Taxable persons not resident in a State of the European Union or the European Economic Area that meet their Italian VAT obligations through a fiscal representative and intend to carry out intra-EU transactions. Companies established in the EU or the EEA are outside the obligation. This is point 1.1 of the Revenue Agency's order of 14 April 2025.",
      },
      {
        q: "How much is the guarantee and how long does it last?",
        a: "The minimum guaranteed amount is €50,000 and the duration cannot be less than 36 months, counted from the date of delivery to the competent Provincial Directorate of the Revenue Agency. This is set out in points 2.3 and 2.7 of the order of 14 April 2025, which implements the ministerial decree of 4 December 2024.",
      },
      {
        q: "In which forms can the VIES guarantee be given?",
        a: "In three forms: a deposit of government or government-guaranteed securities, a bank guarantee, or a surety bond issued by an insurance company, the last two under Article 1 of Law 348/1982. With a surety bond the policyholder pays a premium and does not have to deposit securities for the whole life of the guarantee.",
      },
      {
        q: "In whose favour is the guarantee and where is it delivered?",
        a: "The guarantee is given in favour of the Director for the time being of the Provincial Directorate of the Revenue Agency competent for the tax domicile of the fiscal representative. It is delivered to that Directorate, in person or through the fiscal representative. The office checks it and communicates the outcome; from then on, inclusion in VIES can be requested.",
      },
      {
        q: "When must the guarantee be given?",
        a: "Those that already hold an Italian VAT number give the guarantee before applying for inclusion in VIES. Those that do not yet have one give it together with the start-of-activity declaration in which they ask for inclusion. Those already included in VIES when the order was published, on 14 April 2025, had sixty days to comply.",
      },
      {
        q: "What happens if the guarantee is not given?",
        a: "The Revenue Agency notifies the fiscal representative, by certified email or registered letter, that the procedure for exclusion from VIES has started. From receipt, a further sixty days run to give the guarantee. If it does not arrive, the VAT number is removed by the office from the database of businesses carrying out intra-EU transactions.",
      },
      {
        q: "Does the legal reference change in 2027?",
        a: "Yes: the article number changes, the rule does not. From 1 January 2027 the Consolidated VAT Act applies, Legislative Decree no. 10 of 19 January 2026. The VIES guarantee is in Article 68(10), which takes over Article 35(7-quater) of Presidential Decree 633/1972. References to the repealed provision are read as references to the new one.",
      },
      {
        q: "Can a fiscal representative manage several applications at once?",
        a: "Yes. In the portal a fiscal representative or a firm uploads up to 20 applications per batch, with one Excel file of data and one folder of documents for each company. The portal checks the documents, reports the missing ones and follows each application to the issued bond, with a single statement of account per batch.",
      },
      {
        q: "Does Tecno MGA issue the bond?",
        a: "No. The bond is issued by an insurance company. Tecno Advance MGA Broker Srl is an insurance intermediary entered in the Italian Single Register of Insurance Intermediaries under no. B000746484 and supervised by IVASS: it collects and checks the documents, submits the request to the insurer and delivers the issued, digitally signed bond.",
      },
      {
        q: "Do the foreign company's documents need a translation?",
        a: "Yes. The company's business licence or certificate of incorporation and the identity document of the legal representative are uploaded with their translation, so that the insurer and the portal can read the company name, the registered office and the details of the person signing. After the first contact we say which translations are needed and in which language.",
      },
    ],
  },
  contact: {
    title: "Contact",
    form: {
      name: "Full name",
      company: "Company or firm",
      role: "Who you are",
      rolePlaceholder: "Choose one",
      roles: {
        fiscal_representative: "Fiscal representative",
        professional_firm: "Professional firm",
        broker: "Insurance broker or agent",
        foreign_company: "Foreign company",
        other: "Other",
      },
      country: "Country",
      email: "Email",
      phone: "Phone",
      volume: "Expected applications",
      volumeHint: "For example: 1, 20 a month, 100 a year",
      message: "Message",
      optional: "optional",
      consent: "I have read the {privacy} and ask to be contacted.",
      privacyLink: "privacy notice",
      submit: "Send the request",
      sending: "Sending…",
      success: "Request sent. We will reply to the address you gave us.",
      error: "We could not send your request. Please try again shortly or write to vies@tecnomga.com.",
      invalid: "Please check the highlighted fields.",
      fieldErrors: {
        required: "This field is required.",
        email: "This email address is not valid.",
        message: "Please write at least ten characters.",
        consent: "We need your consent to contact you.",
      },
      noscript: "The form needs JavaScript. You can also write to vies@tecnomga.com.",
    },
    details: {
      title: "Contact details",
      email: "Email",
      phone: "Phone",
      pec: "Certified email (PEC)",
      legalSeat: "Registered office",
      office: "Operating office",
    },
  },
  blog: {
    by: "By",
    published: "Published on",
    updated: "Checked against the sources on",
    summaryTitle: "In short",
    faqTitle: "Frequently asked questions",
    sourcesTitle: "Official sources",
    relatedTitle: "Related guides",
    allGuides: "All guides to the Italian VIES guarantee",
    latestTitle: "Guides to the VIES guarantee",
    cta: { title: "Do you need to give the VIES guarantee?", text: "Tell us about your case: we will list the documents you need and send you a written quotation.", button: "Get in touch" },
  },
  footer: {
    about: "Insurance intermediary. This site is dedicated to the VIES guarantee for non-resident businesses with a fiscal representative in Italy.",
    rui: "Entered in section B of the Italian Single Register of Insurance Intermediaries (RUI) under no.",
    vat: "VAT no.",
    site: "The site",
    legal: "Legal information",
    contacts: "Contact details",
    privacy: "Privacy",
    cookie: "Cookies",
    cookiePreferences: "Cookie preferences",
    apiDocs: "API documentation",
    complaintsTitle: "Complaints",
    complaints: "Complaints about the intermediary's conduct are made in writing to the registered office or to the certified email address. You may also turn to IVASS, as explained on ivass.it.",
    rights: "All rights reserved.",
  },
  legal: {
    updated: "Last updated:",
    noticeLabel: "general privacy notice of Tecno Advance MGA Broker (in Italian)",
    privacy: {
      sections: [
        {
          title: "Who processes your data",
          paragraphs: [
            "The data controller is Tecno Advance MGA Broker Srl, registered office at Via Po, 102 - 00198 Roma, Italy, VAT no. 17460381001, an insurance intermediary entered in the Italian Single Register of Insurance Intermediaries under no. B000746484.",
            "For any question about your data you can write to the data protection officer (DPO), antoncarlo@tecnomga.com, or to the registered office.",
            "This notice covers the public part of the site portale.tecnomga.com and its contact form. Contractual relationships and the client area are covered by the {notice}.",
          ],
          list: [],
        },
        {
          title: "Which data we collect",
          paragraphs: [
            "We do not store your IP address with the contact request. To prevent abuse of the form the system derives an encrypted code from it, which cannot be turned back into the address, and keeps it for one day at most.",
            "We do not ask for, and do not want to receive through the form, special categories of data, such as health data, or documents: the documents of an application are uploaded only in the client area.",
          ],
          list: [
            "Data you write in the contact form: full name, company or firm, role, country, email, the text of the message and, if you give them, phone and expected number of applications. We also record the language and the page the request was sent from.",
            "Browsing data: IP address, browser type, pages requested, date and time. They are recorded automatically by the systems hosting the site, to make it work and to protect it.",
            "Preferences saved in your browser: your cookie choice and your language choice.",
            "Data collected by Google's tools, only if you have given consent: they are described on the {cookie} page.",
          ],
        },
        {
          title: "Why we process them and on what basis",
          paragraphs: [
            "We do not use the data from the form to send you newsletters or commercial communications you have not asked for, and we take no decisions based solely on automated processing.",
            "The required fields of the form are needed to answer you: without them we cannot contact you.",
          ],
          list: [
            "Answering your request and, if you ask for one, preparing a quotation: these are pre-contractual steps taken at your request (Article 6(1)(b) of Regulation (EU) 2016/679).",
            "Making the site work, protecting it and preventing abuse of the form: this is our legitimate interest (Article 6(1)(f)).",
            "Visit statistics and measurement of advertising campaigns with Google's tools: only with your consent (Article 6(1)(a)), which you can withdraw at any time from “Cookie preferences” in the footer.",
          ],
        },
        {
          title: "How long we keep them",
          paragraphs: [],
          list: [
            "Contact requests: 24 months from sending, then they are deleted automatically from the portal's list. If a contract follows from the request, the data are processed under the general privacy notice.",
            "The email carrying the request, in the controller's mailbox: for the time needed to handle it.",
            "Browsing data: for the technical retention of the logs of the provider hosting the site.",
            "Cookie choice: six months in your browser, then we ask again.",
          ],
        },
        {
          title: "Who receives the data",
          paragraphs: [
            "The data are processed by the controller's authorised staff and by the providers supplying technical services to it, as processors:",
            "Some of these providers are based in the United States. When processing involves a transfer of data outside the European Economic Area, it takes place with the safeguards of Articles 45 and 46 of the Regulation: an adequacy decision for organisations certified under the Data Privacy Framework, or standard contractual clauses.",
            "We do not sell your data and we do not disclose them to anyone else, unless the law or an authority requires it. If the request becomes an application, the necessary data are disclosed to the insurance company, as described in the general privacy notice.",
          ],
          list: [
            "Vercel Inc.: hosts the site and runs its functions, in the Dublin (Ireland) data centre.",
            "Supabase Inc.: hosts the database where the requests are saved, in its data centre in Ireland.",
            "Google (Google Workspace) and Resend: email services through which the request reaches the controller's mailbox.",
            "Google Ireland Limited: Google Analytics and Google Ads, only if you have given consent.",
            "Functional Software Inc. (Sentry): receives unexpected technical errors of the site, without the data of the form; its systems are in Germany.",
          ],
        },
        {
          title: "Your rights",
          paragraphs: [
            "At any time you can ask for access to your data, rectification, erasure, restriction of processing and portability, and you can object to processing based on legitimate interest (Articles 15 to 22 of the Regulation). If you have given consent you can withdraw it, without affecting what was done before.",
            "To exercise your rights write to antoncarlo@tecnomga.com or to the registered office. We reply within one month, as Article 12 of the Regulation requires.",
            "If you believe the processing infringes the Regulation you can lodge a complaint with the Italian data protection authority, the Garante per la protezione dei dati personali (https://www.garanteprivacy.it/), or with the supervisory authority of the country where you live or work.",
          ],
          list: [],
        },
        {
          title: "Changes to this notice",
          paragraphs: ["We update this page when the processing or the providers change. The date of the last update is shown at the bottom of the page."],
          list: [],
        },
      ],
    },
    cookie: {
      intro: [
        {
          title: "What they are",
          paragraphs: [
            "Cookies are small files a site saves in your browser. Similar tools, such as the browser's local storage, serve the same purpose: remembering something from one page to the next. This page lists what the public part of the site portale.tecnomga.com saves in your browser, and why.",
          ],
          list: [],
        },
        {
          title: "What we use",
          paragraphs: [
            "The site uses no profiling cookies of its own. It uses technical tools to remember your choices and, only if you agree, Google's tools for visit statistics and to measure advertising campaigns.",
            "Before your choice, and after a refusal, no Google script is loaded. If you refuse, the site works in the same way.",
          ],
          list: [],
        },
      ],
      tableTitle: "List",
      columns: { name: "Name", purpose: "What it is for", duration: "Duration", owner: "Whose it is" },
      rows: [
        { name: "tecno-consent-v1 (local storage)", purpose: "Necessary. Remembers your cookie choice.", duration: "6 months", owner: "Tecno MGA" },
        { name: "tecno-lang-choice (local storage)", purpose: "Necessary. Remembers that you chose a language, so the notice is not shown again.", duration: "Until you clear your browser data", owner: "Tecno MGA" },
        { name: "_ga", purpose: "Statistics, only with consent. Google Analytics: tells visitors apart.", duration: "2 years", owner: "Google" },
        { name: "_ga_<ID>", purpose: "Statistics, only with consent. Google Analytics: keeps the state of the visit.", duration: "2 years", owner: "Google" },
        { name: "_gcl_au", purpose: "Marketing, only with consent. Google Ads: links the visit to an ad to count contact requests.", duration: "90 days", owner: "Google" },
        { name: "_gcl_aw", purpose: "Marketing, only with consent. Google Ads: remembers the click on the ad you came from.", duration: "90 days", owner: "Google" },
        { name: "IDE (doubleclick.net)", purpose: "Marketing, only with consent. Google Ads: ad measurement on Google's domains.", duration: "Up to 13 months", owner: "Google" },
      ],
      after: [
        {
          title: "How to change your choice",
          paragraphs: [
            "You can change your mind at any time with “Cookie preferences” in the footer: the new choice applies at once, and with a refusal the Google cookies saved by the site are deleted. You can also delete cookies from your browser settings.",
            "When Google's tools are not active on the site there is no choice to make, and the “Cookie preferences” command does not appear.",
          ],
          list: [],
        },
        {
          title: "The client area",
          paragraphs: ["After sign-in, the client area of the portal uses its own technical tools to keep the session and remember the language. They are not used for profiling."],
          list: [],
        },
        {
          title: "Who processes the data",
          paragraphs: ["The controller is Tecno Advance MGA Broker Srl. The data collected by Google's tools are also processed by Google Ireland Limited. For everything else read the {privacy} page."],
          list: [],
        },
      ],
    },
  },
  legalNotice: "Advertising message for promotional purposes. Before signing, read the policy documentation (set informativo).",
  cookieBanner: {
    title: "Cookies",
    text: "We use technical cookies to make the site work. With your consent we also use Google cookies for visit statistics and to measure advertising campaigns.",
    accept: "Accept",
    reject: "Reject",
    close: "Close and reject",
    policyLink: "Read the cookie notice",
  },
  langNotice: {
    text: "This page is available in English.",
    action: "Switch to English",
    dismiss: "Close",
  },
};
