// Errori e avvisi VIES: sono generati e salvati in italiano (dati delle pratiche, dei
// lotti e del controllo finale, anche lato server) e tradotti solo quando vengono
// mostrati. Un testo senza regola resta in italiano: meglio l'originale di una
// traduzione sbagliata.

import { getLanguage, getMessages, type Language } from "@/i18n";
import { viesMessages } from "@/i18n/messages/vies";
import { VIES_DOCUMENT_TYPES } from "@/lib/viesDocumentTypes";

type Target = Exclude<Language, "it">;
type Render = (match: RegExpMatchArray, t: (text: string) => string, v: (value: string) => string) => string;
type Rule = { pattern: RegExp; en: Render; zh: Render };

const VALUE_WORDS: Record<string, Record<Target, string>> = {
  mancante: { en: "missing", zh: "缺失" },
  mancanti: { en: "missing", zh: "缺失" },
  nessuno: { en: "none", zh: "无" },
  "un altro ZIP": { en: "another ZIP", zh: "另一个 ZIP" },
};

/** Etichette dei tipi di documento (anche in elenchi) nella lingua di destinazione. */
export const translateDocumentLabels = (text: string, language: Language = getLanguage()) => {
  if (language === "it") return text;
  const labels = viesMessages[language].docTypes as Record<string, string>;
  return VIES_DOCUMENT_TYPES.reduce((result, type) => result.split(type.label).join(labels[type.id] ?? type.label), text);
};

export const getDocumentTypeLabel = (id: string, language: Language = getLanguage()) =>
  (viesMessages[language].docTypes as Record<string, string>)[id] ?? VIES_DOCUMENT_TYPES.find((type) => type.id === id)?.label ?? id;

const same = (en: string, zh: string): Pick<Rule, "en" | "zh"> => ({ en: () => en, zh: () => zh });

