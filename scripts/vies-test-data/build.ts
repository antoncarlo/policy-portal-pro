// Genera i file di prova per il caricamento VIES, interamente fittizi:
//   - 3 Excel da 20 pratiche (lotto 1 con pratiche errate che devono bloccarsi, lotto 2 corretto, lotto 3 corretto di riserva)
//   - i 3 file ZIP con le 20 pratiche e i loro documenti (un ZIP per pratica dentro un unico file, come li carica il portale)
//   - 2 visure di rappresentanti fiscali fittizi
//   - LEGGIMI con cosa contiene ogni file e l'esito atteso
//
//   npm run build:vies-test-data [cartella]      (predefinita: test-data/vies)
//
// Tutto è deterministico: rilanciando lo script escono gli stessi file. Società, persone, codici (con cifra di
// controllo valida), indirizzi e documenti sono inventati; ogni PDF porta la scritta «DOCUMENTO FITTIZIO DI PROVA».
// I documenti sono PDF con testo: il portale li riconosce dal titolo, come i veri, senza bisogno dell'agent.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import { isValidChineseId, isValidItalianTaxCode, isValidItalianVat, isValidUscc } from "../../src/lib/viesCodes";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(process.argv[2] ?? resolve(HERE, "../../test-data/vies"));
const TEMPLATE = resolve(HERE, "../../public/vies/VIES_modello.xlsx");
const FIXED_DATE = new Date("2026-10-12T09:00:00Z");
mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- numeri casuali ripetibili
let seed = 20261012;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const int = (max: number) => Math.floor(rand() * max);
const digits = (n: number) => Array.from({ length: n }, () => int(10)).join("");

// ---------------------------------------------------------------- codici con cifra di controllo valida
const USCC_CHARSET = "0123456789ABCDEFGHJKLMNPQRTUWXY";
const USCC_WEIGHTS = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28];
const uscc = (region: string) => {
  const body = `91${region}MA${Array.from({ length: 7 }, () => USCC_CHARSET[int(USCC_CHARSET.length)]).join("")}`;
  let sum = 0;
  for (let i = 0; i < 17; i += 1) sum += USCC_CHARSET.indexOf(body[i]) * USCC_WEIGHTS[i];
  return body + USCC_CHARSET[(31 - (sum % 31)) % 31];
};
/** Stesso codice con la cifra di controllo sbagliata: per la pratica che deve bloccarsi. */
const brokenUscc = (code: string) => code.slice(0, 17) + USCC_CHARSET[(USCC_CHARSET.indexOf(code[17]) + 1) % USCC_CHARSET.length];

const ID_WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
const chineseId = (region: string, birth: string) => {
  const body = `${region}${birth}${digits(3)}`;
  let sum = 0;
  for (let i = 0; i < 17; i += 1) sum += Number(body[i]) * ID_WEIGHTS[i];
  return body + "10X98765432"[sum % 11];
};

