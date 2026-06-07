# Note operative Annex III VIES

## Requisiti utente confermati

Le pratiche VIES devono essere create come pratiche di tipo `fidejussioni`. L’importo garantito è sempre fisso a **€ 50.000,00**. La durata è sempre fissa a **36 mesi** per tutte le pratiche. L’oggetto/causale della garanzia è sempre: **POLIZZA FIDEIUSSORIA AI SENSI DELL’ART. 35, COMMA 7-QUATER, DEL DPR 633/1972.**

## Campi da compilare automaticamente nell’Annex III

Dal fac-simile `AnnexIII-Fac-SimileVIESGuarantee(3).pdf` e dall’esempio `VIES1pdf.pdf` emergono questi campi operativi da alimentare dai dati Excel/pratica:

| Area | Campo Annex III | Fonte prevista |
|---|---|---|
| Contraente | Ragione sociale / nome contraente | `contraente` da Excel VIES |
| Contraente | C.F./P.IVA / National Tax Reference Number | `partitaIvaContraente` da Excel VIES |
| Domicilio | Comune, via/piazza, numero | `indirizzoRappresentanteFiscale` da Excel VIES, da normalizzare/segmentare se possibile |
| Rappresentante fiscale | Denominazione rappresentante fiscale | Da Excel se presente nel campo indirizzo o da valore configurato futuro |
| Rappresentante fiscale | Codice fiscale rappresentante fiscale | Da Excel se presente o da configurazione futura |
| Beneficiario | Agenzia delle Entrate / Direzione Provinciale competente | `beneficiario` da Excel VIES |
| Beneficiario | Indirizzo beneficiario | `indirizzoBeneficiario` da Excel VIES |
| Garanzia | Importo massimo | costante `€ 50.000,00` |
| Garanzia | Oggetto/causale | costante standard utente |
| Garanzia | Durata | costante `36 mesi`; decorrenza dal giorno del caricamento batch e scadenza calcolata a 3 anni dalla decorrenza |
| Compagnia/Società/Banca | Dati garante/compagnia | Da lasciare in bianco secondo richiesta utente |

## Implicazioni applicative

La creazione batch non deve fermarsi alla coda `vies_jobs`: deve materializzare record in `practices`, così l’utente possa entrare nella sezione pratiche, filtrare per `fidejussioni`/VIES e aprire ogni scheda per controllare contraente, beneficiario, importo, oggetto, decorrenza dal giorno di caricamento, scadenza a 3 anni, durata fissa di 36 mesi e allegati. I job VIES devono conservare un riferimento alla pratica creata per permettere navigazione e controllo incrociato.

## Implementazione predisposta nella pratica

La materializzazione batch salva ogni riga Excel VIES come pratica consultabile di tipo `fidejussioni`, collegando il job VIES alla pratica tramite `external_reference`. I campi standard vengono impostati direttamente in fase di caricamento: `valore_merce` pari a `50000`, `garanzia_richiesta` pari a `true`, `oggetto_assicurazione` con la causale standard, `durata_polizza_mesi` pari a `36`, `data_decorrenza` pari alla data locale del caricamento e `data_scadenza` pari alla stessa data più tre anni. Le note della pratica conservano inoltre un blocco operativo “Dati VIES / Annex III” con contraente, partita IVA, beneficiario, indirizzi e importo, così gli agent dispongono di un riepilogo leggibile per la compilazione automatica del modello.

La parte relativa a compagnia, banca o garante resta intenzionalmente non compilata, in linea con la richiesta utente e con il fac-simile allegato. Se in futuro verrà introdotta una generazione documentale PDF/DOCX dell’Annex III, questa sezione dovrà usare il record `practices` come fonte primaria e il documento originario VIES collegato come evidenza secondaria.

## Visibilità nel dettaglio pratica

La pagina di dettaglio delle pratiche di tipo `fidejussioni` mostra un riquadro dedicato **Riepilogo VIES / rischio fideiussorio**. Il riquadro espone importo garantito, durata, contraente, partita IVA, beneficiario, oggetto della garanzia e l’indicazione che la sezione compagnia/garante dell’Annex III deve restare in bianco. Questo consente il controllo puntuale della singola pratica generata dal caricamento massivo prima della produzione documentale automatica.
