// Generates the VIES Excel template with the Tecno Advance MGA logo (exceljs: SheetJS CE does not write images).
// Usage: npm run build:vies-template  →  public/vies/VIES_modello.xlsx
//
// The template ships with two filled-in EXAMPLE rows (ZIP 1 and 2, grey, "ESEMPIO · …") so the
// fiscal representatives who fill it in can see how a row looks. The portal skips any row whose
// company name starts with "ESEMPIO ·" / "EXAMPLE ·" / "示例 ·" (src/pages/Vies.tsx, EXAMPLE_ROW_NAME),
// so an example left in the file never becomes a practice.
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../../public/vies/VIES_modello.xlsx");
const logo = readFileSync(resolve(HERE, "logo.png"));

const NAVY = "FF103657";
const BRONZE = "FFAC7E59";
const ZEBRA = "FFF2F4F7";
const EXAMPLE_FILL = "FFFBF3EC";
const EXAMPLE_TEXT = "FF7A869A";
const BORDER = { style: "thin", color: { argb: "FFD0D5DD" } };
const MAX = 20;
const HEADER_ROW = 6;

// Header cells carry the column name in Italian, English and Chinese, one per line:
// the portal recognises the column from any of the three.
const COLUMNS = [
  { header: "ZIP\nZIP number\nZIP 编号", width: 11, key: "zip" },
  { header: "Ragione Sociale\nCompany name\n公司名称", width: 44, key: "name" },
  { header: "Denominazione CN\nChinese name\n中文名称", width: 26, key: "nameCn" },
  { header: "P.IVA\nItalian VAT number\n意大利增值税号", width: 17, key: "piva", text: true },
  { header: "Codice credito sociale\nUnified Social Credit Code\n统一社会信用代码", width: 25, key: "uscc", text: true },
  { header: "Sede legale estera\nRegistered office abroad\n境外注册地址", width: 60, key: "address" },
  { header: "Legale rappresentante\nLegal representative\n法定代表人", width: 24, key: "legalRep" },
  { header: "Telefono\nPhone\n电话", width: 16, key: "phone", text: true },
  { header: "Email\nEmail\n电子邮箱", width: 32, key: "email" },
  { header: "PEC\nPEC (certified email)\nPEC 认证邮箱", width: 28, key: "pec" },
];

// Fictitious data, only to show how a row is filled in. Row 1 has every column; row 2 only the required ones.
// (No cell comments: an image and legacy comments in the same sheet are a needless risk for Excel.)
const EXAMPLES = [
  {
    zip: 1,
    name: "ESEMPIO · completo · SAMPLE TRADING CO.",
    nameCn: "示例贸易有限公司",
    piva: "01234567890",
    uscc: "91440300EXAMPLE001",
    address: "Room 101, Building 1, Sample Road 1, Nanshan District, Shenzhen, China",
    legalRep: "ZHANG WEI",
    phone: "+86 755 0000 0000",
    email: "nome@esempio.com",
    pec: "societa@pec.esempio.it",
  },
  {
    zip: 2,
    name: "ESEMPIO · solo obbligatori · MINIMUM DATA CO.",
    uscc: "91310000EXAMPLE002",
  },
];