const vatWithCheck = (first10: string) => {
  let sum = 0;
  for (let i = 0; i < 10; i += 1) {
    let d = Number(first10[i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return first10 + ((10 - (sum % 10)) % 10);
};

const TAX_ODD: Record<string, number> = {
  "0": 1, "1": 0, "2": 5, "3": 7, "4": 9, "5": 13, "6": 15, "7": 17, "8": 19, "9": 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
  N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};
const letters = (text: string, vowels: boolean) => text.toUpperCase().replace(/[^A-Z]/g, "").split("").filter((c) => ("AEIOU".includes(c)) === vowels);
const personTaxCode = (surname: string, name: string, year: number, month: number, day: number, place: string) => {
  const surnameCode = [...letters(surname, false), ...letters(surname, true), "X", "X", "X"].slice(0, 3).join("");
  const consonants = letters(name, false);
  const nameConsonants = consonants.length >= 4 ? [consonants[0], consonants[2], consonants[3]] : consonants;
  const nameCode = [...nameConsonants, ...letters(name, true), "X", "X", "X"].slice(0, 3).join("");
  const body = `${surnameCode}${nameCode}${String(year % 100).padStart(2, "0")}${"ABCDEHLMPRST"[month - 1]}${String(day).padStart(2, "0")}${place}`;
  let sum = 0;
  for (let i = 0; i < 15; i += 1) sum += i % 2 === 0 ? TAX_ODD[body[i]] : /\d/.test(body[i]) ? Number(body[i]) : body.charCodeAt(i) - 65;
  return body + String.fromCharCode(65 + (sum % 26));
};

// ---------------------------------------------------------------- rappresentanti fiscali (fittizi)
interface Representative {
  key: "A" | "B";
  name: string;
  /** Codice fiscale = partita IVA della società. */
  taxCode: string;
  address: string;
  /** Via e CAP come nella visura. */
  street: string;
  pec: string;
  adminName: string;
  adminTaxCode: string;
  adminBirth: string;
  rea: string;
  documentNumber: string;
  capital: string;
}
const REPRESENTATIVES: Representative[] = [
  {
    key: "A",
    name: "ALFA RAPPRESENTANZE FISCALI S.R.L.",
    taxCode: vatWithCheck("0471825906"),
    address: "ROMA (RM) VIA DEI CONDOTTI 10 CAP 00187",
    street: "VIA DEI CONDOTTI 10",
    pec: "alfa.rappresentanze@pec.example.it",
    adminName: "ROSSI MARIO",
    adminTaxCode: personTaxCode("ROSSI", "MARIO", 1970, 1, 1, "H501"),
    adminBirth: "ROMA (RM) il 01/01/1970",
    rea: "RM - 1458231",
    documentNumber: "T 100200301",
    capital: "100.000,00",
  },
  {
    key: "B",
    name: "BETA TAX REPRESENTATIVE S.P.A.",
    taxCode: vatWithCheck("0836194207"),
    address: "MILANO (MI) VIA MANZONI 21 CAP 20121",
    street: "VIA MANZONI 21",
    pec: "beta.taxrep@pec.example.it",
    adminName: "BIANCHI LUCIA",
    adminTaxCode: personTaxCode("BIANCHI", "LUCIA", 1975, 6, 15, "F205"),
    adminBirth: "MILANO (MI) il 15/06/1975",
    rea: "MI - 2093417",
    documentNumber: "T 100200302",
    capital: "500.000,00",
  },
];

// ---------------------------------------------------------------- società clienti (fittizie)
interface Company {
  zip: number;
  name: string;
  nameCn: string;
  uscc: string;
  vat: string;
  address: string;
  city: string;
  legalRep: string;
  idNumber: string;
  birth: string;
  phone: string;
  email: string;
  pec: string;
}

const CITIES = [
  { py: "Shenzhen", cn: "深圳", region: "440300", street: "Room 1803, Block B, Tianan Cyber Park, Futian District" },
  { py: "Guangzhou", cn: "广州", region: "440100", street: "Room 906, No. 120 Tianhe Road, Tianhe District" },
  { py: "Hangzhou", cn: "杭州", region: "330100", street: "Room 512, No. 80 Baoqing Street, Linping District" },
  { py: "Ningbo", cn: "宁波", region: "330200", street: "No. 77 Zhongshan East Road, Haishu District" },
  { py: "Xiamen", cn: "厦门", region: "350200", street: "Unit 6, No. 15 Hubin North Road, Siming District" },
  { py: "Dongguan", cn: "东莞", region: "441900", street: "No. 9 Industrial Avenue, Chang'an Town" },
  { py: "Foshan", cn: "佛山", region: "440600", street: "No. 33 Jihua West Road, Chancheng District" },
  { py: "Suzhou", cn: "苏州", region: "320500", street: "No. 210 Xinghu Street, Industrial Park" },
  { py: "Chengdu", cn: "成都", region: "510100", street: "Floor 12, No. 1 Tianfu Avenue, Wuhou District" },
  { py: "Wuhan", cn: "武汉", region: "420100", street: "No. 58 Jianghan Road, Jianghan District" },
  { py: "Nanjing", cn: "南京", region: "320100", street: "Room 703, No. 18 Zhujiang Road, Xuanwu District" },
  { py: "Qingdao", cn: "青岛", region: "370200", street: "No. 66 Hongkong Middle Road, Shinan District" },
];
const BRANDS = [
  ["Lanxin", "蓝鑫"], ["Yunfeng", "云峰"], ["Haichen", "海辰"], ["Qingyu", "青羽"], ["Mingrui", "明瑞"],
  ["Jinhe", "金禾"], ["Lingxi", "灵犀"], ["Ruiyang", "瑞阳"], ["Xinghe", "星河"], ["Hongda", "宏达"],
  ["Zhongtai", "中泰"], ["Boyuan", "博远"], ["Tianrui", "天瑞"], ["Fengqi", "丰启"], ["Huaxin", "华欣"],
  ["Kangda", "康达"], ["Yongsheng", "永盛"], ["Dongfang", "东方"], ["Shengtai", "盛泰"], ["Weisheng", "伟盛"],
];
const TRADES = [
  ["Maoyi", "贸易"], ["KeJi", "科技"], ["Dianzi Shangwu", "电子商务"],
];
const SURNAMES = ["LI", "WANG", "ZHANG", "LIU", "CHEN", "YANG", "HUANG", "ZHAO", "WU", "ZHOU", "XU", "SUN", "MA", "ZHU", "HU"];
const GIVEN = ["WEI", "MIN", "JUN", "LI", "YANG", "NA", "QIANG", "FAN", "TAO", "LEI", "JING", "HUI", "BO", "YAN", "KAI"];

/** `index` 0..59: sessanta società tutte diverse tra loro, per i tre lotti. */
const company = (index: number, zip: number): Company => {
  const city = CITIES[(index * 5) % CITIES.length];
  const [brandPy, brandCn] = BRANDS[index % BRANDS.length];
  const [tradePy, tradeCn] = TRADES[Math.floor(index / BRANDS.length) % TRADES.length];
  const year = 1972 + int(26);
  const month = 1 + int(12);
  const day = 1 + int(28);
  const birth = `${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
  const legalRep = `${SURNAMES[(index * 7) % SURNAMES.length]} ${GIVEN[(index * 4 + 3) % GIVEN.length]}`;
  const slug = `${brandPy}${tradePy.split(" ")[0]}`.toLowerCase();
  const withVat = index % 4 === 1;
  return {
    zip,
    name: `${city.py} ${brandPy} ${tradePy} YouXian GongSi`,
    nameCn: `${city.cn}${brandCn}${tradeCn}有限公司`,
    uscc: uscc(city.region),
    vat: withVat ? vatWithCheck(`1${digits(9)}`) : "",
    address: `${city.street}, ${city.py}, China`,
    city: city.py,
    legalRep,
    idNumber: chineseId(city.region, birth),
    birth: `${birth.slice(6)}/${birth.slice(4, 6)}/${birth.slice(0, 4)}`,
    phone: `+86 1${3 + int(6)}${int(10)} ${digits(4)} ${digits(4)}`,
    email: `info@${slug}.example.com`,
    pec: index % 5 === 2 ? `${slug}@pec.example.it` : "",
  };
};

// ---------------------------------------------------------------- PDF fittizi
const pdf = (title: string, lines: string[], pages: string[][] = []) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setCreationDate(FIXED_DATE);
  doc.setFileId("0123456789ABCDEF0123456789ABCDEF");
  const draw = (pageTitle: string | null, body: string[]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(180, 0, 0);
    doc.text("DOCUMENTO FITTIZIO DI PROVA - NON VALIDO", 15, 10);
    doc.setTextColor(20, 20, 20);
    let y = 20;
    if (pageTitle) {
      doc.setFontSize(13);
      doc.text(pageTitle, 15, y);
      y += 10;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (const line of body) {
      for (const wrapped of doc.splitTextToSize(line, 180) as string[]) {
        doc.text(wrapped, 15, y);
        y += 5.2;
      }
      y += 1.2;
    }
  };
  draw(title, lines);
  for (const page of pages) {
    doc.addPage();
    draw(null, page);
  }
  return new Uint8Array(doc.output("arraybuffer"));
};

const clientDocuments = (c: Company, rep: Representative): Record<string, Uint8Array> => {
  const vatLine = c.vat ? [`Partita IVA italiana: ${c.vat}`] : [];
  return {
    licenza: pdf("Licenza commerciale - Business License (traduzione italiana)", [
      `Codice unificato del credito sociale: ${c.uscc}`,
      `Nome dell'azienda: ${c.name}`,
      `Rappresentante legale: ${c.legalRep}`,
      `Indirizzo: ${c.address}`,
      "Tipo: societa' a responsabilita' limitata",
      "Autorita' di registrazione: Ufficio amministrativo e di supervisione del mercato",
      "Tutti i contenuti sono tradotti secondo il documento originale.",
    ]),
    identita: pdf("Carta d'identita' del legale rappresentante - Resident Identity Card", [
      `Name: ${c.legalRep}`,
      `Date of Birth: ${c.birth}`,
      `Identity Card Number: ${c.idNumber}`,
      `Residential Address: ${c.city}, China`,
      "Validity Period: 2021 - 2041",
      "Traduzione italiana: carta d'identita' di residente della Repubblica Popolare Cinese.",
    ]),
    report: pdf("Rapporto di divulgazione delle informazioni sul credito aziendale", [
      `Nome aziendale: ${c.name}`,
      `Codice credito sociale unificato: ${c.uscc}`,
      `Rappresentante legale: ${c.legalRep}`,
      `Indirizzo: ${c.address}`,
      "Stato di registrazione: esistente (in attivita', aperto, registrato)",
      "Segnalazioni di anomalie operative: nessuna",
    ]),
    dichiarazione: pdf("DICHIARAZIONE SOSTITUTIVA A SUPPORTO DELLA FIDEIUSSIONE ASSICURATIVA", [
      `Societa' estera: ${c.name}`,
      `Unified Social Credit Code: ${c.uscc}`,
      ...vatLine,
      `Registered Address: ${c.address}`,
      `Legale Rappresentante: ${c.legalRep}`,
      `ID No.: ${c.idNumber}`,
      `Data di nascita: ${c.birth}`,
      `Io sottoscritto ${c.legalRep}, in qualita' di Legale Rappresentante e Beneficiario Effettivo (UBO) della societa' sopra indicata, rilascio la presente dichiarazione ai fini dell'emissione della fideiussione assicurativa di EUR 50.000 richiesta dall'Agenzia delle Entrate ai sensi dell'art. 17 DPR 633/1972.`,
    ]),
    ubo: pdf("ULTIMATE BENEFICIAL OWNER DECLARATION (dichiarazione del titolare effettivo)", [
      `Company Name: ${c.name}`,
      `Unified Social Credit Code: ${c.uscc}`,
      `Registered Address: ${c.address}`,
      `Legal Representative: ${c.legalRep}`,
      `Name of UBO: ${c.legalRep}`,
      `ID No.: ${c.idNumber}`,
      "Ownership / Control Percentage: 100%",
    ]),
    mandato: pdf("MANDATO DI RAPPRESENTANZA FISCALE (art. 17, comma 3, DPR 633/1972)", [
      `Tra la societa' estera ${c.name}, con sede in ${c.address}, codice di credito sociale ${c.uscc}, in persona del Legale Rappresentante ${c.legalRep}${c.vat ? `, partita IVA italiana ${c.vat}` : ""} (di seguito "Rappresentato"),`,
      `e ${rep.name}, con sede legale in ${rep.address}, P.IVA e codice fiscale ${rep.taxCode} (di seguito "Rappresentante Fiscale").`,
      "Articolo 1 - Oggetto. Il Rappresentato conferisce mandato con rappresentanza al Rappresentante Fiscale per l'adempimento di tutti gli obblighi e l'esercizio di tutti i diritti previsti dalla normativa IVA italiana ai sensi dell'art. 17, comma 3, del DPR 633/1972.",
      "Articolo 2 - Durata. Il mandato ha durata di dodici mesi dalla data di sottoscrizione e si intende rinnovato salvo disdetta scritta.",
    ]),
  };
};

