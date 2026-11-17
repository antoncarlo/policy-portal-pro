import type { CorpLang } from "../config";
import { en } from "./en";
import { it } from "./it";
import type { CorpContent } from "./types";

export type { CorpContent, PageMeta } from "./types";

const CONTENT: Record<CorpLang, CorpContent> = { it, en };
export const contentFor = (lang: CorpLang): CorpContent => CONTENT[lang];
