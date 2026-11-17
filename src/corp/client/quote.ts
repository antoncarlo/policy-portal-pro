// Il modulo di richiesta preventivo del sito aziendale. Le regole sono le stesse del server (api/_lib/
// contact-requests.ts, tenute uguali da tests/corp/quote.test.ts): nome, email, messaggio e consenso obbligatori;
// societa', telefono e prodotto facoltativi. La richiesta parte verso il portale, che la salva e la inoltra.
import { bindLeadForm } from "../../site-kit/client/lead-form";

export interface QuoteValues {
  name: string;
  company: string;
  email: string;
  phone: string;
  /** Uno dei prodotti del sito, «altro», oppure vuoto. */
  product: string;
  message: string;
  consent: boolean;
}
export type QuoteField = "name" | "email" | "message" | "consent";
export type QuoteProblem = "required" | "email" | "message" | "consent";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MESSAGE_MIN = 10;
const oneLine = (value: string) => value.replace(/\s+/g, " ").trim();

/** Campo per campo, che cosa manca o non va: un oggetto vuoto se la richiesta puo' partire. */
export const quoteProblems = (values: QuoteValues): Partial<Record<QuoteField, QuoteProblem>> => {
  const problems: Partial<Record<QuoteField, QuoteProblem>> = {};
  if (!oneLine(values.name)) problems.name = "required";
  const email = oneLine(values.email);
  if (!email) problems.email = "required";
  else if (!EMAIL_PATTERN.test(email)) problems.email = "email";
  const message = values.message.trim();
  if (!message) problems.message = "required";
  else if (message.length < MESSAGE_MIN) problems.message = "message";
  if (!values.consent) problems.consent = "consent";
  return problems;
};

/** Il corpo della richiesta: i valori ripuliti, il sito, la lingua e la pagina, il campo trappola e il tempo impiegato. */
export const quotePayload = (values: QuoteValues, extra: { lang: string; page: string; website: string; elapsedMs: number }) => ({
  site: "corporate" as const,
  product: values.product,
  name: oneLine(values.name),
  company: oneLine(values.company),
  email: oneLine(values.email),
  phone: oneLine(values.phone),
  message: values.message.trim(),
  consent: values.consent,
  lang: extra.lang,
  page: extra.page,
  website: extra.website,
  elapsedMs: Math.round(extra.elapsedMs),
});

export function initQuoteForm(): void {
  const form = document.querySelector<HTMLFormElement>("form[data-quote-form]");
  if (!form) return;
  bindLeadForm<QuoteValues, QuoteProblem>(form, {
    read: ({ text, checked }) => ({ name: text("name"), company: text("company"), email: text("email"), phone: text("phone"), product: text("product"), message: text("message"), consent: checked("consent") }),
    problems: quoteProblems,
    payload: (values, extra) => quotePayload(values, { ...extra, lang: document.documentElement.lang.toLowerCase().startsWith("en") ? "en" : "it", page: window.location.pathname }),
    refused: (field) => (field === "consent" ? "consent" : field === "email" ? "email" : field === "message" ? "message" : "required"),
  });

  // «Chiedi un preventivo» nel riquadro di un prodotto porta al modulo con quel prodotto gia' scelto.
  const product = form.elements.namedItem("product") as HTMLSelectElement | null;
  document.addEventListener("click", (event) => {
    const link = (event.target as Element | null)?.closest<HTMLElement>("[data-quote-product]");
    const wanted = link?.dataset.quoteProduct;
    if (!product || !wanted || ![...product.options].some((option) => option.value === wanted)) return;
    product.value = wanted;
  });
}