const representativeDocuments = (rep: Representative): Record<string, Uint8Array> => {
  const header = `Registro Imprese ${rep.name} Codice Fiscale ${rep.taxCode}`;
  return {
    visura: representativeVisura(rep),
    bilancio: pdf("BILANCIO D'ESERCIZIO AL 31/12/2025", [
      `${rep.name} - Codice fiscale e partita IVA ${rep.taxCode}`,
      `Sede legale: ${rep.address}`,
      "STATO PATRIMONIALE",
      "Totale attivo: 1.842.310 euro",
      "Patrimonio netto: 1.205.774 euro",
      "Debiti: 636.536 euro",
      "CONTO ECONOMICO",
      "Valore della produzione: 2.318.450 euro",
      "Utile dell'esercizio: 184.920 euro",
      "Bilancio fittizio redatto in forma abbreviata ai sensi dell'art. 2435-bis del codice civile.",
    ], [[
      "NOTA INTEGRATIVA",
      `La societa' ${rep.name} svolge attivita' di rappresentanza fiscale e consulenza tributaria per imprese estere.`,
      "I criteri di valutazione sono invariati rispetto all'esercizio precedente.",
      `Amministratore: ${rep.adminName}`,
    ]]),
    statuto: pdf(`STATUTO DELLA SOCIETA' ${rep.name}`, [
      `Codice fiscale ${rep.taxCode} - sede in ${rep.address}`,
      "Art. 1 - Denominazione e sede. E' costituita la societa' con la denominazione sopra indicata.",
      "Art. 2 - Oggetto. La societa' ha per oggetto la rappresentanza fiscale di soggetti non residenti e i servizi di consulenza tributaria connessi.",
      `Art. 3 - Capitale. Il capitale sociale e' di euro ${rep.capital}.`,
    ], [[
      "Art. 4 - Amministrazione. La societa' e' amministrata da un amministratore unico, che ha la rappresentanza legale.",
      `Art. 5 - Nomina. Il primo amministratore e' ${rep.adminName}, codice fiscale ${rep.adminTaxCode}.`,
      "Art. 6 - Esercizio sociale. L'esercizio sociale si chiude il 31 dicembre di ogni anno.",
      header.replace("Registro Imprese ", "Societa' "),
    ]]),
  };
};

