// Riepilogo pratica (src/lib/practiceSummary.ts) nella lingua dell'utente.
// Il riepilogo è costruito in italiano anche per l'API dei partner: qui si traducono
// solo titoli, etichette e i valori fissi, per chiave; i dati inseriti restano com'sono.

import { getLanguage, getLocale, type Language } from "@/i18n";
import { practiceTypeLabel } from "@/i18n/messages/domain";
import { translatePolicyFieldLabel, translatePolicyFieldValue } from "@/i18n/policyFieldsText";
import { translateDocumentLabels, translateViesText } from "@/i18n/viesText";
import type { PracticeSummary, SummarySection } from "@/lib/practiceSummary";

type Target = Exclude<Language, "it">;
type Labels = Record<string, Record<Target, string>>;

const SECTION_TITLES: Labels = {
  contraente: { en: "Policyholder", zh: "投保人" },
  polizza: { en: "Policy", zh: "保单" },
  animale: { en: "Insured Animal", zh: "被保险动物" },
  coperture: { en: "Coverages and Quote", zh: "保障项目与报价" },
  premio: { en: "Premium", zh: "保费" },
  rappresentante: { en: "Fiscal representative", zh: "税务代表" },
  beneficiario: { en: "Beneficiary", zh: "受益人" },
  garanzia: { en: "Guarantee", zh: "担保" },
  documentazione: { en: "Documents and checks", zh: "文件与核查" },
  dati_excel: { en: "Original Excel data", zh: "Excel 原始数据" },
};

const SPECIFIC_DATA_TITLE: Record<Target, (type: string) => string> = {
  en: (type) => `${type} Specific Data`.trim(),
  zh: (type) => `${type}专属数据`,
};

