// Privacy and Cookies of the company site, in English: same facts and same structure as the Italian text (it.ts).
import type { CorpLegal } from "./index";

const when = <T>(condition: boolean, ...items: T[]): T[] => (condition ? items : []);

export const legalEn = (measurement: boolean): CorpLegal => ({
  updated: "Last updated:",
  noticeLabel: "general privacy notice of Tecno Advance MGA Broker (in Italian)",
  privacy: {
    sections: [
      {
        title: "Who processes your data",
        paragraphs: [
          "The data controller is Tecno Advance MGA Broker Srl, registered office at Via Po, 102 - 00198 Roma, Italy, VAT no. 17460381001, an insurance intermediary entered in the Italian Single Register of Insurance Intermediaries under no. B000746484.",
          "For any question about your data you can write to the data protection officer (DPO), antoncarlo@tecnomga.com, or to the registered office.",
          "This notice covers the site tecnomga.com and its quotation form. Contractual relationships are covered by the {notice}.",
        ],
        list: [],
      },
      {
        title: "Which data we collect",
        paragraphs: [
          "We do not store your IP address with the quotation request. To prevent abuse of the form the system derives an encrypted code from it, which cannot be turned back into the address, and keeps it for one day at most.",
          "We do not ask for, and do not want to receive through the form, special categories of data, such as health data, or documents: we tell you which ones a quotation needs after we receive your request.",
        ],
        list: [
          "Data you write in the quotation form: full name, email, the text of the message and, if you give them, company, phone and product. We also record the language and the page the request was sent from.",
          "Browsing data: IP address, browser type, pages requested, date and time. They are recorded automatically by the systems hosting the site, to make it work and to protect it.",
          "Visit statistics with Vercel Web Analytics, without cookies and without saving anything in your browser: page visited, referring page, country, region and city, operating system, browser and device type. Visitors are told apart by a code derived from the request, which is deleted after 24 hours: the data are used only in aggregate form and are not linked to you or to your IP address. Before sending, we remove from the page address everything the statistics do not need.",
          measurement ? "Preferences saved in your browser: your cookie choice and your language choice." : "Preferences saved in your browser: your language choice.",
          ...when(measurement, "Data collected by Google Analytics, only if you have given consent: they are described on the {cookie} page."),
        ],
      },
      {
        title: "Why we process them and on what basis",
        paragraphs: [
          "We do not use the data from the form to send you newsletters or commercial communications you have not asked for, and we take no decisions based solely on automated processing.",
          "The required fields of the form are needed to answer you: without them we cannot contact you.",
        ],
        list: [
          "Answering your request and preparing the quotation you ask for: these are pre-contractual steps taken at your request (Article 6(1)(b) of Regulation (EU) 2016/679).",
          "Making the site work, protecting it and preventing abuse of the form: this is our legitimate interest (Article 6(1)(f)).",
          "Visit statistics in aggregate form with Vercel Web Analytics, without cookies, to understand which pages are useful and improve the site: this is our legitimate interest (Article 6(1)(f)).",
          ...when(measurement, "Visit statistics with Google Analytics: only with your consent (Article 6(1)(a)), which you can withdraw at any time from “Cookie preferences” in the footer."),
        ],
      },
      {
        title: "How long we keep them",
        paragraphs: [],
        list: [
          "Quotation requests: 24 months from sending, then they are deleted automatically from the archive where we keep them. If a contract follows from the request, the data are processed under the general privacy notice.",
          "The email carrying the request, in the controller's mailbox: for the time needed to handle it.",
          "Browsing data: for the technical retention of the logs of the provider hosting the site.",
          "Visit statistics: the code that tells visitors apart is deleted after 24 hours; only aggregate data remain.",
          ...when(measurement, "Cookie choice: six months in your browser, then we ask again."),
        ],
      },
      {
        title: "Who receives the data",
        paragraphs: [
          "The data are processed by the controller's authorised staff and by the providers supplying technical services to it, as processors:",
          "Some of these providers are based in the United States. When processing involves a transfer of data outside the European Economic Area, it takes place with the safeguards of Articles 45 and 46 of the Regulation: an adequacy decision for organisations certified under the Data Privacy Framework, or standard contractual clauses.",
          "We do not sell your data and we do not disclose them to anyone else, unless the law or an authority requires it. If a contract follows from the request, the necessary data are disclosed to the insurance company, as described in the general privacy notice.",
        ],
        list: [
          "Vercel Inc.: hosts the site and provides the visit statistics (Vercel Web Analytics); the function that receives the form runs in its Dublin (Ireland) data centre.",
          "Supabase Inc.: hosts the database where the requests are saved, in its data centre in Ireland.",
          "Google (Google Workspace) and Resend: email services through which the request reaches the controller's mailbox.",
          ...when(measurement, "Google Ireland Limited: Google Analytics, only if you have given consent."),
          "Functional Software Inc. (Sentry): receives unexpected technical errors of the function that receives the form, without the data of the form; its systems are in Germany.",
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
          "Cookies are small files a site saves in your browser. Similar tools, such as the browser's local storage, serve the same purpose: remembering something from one page to the next. This page lists what the site tecnomga.com saves in your browser, and why.",
        ],
        list: [],
      },
      {
        title: "What we use",
        paragraphs: measurement
          ? [
              "The site uses no profiling cookies of its own. It uses technical tools to remember your choices and, only if you agree, Google Analytics for visit statistics.",
              "Before your choice, and after a refusal, no Google script is loaded. If you refuse, the site works in the same way.",
              "Visit statistics are collected with Vercel Web Analytics, which uses no cookies and saves nothing in your browser: this is why it is not in the list. What it collects is described on the {privacy} page.",
            ]
          : [
              "The site uses no profiling cookies and no measurement cookies. It saves in your browser only your language choice, so the notice is not shown again.",
              "Visit statistics are collected with Vercel Web Analytics, which uses no cookies and saves nothing in your browser: this is why it is not in the list. What it collects is described on the {privacy} page.",
            ],
        list: [],
      },
    ],
    tableTitle: "List",
    columns: { name: "Name", purpose: "What it is for", duration: "Duration", owner: "Whose it is" },
    rows: [
      ...when(measurement, { name: "tecno-consent-v1 (local storage)", purpose: "Necessary. Remembers your cookie choice.", duration: "6 months", owner: "Tecno MGA" }),
      { name: "tecno-lang-choice (local storage)", purpose: "Necessary. Remembers that you chose a language, so the notice is not shown again.", duration: "Until you clear your browser data", owner: "Tecno MGA" },
      ...when(
        measurement,
        { name: "_ga", purpose: "Statistics, only with consent. Google Analytics: tells visitors apart.", duration: "2 years", owner: "Google" },
        { name: "_ga_<ID>", purpose: "Statistics, only with consent. Google Analytics: keeps the state of the visit.", duration: "2 years", owner: "Google" },
      ),
    ],
    after: [
      measurement
        ? {
            title: "How to change your choice",
            paragraphs: [
              "You can change your mind at any time with “Cookie preferences” in the footer: the new choice applies at once, and with a refusal the Google Analytics cookies saved by the site are deleted. You can also delete cookies from your browser settings.",
            ],
            list: [],
          }
        : {
            title: "No choice to make",
            paragraphs: ["The site saves nothing that needs your consent: this is why no banner appears. You can still delete the saved data from your browser settings."],
            list: [],
          },
      {
        title: "Who processes the data",
        paragraphs: [`The controller is Tecno Advance MGA Broker Srl. The cookieless visit statistics are provided by Vercel Inc.${measurement ? " The data collected by Google Analytics are also processed by Google Ireland Limited." : ""} For everything else read the {privacy} page.`],
        list: [],
      },
    ],
  },
});