/** Visura ordinaria nel formato del Registro Imprese: il portale ne legge denominazione, sede, PEC, amministratore. */
const representativeVisura = (rep: Representative) =>
  pdf("VISURA ORDINARIA SOCIETA' DI CAPITALE", [
    rep.name,
    "DATI ANAGRAFICI",
    `Indirizzo Sede legale ${rep.address}`,
    `Domicilio digitale/PEC ${rep.pec}`,
    `Numero REA ${rep.rea}`,
    `Codice fiscale e n.iscr. al Registro Imprese ${rep.taxCode}`,
    `Partita IVA ${rep.taxCode}`,
    "Forma giuridica societa' a responsabilita' limitata",
    "Data atto di costituzione 14/03/2012",
    "Amministratore Unico",
    rep.adminName,
    "Camera di Commercio Industria Artigianato e Agricoltura",
    "Servizio fittizio: nessun valore legale",
  ], [[
    `Registro Imprese ${rep.name} Codice Fiscale ${rep.taxCode}`,
    "Archivio ufficiale della CCIAA",
    `Documento n . ${rep.documentNumber} estratto dal Registro Imprese in data 05/10/2026`,
    "Visura ordinaria societa' di capitale",
    "INFORMAZIONI DALLO STATUTO/ATTO COSTITUTIVO",
    `Indirizzo Sede legale ${rep.address}`,
    `Domicilio digitale/PEC ${rep.pec}`,
    `Capitale sociale sottoscritto ${rep.capital}`,
    "2 Amministratori",
    "Elenco amministratori",
    "Amministratore Unico",
    `${rep.adminName} Rappresentante dell'impresa`,
    `Nato a ${rep.adminBirth}`,
    `Codice fiscale: ${rep.adminTaxCode}`,
    "3 Soci e titolari di diritti su azioni e quote",
    `${rep.adminName} titolare del 100% del capitale`,
  ]]);