// Etichette per chiave; alcune chiavi hanno un'etichetta propria nella sezione.
const ITEM_LABELS: Labels = {
  client_name: { en: "Name / Company Name", zh: "姓名 / 公司名称" },
  owner_tax_code: { en: "Tax Code / VAT Number", zh: "税号 / 增值税号" },
  client_email: { en: "Email", zh: "电子邮箱" },
  client_phone: { en: "Phone", zh: "电话" },
  client_address: { en: "Address", zh: "地址" },
  beneficiary: { en: "Beneficiary", zh: "受益人" },
  practice_type: { en: "Type", zh: "类型" },
  policy_number: { en: "Policy Number", zh: "保单号" },
  policy_start_date: { en: "Start date", zh: "起保日期" },
  policy_end_date: { en: "End date", zh: "到期日期" },
  duration: { en: "Duration", zh: "期限" },
  pet_name: { en: "Animal Name", zh: "动物名称" },
  pet_species: { en: "Species", zh: "种类" },
  animal_type: { en: "Rating Category", zh: "费率类别" },
  pet_breed: { en: "Breed", zh: "品种" },
  pet_birth_date: { en: "Date of Birth", zh: "出生日期" },
  pet_age: { en: "Age", zh: "年龄" },
  pet_gender: { en: "Sex", zh: "性别" },
  pet_microchip: { en: "Microchip Number", zh: "芯片编号" },
  pet_sterilized: { en: "Neutered", zh: "已绝育" },
  pet_weight: { en: "Weight", zh: "体重" },
  pet_previous_diseases: { en: "Previous Illnesses", zh: "既往病史" },
  coverage_type: { en: "Requested Coverages", zh: "申请的保障" },
  plan_name: { en: "Plan", zh: "方案" },
  total_annual: { en: "Annual Premium", zh: "年度保费" },
  total_monthly: { en: "Monthly Premium", zh: "月度保费" },
  premium_net: { en: "Net Premium", zh: "净保费" },
  premium_taxable: { en: "Taxable Amount", zh: "应税金额" },
  premium_taxes: { en: "Taxes", zh: "税费" },
  premium_gross: { en: "Gross Premium", zh: "总保费" },
  // VIES
  vies_denominazione_cn: { en: "Chinese name", zh: "中文名称" },
  vies_partita_iva: { en: "Italian VAT number", zh: "意大利增值税号" },
  vies_uscc: { en: "Unified Social Credit Code", zh: "统一社会信用代码" },
  vies_legale_rappresentante: { en: "Legal representative", zh: "法定代表人" },
  vies_documento_legale_rappresentante: { en: "Legal representative's document", zh: "法定代表人证件" },
  vies_data_nascita_legale_rappresentante: { en: "Legal representative's date of birth", zh: "法定代表人出生日期" },
  vies_domicilio_fiscale_contraente: { en: "Tax domicile in Italy", zh: "意大利税务住所" },
  vies_sede_contraente: { en: "Registered office (abroad)", zh: "注册地址（境外）" },
  vies_email: { en: "Email", zh: "电子邮箱" },
  vies_rappresentante_fiscale: { en: "Company", zh: "公司" },
  vies_codice_fiscale_rappresentante: { en: "Tax code / VAT number", zh: "税号 / 增值税号" },
  vies_domicilio_fiscale: { en: "Office", zh: "地址" },
  vies_amministratore_rappresentante: { en: "Director", zh: "董事" },
  vies_codice_fiscale_amministratore: { en: "Director's tax code", zh: "董事税号" },
  vies_visura_rappresentante: { en: "Source", zh: "来源" },
  vies_pec_rappresentante: { en: "PEC", zh: "PEC" },
  vies_indirizzo_beneficiario: { en: "Address", zh: "地址" },
  vies_codice_fiscale_beneficiario: { en: "Tax code", zh: "税号" },
  vies_importo_garantito: { en: "Guaranteed amount", zh: "担保金额" },
  vies_oggetto_garanzia: { en: "Object of the guarantee", zh: "担保事项" },
  vies_durata: { en: "Duration", zh: "期限" },
  vies_sezione_garante: { en: "Insurer/guarantor section", zh: "保险公司/担保人栏" },
  vies_zip_file: { en: "ZIP package", zh: "ZIP 文件包" },
  vies_documenti_zip: { en: "Documents in the ZIP", zh: "ZIP 中的文件数" },
  vies_verifica_piva: { en: "Identity check", zh: "身份核验" },
  vies_piva_trovate: { en: "Company codes in the documents", zh: "文件中的公司代码" },
  vies_documenti_mancanti: { en: "Missing documents", zh: "缺少的文件" },
  vies_avvisi: { en: "Validation warnings", zh: "审核提示" },
  vies_note_documenti: { en: "Agent notes on the documents", zh: "识别助手对文件的说明" },
  vies_riga_excel: { en: "Excel row / ZIP column", zh: "Excel 行 / ZIP 列" },
  vies_batch_id: { en: "VIES batch", zh: "VIES 批次" },
};

const SECTION_ITEM_LABELS: Record<string, Labels> = {
  contraente: {
    client_name: { en: "Company name", zh: "公司名称" },
    client_email: { en: "Application PEC", zh: "申请使用的 PEC" },
  },
  beneficiario: { beneficiary: { en: "Name", zh: "名称" } },
};

const VALUE_TEXTS: Labels = {
  Sì: { en: "Yes", zh: "是" },
  No: { en: "No", zh: "否" },
  "Nessuno ZIP collegato": { en: "No ZIP linked", zh: "未关联 ZIP" },
  Nessuno: { en: "None", zh: "无" },
  "Da lasciare in bianco": { en: "To be left blank", zh: "留空" },
  "Verificata: il codice della società compare nei documenti dello ZIP": {
    en: "Verified: the company's code appears in the ZIP documents",
    zh: "已核验：ZIP 文件中出现该公司的代码",
  },
  "Non corrisponde: lo ZIP contiene documenti di un'altra società": {
    en: "Does not match: the ZIP contains documents of another company",
    zh: "不一致：ZIP 中包含另一家公司的文件",
  },
  "Non verificabile: nessun codice leggibile nei documenti": {
    en: "Cannot be verified: no readable code in the documents",
    zh: "无法核验：文件中没有可读代码",
  },
  "Non eseguita (nessuno ZIP collegato)": { en: "Not run (no ZIP linked)", zh: "未执行（未关联 ZIP）" },
};

