// I link interni del sito pubblico.
import { pathOf, type PageRef } from "./routes";

/** Il link a una sezione della homepage: ancora semplice sulla homepage, percorso completo dalle altre pagine. */
export const sectionHref = (page: PageRef, anchor: string): string => (page.id === "home" ? `#${anchor}` : `${pathOf("home", page.lang)}#${anchor}`);