// ---------------------------------------------------------------- Excel
interface LotPlan {
  number: 1 | 2 | 3;
  slug: string;
  title: string;
  rep: Representative;
  companies: Company[];
  /** Cosa non va in ciascuna riga sbagliata: ZIP → spiegazione e messaggio atteso nel portale. */
  faults: Map<number, { kind: "missing_ubo" | "other_company" | "bad_uscc" | "no_zip"; expected: string }>;
  opaqueNames: Set<number>;
}

const COLUMN_KEYS = ["zip", "name", "nameCn", "vat", "uscc", "address", "legalRep", "phone", "email", "pec"] as const;

async function writeExcel(plan: LotPlan, path: string) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE);
  const sheet = workbook.worksheets[0];
  const data = workbook.worksheets[1];
  const reference = sheet.getRow(9);
  for (const company of plan.companies) {
    const row = sheet.getRow(company.zip + 6);
    const fault = plan.faults.get(company.zip);
    const values: Record<(typeof COLUMN_KEYS)[number], string | number> = {
      zip: company.zip,
      name: company.name,
      nameCn: company.nameCn,
      vat: company.vat,
      uscc: fault?.kind === "bad_uscc" ? brokenUscc(company.uscc) : company.uscc,
      address: company.address,
      legalRep: company.legalRep,
      phone: company.phone,
      email: company.email,
      pec: company.pec,
    };
    COLUMN_KEYS.forEach((key, index) => {
      const cell = row.getCell(index + 1);
      // The template's two example rows are grey: the rows of the lot use the plain look of the other rows.
      if (company.zip <= 2) cell.style = { ...reference.getCell(index + 1).style };
      cell.value = values[key] === "" ? null : values[key];
    });
    row.commit();
  }
  // Foglio DATI FOGLIO: rappresentante fiscale (righe 11-16); il beneficiario resta quello del modello.
  const rep = plan.rep;
  const sheetData: Array<[number, string]> = [
    [11, rep.name], [12, rep.taxCode], [13, rep.adminName], [14, rep.adminTaxCode], [15, rep.address], [16, rep.pec],
  ];
  for (const [rowNumber, value] of sheetData) data.getCell(rowNumber, 2).value = value;
  await workbook.xlsx.writeFile(path);
}