const SHEET_DATA = [
  [
    "Beneficiario\nBeneficiary\n受益人",
    "Agenzia delle Entrate – Direzione Provinciale I di Roma",
    "Ufficio dell'Agenzia competente per il foglio\nCompetent office of the Italian Revenue Agency\n主管的意大利税务局办公室",
  ],
  [
    "Indirizzo beneficiario\nBeneficiary address\n受益人地址",
    "Via Ippolito Nievo, 48 – 00153 Roma (RM)",
    "Indirizzo completo dell'ufficio\nFull address of the office\n该办公室的完整地址",
  ],
  [
    "Codice fiscale beneficiario\nBeneficiary tax code\n受益人税号",
    "06363391001",
    "Codice fiscale dell'Agenzia delle Entrate\nTax code of the Italian Revenue Agency\n意大利税务局税号",
  ],
  [
    "PEC beneficiario\nBeneficiary PEC\n受益人 PEC",
    "",
    "Facoltativa. Esempio: ufficio@pec.esempio.it\nOptional. Example: ufficio@pec.esempio.it\n可选。示例：ufficio@pec.esempio.it",
  ],
  [
    "Rappresentante fiscale\nFiscal representative\n税务代表",
    "",
    "Società di rappresentanza, come da visura. Esempio: ESEMPIO RAPPRESENTANTE FISCALE S.P.A.\nRepresentative company, as in the registry extract (visura). Example: ESEMPIO RAPPRESENTANTE FISCALE S.P.A.\n税务代表公司，以商会注册证明为准。示例：ESEMPIO RAPPRESENTANTE FISCALE S.P.A.",
  ],
  [
    "Codice fiscale rappresentante fiscale\nFiscal representative tax code\n税务代表税号",
    "",
    "Codice fiscale / P.IVA della società. Esempio: 12345678901\nCompany tax code / VAT number. Example: 12345678901\n公司税号 / 增值税号。示例：12345678901",
  ],
  [
    "Amministratore rappresentante fiscale\nFiscal representative director\n税务代表董事",
    "",
    "Legale rappresentante dalla visura. Esempio: ROSSI MARIO\nLegal representative, from the registry extract. Example: ROSSI MARIO\n法定代表人，以注册证明为准。示例：ROSSI MARIO",
  ],
  [
    "Codice fiscale amministratore\nDirector tax code\n董事税号",
    "",
    "Esempio: RSSMRA70A01H501S\nExample: RSSMRA70A01H501S\n示例：RSSMRA70A01H501S",
  ],
  [
    "Sede rappresentante fiscale\nFiscal representative office\n税务代表地址",
    "",
    "È anche il domicilio fiscale in Italia delle società clienti. Esempio: ROMA (RM) VIA ESEMPIO 1 CAP 00100\nAlso the Italian tax domicile of the client companies. Example: ROMA (RM) VIA ESEMPIO 1 CAP 00100\n也是客户公司在意大利的税务住所。示例：ROMA (RM) VIA ESEMPIO 1 CAP 00100",
  ],
  [
    "PEC rappresentante fiscale\nFiscal representative PEC\n税务代表 PEC",
    "",
    "Usata per i clienti senza PEC propria. Esempio: studio@pec.esempio.it\nUsed for clients without their own PEC. Example: studio@pec.esempio.it\n用于没有自己 PEC 的客户。示例：studio@pec.esempio.it",
  ],
];

const INSTRUCTIONS_IT = [
  "1. Un file Excel = un lotto di massimo 20 pratiche.",
  "2. Foglio PRATICHE: una riga per cliente, a partire dalla riga 7. La colonna ZIP è già numerata da 1 a 20: il cliente della riga con ZIP 3 va nel file 3.zip.",
  "3. Non modificare le intestazioni della riga 6 e non inserire righe sopra la tabella: il portale legge i dati da lì.",
  "4. Le righe ZIP 1 e 2 sono esempi di compilazione (in grigio, con la scritta ESEMPIO): sovrascrivile con i dati reali. Se restano nel file, il portale le ignora.",
  "5. Le righe con solo il numero ZIP e nessun altro dato vengono ignorate.",
  "6. Obbligatori per ogni cliente: numero ZIP, Ragione Sociale e almeno uno tra P.IVA e Codice credito sociale (18 caratteri, con cifra di controllo). Tutte le altre colonne sono facoltative.",
  "7. PEC: lasciare vuota se il cliente non ne ha una: si usa quella del rappresentante fiscale.",
  "8. Foglio DATI FOGLIO: uguale per tutte le pratiche del lotto. Il beneficiario (ufficio dell'Agenzia delle Entrate) è già indicato; la sua PEC è facoltativa. Il rappresentante fiscale va compilato con i vostri dati, come da visura (le note a destra mostrano un esempio per ogni campo).",
  "9. Ogni ZIP deve contenere i documenti del cliente e del rappresentante fiscale:",
  "    cliente: licenza commerciale con traduzione, documento d'identità del legale rappresentante con traduzione,",
  "    report sul credito d'impresa con traduzione, dichiarazione sostitutiva a supporto della fideiussione,",
  "    dichiarazione UBO, mandato di rappresentanza fiscale;",
  "    rappresentante fiscale: visura, bilancio, statuto.",
  "10. I documenti vengono riconosciuti dal contenuto, non dal nome del file. Una pratica con documenti mancanti o di un'altra società viene bloccata.",
];

const INSTRUCTIONS_EN = [
  "1. One Excel file = one batch of at most 20 applications.",
  "2. PRATICHE sheet: one row per client, starting from row 7. The ZIP column is already numbered 1 to 20: the client on the row with ZIP 3 goes in the file 3.zip.",
  "3. Do not change the headers in row 6 and do not insert rows above the table: the portal reads the data from there.",
  "4. The rows ZIP 1 and 2 are filling-in examples (grey, marked ESEMPIO): overwrite them with the real data. If they stay in the file, the portal ignores them.",
  "5. Rows with only the ZIP number and no other data are ignored.",
  "6. Required for each client: ZIP number, company name and at least one of the Italian VAT number and the Unified Social Credit Code (18 characters, with check character). All other columns are optional.",
  "7. PEC: leave it empty if the client has none: the fiscal representative's PEC is used.",
  "8. DATI FOGLIO sheet: the same for every application of the batch. The beneficiary (office of the Italian Revenue Agency) is already filled in; its PEC is optional. Fill in the fiscal representative with your own data, as in the registry extract (visura): the notes on the right show an example for each field.",
  "9. Each ZIP must contain the documents of the client and of the fiscal representative:",
  "    client: business licence with translation, legal representative's identity document with translation,",
  "    corporate credit report with translation, self-certification supporting the guarantee,",
  "    UBO declaration, fiscal representation mandate;",
  "    fiscal representative: registry extract (visura), financial statements, articles of association.",
  "10. Documents are recognised by their content, not by the file name. An application with missing documents, or documents of another company, is blocked.",
];

