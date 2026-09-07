# Guida all'Integrazione API - Policy Portal Pro

**Versione:** 2.3
**Data:** Settembre 2026
**Autore:** Anton Carlo Santoro

Questa guida documenta tutti gli endpoint disponibili per l'integrazione con Policy Portal Pro: creazione pratica con **tutti i dati della quotazione**, stato completo della pratica con **riepilogo**, documenti, messaggistica e i nuovi endpoint di **dashboard** (elenco pratiche, scadenzario, report produzione, amministrazione).

---

## Informazioni Generali

- **Base URL:** `https://policy-portal-pro.vercel.app`
- **Autenticazione:** Header `X-API-Key` (tutti gli endpoint). La creazione pratica richiede anche la firma HMAC `X-Signature`.
- **Rate Limit:** 100 richieste al minuto per IP (header `Retry-After` in caso di 429)
- **Formato Dati:** JSON (`Content-Type: application/json`)
- **Perimetro dati (tenant isolation):** ogni API Key vede esclusivamente le pratiche create con la chiave stessa e, se la chiave e' associata a un utente del portale, anche le pratiche di quell'utente. In questo modo il partner ha una dashboard completa delle proprie pratiche.
- **Chiamate solo da backend:** le credenziali non devono mai essere esposte in frontend o script lato client.

---

## Riepilogo Endpoint

| Metodo | Endpoint | Funzione |
|:------:|----------|----------|
| POST | `/api/webhook-receive-policy` | Creazione nuova pratica con dati quotazione e documenti |
| GET | `/api/get-practice-status` | Stato completo della pratica con riepilogo, documenti obbligatori, chat, timeline |
| POST | `/api/add-practice-note` | Invio messaggio/nota sulla pratica |
| GET | `/api/get-practice-documents` | Download documenti con URL pre-firmati |
| GET | `/api/get-practices` | Elenco pratiche del partner con filtri e paginazione (dashboard) |
| GET | `/api/get-expiries` | Scadenzario polizze |
| GET | `/api/get-reports` | Report produzione e KPI |
| GET | `/api/get-administration` | Amministrazione: premi, provvigioni, incassi |

---

## 1. Creazione Pratica

### `POST /api/webhook-receive-policy`

Crea una nuova pratica nel portale con i dati del cliente, della polizza, **tutti i dati specifici della quotazione** e i documenti allegati. La pratica viene creata in stato `in_lavorazione`.

**Headers:**
- `Content-Type: application/json`
- `X-API-Key: <chiave>`
- `X-Signature: sha256=<hmac-sha256 hex del body>` (calcolata con il `WEBHOOK_SECRET` sul body JSON esatto inviato)
- `X-Idempotency-Key: <chiave stabile>` (consigliato, alternativa al campo `idempotency_key` nel body)

**Campi del body:**

