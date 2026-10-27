# Guida al collegamento tra il portale Tecno Advance MGA e il portale di una compagnia di assicurazione

**Versione:** 1.0 · ottobre 2026 · prodotto VIES (fideiussione art. 35, comma 7-quater, DPR 633/1972)

*A chi è rivolta: ai tecnici della compagnia (o di un suo fornitore) che devono collegare il proprio portale al nostro per ricevere le pratiche, rispondere a ogni passaggio e restituire bozze e polizze. Descrive tutto il percorso, dalla prima pratica inviata alla polizza emessa, con indirizzi, intestazioni, firme, esempi di messaggi, errori e collaudo.*

---

## 1. In breve

- Il collegamento funziona in **due direzioni**, con messaggi JSON su HTTPS:
  - **Noi → compagnia**: inviamo ogni pratica (con i documenti come link) e, a ogni passaggio che la compagnia non può sapere da sola, un **evento** (pagamento registrato, firme caricate, integrazioni inviate, pratica riaperta).
  - **Compagnia → noi**: la compagnia risponde con **cinque eventi** firmati: presa in carico, richiesta di integrazioni, deliberazione (con bozza e polizza da firmare), rifiuto, emissione (con tutte le copie della polizza).
- Le risposte della compagnia sono **autenticate con una firma HMAC-SHA256** su un segreto condiviso; gli invii nostri portano una chiave `Authorization: Bearer`.
- Ogni messaggio ha un **identificativo di evento** che serve da chiave di idempotenza: lo stesso messaggio può arrivare più volte e va applicato una volta sola.
- Non servono VPN né indirizzi fissi: bastano due indirizzi HTTPS raggiungibili da Internet (uno per ricevere le pratiche, uno facoltativo per gli eventi) e una chiave.

### Indirizzi e ambienti

| | Indirizzo |
|---|---|
| Portale Tecno (produzione) | `https://portale.tecnomga.com` |
| **Dove la compagnia ci risponde** | `POST https://portale.tecnomga.com/api/vies-portal-callback` |
| Dove noi inviamo le pratiche | l'indirizzo della compagnia che ci comunicate (es. `https://portale.alfa.example/api/practices`) |
| Dove noi inviamo gli eventi | `eventsUrl` della compagnia; se manca, lo stesso indirizzo di invio |

Prima della produzione concordiamo un **ambiente di prova** della compagnia e ci scambiamo chiave e segreto separati.

---

## 2. Il percorso in sei fasi

Una pratica VIES corrisponde a una società cliente. Le pratiche viaggiano in lotti da 20, ma **ogni messaggio riguarda una sola pratica**. La tabella mette in fila le sei fasi, cosa fa il portale Tecno, cosa deve fare la compagnia e in quale sezione si trova la pratica.

| Fase | Cosa succede | Il nostro portale → compagnia | La compagnia → il nostro portale | Sezione della pratica |
|---|---|---|---|---|
| **1. Invio** | L'amministratore carica il lotto (Excel + ZIP) e invia le pratiche valide | `POST` della pratica con i documenti come link (§4) | Risposta `200` con il vostro riferimento; poi `practice.received` | Da lavorare → **In valutazione** |
| **2. Valutazione** | La compagnia studia la pratica | — | `practice.info_requested` (se servono documenti) oppure `practice.rejected` | In valutazione / **Integrazioni richieste** / **Non deliberate** |
| **3. Delibera e bozze** | La compagnia delibera e prepara le bozze | Evento `practice.info_provided` se arrivano le integrazioni | `practice.deliberated` con scadenza di pagamento, **bozza** (`draft`) e **polizza nella copia per la Compagnia** (`policy_copy`) | **Deliberate · da pagare** |
| **4. Pagamento** | Il rappresentante fiscale paga l'estratto conto del lotto; l'amministratore conferma l'incasso | `practice.paid` con la data del pagamento | — (la compagnia può ora emettere) | **Pagate · in emissione** |
| **5. Firme e invio** | Il rappresentante fiscale firma **la polizza (copia Compagnia) e il MUP unico**; il portale le trasmette | `practice.signed` con le copie firmate come link | — | Pagate · in emissione |
| **6. Emissione** | La compagnia emette e restituisce tutte le copie | — | `practice.issued` con il numero di polizza e le copie (fino a 10 file) | **Emesse** |

