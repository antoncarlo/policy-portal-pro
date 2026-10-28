# Ambiente di prova (sandbox) — kit di collaudo per la compagnia
<!-- footer: Kit di collaudo sandbox · RISERVATO · © Tecno Advance MGA Broker S.r.l. -->

**Versione:** 1.0 · ottobre 2026 · prodotto VIES (fideiussione art. 35, comma 7-quater, DPR 633/1972)

*A chi è rivolto: ai tecnici della compagnia (o del suo fornitore) che collegano il proprio portale di prova al portale Tecno Advance MGA. La prima parte dice dove collegarsi, con quali credenziali, quali servizi esistono e quali prove fare, nell'ordine. La seconda parte è la guida completa al collegamento (messaggi, firme, errori), valida identica per la produzione.*

---

## 0. Proprietà, licenza d'uso e riservatezza

**Leggere prima dell'uso.** Il portale Tecno Advance MGA, comprese la sua versione di prova (`https://tecnosandbox.app`), le interfacce, i flussi di lavoro, la logica applicativa, i modelli di documento, le API e la relativa documentazione, questa guida, i file di prova e il software di prova (simulatore), è di **proprietà esclusiva di Tecno Advance MGA Broker S.r.l.** ed è tutelato dalle norme sul diritto d'autore, sulla protezione del software e dei segreti commerciali.

L'accesso è concesso alla compagnia con una **licenza d'uso limitata, personale, gratuita, non esclusiva, non trasferibile e revocabile**, al **solo scopo del collaudo del collegamento** tra i portali delle due parti. In particolare:

1. **Persone autorizzate.** Credenziali, documentazione e materiale di prova possono essere usati solo dalle persone indicate o approvate per iscritto da Tecno Advance MGA. Non possono essere ceduti, comunicati o resi accessibili a terzi, inclusi fornitori, consulenti o società del gruppo, senza nostra autorizzazione scritta.
2. **Divieto di copia e riproduzione.** È vietato copiare, riprodurre, imitare o ricreare il portale, in tutto o in parte e **in qualsiasi forma**: codice, interfacce, schermate, flussi, logiche, testi, modelli di documento, strutture dei dati.
3. **Divieto di analisi del software.** È vietato decompilare, disassemblare, analizzare, estrarre o tentare di ricostruire il codice, la logica o il funzionamento interno del portale (*reverse engineering*), salvo quanto inderogabilmente consentito dalla legge. Sono vietati anche le prove di sicurezza e i carichi di traffico non concordati.
4. **Uso consentito.** Il materiale serve solo a sviluppare e collaudare il collegamento descritto in questa guida. Il formato dei messaggi qui descritto può essere implementato dalla compagnia nei propri sistemi esclusivamente per collegarsi al portale Tecno Advance MGA.
5. **Riservatezza.** Tutte le informazioni ricevute sono riservate e lo restano anche dopo la fine del collaudo o del rapporto.
6. **Revoca e restituzione.** Tecno Advance MGA può sospendere o revocare gli accessi in qualsiasi momento. Alla revoca, alla fine del collaudo o su richiesta, la compagnia cancella le copie del materiale ricevuto, salvo quanto debba conservare per legge.
7. **Registrazione.** Gli accessi e le chiamate all'ambiente di prova sono registrati.

L'uso delle credenziali vale come accettazione di queste condizioni, che si aggiungono agli eventuali accordi di riservatezza e ai contratti in essere tra le parti.

---

## 1. L'ambiente di prova in breve

La sandbox è una copia completa del portale Tecno: **stesso codice e stesse regole della produzione**, ma con database, utenti, chiavi e segreto di firma propri. Nessun dato della sandbox arriva in produzione e viceversa. Tutti i dati presenti sono fittizi.

| | Sandbox (prova) | Produzione (dopo il collaudo) |
|---|---|---|
| Portale (accesso con utente e password) | `https://tecnosandbox.app` | `https://portale.tecnomga.com` |
| **Dove ci rispondete** (eventi firmati) | `POST https://tecnosandbox.app/api/vies-portal-callback` | `POST https://portale.tecnomga.com/api/vies-portal-callback` |
| Servizi di lettura (statistiche, scadenzario, pratiche) | `https://tecnosandbox.app/api/…` | `https://portale.tecnomga.com/api/…` |
| Documentazione dei servizi di lettura | `https://tecnosandbox.app/api-docs` | `https://portale.tecnomga.com/api-docs` |
| Id del vostro portale (`X-Portal-Id`) | `compagnia-test` | concordato al passaggio in produzione |
| Segreto di firma, chiave API, utente del portale | **nella scheda credenziali della sandbox** (documento separato e riservato) | nuovi, consegnati al passaggio in produzione |

