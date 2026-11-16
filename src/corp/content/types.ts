// La forma dei testi del sito aziendale: la stessa in ogni lingua.
import type { CorpPageId } from "../routes";

export interface PageMeta {
  /** Titolo della scheda del browser e dei risultati di ricerca: 50-60 caratteri. */
  title: string;
  /** Descrizione nei risultati di ricerca: 150-160 caratteri. */
  description: string;
  /** Titolo principale della pagina. */
  h1: string;
  /** Nome breve: menu, briciole di pane, llms.txt. */
  label: string;
}

export interface CorpContent {
  meta: Record<CorpPageId, PageMeta>;
  nav: {
    /** Link per saltare al contenuto, per chi naviga da tastiera. */
    skip: string;
  };
}