// ---------------------------------------------------------------- ZIP
const NAMES = {
  licenza: "licenza_commerciale.pdf",
  identita: "documento_identita_legale_rappresentante.pdf",
  report: "report_credito_impresa.pdf",
  dichiarazione: "dichiarazione_sostitutiva.pdf",
  ubo: "dichiarazione_ubo.pdf",
  mandato: "mandato_rappresentanza_fiscale.pdf",
  visura: "visura_rappresentante_fiscale.pdf",
  bilancio: "bilancio_rappresentante_fiscale.pdf",
  statuto: "statuto_rappresentante_fiscale.pdf",
} as const;
type DocKey = keyof typeof NAMES;

async function writeZips(plan: LotPlan, path: string, intruder: Company) {
  const repDocs = representativeDocuments(plan.rep);
  const bundle = new JSZip();
  const entries: string[] = [];
  for (const company of plan.companies) {
    const fault = plan.faults.get(company.zip);
    if (fault?.kind === "no_zip") continue; // la pratica 15 manca di proposito: il portale deve bloccarla
    const owner = fault?.kind === "other_company" ? intruder : company;
    const docs: Record<string, Uint8Array> = { ...clientDocuments(owner, plan.rep), ...repDocs };
    const inner = new JSZip();
    let opaque = 0;
    for (const [key, data] of Object.entries(docs) as Array<[DocKey, Uint8Array]>) {
      if (fault?.kind === "missing_ubo" && key === "ubo") continue;
      // nomi senza significato: il portale riconosce i documenti dal contenuto
      const name = plan.opaqueNames.has(company.zip) ? `scansione_${String((opaque += 1)).padStart(2, "0")}.pdf` : NAMES[key];
      inner.file(name, data, { date: FIXED_DATE });
    }
    bundle.file(`${company.zip}.zip`, await inner.generateAsync({ type: "uint8array", compression: "DEFLATE" }), { date: FIXED_DATE });
    entries.push(`${company.zip}.zip`);
  }
  writeFileSync(path, await bundle.generateAsync({ type: "nodebuffer", compression: "STORE" }));
  return entries;
}