Differenze rispetto alla produzione, da sapere durante le prove:

- **Le e-mail sono spente**: nessun messaggio parte verso persone reali. Le notifiche restano visibili dentro il portale.
- I documenti caricati e restituiti devono essere **fittizi** (nel kit trovate quelli pronti, con la scritta «DOCUMENTO FITTIZIO DI PROVA»).
- Le regole (stati, firme, controlli sui documenti, codici di errore, limiti) sono **le stesse della produzione**: un esito ottenuto in sandbox vale anche in produzione.

---

## 2. Cosa vi consegniamo e cosa ci serve da voi

**Vi consegniamo** (scheda credenziali, a parte):

| Cosa | A cosa serve |
|---|---|
| Id portale `compagnia-test` + **segreto di firma** (64 caratteri esadecimali) | Firmare con HMAC-SHA256 i vostri eventi verso `/api/vies-portal-callback` e verificare la firma dei nostri eventi verso di voi |
| **Chiave API** `tmga_…` | Leggere pratiche, statistiche e scadenzario con l'intestazione `X-API-Key` |
| Utente **rappresentante fiscale di prova** della compagnia | Fare la parte del rappresentante: caricare un lotto (Excel + ZIP), confermare le bozze, caricare il pagamento e le firme |

Al primo accesso il portale chiede di **cambiare la password**. La verifica in due passaggi (app di autenticazione) è facoltativa.

Le operazioni da amministratore (invio dei lotti al vostro portale, conferma dei passaggi del lotto, registro degli scambi) le svolgiamo noi durante il collaudo e vi comunichiamo gli esiti.

**Ci serve da voi** per collegare il vostro ambiente di prova (le prove della sezione 5.1 si possono fare anche prima):

1. L'indirizzo HTTPS **di prova** che riceve le pratiche (`POST` JSON) e, se separato, quello che riceve gli eventi.
2. La **chiave** che quell'indirizzo accetta: la invieremo in `Authorization: Bearer <chiave>`.
3. I **domini** da cui scaricheremo i documenti che ci mandate come link (`documentHosts`), se non sono lo stesso dominio dell'indirizzo di invio.
4. Un contatto tecnico per i giorni del collaudo.

---

## 3. Tutti i servizi (API)

### 3.1 Il ciclo della pratica (collegamento tra i due portali)

| Direzione | Chiamata | Autenticazione | Dettagli |
|---|---|---|---|
| Noi → voi | `POST <vostro indirizzo di invio>` — una pratica per chiamata, con i documenti come link | `Authorization: Bearer <vostra chiave>`, `Idempotency-Key` | Parte 2, §4 |
| Voi → noi | `POST https://tecnosandbox.app/api/vies-portal-callback` — sei eventi: `practice.received`, `practice.info_requested`, `practice.rejected`, `practice.deliberated` (con la bozza), `practice.policy_copy` (copia da firmare `.p7m`), `practice.issued` (le copie della polizza) | `X-Portal-Id: compagnia-test`, `X-Timestamp`, `X-Signature` (HMAC-SHA256) | Parte 2, §5 |
| Noi → voi | `POST <vostro indirizzo eventi>` — `practice.info_provided`, `practice.paid`, `practice.signed`, `practice.reopened`, `practice.test` | `Authorization: Bearer`, `X-Signature` con lo stesso segreto | Parte 2, §6 |

### 3.2 Servizi di lettura (facoltativi: statistiche, scadenzario, stato delle pratiche)

Tutti con l'intestazione `X-API-Key: <chiave API della scheda>`. Limite: **300 chiamate al minuto** per chiave (oltre: `429` con `retry_after`). La chiave della sandbox vede le pratiche create dall'utente *rappresentante fiscale di prova* della compagnia.