const INSTRUCTIONS_ZH = [
  "1. 一个 Excel 文件 = 一个批次，最多 20 笔申请。",
  "2. PRATICHE 工作表：每个客户一行，从第 7 行开始。ZIP 列已编号 1 至 20：ZIP 编号为 3 的那一行客户，其文件放入 3.zip。",
  "3. 请勿修改第 6 行的表头，也不要在表格上方插入行：门户从该位置读取数据。",
  "4. ZIP 1 和 2 两行是填写示例（灰色，标有 ESEMPIO）：请用真实数据覆盖。如果留在文件中，门户会忽略它们。",
  "5. 只有 ZIP 编号而没有其他数据的行将被忽略。",
  "6. 每个客户的必填项：ZIP 编号、公司名称，以及意大利增值税号和统一社会信用代码（18 位，含校验位）中的至少一项。其他列均为可选。",
  "7. PEC：如客户没有 PEC，请留空：将使用税务代表的 PEC。",
  "8. DATI FOGLIO 工作表：整个批次的所有申请相同。受益人（意大利税务局办公室）已填写，其 PEC 为可选项。税务代表请按商会注册证明（visura）填写您自己的信息（右侧备注为每个字段提供了示例）。",
  "9. 每个 ZIP 必须包含客户和税务代表的文件：",
  "    客户：营业执照及翻译件、法定代表人身份证件及翻译件、",
  "    企业信用信息报告及翻译件、担保所需声明（替代声明）、",
  "    最终受益人（UBO）声明、税务代表授权书；",
  "    税务代表：商会注册证明（visura）、财务报表、公司章程。",
  "10. 系统按文件内容（而非文件名）识别文件。缺少文件或包含其他公司文件的申请将被阻止。",
];

const logoIds = new WeakMap();
const addBrandHeader = (wb, ws, title, subtitle, titleCol, extraSubtitles = []) => {
  if (!logoIds.has(wb)) logoIds.set(wb, wb.addImage({ buffer: logo, extension: "png" }));
  const imageId = logoIds.get(wb);
  // 1030x376 → 192x70 px
  ws.addImage(imageId, { tl: { col: 0.15, row: 0.3 }, ext: { width: 192, height: 70 }, editAs: "oneCell" });
  for (let r = 1; r <= 4; r += 1) ws.getRow(r).height = 20;
  // Title and subtitles fill rows 1-4 (row 5 is the bronze rule above the table).
  const titleRow = 4 - extraSubtitles.length - 1 > 1 ? 2 : 1;
  const t = ws.getCell(`${titleCol}${titleRow}`);
  t.value = title;
  t.font = { name: "Calibri", size: 16, bold: true, color: { argb: NAVY } };
  const st = ws.getCell(`${titleCol}${titleRow + 1}`);
  st.value = subtitle;
  st.font = { name: "Calibri", size: 10, color: { argb: "FF667085" } };
  extraSubtitles.forEach((text, index) => {
    const cell = ws.getCell(`${titleCol}${titleRow + 2 + index}`);
    cell.value = text;
    cell.font = { name: "Calibri", size: 10, color: { argb: "FF667085" } };
  });
  ws.getRow(5).height = 8;
  for (let c = 1; c <= Math.max(ws.columnCount, 3); c += 1) {
    ws.getCell(5, c).border = { bottom: { style: "medium", color: { argb: BRONZE } } };
  }
};

const styleHeader = (row) => {
  row.height = 50;
  row.eachCell((cell) => {
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    cell.border = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
  });
};

const wb = new ExcelJS.Workbook();
wb.creator = "Tecno Advance MGA Broker S.r.l.";

