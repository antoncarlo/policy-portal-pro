// I file grafici del sito aziendale (cartella sites/tecnomga/public/media) e le loro dimensioni reali.

/** L'immagine ferma dell'apertura: le dimensioni sono dichiarate nella pagina perche' il testo non salti al caricamento. */
export const HERO_POSTER = { src: "/media/apertura.webp", width: 1344, height: 752 } as const;

/** Il video a ciclo continuo dell'apertura, nei due formati: il browser prende il primo che sa leggere. */
export const HERO_VIDEO = [
  { src: "/media/apertura.webm", type: "video/webm" },
  { src: "/media/apertura.mp4", type: "video/mp4" },
] as const;

/**
 * I loghi delle societa' con cui Tecno lavora, nell'ordine dell'elenco dei contenuti (la chiave e' il nome mostrato
 * come testo alternativo). File forniti dal titolare il 16/11/2026: solo ritagliati ai margini e ridotti, colori e
 * forme non si toccano. `width` e `height` sono la misura a cui il logo si mostra; il file e' il doppio.
 */
export const COMPANY_LOGOS: Record<string, { src: string; width: number; height: number }> = {
  Generali: { src: "/companies/generali.webp", width: 113, height: 84 },
  AXA: { src: "/companies/axa.webp", width: 76, height: 76 },
  Vittoria: { src: "/companies/vittoria.webp", width: 180, height: 64 },
  Helpet: { src: "/companies/helpet.webp", width: 182, height: 54 },
  Markel: { src: "/companies/markel.webp", width: 204, height: 34 },
};