| Servizio | Cosa restituisce | Parametri principali |
|---|---|---|
| `GET /api/get-practices` | Elenco delle pratiche, con filtri e paginazione | `status`, `practice_type=vies`, `from`, `to` (AAAA-MM-GG), `search`, `limit` (max 200), `offset`, `include_summary=true` |
| `GET /api/get-practice-status` | Dettaglio di una pratica: stato, sezione, documenti, bozza, copie emesse | `practice_number` oppure `practice_id` |
| `GET /api/get-reports` | Statistiche: totali, distribuzione per stato e tipologia, andamento mensile, KPI | `start_date`, `end_date`, `period` (`week`, `month`, `quarter`, `year`) |
| `GET /api/get-expiries` | Scadenzario delle polizze, con urgenza e avvisi 90/60/30/7 giorni | `days_ahead` (default 90, max 365), `practice_type=vies`, `include_expired=true` |
| `POST /api/add-practice-note` | Aggiunge una nota nella cronologia della pratica | corpo JSON: `practice_number` (o `practice_id`), `message`, `author_name` |

```bash
KEY='tmga_…'   # dalla scheda credenziali
curl -s -H "X-API-Key: $KEY" "https://tecnosandbox.app/api/get-practices?practice_type=vies&limit=20"
curl -s -H "X-API-Key: $KEY" "https://tecnosandbox.app/api/get-practice-status?practice_number=VIES-2026-0001-ab12cd34"
curl -s -H "X-API-Key: $KEY" "https://tecnosandbox.app/api/get-reports?period=month"
curl -s -H "X-API-Key: $KEY" "https://tecnosandbox.app/api/get-expiries?practice_type=vies&days_ahead=365"
curl -s -X POST -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"practice_number":"VIES-2026-0001-ab12cd34","message":"Nota di prova","author_name":"Compagnia"}' \
  https://tecnosandbox.app/api/add-practice-note
```

Risposte: `200`/`201` con `"success": true`; `401` chiave mancante, non valida, disattivata o scaduta; `404` pratica non trovata o non visibile alla chiave; `422` parametri mancanti; `429` troppe richieste.

---

## 4. Il kit di prova

| File | A cosa serve |
|---|---|
| `VIES_Lotto_2_corretto.xlsx` + `VIES_Lotto_2_corretto_ZIP.zip` | Lotto di 20 società fittizie, tutte corrette: è il lotto per la prova generale |
| `VIES_Lotto_1_con_errori.xlsx` + `VIES_Lotto_1_con_errori_ZIP.zip` | Lotto con 4 righe sbagliate che il portale deve bloccare (16 pronte, 4 bloccate) |
| `LEGGIMI_prove_VIES.md` | Cosa contiene ogni file e l'esito atteso del caricamento |
| `documenti-compagnia/bozza_polizza_PROVA.pdf` | La bozza da mandare con `practice.deliberated` |
| `documenti-compagnia/polizza_copia_compagnia_PROVA.pdf.p7m` | La copia di polizza da firmare, busta CAdES valida (firmata con un certificato di prova), da mandare con `practice.policy_copy` |
| `documenti-compagnia/FINTO_non_firmato.pdf.p7m` | Un PDF rinominato `.p7m`: deve essere **rifiutato** (`422 invalid_document`) |
| `documenti-compagnia/polizza_copia1…4_*.pdf` | Le quattro copie della polizza emessa, da mandare con `practice.issued` |
| `vies-portal-simulator.mjs` | Simulatore senza dipendenze (Node 18+): firma e invia i vostri eventi, oppure fa da vostro portale per ricevere i nostri invii e verificarne la firma |

I comandi delle prove usano queste variabili:

```bash
SANDBOX=https://tecnosandbox.app/api/vies-portal-callback
PORTAL=compagnia-test
SECRET='…'        # segreto di firma dalla scheda credenziali
```

---

## 5. Le prove, nell'ordine

### 5.1 Prove che si fanno subito (senza il vostro indirizzo)

