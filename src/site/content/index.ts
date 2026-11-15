import type { Lang } from "../config";
import { en } from "./en";
import { it } from "./it";
import type { SiteContent } from "./types";
import { zh } from "./zh";

const CONTENT: Record<Lang, SiteContent> = { it, en, zh };

export const contentFor = (lang: Lang): SiteContent => CONTENT[lang];
export type { PageMeta, SiteContent } from "./types";