const RULES: Rule[] = [
  // Righe del foglio (punto 3 e righe escluse).
  {
    pattern: /^Numero ZIP mancante nella colonna ZIP: i documenti della società sono in (.+)$/,
    en: (m) => `ZIP number missing in the ZIP column: the company's documents are in ${m[1]}`,
    zh: (m) => `ZIP 列缺少编号：该公司的文件在 ${m[1]} 中`,
  },
  { pattern: /^Numero ZIP mancante nella colonna ZIP$/, ...same("ZIP number missing in the ZIP column", "ZIP 列缺少编号") },
  {
    pattern: /^Il numero ZIP (.+) è indicato su più righe$/,
    en: (m) => `ZIP number ${m[1]} is used on more than one row`,
    zh: (m) => `ZIP 编号 ${m[1]} 出现在多行中`,
  },
  { pattern: /^ZIP (.+)\.zip non caricato$/, en: (m) => `ZIP ${m[1]}.zip not uploaded`, zh: (m) => `未上传 ZIP ${m[1]}.zip` },
  { pattern: /^ZIP duplicato$/, ...same("Duplicate ZIP", "ZIP 重复") },
  {
    pattern: /^I documenti dello ZIP sono di un'altra società: (.+) non compare, trovati (.+)$/,
    en: (m) => `The ZIP documents belong to another company: ${m[1]} does not appear, found ${m[2]}`,
    zh: (m) => `ZIP 中的文件属于另一家公司：未出现 ${m[1]}，找到的是 ${m[2]}`,
  },
  {
    pattern: /^Nei documenti dello ZIP non compare nessun codice leggibile della società: identità non verificabile$/,
    ...same(
      "No readable company code appears in the ZIP documents: identity cannot be verified",
      "ZIP 文件中没有可读的公司代码：无法核验身份",
    ),
  },
  {
    pattern: /^Nello ZIP compaiono anche codici di un'altra società: (.+)$/,
    en: (m) => `The ZIP also contains codes of another company: ${m[1]}`,
    zh: (m) => `ZIP 中还出现了另一家公司的代码：${m[1]}`,
  },
  {
    pattern: /^(\d+) documenti non verificati dall'agent: (.+)$/,
    en: (m, t) => `${m[1]} documents not verified by the agent: ${t(m[2])}`,
    zh: (m, t) => `${m[1]} 份文件未经识别助手核验：${t(m[2])}`,
  },
  {
    pattern: /^Documento del legale rappresentante non corrispondente: nei documenti (.+)$/,
    en: (m) => `Legal representative's document does not match: the documents show ${m[1]}`,
    zh: (m) => `法定代表人证件不一致：文件中为 ${m[1]}`,
  },
  {
    pattern: /^Documento d'identità scaduto il (.+)$/,
    en: (m) => `Identity document expired on ${m[1]}`,
    zh: (m) => `身份证件已于 ${m[1]} 过期`,
  },
  {
    pattern: /^Verifica approfondita dell'agent non riuscita: i documenti mancanti non sono stati ricercati di nuovo$/,
    ...same(
      "The agent's in-depth check failed: the missing documents were not searched for again",
      "识别助手深入核查失败：未能重新查找缺失的文件",
    ),
  },
  {
    pattern: /^Verifica approfondita dell'agent non riuscita: (.+)$/,
    en: (m, t) => `The agent's in-depth check failed: ${t(m[1])}`,
    zh: (m, t) => `识别助手深入核查失败：${t(m[1])}`,
  },
  {
    pattern: /^Codice di credito sociale letto non valido: (.+)$/,
    en: (m) => `Unified Social Credit Code read as invalid: ${m[1]}`,
    zh: (m) => `读取到的统一社会信用代码无效：${m[1]}`,
  },
  { pattern: /^Partita IVA letta non valida: (.+)$/, en: (m) => `VAT number read as invalid: ${m[1]}`, zh: (m) => `读取到的增值税号无效：${m[1]}` },
  {
    pattern: /^Numero del documento d'identità letto non valido: (.+)$/,
    en: (m) => `Identity document number read as invalid: ${m[1]}`,
    zh: (m) => `读取到的身份证件号码无效：${m[1]}`,
  },
  // Dati della riga Excel.
  { pattern: /^Contraente mancante$/, ...same("Policyholder missing", "缺少投保人") },
  {
    pattern: /^Numero ZIP non valido \((.+)\): atteso un numero da 1 a (\d+)$/,
    en: (m) => `Invalid ZIP number (${m[1]}): a number from 1 to ${m[2]} is expected`,
    zh: (m) => `ZIP 编号无效（${m[1]}）：应为 1 至 ${m[2]} 的数字`,
  },
  { pattern: /^Partita IVA contraente non valida$/, ...same("Policyholder's VAT number is invalid", "投保人增值税号无效") },
  { pattern: /^Codice di credito sociale non valido$/, ...same("Invalid Unified Social Credit Code", "统一社会信用代码无效") },
  {
    pattern: /^Identificativo fiscale mancante \(P\.IVA o codice di credito sociale\)$/,
    ...same("Tax identifier missing (VAT number or Unified Social Credit Code)", "缺少税务识别号（增值税号或统一社会信用代码）"),
  },
  { pattern: /^Beneficiario mancante$/, ...same("Beneficiary missing", "缺少受益人") },
  { pattern: /^Indirizzo beneficiario mancante$/, ...same("Beneficiary address missing", "缺少受益人地址") },
  { pattern: /^Codice fiscale beneficiario mancante$/, ...same("Beneficiary tax code missing", "缺少受益人税号") },
  { pattern: /^Codice fiscale beneficiario non valido$/, ...same("Beneficiary tax code invalid", "受益人税号无效") },
  { pattern: /^Rappresentante fiscale mancante$/, ...same("Fiscal representative missing", "缺少税务代表") },
  { pattern: /^Codice fiscale rappresentante fiscale mancante$/, ...same("Fiscal representative tax code missing", "缺少税务代表税号") },
  { pattern: /^Codice fiscale rappresentante fiscale non valido$/, ...same("Fiscal representative tax code invalid", "税务代表税号无效") },
  {
    pattern: /^Amministratore del rappresentante fiscale mancante$/,
    ...same("Fiscal representative's director missing", "缺少税务代表的董事"),
  },
  { pattern: /^Codice fiscale amministratore mancante$/, ...same("Director's tax code missing", "缺少董事税号") },
  { pattern: /^Codice fiscale amministratore non valido$/, ...same("Director's tax code invalid", "董事税号无效") },
  { pattern: /^Domicilio fiscale del rappresentante mancante$/, ...same("Representative's tax domicile missing", "缺少税务代表的税务住所") },
  {
    pattern: /^PEC mancante \(né del contraente né del rappresentante fiscale\)$/,
    ...same("PEC missing (neither the policyholder's nor the fiscal representative's)", "缺少 PEC（投保人和税务代表均未提供）"),
  },
  { pattern: /^PEC non valida$/, ...same("Invalid PEC", "PEC 无效") },
  { pattern: /^PEC beneficiario non valida$/, ...same("Invalid beneficiary PEC", "受益人 PEC 无效") },
  {
    pattern: /^Esiste già la pratica VIES (\S+) per questa società \(creata il (.+)\)$/,
    en: (m) => `VIES application ${m[1]} already exists for this company (created on ${m[2]})`,
    zh: (m) => `该公司已有 VIES 申请 ${m[1]}（创建于 ${m[2]}）`,
  },
  // Controllo finale (punto 6) e stato dei job.
  { pattern: /^Bloccata: (.+)$/, en: (m, t) => `Blocked: ${t(m[1])}`, zh: (m, t) => `已阻止：${t(m[1])}` },
  { pattern: /^errori sui dati o sui documenti$/, ...same("errors in the data or documents", "数据或文件有误") },
  { pattern: /^Già inviata al portale$/, ...same("Already sent to the portal", "已发送至门户") },
  { pattern: /^Annullata$/, ...same("Cancelled", "已取消") },
  {
    pattern: /^Errori registrati alla creazione: (.+)$/,
    en: (m, t) => `Errors recorded at creation: ${t(m[1])}`,
    zh: (m, t) => `创建时记录的错误：${t(m[1])}`,
  },
  {
    pattern: /^Controllo finale non superato: (.+)$/,
    en: (m, t) => `Final check not passed: ${t(m[1])}`,
    zh: (m, t) => `未通过最终检查：${t(m[1])}`,
  },
  { pattern: /^pratica non verificabile$/, ...same("application cannot be checked", "申请无法核验") },
  { pattern: /^Nessuna pratica collegata a questa riga$/, ...same("No application linked to this row", "该行没有关联的申请") },
  { pattern: /^La pratica collegata non è di tipo VIES$/, ...same("The linked application is not a VIES application", "关联的申请不是 VIES 类型") },
  {
    pattern: /^Il contraente della pratica \((.*)\) è diverso da quello della riga \((.*)\)$/,
    en: (m) => `The application's policyholder (${m[1]}) differs from the row's (${m[2]})`,
    zh: (m) => `申请的投保人（${m[1]}）与该行的投保人（${m[2]}）不一致`,
  },
  {
    pattern: /^Mancano sia il codice di credito sociale sia la P\.IVA della società$/,
    ...same("Both the company's Unified Social Credit Code and VAT number are missing", "公司的统一社会信用代码和增值税号均缺失"),
  },
  {
    pattern: /^Codice di credito sociale non valido: (.+)$/,
    en: (m) => `Invalid Unified Social Credit Code: ${m[1]}`,
    zh: (m) => `统一社会信用代码无效：${m[1]}`,
  },
  { pattern: /^P\.IVA non valida: (.+)$/, en: (m) => `Invalid VAT number: ${m[1]}`, zh: (m) => `增值税号无效：${m[1]}` },
  {
    pattern: /^La P\.IVA della pratica non coincide con quella registrata$/,
    ...same("The application's VAT number does not match the recorded one", "申请的增值税号与登记的不一致"),
  },
  {
    pattern: /^La P\.IVA della riga non coincide con quella della pratica$/,
    ...same("The row's VAT number does not match the application's", "该行的增值税号与申请的不一致"),
  },
  {
    pattern: /^L'identità della società non è stata verificata nei documenti dello ZIP$/,
    ...same("The company's identity was not verified in the ZIP documents", "未在 ZIP 文件中核验到该公司的身份"),
  },
  {
    pattern: /^Nei documenti dello ZIP non compare il codice della società \((.+)\)$/,
    en: (m, t, v) => `The company's code does not appear in the ZIP documents (${v(m[1])})`,
    zh: (m, t, v) => `ZIP 文件中未出现该公司的代码（${v(m[1])}）`,
  },
  {
    pattern: /^Nello ZIP compaiono codici di un'altra società: (.+)$/,
    en: (m) => `The ZIP contains codes of another company: ${m[1]}`,
    zh: (m) => `ZIP 中出现另一家公司的代码：${m[1]}`,
  },
  { pattern: /^Numero ZIP non valido: (.+)$/, en: (m, t, v) => `Invalid ZIP number: ${v(m[1])}`, zh: (m, t, v) => `ZIP 编号无效：${v(m[1])}` },
  {
    pattern: /^Lo ZIP della riga è (.+), atteso (.+)$/,
    en: (m, t, v) => `The row's ZIP is ${v(m[1])}, expected ${m[2]}`,
    zh: (m, t, v) => `该行的 ZIP 为 ${v(m[1])}，应为 ${m[2]}`,
  },
  {
    pattern: /^Lo ZIP registrato nella pratica è (.+), atteso (.+)$/,
    en: (m, t, v) => `The ZIP recorded in the application is ${v(m[1])}, expected ${m[2]}`,
    zh: (m, t, v) => `申请中登记的 ZIP 为 ${v(m[1])}，应为 ${m[2]}`,
  },
  {
    pattern: /^Alla pratica sono allegati (\d+) ZIP: (.+)$/,
    en: (m) => `${m[1]} ZIPs are attached to the application: ${m[2]}`,
    zh: (m) => `申请附有 ${m[1]} 个 ZIP：${m[2]}`,
  },
  { pattern: /^Lo ZIP non è allegato alla pratica$/, ...same("The ZIP is not attached to the application", "申请未附带 ZIP") },
  {
    pattern: /^Alla pratica è allegato (.+) invece di (.+)$/,
    en: (m) => `${m[1]} is attached to the application instead of ${m[2]}`,
    zh: (m) => `申请附带的是 ${m[1]}，而不是 ${m[2]}`,
  },
  {
    pattern: /^Lo ZIP allegato non è quello archiviato con questo lotto \((.+)\)$/,
    en: (m) => `The attached ZIP is not the one stored with this batch (${m[1]})`,
    zh: (m) => `附带的 ZIP 不是本批次存档的 ZIP（${m[1]}）`,
  },
  { pattern: /^Lo ZIP allegato risulta vuoto$/, ...same("The attached ZIP is empty", "附带的 ZIP 为空") },
  {
    pattern: /^Alla pratica sono allegati (\d+) documenti di polizza$/,
    en: (m) => `${m[1]} policy documents are attached to the application`,
    zh: (m) => `申请附有 ${m[1]} 份保单文件`,
  },
  { pattern: /^Manca il documento di polizza$/, ...same("The policy document is missing", "缺少保单文件") },
  {
    pattern: /^Il documento di polizza non è archiviato nella cartella di questa pratica$/,
    ...same("The policy document is not stored in this application's folder", "保单文件未存放在该申请的文件夹中"),
  },
  {
    pattern: /^Nessun documento indicizzato per lo ZIP di questa pratica$/,
    ...same("No document indexed for this application's ZIP", "该申请的 ZIP 没有已索引的文件"),
  },
  {
    pattern: /^Tra i documenti della pratica ce n'è uno di (.+)$/,
    en: (m, t, v) => `Among the application's documents there is one from ${v(m[1])}`,
    zh: (m, t, v) => `申请文件中有一份来自 ${v(m[1])}`,
  },
  { pattern: /^Uno dei documenti dello ZIP non è leggibile$/, ...same("One of the ZIP documents cannot be read", "ZIP 中有一份文件无法读取") },
  {
    pattern: /^Documenti obbligatori non trovati: (.+)$/,
    en: (m) => `Required documents not found: ${translateDocumentLabels(m[1], "en")}`,
    zh: (m) => `未找到必备文件：${translateDocumentLabels(m[1], "zh").split(", ").join("、")}`,
  },
  {
    pattern: /^Premio lordo (.+), atteso (.+)$/,
    en: (m, t, v) => `Gross premium ${v(m[1])}, expected ${m[2]}`,
    zh: (m, t, v) => `总保费 ${v(m[1])}，应为 ${m[2]}`,
  },
  { pattern: /^Imposte (.+), attese (.+)$/, en: (m, t, v) => `Taxes ${v(m[1])}, expected ${m[2]}`, zh: (m, t, v) => `税费 ${v(m[1])}，应为 ${m[2]}` },
  {
    pattern: /^Imponibile (.+), atteso (.+)$/,
    en: (m, t, v) => `Taxable amount ${v(m[1])}, expected ${m[2]}`,
    zh: (m, t, v) => `应税金额 ${v(m[1])}，应为 ${m[2]}`,
  },
  {
    pattern: /^Premio netto (.+), atteso (.+)$/,
    en: (m, t, v) => `Net premium ${v(m[1])}, expected ${m[2]}`,
    zh: (m, t, v) => `净保费 ${v(m[1])}，应为 ${m[2]}`,
  },
  {
    pattern: /^Importo garantito (.+), atteso (.+)$/,
    en: (m, t, v) => `Guaranteed amount ${v(m[1])}, expected ${m[2]}`,
    zh: (m, t, v) => `担保金额 ${v(m[1])}，应为 ${m[2]}`,
  },
  {
    pattern: /^Durata (.+) mesi, attesa (.+)$/,
    en: (m, t, v) => `Duration ${v(m[1])} months, expected ${m[2]}`,
    zh: (m, t, v) => `期限 ${v(m[1])} 个月，应为 ${m[2]}`,
  },
  { pattern: /^Mancano le date di decorrenza o scadenza$/, ...same("Start or end date missing", "缺少起保日期或到期日期") },
  {
    pattern: /^Scadenza (.+) non coerente con decorrenza (.+) e durata di (\d+) mesi$/,
    en: (m) => `End date ${m[1]} inconsistent with start date ${m[2]} and a duration of ${m[3]} months`,
    zh: (m) => `到期日 ${m[1]} 与起保日 ${m[2]} 及 ${m[3]} 个月的期限不一致`,
  },
  { pattern: /^Manca il beneficiario$/, ...same("Beneficiary missing", "缺少受益人") },
  { pattern: /^Manca l'indirizzo del beneficiario$/, ...same("Beneficiary address missing", "缺少受益人地址") },
  {
    pattern: /^Codice fiscale del beneficiario mancante o non valido$/,
    ...same("Beneficiary tax code missing or invalid", "受益人税号缺失或无效"),
  },
  { pattern: /^Manca il rappresentante fiscale$/, ...same("Fiscal representative missing", "缺少税务代表") },
  {
    pattern: /^Codice fiscale del rappresentante fiscale mancante o non valido$/,
    ...same("Fiscal representative tax code missing or invalid", "税务代表税号缺失或无效"),
  },
  {
    pattern: /^Manca l'amministratore del rappresentante fiscale$/,
    ...same("Fiscal representative's director missing", "缺少税务代表的董事"),
  },
  {
    pattern: /^Codice fiscale dell'amministratore non valido: (.+)$/,
    en: (m) => `Director's tax code invalid: ${m[1]}`,
    zh: (m) => `董事税号无效：${m[1]}`,
  },
  {
    pattern: /^Manca la sede del rappresentante fiscale \(domicilio della società\)$/,
    ...same("Fiscal representative's office (company domicile) missing", "缺少税务代表的地址（公司住所）"),
  },
  {
    pattern: /^Il numero ZIP (.+) è usato anche dalla riga (\d+)$/,
    en: (m) => `ZIP number ${m[1]} is also used by row ${m[2]}`,
    zh: (m) => `ZIP 编号 ${m[1]} 也被第 ${m[2]} 行使用`,
  },
  {
    pattern: /^La stessa società compare anche alla riga (\d+)$/,
    en: (m) => `The same company also appears on row ${m[1]}`,
    zh: (m) => `同一家公司也出现在第 ${m[1]} 行`,
  },
  {
    pattern: /^Visura(?: n\. (\S+))?(?: estratta il (.+))?$/,
    en: (m) => `Registry extract${m[1] ? ` no. ${m[1]}` : ""}${m[2] ? ` extracted on ${m[2]}` : ""}`,
    zh: (m) => `注册证明${m[1] ? ` 编号 ${m[1]}` : ""}${m[2] ? `，提取于 ${m[2]}` : ""}`,
  },
  // Messaggi dell'orchestratore e del portale.
  {
    pattern: /^Nessun portale esterno collegato: le pratiche restano pronte nel portale, nessun invio eseguito\.$/,
    ...same(
      "No external portal connected: the applications stay ready in the portal, nothing was sent.",
      "未连接外部门户：申请在本门户中保持就绪，未执行任何发送。",
    ),
  },
  {
    pattern: /^Il portale scelto per questo lotto non è collegato: sceglierne un altro e inviare di nuovo\.$/,
    ...same(
      "The portal chosen for this batch is not connected: choose another one and send again.",
      "为本批次选择的门户未连接：请选择其他门户后重新发送。",
    ),
  },
  { pattern: /^Il portale scelto non è collegato\.$/, ...same("The chosen portal is not connected.", "所选门户未连接。") },
  {
    pattern: /^Nessuna pratica del lotto supera il controllo finale: nulla è stato inviato\.$/,
    ...same("No application of the batch passes the final check: nothing was sent.", "本批次没有申请通过最终检查：未发送任何内容。"),
  },
  {
    pattern: /^Si può riprovare solo un invio non riuscito: le pratiche bloccate dai controlli restano bloccate\.$/,
    ...same(
      "Only a failed submission can be retried: applications blocked by the checks stay blocked.",
      "只能重试发送失败的申请：被检查阻止的申请保持阻止状态。",
    ),
  },
  { pattern: /^Elaborazione VIES non completata\.$/, ...same("VIES processing not completed.", "VIES 处理未完成。") },
  // Agent documentale.
  { pattern: /^Agent non raggiungibile\.$/, ...same("Agent not reachable.", "无法连接识别助手。") },
  {
    pattern: /^Agent documentale non configurato: manca il segreto ANTHROPIC_API_KEY\.$/,
    ...same("Document agent not configured: the ANTHROPIC_API_KEY secret is missing.", "文件识别助手未配置：缺少 ANTHROPIC_API_KEY 密钥。"),
  },
  { pattern: /^Agent occupato: riprovare tra poco\.$/, ...same("Agent busy: try again shortly.", "识别助手繁忙：请稍后重试。") },
  { pattern: /^Chiave API dell'agent non valida\.$/, ...same("Invalid agent API key.", "识别助手的 API 密钥无效。") },
  { pattern: /^L'agent non ha elaborato il documento\.$/, ...same("The agent did not process the document.", "识别助手未处理该文件。") },
  { pattern: /^Risposta dell'agent (incompleta|vuota)\.$/, ...same("Incomplete agent response.", "识别助手的回复不完整。") },
  {
    pattern: /^Documento troppo grande per l'agent \(massimo circa 22 MB\)\.$/,
    ...same("Document too large for the agent (about 22 MB at most).", "文件过大，识别助手无法处理（最大约 22 MB）。"),
  },
  {
    pattern: /^(.+) \(dopo (\d+) tentativi\)$/,
    en: (m, t) => `${t(m[1])} (after ${m[2]} attempts)`,
    zh: (m, t) => `${t(m[1])}（尝试 ${m[2]} 次后）`,
  },
];

const translateValue = (value: string, language: Target) => VALUE_WORDS[value]?.[language] ?? value;

const translate = (text: string, language: Target, depth: number): string => {
  const trimmed = text.trim();
  if (!trimmed || depth > 4) return text;
  const recurse = (inner: string) => translate(inner, language, depth + 1);
  const value = (inner: string) => translateValue(inner, language);
  for (const rule of RULES) {
    const match = trimmed.match(rule.pattern);
    if (match) return rule[language](match, recurse, value);
  }
  // Elenchi "errore; errore" (motivi di blocco salvati sui job).
  if (trimmed.includes("; ")) return trimmed.split("; ").map(recurse).join(language === "zh" ? "；" : "; ");
  // "file.pdf: motivo" (avvisi dell'agent su un documento).
  const named = /^([^:]+\.(?:pdf|jpe?g|png|webp|gif|zip)): (.+)$/i.exec(trimmed);
  if (named) return `${named[1]}: ${recurse(named[2])}`;
  return text;
};

/** Testo di un errore o avviso VIES nella lingua corrente (l'italiano resta com'è). */
export const translateViesText = (text: string, language: Language = getLanguage()) =>
  language === "it" ? text : translate(text, language, 0);

/** Messaggi VIES della lingua corrente, per i punti fuori dai componenti. */
export const viesText = () => getMessages(viesMessages);
