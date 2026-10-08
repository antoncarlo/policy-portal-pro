import { defineMessages, getLanguage, type Language } from "@/i18n";

/** Vocabolario condiviso: stati e tipi di pratica, stati contabili, ruoli. */
export const domainMessages = defineMessages({
  it: {
    practiceStatus: {
      in_lavorazione: "In Lavorazione",
      in_attesa: "In Attesa",
      approvata: "Approvata",
      rifiutata: "Rifiutata",
      completata: "Completata",
    },
    practiceType: {
      auto: "Auto",
      casa: "Casa",
      vita: "Vita",
      salute: "Salute",
      responsabilita: "Responsabilità Civile",
      altro: "Altro",
      fidejussioni: "Fidejussioni",
      vies: "VIES",
      car: "CAR",
      postuma_decennale: "Postuma Decennale",
      all_risk: "All Risk",
      responsabilita_civile: "Responsabilità Civile",
      pet: "Pet",
      fotovoltaico: "Fotovoltaico",
      catastrofali: "Catastrofali",
      azienda: "Azienda",
      risparmio: "Risparmio",
    },
    financialStatus: {
      non_incassata: "Non incassata",
      incassata: "Incassata",
      provvigioni_ricevute: "Provvigioni ricevute",
    },
    role: {
      admin: "Amministratore",
      agente: "Agente",
      collaboratore: "Collaboratore",
    },
    daysShort: (days: number) => `${days}gg`,
    today: "Oggi",
  },
  en: {
    practiceStatus: {
      in_lavorazione: "In Progress",
      in_attesa: "Pending",
      approvata: "Approved",
      rifiutata: "Rejected",
      completata: "Completed",
    },
    practiceType: {
      auto: "Motor",
      casa: "Home",
      vita: "Life",
      salute: "Health",
      responsabilita: "Third-Party Liability",
      altro: "Other",
      fidejussioni: "Surety Bonds",
      vies: "VIES",
      car: "Contractors' All Risks (CAR)",
      postuma_decennale: "Ten-Year Latent Defects",
      all_risk: "All Risks",
      responsabilita_civile: "Third-Party Liability",
      pet: "Pet",
      fotovoltaico: "Photovoltaic",
      catastrofali: "Natural Catastrophe",
      azienda: "Business",
      risparmio: "Savings",
    },
    financialStatus: {
      non_incassata: "Not collected",
      incassata: "Collected",
      provvigioni_ricevute: "Commissions received",
    },
    role: {
      admin: "Administrator",
      agente: "Agent",
      collaboratore: "Collaborator",
    },
    daysShort: (days: number) => `${days}d`,
    today: "Today",
  },
  zh: {
    practiceStatus: {
      in_lavorazione: "处理中",
      in_attesa: "待处理",
      approvata: "已批准",
      rifiutata: "已拒绝",
      completata: "已完成",
    },
    practiceType: {
      auto: "车险",
      casa: "家财险",
      vita: "寿险",
      salute: "健康险",
      responsabilita: "第三者责任险",
      altro: "其他",
      fidejussioni: "保证保险",
      vies: "VIES",
      car: "建筑工程一切险（CAR）",
      postuma_decennale: "十年期潜在缺陷险",
      all_risk: "一切险",
      responsabilita_civile: "第三者责任险",
      pet: "宠物险",
      fotovoltaico: "光伏险",
      catastrofali: "巨灾险",
      azienda: "企业险",
      risparmio: "储蓄险",
    },
    financialStatus: {
      non_incassata: "未收款",
      incassata: "已收款",
      provvigioni_ricevute: "已收佣金",
    },
    role: {
      admin: "管理员",
      agente: "代理人",
      collaboratore: "协作人员",
    },
    daysShort: (days: number) => `${days}天`,
    today: "今天",
  },
});

export const PRACTICE_STATUSES = ["in_lavorazione", "in_attesa", "approvata", "rifiutata", "completata"] as const;

/** Tipi di pratica nell'ordine dei menu ("responsabilita" è il tipo storico). */
export const PRACTICE_TYPES = [
  "pet", "car", "casa", "salute", "fidejussioni", "postuma_decennale", "all_risk", "responsabilita_civile",
  "fotovoltaico", "catastrofali", "azienda", "risparmio", "vies", "auto", "vita", "responsabilita", "altro",
] as const;

type DomainGroup = "practiceStatus" | "practiceType" | "financialStatus" | "role";

const lookup = (group: DomainGroup, key: string | null | undefined, language: Language) =>
  key ? ((domainMessages[language][group] as Record<string, string>)[key] ?? key) : "";

export const practiceStatusLabel = (status: string | null | undefined, language: Language = getLanguage()) =>
  lookup("practiceStatus", status, language);
export const practiceTypeLabel = (type: string | null | undefined, language: Language = getLanguage()) =>
  lookup("practiceType", type, language);
export const financialStatusLabel = (status: string | null | undefined, language: Language = getLanguage()) =>
  lookup("financialStatus", status, language);
export const roleLabel = (role: string | null | undefined, language: Language = getLanguage()) => lookup("role", role, language);
