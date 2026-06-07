# Regole di riconciliazione VIES Excel-ZIP

Il flusso VIES deve trattare il file Excel come fonte primaria delle pratiche da generare. Ogni riga utile dell’Excel rappresenta un nominativo e deve contenere un identificativo nel campo `NOME ZIP`. Questo valore è la chiave operativa che collega la riga al file ZIP del nominativo. Ad esempio, se la riga Excel contiene `NOME ZIP = 1`, il sistema deve cercare un file caricato con nome base `1`, quindi `1.zip`, e deve associare alla pratica generata soltanto i documenti contenuti in quello ZIP.

La riconciliazione deve essere bloccante quando manca il valore `NOME ZIP`, quando non viene caricato lo ZIP corrispondente, oppure quando più ZIP caricati hanno la stessa chiave normalizzata. Il sistema deve inoltre segnalare ZIP caricati ma non richiamati da nessuna riga Excel, perché questi file possono indicare un errore di selezione o un nominativo non presente nel tracciato.

La normalizzazione della chiave ZIP deve essere prudente. Il sistema deve rimuovere l’estensione `.zip`, spazi iniziali e finali, accenti e caratteri non alfanumerici ridondanti, mantenendo però il significato operativo del valore. In questo modo `1`, `1.zip` e ` 1 ` coincidono, mentre chiavi diverse restano distinte.

Ogni pratica fideiussoria generata deve conservare nella sua scheda e nel job VIES il riferimento al campo `NOME ZIP`, il nome del file ZIP caricato e gli errori di riconciliazione, se presenti. Ogni documento indicizzato deve essere collegabile alla riga Excel e alla pratica tramite il numero riga, la chiave ZIP e l’identificativo pratica generata. L’orchestratore deve mettere in coda solo le righe senza errori bloccanti sui dati essenziali e sulla riconciliazione documentale.

| Controllo | Esito valido | Esito bloccante |
|---|---|---|
| Campo `NOME ZIP` in Excel | Valore presente e normalizzabile | Campo vuoto o non leggibile |
| ZIP caricato | Esiste un solo ZIP con la stessa chiave | ZIP mancante o duplicato |
| Documenti nel ZIP | Almeno un documento indicizzato, inclusi eventuali ZIP annidati | ZIP illeggibile o vuoto |
| ZIP extra | Nessuno ZIP fuori tracciato, oppure solo avviso esplicito | Non blocca la creazione delle righe valide, ma deve essere visibile |
| Stato job | `queued` solo se dati e ZIP sono coerenti | `blocked` o `pending_validation` in presenza di errori |