// PRATICHE
const ws = wb.addWorksheet("PRATICHE · APPLICATIONS · 申请", { views: [{ state: "frozen", xSplit: 2, ySplit: HEADER_ROW, showGridLines: false }] });
ws.columns = COLUMNS.map(({ width }) => ({ width }));
addBrandHeader(
  wb,
  ws,
  "RICHIESTA FIDEIUSSIONI VIES  ·  VIES GUARANTEE REQUEST  ·  VIES 担保申请",
  "Lotto di massimo 20 pratiche · uno ZIP per pratica (1.zip … 20.zip) · beneficiario e rappresentante fiscale nel foglio DATI FOGLIO",
  "C",
  [
    "Batch of at most 20 applications · one ZIP per application (1.zip … 20.zip) · beneficiary and fiscal representative in the DATI FOGLIO sheet",
    "每批最多 20 笔申请 · 每笔申请一个 ZIP（1.zip … 20.zip）· 受益人和税务代表填写在 DATI FOGLIO 工作表中",
  ],
);
const header = ws.getRow(HEADER_ROW);
COLUMNS.forEach(({ header: label }, i) => {
  header.getCell(i + 1).value = label;
});
styleHeader(header);
ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW, column: COLUMNS.length } };
const examples = new Map(EXAMPLES.map((example) => [example.zip, example]));
for (let n = 1; n <= MAX; n += 1) {
  const row = ws.getRow(HEADER_ROW + n);
  const example = examples.get(n);
  COLUMNS.forEach(({ key, text }, i) => {
    const cell = row.getCell(i + 1);
    if (key === "zip") cell.value = n;
    else if (example?.[key]) cell.value = String(example[key]);
    if (text) cell.numFmt = "@";
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: example ? EXAMPLE_FILL : n % 2 ? "FFFFFFFF" : ZEBRA } };
    cell.border = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
    cell.alignment = { vertical: "middle", horizontal: key === "zip" ? "center" : "left" };
    cell.font = {
      name: "Calibri",
      size: 11,
      bold: key === "zip",
      italic: Boolean(example) && key !== "zip",
      color: { argb: example ? EXAMPLE_TEXT : key === "zip" ? NAVY : "FF101828" },
    };
  });
  row.getCell(1).dataValidation = {
    type: "whole",
    operator: "between",
    formulae: [1, MAX],
    allowBlank: false,
    showErrorMessage: true,
    errorTitle: "ZIP",
    error: "Il numero ZIP va da 1 a 20. / The ZIP number goes from 1 to 20. / ZIP 编号为 1 至 20。",
  };
  row.height = 20;
}

// DATI FOGLIO
const wd = wb.addWorksheet("DATI FOGLIO · SHEET DATA · 表格信息", { views: [{ state: "frozen", ySplit: HEADER_ROW, showGridLines: false }] });
wd.columns = [{ width: 40 }, { width: 72 }, { width: 58 }];
addBrandHeader(wb, wd, "DATI DEL FOGLIO  ·  SHEET DATA  ·  表格信息", "Beneficiario e rappresentante fiscale validi per tutte le pratiche del lotto", "B", [
  "Beneficiary and fiscal representative valid for every application of the batch",
  "受益人和税务代表适用于本批次的所有申请",
]);
const dh = wd.getRow(HEADER_ROW);
["Campo\nField\n字段", "Valore\nValue\n值", "Note\nNotes\n备注"].forEach((v, i) => {
  dh.getCell(i + 1).value = v;
});
styleHeader(dh);
SHEET_DATA.forEach(([field, value, note], i) => {
  const row = wd.getRow(HEADER_ROW + 1 + i);
  [field, value, note].forEach((v, c) => {
    const cell = row.getCell(c + 1);
    if (v !== "") cell.value = v;
    cell.numFmt = "@";
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 ? ZEBRA : "FFFFFFFF" } };
    cell.border = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.font = { name: "Calibri", size: 11, bold: c === 0, color: { argb: c === 2 ? "FF667085" : "FF101828" } };
  });
  row.height = 48;
});

// ISTRUZIONI
const wi = wb.addWorksheet("ISTRUZIONI · INSTRUCTIONS · 说明", { views: [{ showGridLines: false }] });
wi.columns = [{ width: 150 }];
addBrandHeader(wb, wi, "", "", "A");
const ih = wi.getRow(HEADER_ROW);
ih.getCell(1).value = "MODELLO VIES — ISTRUZIONI  ·  VIES TEMPLATE — INSTRUCTIONS  ·  VIES 模板 — 填写说明";
styleHeader(ih);
ih.height = 32;
let line = HEADER_ROW + 2;
for (const [title, lines] of [
  ["ITALIANO", INSTRUCTIONS_IT],
  ["ENGLISH", INSTRUCTIONS_EN],
  ["中文", INSTRUCTIONS_ZH],
]) {
  const heading = wi.getCell(line, 1);
  heading.value = title;
  heading.font = { name: "Calibri", size: 12, bold: true, color: { argb: NAVY } };
  line += 1;
  for (const text of lines) {
    const cell = wi.getCell(line, 1);
    cell.value = text;
    cell.font = { name: "Calibri", size: 11, color: { argb: "FF101828" } };
    line += 1;
  }
  line += 1;
}
wi.getCell(2, 1).value = null;
wi.getCell(3, 1).value = null;

mkdirSync(dirname(OUT), { recursive: true });
await wb.xlsx.writeFile(OUT);
console.log(`ok → ${OUT}`);