// ---------------------------------------------------------------- piano dei tre lotti
const make = (offset: number) => Array.from({ length: 20 }, (_, i) => company(offset + i, i + 1));
const [repA, repB] = REPRESENTATIVES;
const plans: LotPlan[] = [
  {
    number: 1, slug: "VIES_Lotto_1_con_errori", title: "Lotto 1 — con pratiche errate (deve bloccare)", rep: repA, companies: make(0),
    faults: new Map([
      [3, { kind: "missing_ubo", expected: "manca la Dichiarazione del titolare effettivo (UBO)" }],
      [7, { kind: "other_company", expected: "i documenti dello ZIP sono di un'altra società" }],
      [11, { kind: "bad_uscc", expected: "Codice di credito sociale non valido" }],
      [15, { kind: "no_zip", expected: "ZIP 15.zip non caricato" }],
    ]),
    opaqueNames: new Set(),
  },
  { number: 2, slug: "VIES_Lotto_2_corretto", title: "Lotto 2 — tutto corretto", rep: repB, companies: make(20), faults: new Map(), opaqueNames: new Set([5]) },
  { number: 3, slug: "VIES_Lotto_3_riserva", title: "Lotto 3 — di riserva, tutto corretto", rep: repA, companies: make(40), faults: new Map(), opaqueNames: new Set() },
];
const intruder: Company = { ...company(59, 7), name: "Tianjin Hongda Jixie YouXian GongSi", nameCn: "天津宏达机械有限公司", legalRep: "SUN HAO" };
intruder.uscc = uscc("120100");
intruder.idNumber = chineseId("120100", "19800702");
intruder.vat = "";

for (const plan of plans) {
  for (const c of plan.companies) {
    if (!isValidUscc(c.uscc) || !isValidChineseId(c.idNumber) || (c.vat && !isValidItalianVat(c.vat))) throw new Error(`codice non valido: ${c.name}`);
  }
}
for (const rep of REPRESENTATIVES) {
  if (!isValidItalianVat(rep.taxCode) || !isValidItalianTaxCode(rep.adminTaxCode)) throw new Error(`codice non valido: ${rep.name}`);
}

