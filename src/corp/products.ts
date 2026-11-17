// I prodotti che Tecno MGA intermedia, nell'ordine in cui il sito li presenta: per primi i sei piu' richiesti.
export const PRODUCT_IDS = ["fideiussioni", "car", "decennale-postuma", "rc-professionale", "d-and-o", "pet", "fotovoltaico", "impresa-commercio", "casa", "auto", "infortuni-malattia"] as const;
export type ProductId = (typeof PRODUCT_IDS)[number];

/** I prodotti in evidenza: in alto nella homepage, con il riquadro piu' grande. */
export const FEATURED: ProductId[] = ["fideiussioni", "car", "decennale-postuma", "rc-professionale", "d-and-o", "pet"];
export const isFeatured = (id: ProductId): boolean => FEATURED.includes(id);
