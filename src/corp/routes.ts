// Le pagine del sito aziendale e i loro percorsi per lingua.
import { createRoutes } from "../site-kit/routes";
import type { PageRef } from "../site-kit/types";
import { CORP, type CorpLang } from "./config";

export type CorpPageId = "home" | "privacy" | "cookie";
export type CorpPageKind = "home" | "legal";
export type CorpPage = PageRef<CorpPageId, CorpLang>;

/** Il tratto del percorso dopo la lingua: vuoto per la homepage. */
const SLUGS: Record<CorpPageId, Record<CorpLang, string>> = {
  home: { it: "", en: "" },
  privacy: { it: "privacy", en: "privacy" },
  cookie: { it: "cookie", en: "cookie" },
};

const KINDS: Record<CorpPageId, CorpPageKind> = { home: "home", privacy: "legal", cookie: "legal" };
export const pageKind = (id: CorpPageId): CorpPageKind => KINDS[id];

export const { pathOf, listPages, findPage } = createRoutes(CORP, SLUGS);