const summary: string[] = [];
for (const plan of plans) {
  await writeExcel(plan, `${OUT}/${plan.slug}.xlsx`);
  const zips = await writeZips(plan, `${OUT}/${plan.slug}_ZIP.zip`, intruder);
  summary.push(`${plan.slug}: ${plan.companies.length} righe, ${zips.length} ZIP`);
}
writeFileSync(`${OUT}/Visura_Rappresentante_A_ALFA.pdf`, representativeVisura(repA));
writeFileSync(`${OUT}/Visura_Rappresentante_B_BETA.pdf`, representativeVisura(repB));

// ---------------------------------------------------------------- LEGGIMI
const repBlock = (rep: Representative) =>
  `- **${rep.name}** — codice fiscale/P.IVA \`${rep.taxCode}\`, sede ${rep.address}, PEC ${rep.pec}, amministratore ${rep.adminName} (\`${rep.adminTaxCode}\`)`;
const faultLines = [...plans[0].faults.entries()].map(
  ([zip, fault]) => `| ${zip} | ${plans[0].companies[zip - 1].name} | ${fault.expected} |`,
);
const readme = `# File di prova VIES (interamente fittizi)

Società, persone, codici e documenti sono inventati: ogni PDF porta la scritta «DOCUMENTO FITTIZIO DI PROVA - NON VALIDO». I codici
(codice di credito sociale, carta d'identità, partita IVA, codici fiscali) hanno la cifra di controllo valida, quindi il portale li
accetta come veri. Le 60 società dei tre lotti sono tutte diverse: nessun lotto fa scattare l'avviso «esiste già la pratica».

## Come si usa

Pagina **VIES** → 1. File del lotto: carica l'Excel e, subito dopo, il file ZIP del lotto (contiene \`1.zip\` … \`20.zip\`, uno per pratica: il
portale lo apre da solo). Poi 2. Dati del foglio: puoi caricare la visura del rappresentante fiscale per riempire i campi.

| File | Contenuto |
|---|---|
| \`${plans[0].slug}.xlsx\` + \`${plans[0].slug}_ZIP.zip\` | **Lotto 1, con errori.** 20 righe; 16 pronte, 4 bloccate (tabella sotto). Rappresentante fiscale A. |
| \`${plans[1].slug}.xlsx\` + \`${plans[1].slug}_ZIP.zip\` | **Lotto 2, tutto corretto.** 20 righe, 20 pronte. Rappresentante fiscale B. Lo ZIP 5 ha i file con nomi senza significato (\`scansione_01.pdf\`…): i documenti si riconoscono dal contenuto. |
| \`${plans[2].slug}.xlsx\` + \`${plans[2].slug}_ZIP.zip\` | **Lotto 3, di riserva, tutto corretto.** 20 righe, 20 pronte. Rappresentante fiscale A (per provare la numerazione dei lotti dello stesso rappresentante). |
| \`Visura_Rappresentante_A_ALFA.pdf\`, \`Visura_Rappresentante_B_BETA.pdf\` | Le due visure per provare la lettura dei dati del rappresentante fiscale. |

## Rappresentanti fiscali

${repBlock(repA)}
${repBlock(repB)}

## Lotto 1: le quattro righe da bloccare

| ZIP | Società | Cosa deve dire il portale |
|---|---|---|
${faultLines.join("\n")}

Le altre 16 righe del lotto 1 sono corrette: se prosegui, diventano pratiche e le 4 bloccate restano fuori dal lotto con il motivo.

## Contenuto di ogni ZIP di pratica (9 documenti)

Cliente: licenza commerciale, carta d'identità del legale rappresentante, rapporto sul credito d'impresa, dichiarazione sostitutiva a
supporto della fideiussione, dichiarazione del titolare effettivo (UBO), mandato di rappresentanza fiscale. Rappresentante fiscale: visura,
bilancio d'esercizio, statuto.

## Rigenerare

\`npm run build:vies-test-data\` ricrea gli stessi file in \`test-data/vies/\` (cartella non versionata).
`;
writeFileSync(`${OUT}/LEGGIMI_prove_VIES.md`, readme);
console.log(summary.join("\n"));
console.log(`File in ${OUT}`);
