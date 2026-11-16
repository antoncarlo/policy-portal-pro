// Dove porta una voce che punta a una sezione della homepage: in homepage e' un'ancora, altrove torna alla homepage.
import type { HomeAnchor } from "./content/types";
import { pathOf, type CorpPage } from "./routes";

export const sectionHref = (page: Pick<CorpPage, "id" | "lang">, anchor: HomeAnchor): string => (page.id === "home" ? `#${anchor}` : `${pathOf("home", page.lang)}#${anchor}`);
