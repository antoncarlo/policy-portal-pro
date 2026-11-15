// Il consenso ai cookie nel browser: un solo consenso per tutti i cookie non tecnici. Senza identificativi di
// Google nella pagina non fa nulla. Con gli identificativi: mostra il banner se manca una scelta valida, ricorda
// la scelta («Accetta» o «Rifiuta»; la chiusura vale rifiuto), e solo dopo un consenso carica lo
// script di Google con la modalita' di consenso versione 2 (prima «negato a tutto», poi cio' che e' stato concesso).
// Dopo un rifiuto non parte nulla; revocando un consenso i cookie di Google salvati dal sito vengono cancellati.
import { CONSENT_KEY, DENIED, googleTagsToLoad, gtagConsent, parseConsent, serializeConsent, validTagIds, type ConsentChoice } from "../consent-core";

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

const GTAG_SRC = "https://www.googletagmanager.com/gtag/js?id=";
/** I cookie che gli strumenti di Google salvano sul dominio del sito, per categoria. */
const GOOGLE_COOKIES = { statistics: /^_ga(_|$)|^_gid$|^_gat/, marketing: /^_gcl_/ };

function gtag(..._args: unknown[]): void {
  // Google legge l'oggetto «arguments», non un array.
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer?.push(arguments);
}

const read = (): ConsentChoice | null => {
  try {
    return parseConsent(window.localStorage.getItem(CONSENT_KEY), new Date());
  } catch {
    return null;
  }
};
const write = (choice: { statistics: boolean; marketing: boolean }): ConsentChoice => {
  const raw = serializeConsent(choice, new Date());
  try {
    window.localStorage.setItem(CONSENT_KEY, raw);
  } catch {
    // archivio del browser non disponibile: la scelta vale per questa pagina
  }
  return JSON.parse(raw) as ConsentChoice;
};

/** Cancella dal dominio del sito (e dai domini superiori) i cookie di Google della categoria non piu' concessa. */
const removeCookies = (pattern: RegExp) => {
  const names = document.cookie
    .split(";")
    .map((part) => part.split("=")[0].trim())
    .filter((name) => pattern.test(name));
  if (names.length === 0) return;
  const labels = window.location.hostname.split(".");
  const domains = ["", ...labels.map((_, index) => labels.slice(index).join(".")).filter((domain) => domain.includes("."))];
  for (const name of names) {
    for (const domain of domains) document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=.${domain}` : ""}`;
  }
};

export function initConsent(): void {
  const root = document.documentElement;
  const ids = validTagIds({ ga4Id: root.dataset.ga4, adsId: root.dataset.ads });
  const conversionLabel = root.dataset.adsConversion;
  const banner = document.querySelector<HTMLElement>("[data-cookie-banner]");
  if (!banner || (!ids.ga4Id && !ids.adsId)) return;

  const button = (action: string) => banner.querySelector<HTMLButtonElement>(`[data-consent="${action}"]`);
  let choice = read();
  let started = false;
  const configured = new Set<string>();

  /** Dice a Google cosa e' concesso e carica cio' che serve. Senza consenso, e senza uno script gia' partito, non fa nulla. */
  const apply = () => {
    const tags = googleTagsToLoad(choice, ids);
    if (!started && tags.length === 0) return;
    if (!started) {
      started = true;
      window.dataLayer = window.dataLayer ?? [];
      gtag("consent", "default", DENIED);
      gtag("consent", "update", choice ? gtagConsent(choice) : DENIED);
      gtag("js", new Date());
      const script = document.createElement("script");
      script.async = true;
      script.src = `${GTAG_SRC}${encodeURIComponent(tags[0])}`;
      document.head.append(script);
    } else {
      gtag("consent", "update", choice ? gtagConsent(choice) : DENIED);
    }
    for (const tag of tags) {
      if (configured.has(tag)) continue;
      configured.add(tag);
      gtag("config", tag);
    }
  };

  const close = () => {
    banner.hidden = true;
    document.dispatchEvent(new CustomEvent("tecno:consent"));
  };
  /** Un solo consenso per tutto: accettare vale per statistiche e campagne, rifiutare per entrambe. */
  const decide = (accepted: boolean) => {
    choice = write({ statistics: accepted && Boolean(ids.ga4Id), marketing: accepted && Boolean(ids.adsId) });
    apply();
    // Cio' che non e' concesso non resta nel browser: anche i cookie di un consenso dato in passato e poi scaduto.
    if (!choice.statistics) removeCookies(GOOGLE_COOKIES.statistics);
    if (!choice.marketing) removeCookies(GOOGLE_COOKIES.marketing);
    close();
  };

  button("accept")?.addEventListener("click", () => decide(true));
  button("reject")?.addEventListener("click", () => decide(false));
  // Chiudere senza scegliere vale come rifiuto.
  button("close")?.addEventListener("click", () => decide(false));

  // «Preferenze cookie» nel pie' di pagina: riapre il banner, per cambiare la scelta.
  for (const item of document.querySelectorAll<HTMLElement>("[data-cookie-preferences-item]")) item.hidden = false;
  for (const control of document.querySelectorAll("[data-cookie-preferences]")) {
    control.addEventListener("click", () => {
      banner.hidden = false;
      button("accept")?.focus();
    });
  }

  // Una richiesta inviata dal modulo: contatto per le statistiche, conversione per le campagne. Solo con il consenso.
  document.addEventListener("tecno:lead", () => {
    if (!started || !choice) return;
    if (choice.statistics && ids.ga4Id) gtag("event", "generate_lead");
    if (choice.marketing && ids.adsId && conversionLabel) gtag("event", "conversion", { send_to: `${ids.adsId}/${conversionLabel}` });
  });

  if (choice) apply();
  else banner.hidden = false;
}
