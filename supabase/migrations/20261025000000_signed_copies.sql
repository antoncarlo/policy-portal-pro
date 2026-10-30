-- Copie firmate e copie della polizza (flusso VIES).
--
-- Ordine delle firme, dopo la deliberazione: la polizza nella copia per la Compagnia
-- (document_type polizza_copia_compagnia, inviata dalla compagnia con la bozza o allegata
-- dall'ufficio), poi privacy, MUP e questionario antiriciclaggio. La bozza (bozza_deliberata)
-- si controlla, non si firma. Con tutte le copie firmate caricate, il portale le trasmette al
-- portale della compagnia (evento practice.signed) e ne registra qui il momento; la compagnia
-- restituisce le copie della polizza emessa (polizza_emessa, anche piu' file).

alter table public.practice_workflow
  add column if not exists signed_sent_at timestamptz;

comment on column public.practice_workflow.signed_sent_at is
  'Quando le copie firmate (polizza per la Compagnia, privacy, MUP, antiriciclaggio) sono state trasmesse alla compagnia; null finche'' manca una firma. Azzerato alla riapertura.';

comment on column public.practice_documents.document_type is
  'Slot documentale della pratica: documenti obbligatori (es. visura_camerale), bozza della compagnia (bozza_deliberata, si controlla), polizza nella copia per la Compagnia da firmare (polizza_copia_compagnia), copie della polizza emessa (polizza_emessa), modulo di polizza precompilato per la compagnia (modulo_polizza_vies) e copie firmate (polizza_firmata, privacy_firmata, mup_firmato, antiriciclaggio_firmato).';
