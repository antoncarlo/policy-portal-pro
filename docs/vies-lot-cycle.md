# Ciclo del lotto VIES

*Dalla bozza della compagnia alle polizze emesse: chi fa cosa, in che ordine, e dove resta la traccia. Il pannello «Ciclo del lotto» sta in Pratiche, aprendo un lotto.*

## SECTION 01 — I passaggi

| # | Passaggio | Chi agisce | Cosa succede |
|---|---|---|---|
| 1 | **Bozze** | amministratore | «Delibera e carica le bozze»: un PDF per pratica o uno ZIP con tutte. Il portale assegna ogni file alla pratica (numero pratica, numero di polizza o nome del cliente), l'amministratore corregge se serve. Le pratiche non ancora deliberate vengono deliberate con la bozza (data di pagamento e nota facoltative). |
| 2 | **Verifica** | rappresentante fiscale | «Scarica bozze e MUP (ZIP)»: una cartella per pratica con la bozza (da controllare, non si firma) e il MUP compilato. Poi «Ho verificato le bozze»: conferma con dichiarazione, registrata con nome e data. |
| 3 | **Pagamento** | rappresentante fiscale | «Scarica l'estratto conto» (polizze deliberate e totale premi da pagare), lo paga con il saldo, lo firma (PDF o .p7m) e allega estratto firmato e bonifico. |
| 4 | **Conferma** | amministratore | Controlla i documenti, indica la data e conferma l'incasso: tutte le pratiche deliberate passano a «Pagate · in emissione» e il lotto risulta pagato. |
| 5 | **Copie** | amministratore | «Carica polizze copia Compagnia»: PDF o ZIP, assegnati alle pratiche come le bozze. Il numero di polizza si registra nella pratica. |
| 6 | **Firme** | rappresentante fiscale | Scarica lo ZIP (per pratica: polizza copia Compagnia e MUP unico, compilati; alla base l'Excel di ricapitolo del lotto), firma in blocco e ricarica lo ZIP firmato (PDF o .p7m): il portale smista i file nelle pratiche. |
| 7 | **Invio** | amministratore | Scarica il lotto con tutte le firme, lo invia alla compagnia e lo segna («Segna inviato alla compagnia», con un riferimento facoltativo). |
| 8 | **Emesse** | amministratore | La compagnia manda le polizze emesse (fino a 4 copie per pratica): «Carica polizze emesse», PDF o ZIP. Le pratiche passano a «Emesse», il lotto si chiude e il rappresentante scarica tutto. |

Il pannello mostra i passaggi (fatto, in corso, da fare), chi deve agire e i pulsanti del passaggio in corso: ognuno vede solo quelli suoi (l'amministratore può fare anche i passaggi del rappresentante). Nel menu Pratiche un punto ambra indica i lotti che aspettano chi guarda. Le pratiche non ancora deliberate aspettano la delibera e seguono il ciclo dopo.

Nuove bozze caricate prima del pagamento annullano la conferma di verifica: il rappresentante la ripete.

## SECTION 02 — La traccia

Ogni passaggio lascia una riga in tre posti:

- **Registro del lotto** (`vies_lot_events`): chi, quando, cosa e con quali numeri (file collegati, non riconosciuti, falliti). Non si modifica né si cancella (trigger del database). Si legge dal pannello, «Mostra il registro».
- **Storico di ogni pratica** (`practice_events`): bozza allegata, bozza verificata e confermata, pagamento registrato, copie inviate alla compagnia…
- **Registro di audit** (`audit_log`): azione `lot.<passaggio>` con l'utente e i dettagli.

Documenti del lotto che non appartengono a una pratica (estratto conto firmato, bonifico): tabella `vies_lot_documents`, archivio privato `vies-lot-documents`, cartella = id del lotto.

## SECTION 03 — Avvisi e-mail

Solo agli indirizzi di comunicazione scelti dall'utente (Impostazioni › Preferenze, massimo 3; senza indirizzi, l'e-mail di accesso). **Un solo avviso per passaggio, mai uno per pratica**: le operazioni fatte per un lotto intero (`quiet`) chiudono le e-mail che il database mette in coda per ogni pratica.

| Quando | A chi |
|---|---|
| bozze caricate | rappresentante fiscale |
| pagamento confermato | rappresentante fiscale |
| copie per la compagnia caricate (documenti da firmare disponibili) | rappresentante fiscale |
| polizze emesse caricate (lotto chiuso) | rappresentante fiscale |

Gli amministratori non ricevono e-mail per questi passaggi: vedono nel menu e nel pannello cosa li aspetta (conferma delle bozze, pagamento inviato, firme complete).

## SECTION 04 — Azioni del server

`POST /api/vies-control` con l'utente collegato. Passaggi del lotto: `lot_record_step` (bozze, copie, emesse; amministratore), `lot_confirm_drafts` (rappresentante o amministratore), `lot_submit_payment` (rappresentante o amministratore), `lot_confirm_payment` (amministratore), `lot_mark_sent` (amministratore), `lot_silence_events` (dopo un caricamento in blocco). Per le pratiche: `workflow_attach_document` (amministratore: bozza, copia per la compagnia, copia emessa, senza cambiare sezione), `workflow_set_policy_number`. I passaggi controllano l'ordine (si può forzare solo da amministratore, `force: true`) e non si ripetono due volte.

I file grandi non passano dal server (limite di 4,5 MB per richiesta): il browser li salva nell'archivio e il server li controlla (PDF, ZIP, JPEG, PNG; massimo 12 MB, intestazione coerente).
