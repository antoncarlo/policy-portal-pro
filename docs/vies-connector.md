# Connettore del flusso pratiche — portali esterni e portale della compagnia

*Come il portale riceve lotti da altri portali, li lavora, li invia al portale collegato alla compagnia e riceve indietro bozze deliberate, richieste di integrazioni, rifiuti ed emissioni.*

## SECTION 01 — Il flusso

Ogni pratica, di qualsiasi tipologia, passa da sette sezioni. Non c'è una colonna nuova: la sezione deriva da **stato** e **stato di incasso** della pratica (`src/lib/practiceStages.ts`).

| Sezione | Stato della pratica | Significato |
|---|---|---|
| Da lavorare | `in_lavorazione` | Caricata o ricevuta: da verificare e inviare |
| In valutazione | `in_attesa` | Inviata alla compagnia: si attende la deliberazione |
| Integrazioni richieste | `integrazioni` | La compagnia chiede documenti o chiarimenti |
| Deliberate · da pagare | `approvata`, non incassata | Bozza pronta, pagamento entro la scadenza indicata |
| Pagate · in emissione | `approvata`, incassata | Pagamento registrato, polizza in emissione |
| Emesse | `completata` | Polizza emessa |
| Non deliberate | `rifiutata` | La compagnia non ha deliberato |

Chi vede cosa: ogni utente vede le **proprie** pratiche in ogni sezione, l'amministratore vede tutto e le sposta. Se nessun portale è collegato, l'amministratore registra le risposte della compagnia a mano dalla sezione *Valutazione pratica* del dettaglio pratica: il flusso è lo stesso.

