-- Nuovo stato "Integrazioni richieste": la compagnia chiede documenti o chiarimenti prima di deliberare.
-- Aggiunta pura: gli stati esistenti non cambiano. Il valore non puo' essere usato nella stessa
-- transazione che lo crea, per questo sta in una migrazione a parte.

alter type public.practice_status add value if not exists 'integrazioni';
