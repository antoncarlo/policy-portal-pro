import { defineMessages } from "@/i18n";

/** Schermata mostrata quando un errore imprevisto interrompe la pagina. */
export const errorMessages = defineMessages({
  it: {
    title: "Qualcosa è andato storto",
    text: "La pagina ha avuto un problema imprevisto. Il lavoro già salvato non è andato perso. Puoi riprovare o tornare alla dashboard.",
    retry: "Riprova",
    home: "Torna alla dashboard",
    reload: "Ricarica la pagina",
    detail: "Dettaglio tecnico",
    reference: (id: string) => `Riferimento: ${id}`,
  },
  en: {
    title: "Something went wrong",
    text: "The page ran into an unexpected problem. Work that was already saved is not lost. You can try again or go back to the dashboard.",
    retry: "Try again",
    home: "Back to the dashboard",
    reload: "Reload the page",
    detail: "Technical detail",
    reference: (id: string) => `Reference: ${id}`,
  },
  zh: {
    title: "出现了问题",
    text: "页面遇到了意外错误。已保存的内容不会丢失。您可以重试，或返回首页。",
    retry: "重试",
    home: "返回首页",
    reload: "刷新页面",
    detail: "技术详情",
    reference: (id: string) => `参考编号：${id}`,
  },
});