Percorsi consentiti (le altre richieste ricevono `409 invalid_transition`):

```
da lavorare ─inviata→ in valutazione ─deliberata→ deliberata ─pagamento→ pagata ─emissione→ emessa
                       │      ▲                       │
          info_requested│      │info_provided         └─non deliberata→ non deliberata
                       ▼      │
                  integrazioni richieste ─deliberata / non deliberata→ …
```

Una pratica **già pagata non può essere rifiutata né rideliberata**; l'emissione richiede il pagamento già registrato.

### Come si legge dalla parte del nostro portale

Nel portale il lotto ha otto passaggi visibili (bozze, verifica, pagamento, conferma pagamento, copie, firme, invio, polizze emesse). Le sei fasi di questa guida li raggruppano così: fase 3 = bozze e verifica; fase 4 = pagamento e conferma; fase 5 = copie, firme e invio; fase 6 = polizze emesse. **I messaggi sono sempre per pratica**: il lotto è soltanto il modo in cui noi organizziamo il lavoro.

---

## 3. Preparazione del collegamento (checklist)

**Da parte della compagnia:**

1. Un indirizzo HTTPS che riceve le pratiche (`POST` JSON): rispondete in pochi secondi, il nostro invio gira in una funzione che dura al massimo 60 secondi.
2. Facoltativo: un secondo indirizzo per gli eventi (pagamento, firme…). Se manca, usiamo il primo. Gli eventi hanno un limite di **6 secondi** per la risposta: accettate il messaggio e lavoratelo dopo.
3. Una **chiave API** che il nostro portale invia in `Authorization: Bearer <chiave>`.
4. Se i documenti restituiti sono ospitati da voi: l'elenco dei **domini** da cui potremo scaricarli (`documentHosts`).
5. Un riferimento interno per pratica da restituirci (`external_reference`): permette di individuare la pratica anche senza il nostro identificativo.

**Da parte nostra (configurazione server, solo produzione):**

```
VIES_PORTALS=[{"id":"alfa","name":"Compagnia Alfa","url":"https://portale.alfa.example/api/practices",
               "apiKeyEnv":"VIES_PORTAL_ALFA_KEY","callbackSecretEnv":"VIES_PORTAL_ALFA_SECRET",
               "documentHosts":["files.alfa.example"],
               "eventsUrl":"https://portale.alfa.example/api/events"}]
VIES_PORTAL_ALFA_KEY=<la chiave che il vostro portale accetta>
VIES_PORTAL_ALFA_SECRET=<segreto condiviso: almeno 32 byte casuali>
PORTAL_URL=https://portale.tecnomga.com
```

Il **segreto condiviso** si genera con `openssl rand -hex 32` e ci si scambia su un canale riservato, non per e-mail in chiaro. Per cambiarlo senza interruzioni si concorda l'ora del passaggio: il vecchio segreto smette di valere con il nostro nuovo rilascio.

---

## 4. Noi → compagnia: l'invio della pratica (fase 1)

Per ogni pratica valida inviamo una richiesta `POST`:

```
POST <url della compagnia>
Authorization: Bearer <chiave>
Idempotency-Key: <job_id>
Content-Type: application/json
```

```json
{
  "schema_version": 2,
  "idempotency_key": "9b3c1f7e-…",
  "practice": { "id": "5f0c…", "number": "VIES-2026-0003-ab12cd34", "type": "vies", "client_name": "Hangzhou Haichen KeJi YouXian GongSi" },
  "documents": [
    { "file_name": "3.zip", "mime_type": "application/zip", "size": 14496, "document_type": null,
      "download_url": "https://….supabase.co/storage/v1/object/sign/…", "expires_at": "2026-10-30T10:00:00Z" }
  ],
  "callback": {
    "url": "https://portale.tecnomga.com/api/vies-portal-callback",
    "portal_id": "alfa",
    "signature": "HMAC-SHA256 …",
    "events": ["practice.received", "practice.info_requested", "practice.deliberated", "practice.rejected", "practice.issued"]
  },
  "job_id": "…", "batch_id": "…", "row_number": 3,
  "contraente": "Hangzhou Haichen KeJi YouXian GongSi",
  "partita_iva_contraente": "07010712714",
  "beneficiario": "AGENZIA DELLE ENTRATE",
  "pec": "haichenkeji@pec.example.it",
  "raw_payload": { }
}
```

