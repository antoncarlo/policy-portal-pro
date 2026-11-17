// Kit dei siti pubblici generati come HTML: la definizione di un sito (lingue, prefissi, origine).
// Nessun contenuto e nessun dato di un sito specifico: quelli stanno nella definizione che lo usa.

export interface SiteDefinition<L extends string = string> {
  /** Nome breve del sito, per i messaggi di errore e gli attributi della pagina. */
  id: string;
  /** Origine canonica quando l'ambiente non ne indica un'altra, senza barra finale. */
  defaultOrigin: string;
  langs: L[];
  /** Valore di `lang` e di `hreflang` per ogni lingua. */
  hreflang: Record<L, string>;
  /** Prefisso dei percorsi: stringa vuota per la lingua che sta alla radice. */
  langPrefix: Record<L, string>;
  /** La lingua proposta ai motori di ricerca per i paesi non coperti (`x-default`). */
  xDefault: L;
  /** Come ogni lingua chiama se stessa. */
  langNames: Record<L, string>;
  /** La sigla mostrata nella barra. */
  langShort: Record<L, string>;
}

export interface PageRef<Id extends string = string, L extends string = string> {
  id: Id;
  lang: L;
  /** Sempre con la barra iniziale e finale: "/", "/en/", "/en/privacy/". */
  path: string;
}
