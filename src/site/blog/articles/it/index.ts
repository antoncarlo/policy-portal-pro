// Gli articoli pubblicati in questa lingua, per id. Un articolo compare nel sito quando esiste in tutte e tre le lingue.
import type { Article, ArticleId } from "../../types";
import { garanziaVies } from "./garanzia-vies";
import { formeGaranzia } from "./forme-garanzia";
import { documenti } from "./documenti";
import { richiestaPolizza } from "./richiesta-polizza";

export const articles: Partial<Record<ArticleId, Article>> = {
  "garanzia-vies": garanziaVies,
  "forme-garanzia": formeGaranzia,
  "documenti": documenti,
  "richiesta-polizza": richiestaPolizza,
};
