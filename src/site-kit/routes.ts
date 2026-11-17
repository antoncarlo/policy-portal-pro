// Dalle pagine di un sito ai loro percorsi per lingua, e ritorno. Ogni percorso finisce con la barra.
import type { PageRef, SiteDefinition } from "./types";

/** Il percorso come lo scrive `pathOf`: una sola barra iniziale, barra finale, senza query ne' ancora. */
export const normalizePath = (path: string): string => {
  const clean = `/${path.split(/[?#]/)[0].replace(/^\/+|\/+$/g, "")}`;
  return clean === "/" ? "/" : `${clean}/`;
};

export interface Routes<Id extends string, L extends string> {
  pathOf: (id: Id, lang: L) => string;
  listPages: () => Array<PageRef<Id, L>>;
  findPage: (path: string) => PageRef<Id, L> | null;
}

/** `slugs` da' a ogni pagina il tratto di percorso dopo la lingua: vuoto per la homepage. */
export const createRoutes = <L extends string, Id extends string>(def: SiteDefinition<L>, slugs: Record<Id, Record<L, string>>): Routes<Id, L> => {
  const ids = Object.keys(slugs) as Id[];
  const pathOf = (id: Id, lang: L): string => {
    if (!Object.prototype.hasOwnProperty.call(slugs, id)) throw new Error(`${def.id}: nessuna pagina «${id}»`);
    const slug = slugs[id][lang];
    return `${def.langPrefix[lang]}/${slug ? `${slug}/` : ""}`;
  };
  const listPages = () => ids.flatMap((id) => def.langs.map((lang) => ({ id, lang, path: pathOf(id, lang) })));
  const findPage = (path: string) => {
    const wanted = normalizePath(path);
    return listPages().find((page) => page.path === wanted) ?? null;
  };
  return { pathOf, listPages, findPage };
};
