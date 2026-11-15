// I testi del sito pubblico, uguali per struttura nelle tre lingue (lo verifica tests/site/content.test.ts).
import type { PageId } from "../routes";

export interface PageMeta {
  /** 50-60 caratteri in italiano e inglese, con la parola chiave all'inizio. */
  title: string;
  /** 150-160 caratteri in italiano e inglese, con un invito. */
  description: string;
  h1: string;
  /** Nome breve della pagina, per le briciole di pane. */
  label: string;
}

export interface SiteContent {
  meta: Record<PageId, PageMeta>;
}
