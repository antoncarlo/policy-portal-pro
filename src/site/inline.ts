// I collegamenti scritti dentro un testo degli articoli e delle pagine per pubblico: «[testo](bersaglio)».
// Bersagli ammessi: «article:<id>», «page:<id>», «section:<ancora della homepage>», oppure un indirizzo https.
// Un bersaglio che non esiste non diventa un link: `resolveTarget` risponde null e i test lo segnalano.
import { findArticle } from "./blog";
import type { Lang } from "./config";
import { ANCHORS } from "./content/types";
import { isStaticPageId, pathOf } from "./routes";

export interface InlineLink {
  label: string;
  target: string;
}

const LINK = /\[([^\]\n]+)\]\(([^()\s]+)\)/g;

export const parseInline = (text: string): Array<string | InlineLink> => {
  const parts: Array<string | InlineLink> = [];
  let last = 0;
  for (const match of text.matchAll(LINK)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(text.slice(last, index));
    parts.push({ label: match[1], target: match[2] });
    last = index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
};

export const resolveTarget = (target: string, lang: Lang): { href: string; external: boolean } | null => {
  const [kind, ...rest] = target.split(":");
  const value = rest.join(":");
  if (kind === "article") return findArticle(value) ? { href: pathOf(findArticle(value)!.id, lang), external: false } : null;
  if (kind === "page") return isStaticPageId(value) ? { href: pathOf(value, lang), external: false } : null;
  if (kind === "section") return (ANCHORS as readonly string[]).includes(value) ? { href: `${pathOf("home", lang)}#${value}`, external: false } : null;
  if (/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(target)) return { href: target, external: true };
  return null;
};

/** Il testo senza la sintassi dei collegamenti: per il feed, i dati strutturati e i conteggi. */
export const plainText = (text: string): string =>
  parseInline(text)
    .map((part) => (typeof part === "string" ? part : part.label))
    .join("");
