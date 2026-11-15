// L'avviso della lingua: a chi ha il browser in un'altra lingua del sito si propone quella versione, nella sua
// lingua. Mai un reindirizzamento automatico: decide chi legge, e la scelta resta ricordata.
import { noticeLanguage, pageLanguage } from "./logic";

const KEY = "tecno-lang-choice";

const remember = () => {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    // archivio del browser non disponibile: l'avviso tornera' alla prossima visita
  }
};
const hasChosen = () => {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

export function initLangNotice(): void {
  // Chi cambia lingua dalla barra ha gia' scelto: l'avviso non serve piu'.
  for (const link of document.querySelectorAll(".lang-switch a")) link.addEventListener("click", remember);
  if (hasChosen()) return;
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  const target = noticeLanguage(pageLanguage(document.documentElement.lang), languages);
  const notice = target ? document.querySelector<HTMLElement>(`[data-lang-notice="${target}"]`) : null;
  if (!notice) return;
  notice.hidden = false;
  notice.querySelector("[data-lang-dismiss]")?.addEventListener("click", () => {
    notice.hidden = true;
    remember();
  });
  notice.querySelector("a")?.addEventListener("click", remember);
}
