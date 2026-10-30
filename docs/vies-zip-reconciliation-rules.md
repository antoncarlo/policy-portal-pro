# Regole di riconciliazione VIES Excel-ZIP

Il flusso VIES deve trattare il file Excel come fonte primaria delle pratiche da generare. Ogni riga utile dell’Excel rappresenta un nominativo e deve contenere un identificativo nel campo `NOME ZIP`. Questo valore è la chiave operativa che collega la riga al file ZIP del nominativo. Ad esempio, se la riga Excel contiene `NOME ZIP = 1`, il sistema deve cercare un file caricato con nome base `1`, quindi `1.zip`, e deve associare alla pratica generata soltanto i documenti contenuti in quello ZIP.

La riconciliazione deve essere bloccante quando manca il valore `NOME ZIP`, quando non viene caricato lo ZIP corrispondente, oppure quando più ZIP caricati hanno la stessa chiave normalizzata. Il sistema deve inoltre segnalare ZIP caricati ma non richiamati da nessuna riga Excel, perché questi file possono indicare un errore di selezione o un nominativo non presente nel tracciato.

La normalizzazione della chiave ZIP deve essere prudente. Il sistema deve rimuovere l’estensione `.zip`, spazi iniziali e finali, accenti e caratteri non alfanumerici ridondanti, mantenendo però il significato operativo del valore. In questo modo `1`, `1.zip` e ` 1 ` coincidono, così come `CNTBA03717`, `cntba03717.zip` e ` CnTbA03717 `, mentre chiavi diverse restano distinte. Il valore può essere un numero, un codice cliente o una sigla (lettere e cifre, al massimo 80 caratteri): le maiuscole non contano, né nella pagina VIES né nel controllo finale del lotto (`src/lib/viesZipKeys.ts`, usato da entrambi). Un unico ZIP con tutto il lotto viene diviso nelle pratiche quando contiene uno ZIP o una cartella per riga, chiamati come la colonna ZIP; senza Excel caricato si riconoscono solo i numeri da 1 a 20, e se l'Excel arriva dopo gli ZIP la divisione viene rifatta.

Ogni pratica fideiussoria generata deve conservare nella sua scheda e nel job VIES il riferimento al campo `NOME ZIP`, il nome del file ZIP caricato e gli errori di riconciliazione, se presenti. Ogni documento indicizzato deve essere collegabile alla riga Excel e alla pratica tramite il numero riga, la chiave ZIP e l’identificativo pratica generata. L’orchestratore deve mettere in coda solo le righe senza errori bloccanti sui dati essenziali e sulla riconciliazione documentale.

| Controllo | Esito valido | Esito bloccante |
|---|---|---|
| Campo `NOME ZIP` in Excel | Valore presente e normalizzabile | Campo vuoto o non leggibile |
| ZIP caricato | Esiste un solo ZIP con la stessa chiave | ZIP mancante o duplicato |
| Documenti nel ZIP | Almeno un documento indicizzato, inclusi eventuali ZIP annidati | ZIP illeggibile o vuoto |
| ZIP extra | Nessuno ZIP fuori tracciato, oppure solo avviso esplicito | Non blocca la creazione delle righe valide, ma deve essere visibile |
| Stato job | `queued` solo se dati e ZIP sono coerenti | `blocked` o `pending_validation` in presenza di errori |

## Excel dei legali rappresentanti

Alla creazione del lotto il portale salva nella cartella del lotto (`<utente>/<lotto>/Legali-rappresentanti-Lotto-N.xlsx`, scaricata con «Scarica tutto il lotto») un Excel separato da quello caricato, per la compagnia: una riga per ogni pratica creata, con i dati anagrafici del legale rappresentante letti dall'agent documentale sui documenti d'identità dello ZIP (carta d'identità cinese, sua traduzione, passaporto). Le carte che il portale riconosce dal testo vengono mandate all'agent solo per questi dati. Il codice fiscale italiano è calcolato con le regole del DM 23/12/1976 per i nati all'estero (Cina: Z210) e non è calcolato per i nati a Hong Kong o Macao; data di nascita e sesso si prendono dal numero della carta cinese solo se la cifra di controllo è valida. Un dato non letto resta vuoto e la nota della riga dice cosa chiedere al cliente. L'Excel non è un controllo: una lettura non riuscita o un salvataggio fallito non bloccano né la pratica né il lotto (`src/lib/legalRepresentatives.ts`).
