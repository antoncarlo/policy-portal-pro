// I file grafici del sito aziendale (cartella sites/tecnomga/public/media) e le loro dimensioni reali.

/** L'immagine ferma dell'apertura: le dimensioni sono dichiarate nella pagina perche' il testo non salti al caricamento. */
export const HERO_POSTER = { src: "/media/apertura.webp", width: 1344, height: 752 } as const;

/** Il video a ciclo continuo dell'apertura, nei due formati: il browser prende il primo che sa leggere. */
export const HERO_VIDEO = [
  { src: "/media/apertura.webm", type: "video/webm" },
  { src: "/media/apertura.mp4", type: "video/mp4" },
] as const;