const PEC_SOURCES: Labels = {
  "del rappresentante fiscale": { en: "the fiscal representative's", zh: "税务代表的" },
  "del contraente": { en: "the policyholder's", zh: "投保人的" },
};

/** "36 mesi", "3 anni", "1 anno", "12 giorni" nella lingua di destinazione. */
export const translateDuration = (value: string, language: Language = getLanguage()) => {
  if (language === "it") return value;
  const match = /^(\d+) (giorni|anno|anni|mesi)$/.exec(value);
  if (!match) return value;
  const count = Number(match[1]);
  const unit = match[2];
  if (language === "zh") return `${count} ${unit === "giorni" ? "天" : unit === "mesi" ? "个月" : "年"}`;
  const english = unit === "giorni" ? "day" : unit === "mesi" ? "month" : "year";
  return `${count} ${english}${count === 1 ? "" : "s"}`;
};

// Dates are written as dd/mm/yyyy by the shared summary: shown in the user's format.
const DATE_KEYS = new Set(["policy_start_date", "policy_end_date", "pet_birth_date"]);
const localizeItalianDate = (value: string, language: Target) => {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (!match) return value;
  const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  return date.toLocaleDateString(getLocale(language), { day: "2-digit", month: "2-digit", year: "numeric" });
};

const translateValue = (key: string, value: string, language: Target) => {
  const fixed = VALUE_TEXTS[value]?.[language];
  if (fixed) return fixed;
  if (DATE_KEYS.has(key)) return localizeItalianDate(value, language);
  if (key === "duration" || key === "vies_durata") return translateDuration(value, language);
  if (key === "vies_documenti_mancanti") {
    const labels = translateDocumentLabels(value, language);
    return language === "zh" ? labels.split("\n").join("\n") : labels;
  }
  if (key === "vies_avvisi" || key === "vies_note_documenti") {
    return value
      .split("\n")
      .map((line) => translateViesText(line, language))
      .join("\n");
  }
  if (key === "vies_visura_rappresentante") return translateViesText(value, language);
  if (key === "vies_riga_excel") {
    return value.replace(/^Riga (\d+)/, language === "zh" ? "第 $1 行" : "Row $1");
  }
  if (key === "client_email") {
    const source = /^(.*) \((del rappresentante fiscale|del contraente)\)$/.exec(value);
    if (source) return `${source[1]} (${PEC_SOURCES[source[2]][language]})`;
  }
  return value;
};

/** Riepilogo con titoli, etichette e valori fissi tradotti; i dati inseriti restano invariati. */
export const translateSummary = (summary: PracticeSummary, language: Language = getLanguage()): PracticeSummary => {
  if (language === "it") return summary;
  const typeLabel = practiceTypeLabel(summary.practice_type, language);
  const sections: SummarySection[] = summary.sections.map((section) => ({
    ...section,
    title:
      section.id === "dati_specifici"
        ? SPECIFIC_DATA_TITLE[language](typeLabel)
        : SECTION_TITLES[section.id]?.[language] ?? section.title,
    items: section.items.map((item) => {
      const label =
        section.id === "dati_specifici"
          ? translatePolicyFieldLabel(summary.practice_type, item.key, item.label, language)
          : section.id === "dati_excel"
            ? item.label
            : SECTION_ITEM_LABELS[section.id]?.[item.key]?.[language] ?? ITEM_LABELS[item.key]?.[language] ?? item.label;
      const value =
        section.id === "dati_specifici"
          ? translatePolicyFieldValue(summary.practice_type, item.key, item.value, language)
          : translateValue(item.key, item.value, language);
      return { ...item, label, value };
    }),
  }));
  return { ...summary, practice_type_label: typeLabel, sections };
};
