// Che cosa riceve Vercel Web Analytics dell'indirizzo di una pagina vista. Si tolgono le parti che possono contenere
// dati di una persona o credenziali: il frammento (i link di accesso di Supabase vi portano i token), i parametri
// diversi da quelli delle campagne (utm_*) e gli identificativi di pratiche e clienti nel percorso
// (/practices/:id, /clients/:id). Funzione pura: la usano il sito aziendale, le pagine pubbliche e l'area riservata.

const UUID = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi;

/** L'indirizzo da inviare alle statistiche, oppure null se non si legge: in quel caso la visita non si invia. */
export function analyticsUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const campaign = [...url.searchParams].filter(([key]) => key.toLowerCase().startsWith("utm_"));
  const query = new URLSearchParams(campaign).toString();
  return `${url.origin}${url.pathname.replace(UUID, "/[id]")}${query ? `?${query}` : ""}`;
}
