// Titolo, descrizione e nome breve di una pagina del sito aziendale, nella sua lingua.
import { contentFor, type PageMeta } from "./content";
import type { CorpPage } from "./routes";

export const metaOf = (page: Pick<CorpPage, "id" | "lang">): PageMeta => contentFor(page.lang).meta[page.id];