Passaggi consentiti (le altre richieste ricevono 409 `invalid_transition`; solo l'amministratore può forzarle):

```
da lavorare ──inviata──▶ in valutazione ──deliberata──▶ deliberata ──pagamento──▶ pagata ──emissione──▶ emessa
                          │      ▲                          │
                richiesta │      │ integrazioni             └──non deliberata──▶ non deliberata
                          ▼      │ inviate
                      integrazioni richieste ──deliberata / non deliberata──▶ …
```

Una pratica **già pagata non può essere rifiutata** né rideliberata; l'emissione richiede il pagamento.

## SECTION 02 — Collegamenti in entrata e in uscita

Il portale parla in **entrambe le direzioni** con i due tipi di controparte: le compagnie di assicurazione e i rappresentanti fiscali (o altri portali) che caricano lotti.

| | In entrata (verso questo portale) | In uscita (da questo portale) |
|---|---|---|
| **Compagnia** | Risposte firmate: presa in carico, integrazioni, deliberata con bozza, non deliberata, emessa (`POST /api/vies-portal-callback`) | Invio delle pratiche con documenti; eventi: pagamento registrato, integrazioni inviate, pratica riaperta |
| **Rappresentante fiscale / portale sorgente** | Lotti: Excel, ZIP, visura (`POST /api/vies-intake`, `X-API-Key`) | Notifiche firmate (lotto elaborato o rifiutato, ogni passaggio delle pratiche, bozza e polizza come link) e lettura dello stato (`GET /api/vies-intake-status`, `GET /api/get-practice-status`, `GET /api/get-practice-documents`) |

Gli indirizzi di questo portale sono in **Impostazioni → Connessioni**, con lo stato di ogni portale configurato, l'indirizzo di notifica di ogni chiave API (con prova di invio), il registro degli ultimi scambi in entrata e quello delle consegne in uscita, con l'esito e il motivo di ogni errore.

### 2.1 Lotti in ingresso (altri portali → questo portale)

Documentati nella pagina pubblica `/api-docs` (sezione 8). In sintesi: `create_lot` annuncia i file (un Excel, uno ZIP per azienda, facoltativa la visura) e restituisce indirizzi di caricamento firmati, validi due ore; i file vanno caricati con `PUT`; `complete_lot` verifica che ogni file sia arrivato per intero e chiude il lotto come **ricevuto**. Il lotto compare nella pagina VIES in *Lotti ricevuti da altri portali*: l'amministratore preme **Carica nel flusso**, i file passano dagli stessi lettori del caricamento a mano (controllo documenti, verifica finale), crea le pratiche e il lotto diventa **elaborato**. Le pratiche registrano il portale e il riferimento di provenienza; il portale mittente legge lo stato con `GET /api/vies-intake-status`.

La chiave API deve essere associata a un utente (*Impostazioni → Mappatura API*): i lotti appartengono a quell'utente. Una chiave non associata riceve 403 `key_not_mapped`.

**Bozza e documenti da firmare.** La creazione del lotto **non genera nessun documento di polizza**: un eventuale modulo `modulo_polizza_vies` (pratiche create prima, o generato a mano da un amministratore) e' interno, lo vedono solo gli amministratori e non compare mai al rappresentante fiscale, ne' nel portale ne' nelle API. Fino alla deliberazione la pratica non ha nessuna bozza: la scheda *Valutazione pratica* mostra «Documenti ricevuti, in attesa della deliberazione» e la sezione *Documenti da firmare* dice che le firme iniziano dopo la deliberazione. Alla deliberazione arrivano la bozza (`bozza_deliberata`, **si controlla, non si firma**) e la polizza nella copia per la Compagnia (`polizza_copia_compagnia`, inviata dalla compagnia con `data.policy_copy` o allegata dall'ufficio); la scheda mostra «Bozza ricevuta il …» con i passi successivi. Le firme, **in quest'ordine**: 1) polizza nella copia per la Compagnia, 2) **MUP unico**. Il MUP unico (MUP, incarico di consulenza, raccomandazione, dichiarazione di consegna, informativa privacy e questionario antiriciclaggio, con il testo predisposto dal rappresentante fiscale) è un modello del portale su carta intestata Tecno Advance MGA (`public/modelli-firma/mup.pdf`, generato da `scripts/signing-templates/build.mjs`): a ogni download si compila con i dati della pratica, il resto lo completa chi firma. Per la parte antiriciclaggio il pulsante *Leggi i documenti* fa leggere dall'agente `vies-aml-agent` licenza commerciale, documento del legale rappresentante e UBO dello ZIP della pratica; il risultato (`practice_aml_data`) e' una bozza da verificare che finisce nel questionario. Il **numero di polizza della compagnia** arriva dopo la delibera, con la copia per la Compagnia: lo registra l'amministratore nella sezione *Documenti da firmare* (azione `workflow_set_policy_number`) oppure la compagnia lo manda in `data.policy_number` di una nuova `practice.deliberated` (o di `practice.issued`); un numero gia' registrato non viene sovrascritto. Le copie firmate finiscono nella pratica con `document_type` `polizza_firmata` e `mup_firmato` (le copie di privacy e antiriciclaggio caricate prima del MUP unico restano nella pratica ma non servono più). Con le due firme caricate il portale **trasmette da solo le copie firmate alla compagnia** (`practice.signed`, con i link; `practice_workflow.signed_sent_at`); la compagnia emette e restituisce **tutte le copie della polizza** con `practice.issued` (`data.documents`, ognuna allegata come `polizza_emessa`). Dalla pagina Pratiche, per lotto: «Scarica documenti da firmare (ZIP)» (una cartella per pratica deliberata, file numerati nell'ordine di firma) e «Carica documenti firmati (ZIP)» (ogni file va nella pratica della sua cartella, tipo riconosciuto dal nome; le pratiche complete vengono trasmesse). Le API: `get-practice-status` restituisce `draft`, `company_copy`, `documents_to_sign` (con `order` e `source_received`), `signatures_complete`, `signed_copies_sent_at` e `issued_copies` (`src/lib/signingDocuments.ts`).

### 2.2 Invio alla compagnia (questo portale → portale compagnia)

Dalla pagina VIES, sezione di invio: scelto il portale, il controllo finale passa le pratiche valide alla coda e ogni pratica viene inviata con una `POST` JSON.

```
POST <url>
Authorization: Bearer <chiave>
Idempotency-Key: <job_id>          # ripetuto in idempotency_key: lo stesso invio ritentato ha la stessa chiave
Content-Type: application/json
```

