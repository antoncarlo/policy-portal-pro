// Statistiche di visita con Vercel Web Analytics: senza cookie e senza nulla salvato nel browser. Lo script arriva
// dallo stesso dominio (/_vercel/insights/script.js, o dall'indirizzo che Vercel indica nelle variabili
// VITE_VERCEL_OBSERVABILITY_*), quindi le politiche di sicurezza dei siti non cambiano. Parte solo nelle build fatte
// su Vercel (__VERCEL_ANALYTICS__, vedi vite.config.ts e vite.corp.config.ts): in locale e nelle prove lo script
// non esiste. Prima di ogni invio l'indirizzo passa da analyticsUrl.
import { inject } from "@vercel/analytics";
import { analyticsUrl } from "../analytics";

export function initAnalytics(): void {
  if (!__VERCEL_ANALYTICS__) return;
  inject(
    {
      mode: "production",
      basePath: import.meta.env.VITE_VERCEL_OBSERVABILITY_BASEPATH,
      beforeSend: (event) => {
        const url = analyticsUrl(event.url);
        return url ? { ...event, url } : null;
      },
    },
    import.meta.env.VITE_VERCEL_OBSERVABILITY_CLIENT_CONFIG,
  );
}
