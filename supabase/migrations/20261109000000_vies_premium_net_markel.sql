-- Premio delle fideiussioni VIES scomposto come nelle bozze della compagnia (Markel, bozza 1514223 del 9/11/2026):
-- premio netto 1.616,16 + accessori 161,62 + diritti 0,00 = imponibile 1.777,78; + imposte 222,22 = premio finito 2.000,00.
-- Le pratiche VIES create finora avevano il premio netto uguale all'imponibile (1.777,78): si corregge solo il netto,
-- e solo dove il premio e' ancora quello fisso di prima (lordo, imposte, imponibile e netto invariati), cosi' una
-- pratica corretta a mano non viene toccata. Gli accessori si ricavano (imponibile - netto). Il trigger delle provvigioni
-- ricalcola commission_amount sul nuovo netto (al 9/11/2026 le 41 pratiche VIES hanno provvigione 0%: restano a 0).
-- La modifica entra nel registro di audit delle pratiche.

update public.practices
set premium_net = 1616.16
where vies_batch_id is not null
  and premium_gross = 2000
  and premium_taxes = 222.22
  and premium_taxable = 1777.78
  and premium_net = 1777.78;
