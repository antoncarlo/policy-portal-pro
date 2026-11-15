// Titolo, descrizione, H1 e nome breve di una pagina: dai testi del sito per le pagine fisse, dall'articolo per gli articoli.
import { articleOf } from "./blog";
import { contentFor } from "./content";
import type { PageMeta } from "./content/types";
import { isStaticPageId, type PageRef } from "./routes";

export const metaOf = (page: PageRef): PageMeta => {
  if (isStaticPageId(page.id)) return contentFor(page.lang).meta[page.id];
  const { title, description, h1, label } = articleOf(page.id).content[page.lang];
  return { title, description, h1, label };
};