```json
{
  "schema_version": 2,
  "idempotency_key": "9b3c…",
  "practice": { "id": "…", "number": "VIES-2026-0001-ab12cd34", "type": "vies", "client_name": "Azienda Uno" },
  "documents": [
    { "file_name": "1.zip", "mime_type": "application/zip", "size": 482113, "document_type": null,
      "download_url": "https://….supabase.co/storage/v1/object/sign/…", "expires_at": "2026-10-14T10:00:00Z" }
  ],
  "callback": {
    "url": "https://portale.tecnomga.com/api/vies-portal-callback",
    "portal_id": "alfa",
    "signature": "HMAC-SHA256 …",
    "events": ["practice.received", "practice.info_requested", "practice.deliberated", "practice.rejected", "practice.issued"]
  },
  "job_id": "…", "batch_id": "…", "row_number": 1,
  "contraente": "…", "partita_iva_contraente": "…", "beneficiario": "…", "pec": "…", "raw_payload": { }
}
```

- I campi piatti (`job_id`, `contraente`, …) sono quelli della prima versione, invariati.
- `documents` elenca tutti i file della pratica (polizza VIES in PDF, ZIP dei documenti, visura) come **link validi tre giorni**. Le bozze e le polizze tornate dalla compagnia non vengono rimandate indietro.
- `callback` è `null` se per quel portale non è configurato il segreto delle risposte.
- La risposta attesa è `200` con `{ "external_reference": "<il vostro riferimento>" }` (facoltativo ma consigliato: permette di individuare la pratica anche senza il nostro id). `5xx` e `429` vengono ritentati con attesa crescente; altri errori fermano l'invio con il motivo mostrato in pagina.
- A invio riuscito la pratica passa a **In valutazione** e registra portale e riferimento. L'invio resta valido anche se questo passaggio fallisce: l'errore viene riportato.

### 2.3 Risposte della compagnia (portale compagnia → questo portale) — entrata

`POST https://portale.tecnomga.com/api/vies-portal-callback`

| Header | Valore |
|---|---|
| `X-Portal-Id` | l'id del portale in `VIES_PORTALS` (es. `alfa`) |
| `X-Timestamp` | secondi da epoch; oltre 5 minuti di scarto la chiamata è rifiutata |
| `X-Signature` | `sha256=` + esadecimale di `HMAC-SHA256(segreto, X-Timestamp + "." + corpo grezzo)` |

La firma copre i **byte esatti** del corpo: non ri-serializzare il JSON dopo averlo firmato.

```json
{
  "event_id": "evt-000123",
  "event_type": "practice.deliberated",
  "occurred_at": "2026-10-12T09:30:00Z",
  "practice": { "id": "…", "number": "VIES-2026-0001-ab12cd34", "reference": "ALFA-9981" },
  "data": { }
}
```

