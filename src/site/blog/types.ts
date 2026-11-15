// Gli articoli del blog: un articolo e' un modulo per lingua, con la stessa struttura nelle tre lingue.
// Nessun HTML nei testi: solo i blocchi qui sotto e i collegamenti nella forma «[testo](bersaglio)» (src/site/inline.ts).
import type { Lang } from "../config";

/** Gli articoli del progetto (§6.8), nell'ordine in cui compaiono nell'indice. */
export const ARTICLE_IDS = [
  "garanzia-vies",
  "forme-garanzia",
  "documenti",
  "richiesta-polizza",
  "lotto-pratiche",
  "firma-p7m",
  "garanzia-rappresentante",
  "venditori-marketplace",
] as const;
export type ArticleId = (typeof ARTICLE_IDS)[number];

export type Block =
  | { type: "p"; text: string }
  | { type: "list"; items: string[] }
  /** Passi in ordine: un titolo breve e la spiegazione. */
  | { type: "steps"; items: Array<{ title: string; text: string }> }
  /** La prima colonna e' l'intestazione di riga. */
  | { type: "table"; columns: string[]; rows: string[][] }
  /** Un'avvertenza messa in evidenza. */
  | { type: "note"; text: string };

export interface ArticleSection {
  /** Ancora della sezione, uguale nelle tre lingue. */
  id: string;
  heading: string;
  blocks: Block[];
}

export interface Article {
  /** Il tratto dell'indirizzo dopo «/blog/», nella lingua dell'articolo. */
  slug: string;
  /** 50-60 caratteri in italiano e inglese, con la parola chiave all'inizio. */
  title: string;
  /** 150-160 caratteri in italiano e inglese. */
  description: string;
  h1: string;
  /** Nome breve, per le briciole di pane e i riquadri. */
  label: string;
  /** La ricerca a cui l'articolo risponde: sta nel titolo o nell'H1. */
  keyword: string;
  /** La risposta diretta in apertura: 40-60 parole. */
  summary: string;
  sections: ArticleSection[];
  /** Risposte di 40-60 parole. */
  faq: Array<{ q: string; a: string }>;
  /** Solo fonti ufficiali. */
  sources: Array<{ label: string; href: string }>;
}

export interface ArticleEntry {
  id: ArticleId;
  /** AAAA-MM-GG. */
  published: string;
  /** Data dell'ultima verifica sulle fonti. */
  updated: string;
  related: ArticleId[];
  content: Record<Lang, Article>;
}
