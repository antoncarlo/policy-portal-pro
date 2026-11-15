// Gli articoli pubblicati in questa lingua, per id. Un articolo compare nel sito quando esiste in tutte e tre le lingue.
import type { Article, ArticleId } from "../../types";
import { documenti } from "./documenti";
import { firmaP7m } from "./firma-p7m";
import { formeGaranzia } from "./forme-garanzia";
import { garanziaRappresentante } from "./garanzia-rappresentante";
import { garanziaVies } from "./garanzia-vies";
import { lottoPratiche } from "./lotto-pratiche";
import { richiestaPolizza } from "./richiesta-polizza";
import { venditoriMarketplace } from "./venditori-marketplace";

export const articles: Partial<Record<ArticleId, Article>> = {
  "garanzia-vies": garanziaVies,
  "forme-garanzia": formeGaranzia,
  "documenti": documenti,
  "richiesta-polizza": richiestaPolizza,
  "lotto-pratiche": lottoPratiche,
  "firma-p7m": firmaP7m,
  "garanzia-rappresentante": garanziaRappresentante,
  "venditori-marketplace": venditoriMarketplace,
};