`practice` basta con **uno** tra `id`, `number`, `reference` (il riferimento che il portale ha restituito all'invio). `event_id` è unico per portale: lo stesso evento inviato due volte viene applicato una sola volta e la seconda risposta riporta `"duplicate": true`.

| `event_type` | `data` | Effetto |
|---|---|---|
| `practice.received` | — (serve `practice.reference`) | Registra la presa in carico e il riferimento; lo stato non cambia |
| `practice.info_requested` | `message` (obbligatorio), `due_date` (AAAA-MM-GG, facoltativo) | → Integrazioni richieste; il titolare riceve notifica ed email. Senza `due_date` (o se è nel passato) il termine è di 7 giorni |
| `practice.deliberated` | `payment_due_date` (AAAA-MM-GG), `note`, `draft`, `policy_copy`, `policy_number` (facoltativo, di solito arriva dopo con la copia) | → Deliberate · da pagare; bozza (si controlla) e polizza nella copia per la Compagnia (si firma) allegate alla pratica |
| `practice.rejected` | `reason` (obbligatorio) | → Non deliberate, con il motivo |
| `practice.issued` | `policy_number`, `document` oppure `documents` (fino a 10 copie: contraente, beneficiario, compagnia) | → Emesse (richiede il pagamento già registrato); ogni copia è allegata come `polizza_emessa` |

`draft`, `policy_copy`, `document` e ogni elemento di `documents` sono `{ "file_name", "mime_type", "content_base64" }` per file piccoli (corpo massimo 4 MB), oppure `{ "file_name", "mime_type", "url" }` con un indirizzo **https** il cui host sia quello del portale o uno di `documentHosts`. Tipi ammessi: PDF, ZIP, JPEG, PNG; massimo 12 MB; l'intestazione del file deve corrispondere al tipo dichiarato.

Risposte: `200` applicato (o già applicato), `400` corpo non valido (`invalid_json`, `invalid_payload`), `401` portale o firma non validi (stessa risposta per portale sconosciuto, senza segreto e firma errata), `403 practice_not_assigned` (la pratica non risulta inviata a questo portale: vale la riga di flusso o l'invio completato verso di lui; una pratica segnata «inviata a mano» non è assegnata a nessun portale), `404 practice_not_found`, `409 invalid_transition` o `conflict`, `422 invalid_document`, `429`, `503`. Un evento fallito può essere **rinviato con lo stesso `event_id`**: viene riapplicato.

#### Esempio di firma

```js
// Node
const ts = String(Math.floor(Date.now() / 1000));
const raw = JSON.stringify(event);
const sig = "sha256=" + crypto.createHmac("sha256", SECRET).update(`${ts}.${raw}`).digest("hex");
await fetch(CALLBACK_URL, { method: "POST", headers: { "Content-Type": "application/json",
  "X-Portal-Id": "alfa", "X-Timestamp": ts, "X-Signature": sig }, body: raw });
```

```python
# Python
ts = str(int(time.time())); raw = json.dumps(event).encode()
sig = "sha256=" + hmac.new(SECRET.encode(), ts.encode() + b"." + raw, hashlib.sha256).hexdigest()
requests.post(CALLBACK_URL, data=raw, headers={"Content-Type": "application/json", "X-Portal-Id": "alfa", "X-Timestamp": ts, "X-Signature": sig})
```

```php
// PHP
$ts = (string) time(); $raw = json_encode($event);
$sig = 'sha256=' . hash_hmac('sha256', $ts . '.' . $raw, $secret);
```

### 2.4 Notifiche ai rappresentanti fiscali (questo portale → portale sorgente) — uscita

Ogni chiave API può avere un indirizzo `https` che riceve le notifiche (Impostazioni → Connessioni → *Rappresentanti fiscali e portali che inviano lotti* → **Configura**). Alla creazione compare un **segreto di firma, mostrato una sola volta**: va comunicato al portale del partner. Lo stesso pulsante lo rigenera (il vecchio smette di valere subito); **Prova** invia una notifica `practice.test`.

Le pratiche create da un lotto ricevuto appartengono anche alla chiave che lo ha inviato: il partner le legge con la sua chiave dalle API di sempre.

```
POST <indirizzo del partner>
Content-Type: application/json
X-Event-Type: practice.deliberated
Idempotency-Key: <event_id>        # uguale a event_id nel corpo; lo stesso evento ritentato ha la stessa chiave
X-Delivery-Attempt: 1
X-Partner-Id: <id della chiave API>
X-Timestamp: 1760000000
X-Signature: sha256=…               # HMAC-SHA256(segreto, X-Timestamp + "." + corpo grezzo)
```

```json
{
  "schema_version": 1,
  "event_id": "5b0f…",
  "event_type": "practice.deliberated",
  "occurred_at": "2026-10-12T09:30:00Z",
  "source": { "lot_id": "…", "reference": "LOTTO-2026-10-A" },
  "practice": { "id": "…", "number": "VIES-2026-0001-ab12cd34", "client_name": "Azienda Uno" },
  "stage": "deliberata",
  "data": {
    "payment_due_date": "2026-12-20", "note": "Premio confermato",
    "documents": [ { "file_name": "bozza.pdf", "document_type": "bozza_deliberata", "mime_type": "application/pdf",
                     "size": 120344, "download_url": "https://…", "expires_at": "2026-10-19T09:30:00Z" } ]
  }
}
```

| `event_type` | Quando | `data` |
|---|---|---|
| `lot.processed` | L'amministratore ha caricato il lotto nel flusso e le pratiche sono state create | `practices`: riga, contraente, numero pratica, sezione |
| `lot.rejected` | Lotto rifiutato | `reason` |
| `practice.in_review` | Pratica inviata alla compagnia | — |
| `practice.info_requested` | La compagnia chiede integrazioni | `message`, `due_date` (termine per fornirle) |
| `practice.info_provided` | Integrazioni inviate alla compagnia | `message` |
| `practice.deliberated` | Deliberata: bozza da pagare | `payment_due_date`, `note`, `documents` (bozza da controllare e, se arrivata, polizza nella copia per la Compagnia da firmare: `polizza_copia_compagnia`) |
| `practice.rejected` | Non deliberata | `reason` |
| `practice.paid` | Pagamento registrato | `payment_date`, `payment_due_date`, `documents` |
| `practice.signed` | Copie firmate trasmesse alla compagnia | `documents` (le copie firmate: `polizza_firmata`, `mup_firmato`) |
| `practice.issued` | Polizza emessa | `policy_number`, `documents` (tutte le copie della polizza emessa) |
| `practice.reopened` | Pratica riaperta | `reason` |
| `practice.test` | Prova dalle impostazioni | `message` |

`stage` è la sezione in cui si trova ora la pratica (`da_lavorare`, `in_valutazione`, `integrazioni`, `deliberata`, `da_emettere`, `emessa`, `non_deliberata`). I link ai documenti valgono sette giorni.

**Consegna e ritentativi.** `2xx` = consegnata. `5xx`, `408`, `425`, `429`, nessuna risposta entro 6 secondi: ritentata dopo 1 minuto, 5 minuti, 30 minuti, 2 ore, 6 ore, 24 ore (7 tentativi in tutto); i ritentativi partono anche dal ciclo automatico giornaliero e da **Riprova** nelle impostazioni. Gli altri `4xx` fermano la consegna subito (stato *Non consegnata*, con il motivo): corretta la causa, **Riprova**. Il ricevente deve rispondere in fretta e **trattare `event_id` come chiave di idempotenza**: lo stesso evento può arrivare più di una volta. L'ordine non è garantito: `stage` e `occurred_at` dicono qual è lo stato più recente.

### 2.5 Eventi verso il portale della compagnia — uscita

Oltre all'invio delle pratiche (2.2), il portale avvisa la compagnia di ciò che da sola non può sapere. Indirizzo: `eventsUrl` del portale in `VIES_PORTALS`, altrimenti lo stesso dell'invio. Intestazioni: `Authorization: Bearer <chiave>`, `X-Portal-Id`, `X-Event-Type`, `Idempotency-Key`, e se è configurato il segreto `X-Timestamp` / `X-Signature` (stessa firma delle risposte, stesso segreto).

| `event_type` | Quando | `data` |
|---|---|---|
| `practice.paid` | Pagamento registrato: la compagnia può emettere la polizza | `payment_date` |
| `practice.signed` | Il rappresentante fiscale ha firmato tutto: polizza nella copia per la Compagnia e MUP unico. La compagnia emette e restituisce le copie della polizza con `practice.issued` | `signed_at`, `documents` (le copie firmate, con i link validi sette giorni) |
| `practice.info_provided` | Integrazioni inviate | `message`, `documents` (i documenti della pratica, con i link) |
| `practice.reopened` | La pratica è stata riaperta (non è più da considerare in valutazione) | `reason` |
| `practice.test` | **Prova invio** dalle impostazioni | `message` |

Il corpo ha `schema_version: 2`, `event_id`, `event_type`, `occurred_at`, `practice: { id, number, reference }`, `data`. Stesse regole di consegna e ritentativo di 2.4. Gli eventi che la compagnia stessa ha causato (deliberata, non deliberata, emessa, integrazioni richieste) non le vengono rimandati. `practice.signed` parte da solo quando l'ultima copia firmata viene caricata (dalla pratica o con lo ZIP del lotto), oppure a mano dalla sezione *Documenti da firmare*; `practice_workflow.signed_sent_at` ne registra il momento e la riapertura lo azzera.

## SECTION 03 — Configurazione (Vercel, sola produzione)

I portali si configurano **solo sul server**; indirizzi, chiavi e segreti non arrivano mai al browser.

```
VIES_PORTALS=[{"id":"alfa","name":"Compagnia Alfa","url":"https://portale.alfa.example/api/practices",
               "apiKeyEnv":"VIES_PORTAL_ALFA_KEY","callbackSecretEnv":"VIES_PORTAL_ALFA_SECRET",
               "documentHosts":["files.alfa.example"],
               "eventsUrl":"https://portal.alfa.example/api/events"}]   # facoltativo: senza, gli eventi vanno all'indirizzo di invio
VIES_PORTAL_ALFA_KEY=<chiave che il portale compagnia accetta in Authorization: Bearer>
VIES_PORTAL_ALFA_SECRET=<segreto condiviso per firmare le risposte: almeno 32 byte casuali>
PORTAL_URL=https://portale.tecnomga.com      # già usato per le email: è anche l'indirizzo delle risposte
```

In alternativa, per un solo portale: `VIES_PORTAL_API_URL`, `VIES_PORTAL_API_KEY`, `VIES_PORTAL_NAME`, `VIES_PORTAL_CALLBACK_SECRET`, `VIES_PORTAL_EVENTS_URL` (id `default`). Un portale senza indirizzo o chiave non compare tra quelli a cui inviare; senza segreto non può rispondere. Dopo la modifica serve un nuovo deploy.

Per generare il segreto: `openssl rand -hex 32`. Per cambiarlo senza interruzioni, concordare con la compagnia l'ora del passaggio: il vecchio segreto smette di valere con il deploy.

## SECTION 04 — Provare il collegamento senza la compagnia

`scripts/vies-portal-simulator.mjs` (solo Node) fa da portale della compagnia:

```bash
# riceve gli invii e risponde da solo: "received" dopo mezzo secondo, "deliberated" dopo 5 secondi
node scripts/vies-portal-simulator.mjs listen --port 4010 --key CHIAVE --secret SEGRETO --portal-id alfa --auto-reply

# oppure invia a mano una risposta firmata
node scripts/vies-portal-simulator.mjs callback --url https://portale.tecnomga.com/api/vies-portal-callback \
  --portal-id alfa --secret SEGRETO --event deliberated --practice-number VIES-2026-0001-ab12cd34 \
  --due 2026-12-31 --note "Premio confermato" --pdf bozza.pdf --policy-copy copia_compagnia.pdf

# emissione con tutte le copie della polizza (--pdf ripetuto, una copia per volta)
node scripts/vies-portal-simulator.mjs callback --url https://portale.tecnomga.com/api/vies-portal-callback \
  --portal-id alfa --secret SEGRETO --event issued --practice-number VIES-2026-0001-ab12cd34 \
  --policy-number POL-2026-123 --pdf polizza_contraente.pdf --pdf polizza_compagnia.pdf --pdf polizza_intermediario.pdf
```

```bash
# fa da portale del partner (o della compagnia) che riceve le notifiche in uscita e ne verifica la firma
node scripts/vies-portal-simulator.mjs receive --port 4011 --secret whsec_… [--fail 500]
```

Eventi: `received`, `info_requested`, `deliberated`, `rejected`, `issued`. Per provare in locale con un portale raggiungibile da Internet serve un tunnel verso `--port`.

## SECTION 05 — Controlli e rischi

- **Idempotenza**: ogni evento è registrato in `integration_events` prima di essere applicato; un indice univoco su (portale, `event_id`) impedisce la doppia applicazione anche con due richieste simultanee.
- **Isolamento**: un portale risponde solo per le pratiche che risultano inviate a lui (anche quelle inviate prima di questa funzione); una chiave API vede solo i propri lotti.
- **Documenti**: tipo, dimensione e intestazione del file vengono verificati; i link in ingresso sono accettati solo da host autorizzati e solo in https.
- **Lotti**: i file passano per indirizzi firmati e hanno nome sanificato; il percorso inizia sempre con l'id dell'utente proprietario (le regole di accesso allo storage lo leggono da lì).
- **Notifiche in uscita**: l'indirizzo deve essere https e raggiungibile da Internet (niente indirizzi interni, `localhost`, credenziali nell'indirizzo, reindirizzamenti); il segreto di firma sta in una tabella che il browser non può leggere e viene mostrato una sola volta; ogni consegna è registrata con tentativi ed esito.
- **Privacy**: il registro non conserva il contenuto dei documenti, solo il loro nome e la dimensione.
- **Limiti noti**: il limite di corpo della piattaforma (4,5 MB) vale per le risposte con documento in `content_base64`: per file più grandi la compagnia usa `url`. Il caricamento dei file di un lotto ricevuto nel flusso avviene nel browser dell'amministratore, come per il caricamento a mano (un lotto molto grande richiede tempo e un computer acceso).
- **Da fare con la compagnia**: concordare contratto definitivo (campi, codici di errore, tempi di risposta) e un ambiente di prova; il contratto qui descritto è il riferimento dal quale partire e si adatta con modifiche locali a `buildPortalPayload` e a `parseCallbackEvent`.
