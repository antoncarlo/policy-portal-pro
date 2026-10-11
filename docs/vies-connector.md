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

Chi vede cosa: ogni utente vede le **proprie** pratiche in ogni sezione, l'amministratore vede tutto e le sposta. Se nessun portale è collegato, l'amministratore registra le risposte della compagnia a mano dalla scheda *Flusso* del dettaglio pratica: il flusso è lo stesso.

Passaggi consentiti (le altre richieste ricevono 409 `invalid_transition`; solo l'amministratore può forzarle):

```
da lavorare ──inviata──▶ in valutazione ──deliberata──▶ deliberata ──pagamento──▶ pagata ──emissione──▶ emessa
                          │      ▲                          │
                richiesta │      │ integrazioni             └──non deliberata──▶ non deliberata
                          ▼      │ inviate
                      integrazioni richieste ──deliberata / non deliberata──▶ …
```

Una pratica **già pagata non può essere rifiutata** né rideliberata; l'emissione richiede il pagamento.

## SECTION 02 — Tre collegamenti

| Direzione | Indirizzo | Chi lo usa |
|---|---|---|
| Lotti in ingresso | `POST /api/vies-intake`, `GET /api/vies-intake-status` | Altri portali, con `X-API-Key` |
| Invio alla compagnia | `POST <url del portale compagnia>` | Il portale, in uscita |
| Risposte della compagnia | `POST /api/vies-portal-callback` | Il portale della compagnia, firmato |

Gli indirizzi di questo portale sono in **Impostazioni → Connessioni**, con lo stato di ogni portale configurato (pronto per l'invio, pronto a ricevere risposte) e il registro degli ultimi scambi, con l'esito di ciascuno.

### 2.1 Lotti in ingresso (altri portali → questo portale)

Documentati nella pagina pubblica `/api-docs` (sezione 8). In sintesi: `create_lot` annuncia i file (un Excel, uno ZIP per azienda, facoltativa la visura) e restituisce indirizzi di caricamento firmati, validi due ore; i file vanno caricati con `PUT`; `complete_lot` verifica che ogni file sia arrivato per intero e chiude il lotto come **ricevuto**. Il lotto compare nella pagina VIES in *Lotti ricevuti da altri portali*: l'amministratore preme **Carica nel flusso**, i file passano dagli stessi lettori del caricamento a mano (controllo documenti, verifica finale), crea le pratiche e il lotto diventa **elaborato**. Le pratiche registrano il portale e il riferimento di provenienza; il portale mittente legge lo stato con `GET /api/vies-intake-status`.

La chiave API deve essere associata a un utente (*Impostazioni → Mappatura API*): i lotti appartengono a quell'utente. Una chiave non associata riceve 403 `key_not_mapped`.

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

### 2.3 Risposte della compagnia (portale compagnia → questo portale)

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
| `practice.info_requested` | `message` (obbligatorio) | → Integrazioni richieste; il titolare riceve notifica ed email |
| `practice.deliberated` | `payment_due_date` (AAAA-MM-GG), `note`, `draft` | → Deliberate · da pagare; bozza allegata alla pratica |
| `practice.rejected` | `reason` (obbligatorio) | → Non deliberate, con il motivo |
| `practice.issued` | `policy_number`, `document` | → Emesse (richiede il pagamento già registrato) |

`draft` e `document` sono `{ "file_name", "mime_type", "content_base64" }` per file piccoli (corpo massimo 4 MB), oppure `{ "file_name", "mime_type", "url" }` con un indirizzo **https** il cui host sia quello del portale o uno di `documentHosts`. Tipi ammessi: PDF, ZIP, JPEG, PNG; massimo 12 MB; l'intestazione del file deve corrispondere al tipo dichiarato.

Risposte: `200` applicato (o già applicato), `400` corpo non valido (`invalid_json`, `invalid_payload`), `401` portale o firma non validi (stessa risposta per portale sconosciuto, senza segreto e firma errata), `403 practice_not_assigned` (la pratica è stata inviata a un altro portale), `404 practice_not_found`, `409 invalid_transition` o `conflict`, `422 invalid_document`, `429`, `503`. Un evento fallito può essere **rinviato con lo stesso `event_id`**: viene riapplicato.

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

## SECTION 03 — Configurazione (Vercel, sola produzione)

I portali si configurano **solo sul server**; indirizzi, chiavi e segreti non arrivano mai al browser.

```
VIES_PORTALS=[{"id":"alfa","name":"Compagnia Alfa","url":"https://portale.alfa.example/api/practices",
               "apiKeyEnv":"VIES_PORTAL_ALFA_KEY","callbackSecretEnv":"VIES_PORTAL_ALFA_SECRET",
               "documentHosts":["files.alfa.example"]}]
VIES_PORTAL_ALFA_KEY=<chiave che il portale compagnia accetta in Authorization: Bearer>
VIES_PORTAL_ALFA_SECRET=<segreto condiviso per firmare le risposte: almeno 32 byte casuali>
PORTAL_URL=https://portale.tecnomga.com      # già usato per le email: è anche l'indirizzo delle risposte
```

In alternativa, per un solo portale: `VIES_PORTAL_API_URL`, `VIES_PORTAL_API_KEY`, `VIES_PORTAL_NAME`, `VIES_PORTAL_CALLBACK_SECRET` (id `default`). Un portale senza indirizzo o chiave non compare tra quelli a cui inviare; senza segreto non può rispondere. Dopo la modifica serve un nuovo deploy.

Per generare il segreto: `openssl rand -hex 32`. Per cambiarlo senza interruzioni, concordare con la compagnia l'ora del passaggio: il vecchio segreto smette di valere con il deploy.

## SECTION 04 — Provare il collegamento senza la compagnia

`scripts/vies-portal-simulator.mjs` (solo Node) fa da portale della compagnia:

```bash
# riceve gli invii e risponde da solo: "received" dopo mezzo secondo, "deliberated" dopo 5 secondi
node scripts/vies-portal-simulator.mjs listen --port 4010 --key CHIAVE --secret SEGRETO --portal-id alfa --auto-reply

# oppure invia a mano una risposta firmata
node scripts/vies-portal-simulator.mjs callback --url https://portale.tecnomga.com/api/vies-portal-callback \
  --portal-id alfa --secret SEGRETO --event deliberated --practice-number VIES-2026-0001-ab12cd34 \
  --due 2026-12-31 --note "Premio confermato" --pdf bozza.pdf
```

Eventi: `received`, `info_requested`, `deliberated`, `rejected`, `issued`. Per provare in locale con un portale raggiungibile da Internet serve un tunnel verso `--port`.

## SECTION 05 — Controlli e rischi

- **Idempotenza**: ogni evento è registrato in `integration_events` prima di essere applicato; un indice univoco su (portale, `event_id`) impedisce la doppia applicazione anche con due richieste simultanee.
- **Isolamento**: un portale risponde solo per le pratiche inviate a lui; una chiave API vede solo i propri lotti.
- **Documenti**: tipo, dimensione e intestazione del file vengono verificati; i link in ingresso sono accettati solo da host autorizzati e solo in https.
- **Lotti**: i file passano per indirizzi firmati e hanno nome sanificato; il percorso inizia sempre con l'id dell'utente proprietario (le regole di accesso allo storage lo leggono da lì).
- **Privacy**: il registro non conserva il contenuto dei documenti, solo il loro nome e la dimensione.
- **Limiti noti**: il limite di corpo della piattaforma (4,5 MB) vale per le risposte con documento in `content_base64`: per file più grandi la compagnia usa `url`. Il caricamento dei file di un lotto ricevuto nel flusso avviene nel browser dell'amministratore, come per il caricamento a mano (un lotto molto grande richiede tempo e un computer acceso).
- **Da fare con la compagnia**: concordare contratto definitivo (campi, codici di errore, tempi di risposta) e un ambiente di prova; il contratto qui descritto è il riferimento dal quale partire e si adatta con modifiche locali a `buildPortalPayload` e a `parseCallbackEvent`.