Cosa contiene:

- `practice`: identificativo e numero della pratica (`VIES-ANNO-RIGA-CODICE`). Il **numero** è quello da usare nelle risposte.
- `documents`: lo ZIP della pratica (licenza, documenti d'identità, report sul credito, dichiarazioni, UBO, mandato, visura, bilancio, statuto) come **link validi tre giorni**.
- `partita_iva_contraente`: **la partita IVA italiana** assegnata dall'Agenzia delle Entrate alla società cinese; è l'unico identificativo fiscale del contraente (mai il codice di credito sociale).
- `callback`: dove e come rispondere. È `null` se per il vostro portale non è configurato il segreto.
- I campi piatti (`job_id`, `contraente`, …) sono quelli della prima versione e restano invariati.

**Cosa ci aspettiamo come risposta:**

```json
{ "external_reference": "ALFA-9981" }
```

`200` con il vostro riferimento (consigliato, non obbligatorio). Gli errori `5xx` e `429` vengono **ritentati con attesa crescente**; gli altri errori fermano l'invio e il motivo compare nella pagina dell'amministratore. Un invio ripetuto ha la **stessa** `Idempotency-Key`: va trattato come lo stesso invio.

A invio riuscito la pratica passa a **In valutazione** e registra portale e riferimento.

---

## 5. Compagnia → noi: le risposte (fasi 1, 2, 3 e 6)

### 5.1 Autenticazione e firma

`POST https://portale.tecnomga.com/api/vies-portal-callback`

| Intestazione | Valore |
|---|---|
| `Content-Type` | `application/json` |
| `X-Portal-Id` | l'id del vostro portale (es. `alfa`), quello concordato |
| `X-Timestamp` | secondi da epoch; oltre 5 minuti di scarto la chiamata è rifiutata |
| `X-Signature` | `sha256=` + esadecimale di `HMAC-SHA256(segreto, X-Timestamp + "." + corpo grezzo)` |

La firma copre i **byte esatti** del corpo: non ri-serializzare il JSON dopo averlo firmato. Il corpo massimo è **4 MB**.

```js
// Node.js
const ts = String(Math.floor(Date.now() / 1000));
const raw = JSON.stringify(event);
const sig = "sha256=" + crypto.createHmac("sha256", SECRET).update(`${ts}.${raw}`).digest("hex");
await fetch("https://portale.tecnomga.com/api/vies-portal-callback", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Portal-Id": "alfa", "X-Timestamp": ts, "X-Signature": sig },
  body: raw,
});
```

```python
# Python
ts = str(int(time.time())); raw = json.dumps(event).encode()
sig = "sha256=" + hmac.new(SECRET.encode(), ts.encode() + b"." + raw, hashlib.sha256).hexdigest()
requests.post(CALLBACK_URL, data=raw, headers={"Content-Type": "application/json",
    "X-Portal-Id": "alfa", "X-Timestamp": ts, "X-Signature": sig})
```

```php
// PHP
$ts = (string) time(); $raw = json_encode($event);
$sig = 'sha256=' . hash_hmac('sha256', $ts . '.' . $raw, $secret);
```

### 5.2 Forma del messaggio

```json
{
  "event_id": "evt-000123",
  "event_type": "practice.deliberated",
  "occurred_at": "2026-10-29T09:30:00Z",
  "practice": { "number": "VIES-2026-0003-ab12cd34", "reference": "ALFA-9981" },
  "data": { }
}
```

- `practice`: basta **uno** tra `id`, `number`, `reference`.
- `event_id`: **unico per portale**. Lo stesso evento inviato due volte viene applicato una sola volta; la seconda risposta riporta `"duplicate": true`. Un evento fallito si può **rinviare con lo stesso `event_id`**: viene riapplicato.
- La pratica deve risultare **inviata proprio a quel portale**, altrimenti `403 practice_not_assigned`.

### 5.3 Gli eventi, fase per fase

**Fase 1 — presa in carico.** Non cambia stato: registra il vostro riferimento.

```json
{ "event_id": "evt-1", "event_type": "practice.received", "occurred_at": "2026-10-28T08:00:00Z",
  "practice": { "number": "VIES-2026-0003-ab12cd34", "reference": "ALFA-9981" }, "data": {} }
```

**Fase 2 — richiesta di integrazioni.** `message` è obbligatorio; `due_date` (AAAA-MM-GG) è facoltativo (senza, o se è nel passato, il termine è di 7 giorni). La pratica passa a *Integrazioni richieste* e il titolare riceve notifica ed e-mail.

```json
{ "event_id": "evt-2", "event_type": "practice.info_requested", "occurred_at": "2026-10-28T10:00:00Z",
  "practice": { "reference": "ALFA-9981" },
  "data": { "message": "Manca la traduzione giurata dello statuto.", "due_date": "2026-11-05" } }
```

Quando il rappresentante fornisce le integrazioni, **noi vi mandiamo** `practice.info_provided` (§6) con i documenti.

**Fase 2 — rifiuto.** `reason` è obbligatorio. La pratica passa a *Non deliberate*. Una pratica già pagata non può essere rifiutata.

```json
{ "event_id": "evt-3", "event_type": "practice.rejected", "occurred_at": "2026-10-28T11:00:00Z",
  "practice": { "reference": "ALFA-9981" }, "data": { "reason": "Rischio non assumibile" } }
```

**Fase 3 — delibera.** La pratica passa a *Deliberate · da pagare*. Contiene la **scadenza del pagamento**, la **bozza** (si controlla, non si firma) e la **polizza nella copia per la Compagnia** (è quella che si firma).

```json
{
  "event_id": "evt-4", "event_type": "practice.deliberated", "occurred_at": "2026-10-29T09:30:00Z",
  "practice": { "reference": "ALFA-9981" },
  "data": {
    "payment_due_date": "2026-11-20",
    "note": "Premio confermato",
    "draft":       { "file_name": "bozza_ALFA-9981.pdf",  "mime_type": "application/pdf", "content_base64": "JVBERi0x…" },
    "policy_copy": { "file_name": "polizza_copia_compagnia_ALFA-9981.pdf", "mime_type": "application/pdf",
                     "url": "https://files.alfa.example/doc/9981-copia.pdf" },
    "policy_number": "POL-2026-000123"
  }
}
```

`policy_number` è facoltativo: spesso arriva dopo, con la copia per la Compagnia (si può mandare in una nuova `practice.deliberated` o in `practice.issued`). Un numero già registrato non viene sovrascritto.

**Fase 6 — emissione.** Richiede il pagamento già registrato (altrimenti `409 invalid_transition`). Si manda `document` oppure `documents` (**fino a 10 copie**: contraente, beneficiario, compagnia…). Ogni copia viene allegata alla pratica come polizza emessa. (La chiusura del lotto nel portale resta un passaggio dell'amministratore: vedi §10.)

```json
{
  "event_id": "evt-5", "event_type": "practice.issued", "occurred_at": "2026-11-12T15:00:00Z",
  "practice": { "reference": "ALFA-9981" },
  "data": {
    "policy_number": "POL-2026-000123",
    "documents": [
      { "file_name": "polizza_copia1_contraente.pdf",   "mime_type": "application/pdf", "url": "https://files.alfa.example/doc/9981-1.pdf" },
      { "file_name": "polizza_copia2_beneficiario.pdf", "mime_type": "application/pdf", "url": "https://files.alfa.example/doc/9981-2.pdf" },
      { "file_name": "polizza_copia3_compagnia.pdf",    "mime_type": "application/pdf", "url": "https://files.alfa.example/doc/9981-3.pdf" },
      { "file_name": "polizza_copia4_intermediario.pdf","mime_type": "application/pdf", "url": "https://files.alfa.example/doc/9981-4.pdf" }
    ]
  }
}
```

### 5.4 Come si allegano i documenti

| Forma | Quando | Regole |
|---|---|---|
| `{ "file_name", "mime_type", "content_base64" }` | File piccoli | Il corpo intero non supera **4 MB** |
| `{ "file_name", "mime_type", "url" }` | File grandi | `https`, con host **uguale a quello del vostro portale** o elencato in `documentHosts`; link raggiungibile da Internet |

Tipi ammessi: **PDF, ZIP, JPEG, PNG**; massimo **12 MB** per file; l'intestazione del file deve corrispondere al tipo dichiarato (un PDF che non inizia con `%PDF` viene rifiutato con `422 invalid_document`).

### 5.5 Risposte e codici di errore

| Codice | Significato | Cosa fare |
|---|---|---|
| `200` | Applicato (o già applicato: `"duplicate": true`) | Niente |
| `400` | Corpo non valido (`invalid_json`, `invalid_payload`) | Correggere e rinviare |
| `401` | Portale sconosciuto, firma errata o segreto mancante (stessa risposta per tutti i casi) | Controllare id, segreto, orologio, byte del corpo |
| `403 practice_not_assigned` | La pratica non risulta inviata a questo portale | Verificare numero/riferimento |
| `404 practice_not_found` | Nessuna pratica con quei dati | Verificare numero/riferimento |
| `409 invalid_transition` / `conflict` | Passaggio non consentito dallo stato attuale (es. emissione prima del pagamento; rifiuto dopo il pagamento) | Controllare la fase; riprovare quando la pratica è nello stato giusto |
| `422 invalid_document` | Tipo, dimensione o host del documento non ammessi | Correggere il documento |
| `429` / `503` | Troppe richieste / servizio non disponibile | Ritentare con attesa crescente |

---

## 6. Noi → compagnia: gli eventi (fasi 3, 4 e 5)

Gli eventi che la compagnia **non può sapere da sola** le arrivano con una `POST` all'indirizzo eventi:

```
POST <eventsUrl>
Authorization: Bearer <chiave>
X-Portal-Id: alfa
X-Event-Type: practice.paid
Idempotency-Key: <event_id>
X-Timestamp: 1761800000           # solo se è configurato il segreto
X-Signature: sha256=…             # HMAC-SHA256(segreto, X-Timestamp + "." + corpo grezzo): stessa regola e stesso segreto delle risposte
Content-Type: application/json
```

Forma comune: `schema_version: 2`, `event_id`, `event_type`, `occurred_at`, `practice: { id, number, reference }`, `data`.

| `event_type` | Fase | Quando | `data` |
|---|---|---|---|
| `practice.info_provided` | 2–3 | Il rappresentante ha inviato le integrazioni richieste | `message`, `documents` (i documenti della pratica, link validi tre giorni) |
| `practice.paid` | 4 | L'amministratore ha registrato il pagamento: **la compagnia può emettere** | `payment_date` (AAAA-MM-GG) |
| `practice.signed` | 5 | Le copie firmate sono complete e trasmesse | `signed_at`, `documents` (le copie firmate come link) |
| `practice.reopened` | qualsiasi | La pratica è stata riaperta e non è più da considerare in valutazione | `reason` |
| `practice.test` | — | Prova dalle impostazioni | `message` |

Gli eventi che la compagnia stessa ha causato (deliberata, non deliberata, emessa, integrazioni richieste) **non** le vengono rimandati.

### Pagamento (fase 4)

```json
{ "schema_version": 2, "event_id": "6c1e…", "event_type": "practice.paid", "occurred_at": "2026-11-18T09:00:00Z",
  "practice": { "id": "5f0c…", "number": "VIES-2026-0003-ab12cd34", "reference": "ALFA-9981" },
  "data": { "payment_date": "2026-11-17" } }
```

Il pagamento è dell'**intero lotto** (un unico bonifico dell'estratto conto), ma l'evento arriva **una volta per ogni pratica** del lotto che passa a pagata.

### Firme (fase 5)

Per ogni pratica il rappresentante fiscale firma **due documenti**: la **polizza nella copia per la Compagnia** e il **MUP unico** (MUP, incarico di consulenza, raccomandazione, dichiarazione di consegna, informativa privacy e questionario antiriciclaggio in un solo file). Con entrambi caricati, il portale trasmette:

```json
{
  "schema_version": 2, "event_id": "a91b…", "event_type": "practice.signed", "occurred_at": "2026-11-20T11:00:00Z",
  "practice": { "id": "5f0c…", "number": "VIES-2026-0003-ab12cd34", "reference": "ALFA-9981" },
  "data": {
    "signed_at": "2026-11-20T11:00:00Z",
    "documents": [
      { "file_name": "1_polizza_copia_compagnia_….pdf.p7m", "mime_type": "application/pkcs7-mime", "size": 211004,
        "document_type": "polizza_firmata", "download_url": "https://…", "expires_at": "2026-11-27T11:00:00Z" },
      { "file_name": "2_mup_….pdf", "mime_type": "application/pdf", "size": 255351,
        "document_type": "mup_firmato", "download_url": "https://…", "expires_at": "2026-11-27T11:00:00Z" }
    ]
  }
}
```

Le firme possono essere **digitali CAdES** (`.p7m`, anche `documento.pdf.p7m`, `application/pkcs7-mime`) o PDF firmati: la compagnia deve accettare entrambi.

### Consegna e ritentativi (valgono per tutti i nostri invii)

- `2xx` = consegnato. `5xx`, `408`, `425`, `429` o nessuna risposta entro **6 secondi**: ritentiamo dopo 1 minuto, 5 minuti, 30 minuti, 2 ore, 6 ore, 24 ore (**7 tentativi** in tutto); i ritentativi ripartono anche dal ciclo automatico giornaliero e dal pulsante **Riprova** nelle impostazioni.
- Gli altri `4xx` fermano subito la consegna (stato *Non consegnata*, con il motivo): corretta la causa, si preme **Riprova**.
- Rispondete in fretta e **trattate `event_id` come chiave di idempotenza**. L'ordine non è garantito: l'ordine di arrivo può non coincidere con quello di accadimento, usate `occurred_at`.

---

## 7. Che cosa si vede nel portale a ogni fase

| Fase | Sezione della pratica | Contatore nel menu | Cosa vede il rappresentante fiscale |
|---|---|---|---|
| 1 | In valutazione | In valutazione | «Documenti ricevuti, in attesa della deliberazione» |
| 2 | Integrazioni richieste / Non deliberate | idem | Il messaggio e la scadenza per rispondere; per il rifiuto, il motivo |
| 3 | Deliberate · da pagare | Deliberate (con avviso se la scadenza è entro 7 giorni) | La bozza da controllare e il pulsante per confermarla; l'estratto conto del lotto da saldare |
| 4 | Pagate · in emissione | Pagate | Pagamento registrato |
| 5 | Pagate · in emissione | idem | Lo ZIP dei documenti da firmare (polizza copia Compagnia + MUP unico, già compilati) e il caricamento delle firme |
| 6 | Emesse | Emesse | Tutte le copie della polizza, scaricabili (il lotto si chiude quando l'amministratore conferma le polizze emesse) |

Il portale invia anche le **e-mail**: una per passaggio del lotto, solo ai collaboratori interessati. Le API non cambiano questo comportamento.

---

## 8. Collaudo prima della produzione

Nel repository del portale c'è un simulatore (solo Node) che fa da portale della compagnia, per provare ogni fase senza coinvolgerla:

```bash
# Fase 1: riceve le pratiche e risponde da solo ("received" dopo mezzo secondo, "deliberated" dopo 5 secondi)
node scripts/vies-portal-simulator.mjs listen --port 4010 --key CHIAVE --secret SEGRETO --portal-id alfa --auto-reply

# Fase 3: delibera con bozza e copia per la Compagnia
node scripts/vies-portal-simulator.mjs callback --url https://portale.tecnomga.com/api/vies-portal-callback \
  --portal-id alfa --secret SEGRETO --event deliberated --practice-number VIES-2026-0003-ab12cd34 \
  --due 2026-12-31 --note "Premio confermato" --pdf bozza.pdf --policy-copy copia_compagnia.pdf

# Fase 6: emissione con tutte le copie (--pdf ripetuto)
node scripts/vies-portal-simulator.mjs callback --url https://portale.tecnomga.com/api/vies-portal-callback \
  --portal-id alfa --secret SEGRETO --event issued --practice-number VIES-2026-0003-ab12cd34 \
  --policy-number POL-2026-123 --pdf copia1.pdf --pdf copia2.pdf --pdf copia3.pdf --pdf copia4.pdf

# Eventi in uscita (pagamento, firme): fa da portale ricevente e verifica la firma
node scripts/vies-portal-simulator.mjs receive --port 4011 --secret SEGRETO [--fail 500]
```

**Prova generale consigliata (un lotto da 5 pratiche), nell'ordine:**

| # | Prova | Esito atteso |
|---|---|---|
| 1 | Invio di 5 pratiche | Ogni pratica arriva con `documents`, `partita_iva_contraente`, `callback`; risposta `200` con `external_reference` |
| 2 | `practice.received` | `200`, riferimento registrato, stato invariato |
| 3 | Lo stesso evento due volte | La seconda risposta riporta `"duplicate": true` |
| 4 | `practice.info_requested` poi risposta del rappresentante | Noi inviamo `practice.info_provided` |
| 5 | `practice.rejected` su una pratica | Pratica in *Non deliberate* con il motivo |
| 6 | `practice.deliberated` con bozza e copia per la Compagnia | Pratiche in *Deliberate · da pagare*, documenti allegati |
| 7 | Pagamento del lotto registrato dall'amministratore | Arrivano 4 eventi `practice.paid` (uno per pratica) |
| 8 | `practice.issued` **prima** del pagamento (prova negativa) | `409 invalid_transition` |
| 9 | Firme caricate | Arriva `practice.signed` con due documenti firmati (polizza e MUP unico) |
| 10 | `practice.issued` con 4 copie | Pratica *Emessa*, 4 file allegati, numero di polizza registrato |
| 11 | Firma sbagliata / orologio sfasato / segreto errato | `401` identico in tutti i casi |
| 12 | Il vostro endpoint risponde `500` | Ritentativi dopo 1, 5, 30 minuti… visibili nel registro delle consegne |

---

## 9. Sicurezza e regole di buona condotta

- Usate solo HTTPS con certificato valido e raggiungibile da Internet.
- Il segreto di firma e la chiave non viaggiano mai nei messaggi e non sono mai visibili nel browser. Chi riceve verifica la firma con **confronto a tempo costante** e rifiuta i messaggi con `X-Timestamp` fuori dai 5 minuti.
- Una compagnia risponde **solo per le pratiche che le abbiamo inviato**; non può leggere né toccare le altre.
- I link ai documenti scadono: tre giorni per i file di una pratica inviata, **sette giorni** per quelli dei nostri eventi (pagamento, firme, integrazioni). Scaricateli subito e conservate voi i file.
- Il registro scambi del nostro portale non conserva il contenuto dei documenti, solo nome e dimensione.
- Dati personali: i documenti contengono dati di persone fisiche (legali rappresentanti, titolari effettivi). Trattateli secondo il GDPR e conservateli per il tempo previsto dal contratto.

---

## 10. Cosa oggi è manuale (da sapere prima del collegamento)

Il collegamento aggiorna **le pratiche**: stato, documenti, scadenze, numero di polizza. Alcune conferme **del lotto** restano invece azioni dell'amministratore Tecno nel portale, perché sono i controlli con cui il lotto viene seguito e pagato:

- la conferma del passaggio «bozze caricate» (anche se le bozze sono già arrivate con `practice.deliberated`);
- la conferma del pagamento del lotto (che genera gli eventi `practice.paid`);
- il caricamento in blocco delle copie per la compagnia e delle polizze emesse, e la **chiusura del lotto**: oggi le polizze emesse che arrivano con `practice.issued` aggiornano la pratica (stato *Emessa*, documenti) ma non completano da sole l'ultimo passaggio del lotto;
- l'invio delle firme alla compagnia come passaggio del lotto (il messaggio `practice.signed` parte invece già quando le firme di quella pratica sono complete).

Se la compagnia desidera che anche questi passaggi si chiudano **da soli** alla ricezione degli eventi, è una modifica concordabile (nessun cambio per voi: cambia il nostro comportamento interno).

---

## 11. Da concordare con la compagnia

1. Indirizzi (prova e produzione), chiave, segreto, `documentHosts`.
2. Se `external_reference` è disponibile già alla risposta di invio o solo con `practice.received`.
3. Tempi massimi di risposta per fase (presa in carico, delibera, emissione).
4. Formato delle polizze emesse (numero di copie, nome dei file) e firme accettate (PDF e/o CAdES `.p7m`).
5. Un contatto tecnico reperibile nei primi giorni e un indirizzo per i problemi di consegna.
6. Il contratto qui descritto è il riferimento di partenza: campi, codici di errore e tempi si adattano con modifiche locali al nostro lato (`buildPortalPayload`, `parseCallbackEvent`).

*Contatti tecnici Tecno Advance MGA: info@tecnomga.com · PEC tecnoadvancemgabroker@legalmail.it*