| Campo | Tipo | Obbligatorio | Descrizione |
|-------|------|:---:|-------------|
| `source` | string | Si | Identificativo del portale mittente (es. `portale-mariano`) |
| `practice_type` | string | Si | Tipologia: `pet`, `car`, `casa`, `fidejussioni`, `rc`, `fotovoltaico`, `catastrofali`, `azienda`, `postuma_decennale`, `all_risk`, `risparmio`, `salute` |
| `client_name` | string | Si | Nome o ragione sociale del contraente |
| `client_email` | string | Si | Email del contraente |
| `client_phone` | string | Si | Telefono del contraente |
| `owner_tax_code` | string | No | Codice fiscale / P.IVA del contraente (per Pet: codice fiscale del proprietario) |
| `beneficiary` | string | No | Beneficiario |
| `policy_number` | string | No | Numero polizza o riferimento esterno |
| `policy_start_date` | date | No | Decorrenza (`YYYY-MM-DD`) |
| `policy_end_date` | date | No | Scadenza (`YYYY-MM-DD`). Alimenta lo scadenzario |
| `specific_fields` | object | Consigliato | **Tutti i dati della quotazione** per la tipologia (vedi tabelle piu' avanti). Vengono mostrati nel riepilogo della pratica |
| `pet_microchip` | string | Pet | Numero microchip (max 15 caratteri). Puo' essere passato anche dentro `specific_fields` |
| `premium_net` | number | No | Premio netto (base provvigionale) |
| `premium_taxable` | number | No | Imponibile |
| `premium_taxes` | number | No | Imposte |
| `premium_gross` | number | No | Premio lordo. Per Pet, se assente, viene usato `specific_fields.total_annual` oppure la somma delle `selected_coverages` |
| `notes` | string | No | **Appunti liberi** per l'assuntore (non usare per i dati della quotazione) |
| `idempotency_key` | string | Consigliato | Chiave di idempotenza (alternativa all'header) |
| `documents` | array | Si in pratica | Allegati inline in Base64 (vedi sezione Allegati) |

> **Importante:** i dati della quotazione vanno in `specific_fields`, non in `notes`. Le note restano appunti liberi per l'assuntore e per il partner. Per retro-compatibilita' viene ancora accettato il formato `notes` con separatore `--- Dati Specifici Polizza ---` seguito da JSON, ma il campo `specific_fields` e' il canale ufficiale.

**Esempio completo Pet (quotazione completa):**
```json
{
  "source": "portale-mariano",
  "idempotency_key": "EXT-2026-000123",
  "practice_type": "pet",
  "client_name": "Mario Rossi",
  "client_email": "mario.rossi@example.com",
  "client_phone": "+39 333 1234567",
  "owner_tax_code": "RSSMRA80A01H501U",
  "pet_microchip": "380260001234567",
  "policy_start_date": "2026-10-01",
  "policy_end_date": "2027-10-01",
  "premium_gross": 318.00,
  "specific_fields": {
    "pet_name": "Fido",
    "pet_species": "cane",
    "pet_breed": "Labrador",
    "pet_birth_date": "2021-03-15",
    "pet_gender": "maschio",
    "pet_sterilized": true,
    "pet_weight": 18,
    "pet_previous_diseases": "Nessuna",
    "animal_type": "cani_0_20kg",
    "coverage_type": "completa",
    "selected_coverages": ["ass_standard", "rsv_gold_1000", "rct_100k", "tl_standard"],
    "total_annual": 318.00,
    "total_monthly": 26.50,
    "client_address": "Via Roma 1, 00100 Roma"
  },
  "notes": "Cliente preferisce essere contattato via email.",
  "documents": [
    {
      "filename": "documento_identita_rossi.pdf",
      "mime_type": "application/pdf",
      "content_base64": "JVBERi0xLjQK...",
      "document_type": "documento_identita"
    },
    {
      "filename": "libretto_sanitario_fido.pdf",
      "mime_type": "application/pdf",
      "content_base64": "JVBERi0xLjQK...",
      "document_type": "libretto_sanitario"
    }
  ]
}
```

**Risposta di Successo (200 OK):**
```json
{
  "success": true,
  "practice_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "practice_number": "PR-2026-1045",
  "message": "Pratica creata con successo.",
  "quote_document": { "file_name": "Ricapitolo Richiesta per Fido.pdf", "document_type": "preventivo_pet" }
}
```

**Ricapitolo Richiesta (solo Pet):** se la pratica e' di tipo `pet` e sono presenti `selected_coverages` (oppure `total_annual` / `premium_gross`), il portale genera automaticamente il PDF "Ricapitolo Richiesta per <nome animale>", con lo stesso layout e testo della mail di preventivo inviata al cliente (coperture incluse SI/NO, premio annuale, rata mensile, condizioni). Il file viene allegato alla pratica con `document_type = preventivo_pet` ed e' scaricabile da `get-practice-documents`. Per questo e' importante inviare `selected_coverages` con gli id del catalogo coperture: senza coperture o premio il documento non viene generato (`quote_document: null`).

Un reinvio con la stessa idempotency key restituisce `200` con `duplicate: true` e gli stessi identificativi. Il confronto della chiave e' esatto (`EXT-2` non coincide con `EXT-2026-000123`).

**Formato date:** il formato consigliato e' ISO `YYYY-MM-DD`. Nei campi di `specific_fields` (es. `pet_birth_date`) viene accettato anche il formato italiano `DD/MM/YYYY`, che nel riepilogo viene interpretato correttamente come giorno/mese/anno.

### Allegati documentali

Ogni documento richiede `filename`, `mime_type` (`application/pdf`, `image/jpeg`, `image/png`, `.docx`) e `content_base64` (max 10 MB decodificati). Il campo `document_type` e' facoltativo: se omesso viene dedotto dalle keyword nel nome file. Usare gli id degli slot documentali del portale (vedi "Documenti Obbligatori per Tipologia") rende immediato lo stato "caricato" nel riepilogo.

Un documento obbligatorio e' considerato presente se la keyword compare nel nome file **oppure** se `document_type` indica lo slot corrispondente (es. `document_type: "libretto_sanitario"` soddisfa la keyword `libretto_sanitario_o_microchip`). In caso contrario la risposta e' HTTP 422 `missing_required_documents`.

Keyword richieste per tipologia:

| Tipo pratica | Keyword richieste |
|--------------|-------------------|
| pet | `libretto_sanitario_o_microchip` oppure `libretto_sanitario` oppure `microchip` |
| rc | `visura_camerale`, `documento_identita` |
| car | `preventivo_o_contratto`, `visura_camerale` |
| casa | `visura_catastale`, `documento_identita` |
| fidejussioni | `visura_camerale`, `bilancio_ultimo_anno`, `documento_identita_legale_rappresentante` (facoltativo `atto_gara` / `atto_gara_bando`) |
| fotovoltaico | `progetto_impianto`, `visura_camerale` |
| catastrofali | `perizia_immobile`, `visura_catastale` |
| azienda | `visura_camerale`, `bilancio` |
| postuma_decennale | `collaudo_statico`, `progetto_esecutivo`, `visura_camerale` |
| all_risk | `lista_macchinari`, `visura_camerale` |
| risparmio | `documento_identita`, `profilo_rischio_mifid` |
| salute | `documento_identita`, `questionario_sanitario` |

---

## 2. Consultazione Stato Pratica (con Riepilogo)

### `GET /api/get-practice-status`

Restituisce lo stato completo della pratica: **riepilogo leggibile di tutti i dati della quotazione**, dati Pet strutturati, documenti obbligatori con stato caricato/mancante, dati finanziari, note, chat e timeline.

**Parametri di Query (usarne uno):**
- `practice_id`: UUID della pratica
- `practice_number`: numero pratica (es. `PR-2026-1045`)

**Esempio di Richiesta:**
```bash
curl -X GET "https://policy-portal-pro.vercel.app/api/get-practice-status?practice_number=PR-2026-1045" \
  -H "X-API-Key: <chiave>"
```

**Risposta di Successo (200 OK):**
```json
{
  "practice_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "practice_number": "PR-2026-1045",
  "practice_type": "pet",
  "practice_type_label": "Pet",
  "status": "in_lavorazione",
  "financial_status": "non_incassata",
  "client": {
    "name": "Mario Rossi",
    "email": "mario.rossi@example.com",
    "phone": "+39 333 1234567",
    "beneficiary": null,
    "tax_code": "RSSMRA80A01H501U"
  },
  "policy": {
    "number": null,
    "start_date": "2026-10-01",
    "end_date": "2027-10-01",
    "days_until_expiry": 389
  },
  "summary": {
    "practice_type": "pet",
    "practice_type_label": "Pet",
    "sections": [
      {
        "id": "contraente",
        "title": "Contraente",
        "items": [
          { "key": "client_name", "label": "Nome / Ragione Sociale", "value": "Mario Rossi" },
          { "key": "owner_tax_code", "label": "Codice Fiscale Proprietario", "value": "RSSMRA80A01H501U" },
          { "key": "client_email", "label": "Email", "value": "mario.rossi@example.com" },
          { "key": "client_phone", "label": "Telefono", "value": "+39 333 1234567" },
          { "key": "client_address", "label": "Indirizzo", "value": "Via Roma 1, 00100 Roma" }
        ]
      },
      {
        "id": "polizza",
        "title": "Polizza",
        "items": [
          { "key": "practice_type", "label": "Tipologia", "value": "Pet" },
          { "key": "policy_start_date", "label": "Decorrenza", "value": "01/10/2026" },
          { "key": "policy_end_date", "label": "Scadenza", "value": "01/10/2027" },
          { "key": "duration", "label": "Durata", "value": "1 anno" }
        ]
      },
      {
        "id": "animale",
        "title": "Animale Assicurato",
        "items": [
          { "key": "pet_name", "label": "Nome Animale", "value": "Fido" },
          { "key": "pet_species", "label": "Specie", "value": "Cane" },
          { "key": "animal_type", "label": "Categoria Tariffaria", "value": "Cane fino a 20 kg" },
          { "key": "pet_breed", "label": "Razza", "value": "Labrador" },
          { "key": "pet_birth_date", "label": "Data di Nascita", "value": "15/03/2021" },
          { "key": "pet_gender", "label": "Sesso", "value": "Maschio" },
          { "key": "pet_microchip", "label": "Numero Microchip", "value": "380260001234567" },
          { "key": "pet_sterilized", "label": "Sterilizzato", "value": "Sì" },
          { "key": "pet_weight", "label": "Peso", "value": "18 kg" },
          { "key": "pet_previous_diseases", "label": "Malattie Pregresse", "value": "Nessuna" }
        ]
      },
      {
        "id": "coperture",
        "title": "Coperture e Preventivo",
        "items": [
          { "key": "coverage_type", "label": "Coperture Richieste", "value": "Copertura Completa (RCT + RSV + TL)" },
          { "key": "coverage_ass_standard", "label": "Assistenza", "value": "Assistenza Standard (14,00 €/anno)" },
          { "key": "coverage_rsv_gold_1000", "label": "Rimborso Spese Veterinarie", "value": "RSV Gold 1.000€ (232,00 €/anno)" },
          { "key": "coverage_rct_100k", "label": "Responsabilità Civile verso Terzi", "value": "RCT 100K€ (40,00 €/anno)" },
          { "key": "coverage_tl_standard", "label": "Tutela Legale", "value": "Tutela Legale Standard (32,00 €/anno)" },
          { "key": "total_annual", "label": "Premio Annuale", "value": "318,00 €" },
          { "key": "total_monthly", "label": "Premio Mensile", "value": "26,50 €" }
        ]
      },
      {
        "id": "premio",
        "title": "Premio",
        "items": [
          { "key": "premium_gross", "label": "Premio Lordo", "value": "318,00 €" }
        ]
      }
    ],
    "pet": {
      "name": "Fido",
      "species": "cane",
      "animal_type": "cani_0_20kg",
      "animal_type_label": "Cane fino a 20 kg",
      "breed": "Labrador",
      "birth_date": "2021-03-15",
      "gender": "maschio",
      "microchip": "380260001234567",
      "sterilized": true,
      "weight_kg": 18,
      "previous_diseases": "Nessuna",
      "owner_tax_code": "RSSMRA80A01H501U",
      "coverage_type": "completa",
      "coverage_type_label": "Copertura Completa (RCT + RSV + TL)",
      "coverages": [
        { "id": "ass_standard", "name": "Assistenza Standard", "category": "assistenza", "category_label": "Assistenza", "description": "Assistenza animali domestici - Prestazioni in natura - Carenza 30 giorni", "price": 14 },
        { "id": "rsv_gold_1000", "name": "RSV Gold 1.000€", "category": "rsv", "category_label": "Rimborso Spese Veterinarie", "description": "Rimborso spese veterinarie - Massimale 1.000€ - Scoperto 10% min €100 - Max 2 sinistri/anno", "price": 232 },
        { "id": "rct_100k", "name": "RCT 100K€", "category": "rct", "category_label": "Responsabilità Civile verso Terzi", "description": "Responsabilità Civile verso Terzi - Massimale 100.000€ - Carenza 30 giorni", "price": 40 },
        { "id": "tl_standard", "name": "Tutela Legale Standard", "category": "tl", "category_label": "Tutela Legale", "description": "Copertura standard - Assistenza legale", "price": 32 }
      ],
      "total_annual": 318,
      "total_monthly": 26.5
    }
  },
  "pet": { "...": "stesso oggetto di summary.pet" },
  "specific_fields": { "pet_name": "Fido", "pet_species": "cane", "...": "tutti i campi inviati" },
  "pet_microchip": "380260001234567",
  "owner_tax_code": "RSSMRA80A01H501U",
  "quote": {
    "premium_net": null,
    "premium_taxable": null,
    "premium_taxes": null,
    "premium_gross": 318.00,
    "commission_percentage": 10,
    "commission_amount": 0
  },
  "payment": {
    "financial_status": "non_incassata",
    "payment_date": null,
    "commission_received_date": null
  },
  "notes": "Fonte: portale-mariano\n\nCliente preferisce essere contattato via email.",
  "notes_chat": [
    { "message": "[Mariano] Ho caricato il libretto sanitario.", "author": "Mariano Del Priore", "created_at": "2026-09-07T10:05:00Z" }
  ],
  "required_documents": [
    { "id": "documento_identita", "label": "Documento d'Identita Proprietario", "description": "Carta d'identita o passaporto", "is_questionnaire": false, "uploaded": true },
    { "id": "libretto_sanitario", "label": "Libretto Sanitario o Certificato Microchip", "description": "Documento veterinario attestante l'identita dell'animale", "is_questionnaire": false, "uploaded": true }
  ],
  "missing_documents": [],
  "documents_complete": true,
  "documents_count": 2,
  "documents": [
    { "id": "doc-uuid", "file_name": "documento_identita_rossi.pdf", "file_size": 102400, "mime_type": "application/pdf", "document_type": "documento_identita", "created_at": "2026-09-07T10:00:00Z" }
  ],
  "timeline": [
    { "event_type": "created", "description": "Pratica creata", "author": "Sistema", "created_at": "2026-09-07T10:00:00Z" }
  ],
  "created_at": "2026-09-07T10:00:00Z",
  "updated_at": "2026-09-07T10:30:00Z"
}
```

**Campi principali della risposta:**
- `summary`: riepilogo pronto per la visualizzazione, per **tutte le tipologie** di polizza. Ogni sezione ha `items` con `label` e `value` gia' formattati (date in formato italiano, importi in euro, opzioni tradotte in etichette). Le sezioni possibili sono `contraente`, `polizza`, `animale` (Pet), `coperture` (Pet), `dati_specifici` (altre tipologie) e `premio`.
- `pet`: dati Pet strutturati (solo per `practice_type = pet`), con l'elenco coperture e i totali del preventivo.
- `specific_fields`: i campi inviati in creazione, cosi' come ricevuti.
- `required_documents` / `missing_documents` / `documents_complete`: stato dei documenti obbligatori.
- `notes`: appunti liberi (non contiene i dati della quotazione).
- `notes_chat`: messaggi scambiati tra partner e operatore.
- `timeline`: eventi della pratica (creazione, cambi stato, documenti).

---

## 3. Messaggistica / Aggiunta Note

### `POST /api/add-practice-note`

Invia un messaggio o una nota testuale sulla pratica. Il messaggio compare nella timeline della pratica sul portale e nell'array `notes_chat` di `get-practice-status`.

**Body della Richiesta:**
```json
{
  "practice_number": "PR-2026-1045",
  "message": "Ecco il libretto sanitario richiesto, l'ho appena caricato.",
  "author_name": "Mariano"
}
```

*E' possibile usare `practice_id` in alternativa a `practice_number`. `author_name` e' opzionale ma consigliato.*

**Risposta di Successo (201 Created):**
```json
{
  "success": true,
  "event_id": "event-uuid",
  "practice_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "message": "Ecco il libretto sanitario richiesto, l'ho appena caricato.",
  "author": "Mariano",
  "created_at": "2026-09-07T11:00:00Z"
}
```

---

## 4. Download Documenti

### `GET /api/get-practice-documents`

Restituisce l'elenco dei documenti allegati con URL pre-firmati temporanei (validita' 1 ora).

**Parametri di Query:** `practice_id` oppure `practice_number`

**Risposta di Successo (200 OK):**
```json
{
  "success": true,
  "practice_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "practice_number": "PR-2026-1045",
  "practice": { "id": "...", "practice_number": "PR-2026-1045", "practice_type": "pet", "client_name": "Mario Rossi", "status": "in_lavorazione", "created_at": "2026-09-07T10:00:00Z" },
  "documents": [
    {
      "id": "doc-uuid",
      "file_name": "documento_identita_rossi.pdf",
      "file_size": 102400,
      "mime_type": "application/pdf",
      "document_type": "documento_identita",
      "created_at": "2026-09-07T10:00:00Z",
      "download_url": "https://[project].supabase.co/storage/v1/object/sign/...",
      "expires_at": "2026-09-07T11:00:00Z"
    }
  ],
  "count": 1
}
```

---

## 5. Elenco Pratiche (Dashboard)

### `GET /api/get-practices`

Elenco delle pratiche visibili alla chiave API, con filtri e paginazione. Utile per costruire la dashboard del partner.

**Parametri di Query (tutti facoltativi):**

| Parametro | Descrizione |
|-----------|-------------|
| `status` | `in_lavorazione`, `in_attesa`, `approvata`, `rifiutata`, `completata` |
| `financial_status` | `non_incassata`, `incassata`, `provvigioni_ricevute` |
| `practice_type` | Tipologia (es. `pet`, `rc`, `casa`) |
| `from`, `to` | Intervallo data creazione (`YYYY-MM-DD`) |
| `search` | Ricerca su numero pratica, nome o email cliente |
| `limit`, `offset` | Paginazione (default 50, max 200) |
| `include_summary` | `true` per includere il riepilogo completo (`summary`) di ogni pratica |

**Esempio:**
```bash
curl "https://policy-portal-pro.vercel.app/api/get-practices?status=in_lavorazione&limit=20&include_summary=true" \
  -H "X-API-Key: <chiave>"
```

**Risposta (200 OK):**
```json
{
  "success": true,
  "total": 42,
  "limit": 20,
  "offset": 0,
  "count": 20,
  "filters": { "status": "in_lavorazione", "financial_status": null, "practice_type": null, "from": null, "to": null, "search": null },
  "practices": [
    {
      "practice_id": "a1b2c3d4-...",
      "practice_number": "PR-2026-1045",
      "practice_type": "pet",
      "practice_type_label": "Pet",
      "status": "in_lavorazione",
      "financial_status": "non_incassata",
      "client": { "name": "Mario Rossi", "email": "mario.rossi@example.com", "phone": "+39 333 1234567", "beneficiary": null, "tax_code": "RSSMRA80A01H501U" },
      "policy": { "number": null, "start_date": "2026-10-01", "end_date": "2027-10-01", "days_until_expiry": 389 },
      "quote": { "premium_net": null, "premium_taxable": null, "premium_taxes": null, "premium_gross": 318, "commission_percentage": 10, "commission_amount": 0 },
      "payment_date": null,
      "commission_received_date": null,
      "pet_microchip": "380260001234567",
      "notes": "Fonte: portale-mariano",
      "specific_fields": { "pet_name": "Fido", "...": "..." },
      "documents_count": 2,
      "created_at": "2026-09-07T10:00:00Z",
      "updated_at": "2026-09-07T10:30:00Z",
      "summary": { "...": "presente solo con include_summary=true" }
    }
  ]
}
```

---

## 6. Scadenzario

### `GET /api/get-expiries`

Polizze in scadenza nei prossimi N giorni, con classificazione di urgenza e stato delle notifiche di scadenza inviate dal portale (90/60/30/7 giorni).

**Parametri di Query:**

| Parametro | Descrizione |
|-----------|-------------|
| `days_ahead` | Giorni di orizzonte (default 90, max 365) |
| `practice_type` | Filtra per tipologia |
| `status` | Filtra per stato pratica (default: tutte tranne `rifiutata`) |
| `include_expired` | `true` per includere anche le polizze scadute negli ultimi 90 giorni |

**Risposta (200 OK):**
```json
{
  "success": true,
  "generated_at": "2026-09-07T12:00:00Z",
  "reference_date": "2026-09-07",
  "days_ahead": 90,
  "include_expired": false,
  "summary": { "expired": 0, "urgent": 2, "soon": 5, "upcoming": 11, "total": 18 },
  "expiries": [
    {
      "practice_id": "a1b2c3d4-...",
      "practice_number": "PR-2025-0871",
      "practice_type": "pet",
      "practice_type_label": "Pet",
      "status": "completata",
      "financial_status": "incassata",
      "client": { "name": "Mario Rossi", "email": "mario.rossi@example.com", "phone": "+39 333 1234567" },
      "policy_number": "POL-123456",
      "policy_start_date": "2025-09-12",
      "policy_end_date": "2026-09-12",
      "premium_gross": 318,
      "days_until_expiry": 5,
      "urgency": "urgent",
      "notifications": { "90_days": true, "60_days": true, "30_days": true, "7_days": false }
    }
  ]
}
```

Valori di `urgency`: `expired` (gia' scaduta), `urgent` (entro 7 giorni), `soon` (8-30 giorni), `upcoming` (oltre 30 giorni).

---

## 7. Report Produzione

### `GET /api/get-reports`

Statistiche di produzione delle pratiche del partner: totali, distribuzione per tipologia e stato, andamento mensile e KPI con confronto rispetto al periodo precedente.

**Parametri di Query:**

| Parametro | Descrizione |
|-----------|-------------|
| `start_date`, `end_date` | Intervallo di analisi (`YYYY-MM-DD`, default: dal 1 gennaio dell'anno corrente a oggi) |
| `period` | Periodo dei KPI: `week`, `month` (default), `quarter`, `year` |

**Risposta (200 OK):**
```json
{
  "success": true,
  "generated_at": "2026-09-07T12:00:00Z",
  "range": { "start_date": "2026-01-01", "end_date": "2026-09-07" },
  "totals": {
    "total_practices": 120,
    "total_premium_gross": 38160.00,
    "total_premium_net": 32000.00,
    "total_commission": 3200.00,
    "avg_premium": 318.00,
    "conversion_rate": 82.5
  },
  "practices_by_type": {
    "pet": { "label": "Pet", "practices": 95, "premium_gross": 30210.00, "premium_net": 25000.00, "commission": 2500.00 },
    "casa": { "label": "Casa", "practices": 25, "premium_gross": 7950.00, "premium_net": 7000.00, "commission": 700.00 }
  },
  "practices_by_status": { "in_lavorazione": 12, "approvata": 30, "completata": 70, "rifiutata": 8 },
  "practices_by_financial_status": { "non_incassata": 20, "incassata": 60, "provvigioni_ricevute": 40 },
  "practices_by_month": [
    { "month": "2026-01", "practices": 10, "premium_gross": 3180.00, "premium_net": 2700.00, "commission": 270.00 }
  ],
  "kpis": {
    "period": "month",
    "current_period_start": "2026-09-01",
    "previous_period_start": "2026-08-01",
    "current_period_practices": 8,
    "current_period_premium": 2544.00,
    "current_period_commission": 254.40,
    "previous_period_practices": 14,
    "previous_period_premium": 4452.00,
    "previous_period_commission": 445.20,
    "growth_practices": -42.86,
    "growth_premium": -42.86,
    "growth_commission": -42.86,
    "expiring_soon": 5
  }
}
```

---

## 8. Amministrazione (Premi, Provvigioni, Incassi)

### `GET /api/get-administration`

Riepilogo finanziario delle pratiche del partner e stato di incasso/liquidazione delle provvigioni, con elenco pratiche.

**Parametri di Query:**

| Parametro | Descrizione |
|-----------|-------------|
| `financial_status` | `non_incassata`, `incassata`, `provvigioni_ricevute` |
| `from`, `to` | Intervallo data creazione (`YYYY-MM-DD`) |
| `search` | Ricerca su numero pratica o nome cliente |
| `limit`, `offset` | Paginazione (default 100, max 500) |

**Risposta (200 OK):**
```json
{
  "success": true,
  "generated_at": "2026-09-07T12:00:00Z",
  "filters": { "financial_status": null, "from": null, "to": null, "search": null },
  "summary": {
    "total_practices": 120,
    "total_premium_gross": 38160.00,
    "total_premium_net": 32000.00,
    "total_commission_amount": 3200.00,
    "non_incassate_count": 20,
    "non_incassate_amount": 6360.00,
    "incassate_count": 60,
    "incassate_amount": 19080.00,
    "incassate_commission": 1600.00,
    "provvigioni_ricevute_count": 40,
    "provvigioni_ricevute_amount": 1066.00,
    "commission_to_receive": 2134.00
  },
  "total": 120,
  "limit": 100,
  "offset": 0,
  "count": 100,
  "practices": [
    {
      "practice_id": "a1b2c3d4-...",
      "practice_number": "PR-2026-1045",
      "practice_type": "pet",
      "practice_type_label": "Pet",
      "status": "completata",
      "financial_status": "incassata",
      "client_name": "Mario Rossi",
      "policy_number": "POL-123456",
      "premium_net": 260.00,
      "premium_gross": 318.00,
      "commission_percentage": 10,
      "commission_amount": 26.00,
      "payment_date": "2026-09-05",
      "commission_received_date": null,
      "created_at": "2026-09-01T10:00:00Z"
    }
  ]
}
```

Significato dei campi del riepilogo:
- `non_incassate_*`: premio non ancora pagato dal cliente
- `incassate_*`: premio pagato, provvigione da liquidare al partner (`incassate_commission`)
- `provvigioni_ricevute_*`: provvigioni gia' liquidate al partner
- `commission_to_receive`: provvigioni ancora da ricevere (pratiche non incassate + incassate)

---

## Tabelle di Riferimento (Enum)

### Stati Pratica (`status`)
| Valore | Descrizione |
|--------|-------------|
| `in_lavorazione` | La pratica e' stata presa in carico da un operatore |
| `in_attesa` | La pratica e' in attesa di documenti o informazioni dal cliente |
| `approvata` | La pratica e' stata approvata dalla compagnia |
| `rifiutata` | La pratica non ha superato l'analisi |
| `completata` | La pratica e' stata emessa e conclusa |

### Stati Finanziari (`financial_status`)
| Valore | Descrizione |
|--------|-------------|
| `non_incassata` | Il premio non e' ancora stato pagato dal cliente |
| `incassata` | Il premio e' stato pagato dal cliente |
| `provvigioni_ricevute` | Le provvigioni sono state liquidate al partner |

### Tipologie Pratica (`practice_type`)
In creazione: `pet`, `car`, `casa`, `fidejussioni`, `rc`, `fotovoltaico`, `catastrofali`, `azienda`, `postuma_decennale`, `all_risk`, `risparmio`, `salute`. Il valore `rc` viene salvato come `responsabilita_civile` e cosi' viene restituito negli endpoint di lettura.

---

## Campi Specifici per Tipologia (`specific_fields`)

I campi specifici vengono inviati in creazione nell'oggetto `specific_fields` e restituiti sia in `specific_fields` sia, gia' formattati con etichette, in `summary.sections`. E' possibile inviare anche campi aggiuntivi non elencati: verranno mostrati nel riepilogo con un'etichetta derivata dal nome del campo.

### Pet
| Campo | Tipo | Obbligatorio | Descrizione |
|-------|------|:---:|-------------|
| `pet_name` | string | Si | Nome dell'animale |
| `pet_species` | string | Si | `cane` o `gatto` |
| `pet_breed` | string | Si | Razza |
| `pet_birth_date` | date | Si | Data di nascita (`YYYY-MM-DD`) |
| `pet_gender` | string | Si | `maschio` o `femmina` |
| `pet_microchip` | string | Si | Numero microchip (15 cifre). Puo' essere passato anche a livello radice |
| `pet_sterilized` | boolean | No | Sterilizzato |
| `pet_weight` | number | Si | Peso in kg (serve a determinare la categoria tariffaria dei cani) |
| `pet_previous_diseases` | string | No | Malattie pregresse |
| `animal_type` | string | Consigliato | Categoria tariffaria: `gatti`, `cani_0_20kg`, `cani_oltre_20kg`. Se assente viene dedotta da specie e peso |
| `coverage_type` | string | Si | `rct`, `rsv`, `rct_rsv`, `completa` |
| `selected_coverages` | string[] | Consigliato | Id delle coperture del preventivo (vedi catalogo sotto) |
| `total_annual` | number | Consigliato | Premio annuale del preventivo (€) |
| `total_monthly` | number | No | Premio mensile del preventivo (€) |
| `client_address` | string | No | Indirizzo del proprietario |

#### Catalogo coperture Pet (`selected_coverages`)
| Id | Copertura | Categoria | Premio annuo |
|----|-----------|-----------|-------------:|
| `ass_standard` | Assistenza Standard (sempre inclusa) | Assistenza | 14,00 € |
| `rsv_silver_500` | RSV Silver 500€ | Rimborso Spese Veterinarie | 141,00 € |
| `rsv_silver_750` | RSV Silver 750€ | Rimborso Spese Veterinarie | 178,00 € |
| `rsv_gold_1000` | RSV Gold 1.000€ | Rimborso Spese Veterinarie | 232,00 € |
| `rsv_gold_2000` | RSV Gold 2.000€ | Rimborso Spese Veterinarie | 308,00 € |
| `rsv_platinum_2500` | RSV Platinum 2.000€ + 500€ | Rimborso Spese Veterinarie | 348,00 € |
| `rsv_platinum_3500` | RSV Platinum 3.000€ + 500€ | Rimborso Spese Veterinarie | 463,00 € |
| `rct_100k` | RCT 100K€ | Responsabilità Civile verso Terzi | 40,00 € |
| `rct_250k` | RCT 250K€ | Responsabilità Civile verso Terzi | 46,00 € |
| `rct_500k` | RCT 500K€ | Responsabilità Civile verso Terzi | 52,00 € |
| `tl_standard` | Tutela Legale Standard | Tutela Legale | 32,00 € |

### Casa
| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `property_type` | string | `appartamento`, `villa`, `bifamiliare`, `terratetto` |
| `property_ownership` | string | `proprieta`, `affitto` |
| `property_sqm` | number | Superficie (mq) |
| `property_floor` | string | `terra`, `rialzato`, `1`, `2`, `3`, `4`, `5+`, `attico` |
| `property_rooms` | number | Numero vani |
| `construction_year` | number | Anno di costruzione |
| `property_alarm`, `property_bars`, `property_armored_door` | boolean | Allarme, inferriate, porta blindata |
| `building_value`, `contents_value` | number | Valore immobile e contenuto (€) |
| `adults_count`, `minors_count` | number | Conviventi maggiorenni / minorenni |
| `claims_last_3_years` | number | Sinistri domestici ultimi 3 anni |

### Responsabilita' Civile (`rc`)
| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `professional_type` | string | `medico`, `ingegnere`, `architetto`, `avvocato`, `commercialista`, `geometra`, `notaio`, `consulente`, `altro` |
| `professional_order` | string | Ordine professionale |
| `registration_number` | string | Numero iscrizione albo |
| `registration_date` | date | Data iscrizione albo |
| `annual_turnover` | number | Fatturato annuo (€) |
| `coverage_limit_per_claim` | string | `500000`, `1000000`, `2000000`, `3000000`, `5000000` |
| `retroactivity` | string | `illimitata`, `10_anni`, `5_anni`, `3_anni`, `1_anno` |
| `postuma` | string | `illimitata`, `10_anni`, `5_anni`, `3_anni` |
| `claims_history` | number | Sinistri ultimi 5 anni |

### CAR
| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `company_name`, `vat_number` | string | Ragione sociale, Partita IVA |
| `construction_site_address` | string | Indirizzo cantiere |
| `client_name` | string | Committente |
| `works_amount`, `insured_value` | number | Importo lavori, valore assicurato (€) |
| `work_type` | string | `nuova_costruzione`, `ristrutturazione`, `ampliamento`, `infrastruttura`, `impianti` |
| `works_start_date`, `works_end_date` | date | Date lavori |
| `maintenance_period_months` | number | Periodo manutenzione (mesi) |
| `project_manager`, `designer` | string | Direttore lavori, progettista |
| `subcontractors` | string | Subappaltatori principali |

### Fidejussioni
| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `company_name`, `vat_number`, `pec_email` | string | Ragione sociale, Partita IVA, PEC |
| `legal_representative` | string | Rappresentante legale |
| `guarantee_amount` | number | Importo garantito (€) |
| `guarantee_type` | string | `definitiva`, `provvisoria`, `anticipazione`, `buona_esecuzione` |
| `sector` | string | `appalti_pubblici`, `appalti_privati`, `forniture`, `servizi`, `altro` |
| `contracting_authority` | string | Ente appaltante |
| `cig_code` | string | CIG |
| `guarantee_object` | string | Oggetto della garanzia |

### Fotovoltaico
| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `owner_type` | string | `privato`, `azienda` |
| `installation_address` | string | Indirizzo installazione |
| `nominal_power` | number | Potenza nominale (kWp) |
| `installation_date` | date | Data installazione |
| `panel_brand`, `inverter_brand` | string | Marca pannelli / inverter |
| `panel_count` | number | Numero pannelli |
| `installation_type` | string | `tetto`, `terra`, `pensilina` |
| `system_value` | number | Valore impianto (€) |
| `has_storage` | boolean | Sistema di accumulo |
| `storage_capacity` | number | Capacita' accumulo (kWh) |

### Catastrofali / Azienda / Postuma Decennale / All Risk / Risparmio / Salute
I campi accettati coincidono con quelli del modulo di caricamento del portale (ragione sociale, Partita IVA, valori assicurati, zona sismica, dati sanitari, ecc.). Qualsiasi campo inviato in `specific_fields` viene comunque conservato e mostrato nel riepilogo.

---

## Documenti Obbligatori per Tipologia

L'array `required_documents` di `get-practice-status` indica per ogni tipologia quali documenti sono richiesti e se sono gia' stati caricati (`uploaded`). Usare gli id indicati come `document_type` in creazione.

### Pet
| Id | Documento |
|----|-----------|
| `documento_identita` | Documento d'Identita' Proprietario |
| `libretto_sanitario` | Libretto Sanitario o Certificato Microchip |

*Per il prodotto Pet non e' previsto alcun questionario.*

### Casa
| Id | Documento |
|----|-----------|
| `documento_identita` | Documento d'Identita' |
| `visura_catastale` | Visura Catastale |
| `questionario_globale_fabbricati` | Questionario Globale Fabbricati (questionario) |

### Fidejussioni
| Id | Documento |
|----|-----------|
| `visura_camerale` | Visura Camerale |
| `documento_identita` | Documento d'Identita' Legale Rappresentante |
| `bilancio_ultimo_anno` | Bilancio Ultimo Anno |
| `atto_gara` | Atto di Gara / Bando |

### CAR
| Id | Documento |
|----|-----------|
| `visura_camerale` | Visura Camerale |
| `documento_identita` | Documento d'Identita' Legale Rappresentante |
| `preventivo_o_contratto` | Preventivo o Contratto Lavori |
| `questionario_car` | Questionario CAR (questionario) |

### Responsabilita' Civile
| Id | Documento |
|----|-----------|
| `visura_camerale` | Visura Camerale |
| `documento_identita` | Documento d'Identita' |
| `questionario_rc` | Questionario RC (questionario) |

### Fotovoltaico
| Id | Documento |
|----|-----------|
| `visura_camerale` | Visura Camerale o Documento d'Identita' |
| `progetto_impianto` | Progetto dell'Impianto |
| `autorizzazione` | Autorizzazione/Permesso |

### Catastrofali
| Id | Documento |
|----|-----------|
| `documento_identita` | Documento d'Identita' |
| `visura_catastale` | Visura Catastale |
| `perizia_immobile` | Perizia o Planimetria Immobile |
| `questionario_rischi_catastrofali` | Questionario Rischi Catastrofali (questionario) |

### Azienda
| Id | Documento |
|----|-----------|
| `visura_camerale` | Visura Camerale |
| `documento_identita` | Documento d'Identita' Legale Rappresentante |
| `bilancio` | Bilancio o Dichiarazione dei Redditi |
| `questionario_rischi_catastrofali_azienda` | Questionario Rischi Catastrofali Azienda (questionario) |

### Postuma Decennale
| Id | Documento |
|----|-----------|
| `visura_camerale` | Visura Camerale |
| `documento_identita` | Documento d'Identita' Legale Rappresentante |
| `collaudo_statico` | Collaudo Statico |
| `progetto_esecutivo` | Progetto Esecutivo |
| `questionario_decennale_postuma` | Questionario Decennale Postuma (questionario) |

### All Risk
| Id | Documento |
|----|-----------|
| `visura_camerale` | Visura Camerale o Documento d'Identita' |
| `documento_identita` | Documento d'Identita' |
| `lista_beni` | Lista Beni/Macchinari |
| `questionario_car_postuma_l210` | Questionario Tutti i Rischi / CAR L210 (questionario) |

### Risparmio / Salute
| Id | Documento |
|----|-----------|
| `documento_identita` | Documento d'Identita' |
| `codice_fiscale` | Tessera Sanitaria / Codice Fiscale |
| `questionario_salute_risparmio` / `questionario_sanitario` | Questionario Sanitario (questionario) |

---

## Visibilita' delle Azioni

### Azioni visibili al partner via API

| Azione operatore | Dove appare nella risposta API |
|-----------------|-------------------------------|
| Cambio stato pratica | Campo `status` + evento in `timeline` (`get-practice-status`, `get-practices`) |
| Cambio stato finanziario / incasso | `financial_status`, `payment`, `get-administration` |
| Inserimento nota/messaggio | Nuovo messaggio in `notes_chat` |
| Caricamento documento | Nuovo elemento in `documents`, `required_documents[x].uploaded = true` |
| Aggiornamento dati finanziari | Oggetto `quote` aggiornato |
| Aggiornamento dati polizza (numero, date) | Oggetto `policy` aggiornato; la scadenza alimenta `get-expiries` |
| Modifica delle note | Campo `notes` aggiornato (i dati della quotazione restano nel riepilogo) |

### Azioni visibili all'operatore nel portale

| Azione partner | Dove appare nel portale |
|----------------|------------------------|
| Creazione pratica via `POST /api/webhook-receive-policy` | Nuova pratica con **Riepilogo Pratica** completo (contraente, polizza, animale, coperture, premio) |
| Invio nota via `POST /api/add-practice-note` | Nella timeline della pratica con il nome indicato in `author_name` |

---

## Codici di Errore

| Codice HTTP | Significato | Quando |
|:-----------:|-------------|--------|
| 200 | Successo | Richiesta completata |
| 201 | Creato | Nota aggiunta con successo |
| 400 | Richiesta non valida | Body non JSON |
| 401 | Non autorizzato | API Key mancante, non valida, disattivata o scaduta; firma HMAC assente o errata |
| 403 | Accesso negato | La pratica non appartiene alla propria API Key |
| 404 | Non trovato | Pratica non esistente |
| 405 | Metodo non consentito | Metodo HTTP errato |
| 422 | Validazione fallita | Campi obbligatori mancanti, tipologia non valida, `specific_fields` non oggetto, importi non numerici, documenti mancanti, parametri di filtro non validi |
| 429 | Troppe richieste | Rate limit superato (100 req/min). Rispettare header `Retry-After` |
| 500 | Errore interno | Errore durante il salvataggio (ritentare con la stessa idempotency key) |
| 503 | Servizio non disponibile | Errore temporaneo di connessione al database |

---

## Note di Migrazione dalla versione 2.0

- I dati della quotazione vanno ora inviati in `specific_fields` (oggetto JSON) invece che dentro `notes`. Il vecchio formato con separatore resta accettato.
- Per Pet inviare anche `animal_type`, `selected_coverages`, `total_annual` e `total_monthly` per avere il riepilogo coperture completo.
- Il questionario Pet (`questionario_pet`) e' stato rimosso: per Pet sono richiesti solo documento d'identita' e libretto sanitario/microchip.
- `get-practice-status` restituisce i nuovi campi `summary`, `pet`, `client.tax_code`, `policy.days_until_expiry`, `payment`, `missing_documents`, `documents_complete`.
- Nuovi endpoint: `get-practices`, `get-expiries`, `get-reports`, `get-administration`.

## Note versione 2.3

- Pet: alla creazione della pratica viene generato e allegato automaticamente il PDF "Ricapitolo Richiesta per <nome animale>" (`document_type = preventivo_pet`), scaricabile via `get-practice-documents`. La risposta del webhook include `quote_document`.

## Note versione 2.2

- Lo stato "caricato/mancante" dei documenti obbligatori riconosce anche le keyword storiche usate in creazione (`libretto_sanitario_o_microchip`, `microchip`, `documento_identita_legale_rappresentante`, `atto_gara_bando`, `lista_macchinari`, ...): le pratiche gia' inviate risultano complete senza reinvio.
- Le date in formato italiano `DD/MM/YYYY` dentro `specific_fields` vengono interpretate correttamente nel riepilogo.
- Per Pet, se manca `premium_gross` e `total_annual`, il premio lordo viene calcolato dalla somma delle `selected_coverages`.
- Il controllo di idempotenza confronta la chiave in modo esatto (nessuna collisione tra chiavi con lo stesso prefisso).

---

*Documento tecnico a cura di Anton Carlo Santoro - Policy Portal Pro*
