// Coperture e categorie del preventivatore Pet in inglese e cinese.
// src/data/petInsuranceData.ts resta in italiano perché lo usano anche l'API e i PDF:
// qui la traduzione è per id di copertura (configuratore) o per testo italiano (riepilogo).

import { getLanguage, getLocale, type Language } from "@/i18n";
import { petCoverages, type PetCoverage } from "@/data/petInsuranceData";

type Target = Exclude<Language, "it">;
type CoverageText = { name: string; description: string };

const WAITING_30 = { en: "30-day waiting period", zh: "30 天等待期" };
const RSV_TERMS = { en: "10% excess, min €100 - Max 2 claims/year", zh: "自付 10%，最低 €100 - 每年最多 2 次理赔" };

const rsv = (tier: string, limit: Record<Target, string>): Record<Target, CoverageText> => ({
  en: {
    name: `RSV ${tier} ${limit.en}`,
    description: `Veterinary expenses reimbursement - Limit ${limit.en} - ${RSV_TERMS.en}`,
  },
  zh: {
    name: `RSV ${tier} ${limit.zh}`,
    description: `兽医费用报销 - 保额 ${limit.zh} - ${RSV_TERMS.zh}`,
  },
});

const rct = (short: string, limit: string): Record<Target, CoverageText> => ({
  en: { name: `RCT ${short}`, description: `Third-party liability - Limit ${limit} - ${WAITING_30.en}` },
  zh: { name: `RCT ${short}`, description: `第三方责任 - 保额 ${limit} - ${WAITING_30.zh}` },
});

const COVERAGES: Record<string, Record<Target, CoverageText>> = {
  ass_standard: {
    en: { name: "Standard Assistance", description: `Pet assistance - Services in kind - ${WAITING_30.en}` },
    zh: { name: "标准援助", description: `宠物援助 - 实物服务 - ${WAITING_30.zh}` },
  },
  rsv_silver_500: rsv("Silver", { en: "€500", zh: "€500" }),
  rsv_silver_750: rsv("Silver", { en: "€750", zh: "€750" }),
  rsv_gold_1000: rsv("Gold", { en: "€1,000", zh: "€1,000" }),
  rsv_gold_2000: rsv("Gold", { en: "€2,000", zh: "€2,000" }),
  rsv_platinum_2500: rsv("Platinum", { en: "€2,000 + €500 extra", zh: "€2,000 + 额外 €500" }),
  rsv_platinum_3500: rsv("Platinum", { en: "€3,000 + €500 extra", zh: "€3,000 + 额外 €500" }),
  rct_100k: rct("€100K", "€100,000"),
  rct_250k: rct("€250K", "€250,000"),
  rct_500k: rct("€500K", "€500,000"),
  tl_standard: {
    en: { name: "Standard Legal Protection", description: "Standard cover - Legal assistance" },
    zh: { name: "标准法律保护", description: "标准保障 - 法律援助" },
  },
};

const ITALIAN_TEXTS: Record<string, Record<Target, string>> = {
  // Categorie di copertura
  Assistenza: { en: "Assistance", zh: "援助" },
  "Rimborso Spese Veterinarie": { en: "Veterinary Expenses Reimbursement", zh: "兽医费用报销" },
  "Responsabilità Civile verso Terzi": { en: "Third-Party Liability", zh: "第三方责任" },
  "Tutela Legale": { en: "Legal Protection", zh: "法律保护" },
  // Specie e categorie tariffarie
  Gatto: { en: "Cat", zh: "猫" },
  Cane: { en: "Dog", zh: "狗" },
  "Cane fino a 20 kg": { en: "Dog up to 20 kg", zh: "狗（20 公斤以内）" },
  "Cane oltre 20 kg": { en: "Dog over 20 kg", zh: "狗（20 公斤以上）" },
  // Tipo di copertura richiesto
  "Solo RC Terzi (RCT)": { en: "Third-party liability only (RCT)", zh: "仅第三方责任（RCT）" },
  "Solo Spese Veterinarie (RSV)": { en: "Veterinary expenses only (RSV)", zh: "仅兽医费用（RSV）" },
  "RC Terzi + Spese Veterinarie": { en: "Third-party liability + Veterinary expenses", zh: "第三方责任 + 兽医费用" },
  "Copertura Completa (RCT + RSV + TL)": { en: "Full cover (RCT + RSV + TL)", zh: "全面保障（RCT + RSV + TL）" },
};

const coverageByItalianName = new Map(petCoverages.map((coverage) => [coverage.name, coverage.id]));

export const petCoverageName = (coverage: PetCoverage | undefined, language: Language = getLanguage()) => {
  if (!coverage) return "";
  return language === "it" ? coverage.name : COVERAGES[coverage.id]?.[language].name ?? coverage.name;
};

export const petCoverageDescription = (coverage: PetCoverage | undefined, language: Language = getLanguage()) => {
  if (!coverage) return "";
  return language === "it" ? coverage.description : COVERAGES[coverage.id]?.[language].description ?? coverage.description;
};

/** Categoria, specie o tipo di copertura scritto in italiano nel riepilogo. */
export const translatePetText = (text: string, language: Language = getLanguage()) =>
  language === "it" ? text : ITALIAN_TEXTS[text]?.[language] ?? text;

/** "RSV Silver 500€ (141,00 €/anno)" del riepilogo nella lingua di destinazione. */
export const translatePetCoverageLine = (value: string, language: Language = getLanguage()) => {
  if (language === "it") return value;
  const match = /^(.+) \((.+)\/anno\)$/.exec(value);
  if (!match) return value;
  const id = coverageByItalianName.get(match[1]);
  const name = id ? COVERAGES[id]?.[language].name ?? match[1] : match[1];
  const amount = Number(match[2].replace(/[^\d,]/g, "").replace(",", "."));
  const price = Number.isFinite(amount)
    ? amount.toLocaleString(getLocale(language), { style: "currency", currency: "EUR" })
    : match[2];
  return `${name} (${price}${language === "zh" ? "/年" : "/year"})`;
};

/** Copertura del riepilogo pratica (nome, descrizione, categoria) nella lingua di destinazione. */
export const translatePetCoverage = <T extends { id: string; name: string; description: string; category_label: string }>(
  coverage: T,
  language: Language = getLanguage(),
): T => {
  if (language === "it") return coverage;
  const text = COVERAGES[coverage.id]?.[language];
  return {
    ...coverage,
    name: text?.name ?? coverage.name,
    description: text?.description ?? coverage.description,
    category_label: translatePetText(coverage.category_label, language),
  };
};