| # | Prova | Come | Esito atteso |
|---|---|---|---|
| A1 | Accesso al portale | Entrate su `https://tecnosandbox.app` con l'utente della scheda | Cambio password al primo accesso, poi la dashboard del rappresentante fiscale |
| A2 | Chiave API | `GET /api/get-practices` con `X-API-Key` (§3.2) | `200`, elenco (vuoto finché non c'è un lotto) |
| A3 | Chiave sbagliata | Stessa chiamata con una chiave inventata | `401 API Key non valida.` |
| A4 | Firma corretta | `practice.received` firmato per una pratica inesistente (comando sotto) | `404 practice_not_found`: la firma è stata accettata. Senza `practice.reference` la risposta è `400 invalid_payload` (il riferimento è obbligatorio in `practice.received`) |
| A5 | Firma sbagliata | Lo stesso con un segreto diverso, oppure `X-Timestamp` di 10 minuti fa | `401 unauthorized` (risposta identica in tutti i casi) |
| A6 | Ricezione dei nostri eventi | Avviate il vostro ricevitore (o `simulator receive`) e chiedeteci un `practice.test` | Arriva l'evento con firma verificabile |

```bash
# A4: firma corretta su una pratica che non esiste → 404 practice_not_found
node vies-portal-simulator.mjs callback --url $SANDBOX --portal-id $PORTAL --secret "$SECRET" \
  --event received --practice-number VIES-2026-9999-00000000 --reference PROVA-1
```

### 5.2 Prova generale (con il vostro indirizzo di prova collegato)

Chi fa che cosa nel portale: **RF** = utente rappresentante fiscale di prova della compagnia; **AD** = noi (amministratore Tecno); **voi** = il vostro portale di prova.

| # | Chi | Prova | Esito atteso |
|---|---|---|---|
| 1 | RF | Pagina **VIES**: carica `VIES_Lotto_2_corretto.xlsx` e poi `VIES_Lotto_2_corretto_ZIP.zip`; crea il lotto | 20 righe pronte su 20, lotto creato |
| 2 | AD | Apre il lotto e lo **invia** al portale `compagnia-test` | Voi ricevete una `POST` per pratica (con `documents`, `partita_iva_contraente`, `callback`); rispondete `200` con `external_reference`. Nel nostro registro le consegne risultano riuscite |
| 3 | voi | `practice.received` per ogni pratica, con il vostro riferimento in `practice.reference` | `200`, riferimento registrato, stato invariato |
| 4 | voi | Lo stesso evento con lo stesso `event_id` | `200` con `"duplicate": true` |
| 5 | voi | `practice.info_requested` su una pratica, con `message` | La pratica passa a *Integrazioni richieste* |
| 6 | RF | Risponde alla richiesta caricando un documento | Voi ricevete `practice.info_provided` con i documenti |
| 7 | voi | `practice.rejected` su un'altra pratica, con `reason` | La pratica passa a *Non deliberate* con il motivo |
| 8 | voi | `practice.issued` **prima** del pagamento (prova negativa) | `409 invalid_transition` |
| 9 | voi | `practice.deliberated` con `bozza_polizza_PROVA.pdf` e `payment_due_date` | Pratiche in *Deliberate · da pagare*, bozza allegata |
| 10 | RF + AD | RF conferma le bozze e carica il pagamento; AD conferma l'incasso | Voi ricevete un `practice.paid` per ogni pratica pagata |
| 11 | voi | `practice.policy_copy` con `polizza_copia_compagnia_PROVA.pdf.p7m` e il numero di polizza | `200`, copia allegata, numero registrato, stato invariato |
| 12 | voi | Lo stesso con `FINTO_non_firmato.pdf.p7m` | `422 invalid_document` |
| 13 | RF | Scarica il pacchetto da firmare (copia `.p7m` + MUP unico) e carica i due file firmati | Voi ricevete `practice.signed` con i due documenti firmati |
| 14 | voi | `practice.issued` con le quattro copie della polizza | Pratica *Emessa*, quattro file allegati |
| 15 | voi | Il vostro indirizzo eventi risponde `500` per qualche minuto | Noi ritentiamo dopo 1, 5, 30 minuti…: i tentativi risultano nel nostro registro e si possono ripetere a mano |
| 16 | voi | Servizi di lettura su una pratica del lotto (`get-practice-status`, `get-reports`) | I dati corrispondono a quelli del portale |

Comandi pronti per le prove 3, 5, 7, 9, 11, 12 e 14 (sostituite il numero della pratica con quello ricevuto nella prova 2):

```bash
N=VIES-2026-0001-ab12cd34

# 3. presa in carico
node vies-portal-simulator.mjs callback --url $SANDBOX --portal-id $PORTAL --secret "$SECRET" \
  --event received --practice-number $N --reference VOSTRO-RIF-1 --event-id evt-$N-received

# 5. richiesta di integrazioni
node vies-portal-simulator.mjs callback --url $SANDBOX --portal-id $PORTAL --secret "$SECRET" \
  --event info_requested --practice-number $N --note "Manca la traduzione dello statuto"

# 7. rifiuto (su un'altra pratica)
node vies-portal-simulator.mjs callback --url $SANDBOX --portal-id $PORTAL --secret "$SECRET" \
  --event rejected --practice-number VIES-2026-0002-… --reason "Rischio non assumibile (prova)"

# 9. delibera con la bozza
node vies-portal-simulator.mjs callback --url $SANDBOX --portal-id $PORTAL --secret "$SECRET" \
  --event deliberated --practice-number $N --due 2026-12-31 --note "Premio confermato" \
  --pdf documenti-compagnia/bozza_polizza_PROVA.pdf

# 11. copia di polizza da firmare (.p7m), dopo il pagamento
node vies-portal-simulator.mjs callback --url $SANDBOX --portal-id $PORTAL --secret "$SECRET" \
  --event policy_copy --practice-number $N --policy-number POL-TEST-000001 \
  --policy-copy documenti-compagnia/polizza_copia_compagnia_PROVA.pdf.p7m

# 12. stesso evento con un falso .p7m → 422
node vies-portal-simulator.mjs callback --url $SANDBOX --portal-id $PORTAL --secret "$SECRET" \
  --event policy_copy --practice-number $N --policy-number POL-TEST-000001 \
  --policy-copy documenti-compagnia/FINTO_non_firmato.pdf.p7m

# 14. emissione con le quattro copie
node vies-portal-simulator.mjs callback --url $SANDBOX --portal-id $PORTAL --secret "$SECRET" \
  --event issued --practice-number $N --policy-number POL-TEST-000001 \
  --pdf documenti-compagnia/polizza_copia1_contraente_PROVA.pdf --pdf documenti-compagnia/polizza_copia2_beneficiario_PROVA.pdf \
  --pdf documenti-compagnia/polizza_copia3_compagnia_PROVA.pdf --pdf documenti-compagnia/polizza_copia4_intermediario_PROVA.pdf

# Ricevere i nostri invii ed eventi senza il vostro portale (verifica anche la firma)
node vies-portal-simulator.mjs listen  --port 4010 --key LA_VOSTRA_CHIAVE --secret "$SECRET" --portal-id $PORTAL
node vies-portal-simulator.mjs receive --port 4011 --secret "$SECRET" [--fail 500]
```

Il simulatore mostra la richiesta inviata e la risposta del nostro portale: è anche un esempio di codice per la firma. Il vostro portale deve produrre messaggi equivalenti (Parte 2, §5).

### 5.3 Esito del collaudo

Il collaudo è superato quando le prove da 1 a 16 danno l'esito atteso. A quel punto si concordano gli indirizzi e la chiave di produzione, generiamo **nuove** credenziali di produzione (id del portale, segreto di firma, eventuale chiave API) e si fa una prima pratica reale controllata insieme. Le credenziali della sandbox non funzionano in produzione.

---

## 6. Assistenza durante il collaudo

- Ogni scambio è registrato nel nostro portale con esito, codice e motivo dell'errore: su richiesta vi mandiamo l'estratto del registro.
- Per un errore comunicateci: ora (con fuso), `event_id` o numero di pratica, codice di risposta. Non mandate mai il segreto di firma per e-mail.
- Possiamo ripristinare utenti, password e dati della sandbox in qualsiasi momento.

Le condizioni d'uso dell'ambiente di prova e di questo materiale sono nella sezione 0 di questa guida.

*Contatti tecnici Tecno Advance MGA: info@tecnomga.com · PEC tecnoadvancemgabroker@legalmail.it*

---

# Parte 2 — Guida completa al collegamento

*Il testo che segue vale identico per sandbox e produzione. Negli esempi l'indirizzo è quello di produzione (`https://portale.tecnomga.com`) e l'id del portale è `alfa`: in sandbox usate `https://tecnosandbox.app` e `compagnia-test`.*
