# Guida all'Integrazione API - Policy Portal Pro

**Data:** Luglio 2026
**Autore:** Anton Carlo Santoro

Questa guida documenta tutti gli endpoint disponibili per l'integrazione con Policy Portal Pro, inclusi i nuovi aggiornamenti per la gestione completa dello stato della pratica, dei documenti obbligatori e del sistema di messaggistica bidirezionale.

---

## Informazioni Generali

- **Base URL:** `https://policy-portal-pro.vercel.app`
- **Autenticazione:** Header `X-API-Key`
- **Rate Limit:** 100 richieste al minuto per IP
- **Formato Dati:** JSON (`Content-Type: application/json`)
- **Tenant Isolation:** Ogni API Key puo accedere e gestire esclusivamente le proprie pratiche.

---

## 1. Creazione Pratica

### `POST /api/webhook-receive-policy`

Crea una nuova pratica nel portale, caricando i dati del cliente, della polizza e i documenti allegati.

**Body della Richiesta:**
```json
{
  "source": "partner_portal",
  "idempotency_key": "unique-id-12345",
  "practice_type": "pet",
  "client_name": "Mario Rossi",
  "client_email": "mario.rossi@example.com",
  "client_phone": "+39 123 456 7890",
  "beneficiary": "Mario Rossi",
  "policy_number": "POL-123456",
  "policy_start_date": "2026-07-01",
  "policy_end_date": "2027-07-01",
  "notes": "--- Dati Specifici Polizza ---\n{\n  \"pet_name\": \"Fido\",\n  \"pet_species\": \"cane\",\n  \"pet_breed\": \"Labrador\",\n  \"pet_weight\": 25,\n  \"coverage_type\": \"completa\"\n}",
  "documents": [
    {
      "filename": "documento_identita.pdf",
      "mime_type": "application/pdf",
      "content_base64": "JVBERi0xLjQKJcOkw... (base64 string)",
      "document_type": "documento_identita"
    }
  ]
}
```

**Campi Specifici per Tipologia (Pet, Casa, ecc.):**
I campi specifici devono essere inseriti all'interno del campo `notes`, separati dalla stringa esatta `--- Dati Specifici Polizza ---` seguita da un oggetto JSON.

**Risposta di Successo (200 OK):**
```json
{
  "success": true,
  "practice_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "practice_number": "PR-2026-1045",
  "message": "Pratica creata con successo."
}
```

---

## 2. Consultazione Stato Pratica (Aggiornato)

### `GET /api/get-practice-status`

Restituisce lo stato completo e aggiornato della pratica, inclusi i dati specifici, lo stato dei documenti obbligatori, i dati finanziari (preventivo/provvigioni) e la cronologia degli eventi e dei messaggi.

**Parametri di Query (usarne uno dei due):**
- `practice_id`: UUID della pratica
- `practice_number`: Numero della pratica (es. PR-2026-1045)

**Esempio di Richiesta:**
`GET /api/get-practice-status?practice_number=PR-2026-1045`

**Risposta di Successo (200 OK):**
```json
{
  "practice_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "practice_number": "PR-2026-1045",
  "practice_type": "pet",
  "status": "in_lavorazione",
  "financial_status": "non_incassata",
  "client": {
    "name": "Mario Rossi",
    "email": "mario.rossi@example.com",
    "phone": "+39 123 456 7890",
    "beneficiary": "Mario Rossi"
  },
  "policy": {
    "number": "POL-123456",
    "start_date": "2026-07-01",
    "end_date": "2027-07-01"
  },
  "specific_fields": {
    "pet_name": "Fido",
    "pet_species": "cane",
    "pet_breed": "Labrador",
    "pet_weight": 25,
    "coverage_type": "completa"
  },
  "pet_microchip": "123456789012345",
  "owner_tax_code": "RSSMRA80A01H501U",
  "quote": {
    "premium_net": 1000.00,
    "premium_taxable": 1050.00,
    "premium_taxes": 50.00,
    "premium_gross": 1100.00,
    "commission_percentage": 10,
    "commission_amount": 100.00
  },
  "notes": "Pratica inserita da portale partner.",
  "required_documents": [
    {
      "id": "documento_identita",
      "label": "Documento d'Identita Proprietario",
      "description": "Carta d'identita o passaporto",
      "is_questionnaire": false,
      "uploaded": true
    },
    {
      "id": "libretto_sanitario",
      "label": "Libretto Sanitario o Certificato Microchip",
      "description": "Documento veterinario attestante l'identita dell'animale",
      "is_questionnaire": false,
      "uploaded": false
    },
    {
      "id": "questionario_pet",
      "label": "Questionario Pet Compilato e Firmato",
      "description": "Questionario sullo stato di salute dell'animale",
      "is_questionnaire": true,
      "uploaded": false
    }
  ],
  "documents_count": 1,
  "documents": [
    {
      "id": "doc-uuid",
      "file_name": "documento_identita.pdf",
      "file_size": 102400,
      "mime_type": "application/pdf",
      "document_type": "documento_identita",
      "created_at": "2026-07-09T10:00:00Z"
    }
  ],
  "notes_chat": [
    {
      "message": "Ciao, ho inserito la pratica. Manca il libretto sanitario, lo invio a breve.",
      "author": "Federico M.",
      "created_at": "2026-07-09T10:05:00Z"
    },
    {
      "message": "Perfetto, resto in attesa del libretto per procedere con l'emissione.",
      "author": "Anton Carlo",
      "created_at": "2026-07-09T10:30:00Z"
    }
  ],
  "timeline": [
    {
      "event_type": "created",
      "description": "Pratica creata",
      "author": "Sistema",
      "created_at": "2026-07-09T10:00:00Z"
    },
    {
      "event_type": "status_change",
      "description": "Stato cambiato da in_attesa a in_lavorazione",
      "author": "Anton Carlo",
      "created_at": "2026-07-09T10:30:00Z"
    }
  ],
  "created_at": "2026-07-09T10:00:00Z",
  "updated_at": "2026-07-09T10:30:00Z"
}
```

---

## 3. Messaggistica / Aggiunta Note (Nuovo)

### `POST /api/add-practice-note`

Permette al partner di inviare un messaggio o una nota testuale relativa a una pratica specifica. Il messaggio apparira nella timeline della pratica sul portale e verra restituito nell'array `notes_chat` dell'endpoint `get-practice-status`.

**Body della Richiesta:**
```json
{
  "practice_number": "PR-2026-1045",
  "message": "Ecco il libretto sanitario richiesto, l'ho appena caricato.",
  "author_name": "Federico M."
}
```

*Nota: e possibile usare `practice_id` in alternativa a `practice_number`. Il campo `author_name` e opzionale ma consigliato per identificare chi ha scritto il messaggio.*

**Risposta di Successo (201 Created):**
```json
{
  "success": true,
  "event_id": "event-uuid",
  "practice_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "message": "Ecco il libretto sanitario richiesto, l'ho appena caricato.",
  "author": "Federico M.",
  "created_at": "2026-07-09T11:00:00Z"
}
```

---

## 4. Download Documenti

### `GET /api/get-practice-documents`

Restituisce l'elenco dei documenti allegati a una pratica con i relativi URL pre-firmati temporanei per il download sicuro.

**Parametri di Query:**
- `practice_id` oppure `practice_number`

**Risposta di Successo (200 OK):**
```json
{
  "practice_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "practice_number": "PR-2026-1045",
  "documents": [
    {
      "id": "doc-uuid",
      "file_name": "documento_identita.pdf",
      "file_size": 102400,
      "mime_type": "application/pdf",
      "created_at": "2026-07-09T10:00:00Z",
      "download_url": "https://[project].supabase.co/storage/v1/object/sign/...",
      "expires_at": "2026-07-09T11:00:00Z"
    }
  ]
}
```

*Nota: I `download_url` hanno una validita di 1 ora dal momento della richiesta.*

---

## Tabelle di Riferimento (Enum)

### Stati Pratica (`status`)
| Valore | Descrizione |
|--------|-------------|
| `in_lavorazione` | La pratica e stata presa in carico da un operatore |
| `in_attesa` | La pratica e in attesa di documenti o informazioni dal cliente |
| `approvata` | La pratica e stata approvata dalla compagnia |
| `rifiutata` | La pratica non ha superato l'analisi |
| `completata` | La pratica e stata emessa e conclusa |

### Stati Finanziari (`financial_status`)
| Valore | Descrizione |
|--------|-------------|
| `non_incassata` | Il premio non e ancora stato pagato dal cliente |
| `incassata` | Il premio e stato pagato dal cliente |
| `provvigioni_ricevute` | Le provvigioni sono state liquidate al partner |

### Tipologie Pratica (`practice_type`)
I valori supportati includono: `pet`, `auto`, `casa`, `vita`, `salute`, `responsabilita`, `fidejussioni`, `car`, `postuma_decennale`, `all_risk`, `responsabilita_civile`, `fotovoltaico`, `catastrofali`, `azienda`, `risparmio`, `altro`.


---

## Campi Specifici per Tipologia (specific_fields)

I campi specifici vengono restituiti nell'oggetto `specific_fields` della risposta di `get-practice-status`. Di seguito la lista completa per ogni tipologia supportata.

### Pet
| Campo | Tipo | Obbligatorio | Descrizione |
|-------|------|:---:|-------------|
| `pet_name` | string | Si | Nome dell'animale |
| `pet_species` | string | Si | Specie: "cane" o "gatto" |
| `pet_breed` | string | Si | Razza dell'animale |
| `pet_birth_date` | date | Si | Data di nascita (YYYY-MM-DD) |
| `pet_gender` | string | Si | Sesso: "maschio" o "femmina" |
| `pet_microchip` | string | Si | Numero microchip (15 cifre) |
| `pet_sterilized` | boolean | No | Se l'animale e sterilizzato |
| `pet_weight` | number | Si | Peso in kg |
| `pet_previous_diseases` | string | No | Malattie pregresse |
| `coverage_type` | string | Si | Tipo copertura: "rct", "rsv", "rct_rsv", "completa" |

### Casa
| Campo | Tipo | Obbligatorio | Descrizione |
|-------|------|:---:|-------------|
| `property_type` | string | Si | Tipo immobile |
| `property_address` | string | Si | Indirizzo immobile |
| `property_value` | number | Si | Valore immobile |
| `construction_year` | number | No | Anno di costruzione |

### Fotovoltaico
| Campo | Tipo | Obbligatorio | Descrizione |
|-------|------|:---:|-------------|
| `owner_type` | string | Si | "privato" o "azienda" |
| `plant_power_kw` | number | Si | Potenza impianto in kW |
| `plant_address` | string | Si | Indirizzo impianto |
| `installation_date` | date | No | Data installazione |

---

## Documenti Obbligatori per Tipologia

L'array `required_documents` nella risposta di `get-practice-status` indica per ogni tipologia quali documenti sono richiesti e se sono gia stati caricati. Il campo `uploaded` vale `true` se il documento e presente, `false` se manca.

### Pet
| Documento | Tipo |
|-----------|------|
| Documento d'Identita Proprietario | Obbligatorio |
| Libretto Sanitario o Certificato Microchip | Obbligatorio |
| Questionario Pet Compilato e Firmato | Questionario |

### Casa
| Documento | Tipo |
|-----------|------|
| Documento d'Identita | Obbligatorio |
| Visura Catastale | Obbligatorio |
| Questionario Globale Fabbricati | Questionario |

### Fidejussioni
| Documento | Tipo |
|-----------|------|
| Visura Camerale | Obbligatorio |
| Documento d'Identita Legale Rappresentante | Obbligatorio |
| Bilancio Ultimo Anno | Obbligatorio |
| Atto di Gara / Bando | Obbligatorio |

### CAR
| Documento | Tipo |
|-----------|------|
| Visura Camerale | Obbligatorio |
| Documento d'Identita Legale Rappresentante | Obbligatorio |
| Preventivo o Contratto Lavori | Obbligatorio |
| Questionario CAR | Questionario |

### Responsabilita Civile
| Documento | Tipo |
|-----------|------|
| Visura Camerale | Obbligatorio |
| Documento d'Identita | Obbligatorio |
| Questionario RC | Questionario |

### Fotovoltaico
| Documento | Tipo |
|-----------|------|
| Visura Camerale o Documento d'Identita | Obbligatorio |
| Progetto dell'Impianto | Obbligatorio |
| Autorizzazione/Permesso | Obbligatorio |

### Catastrofali
| Documento | Tipo |
|-----------|------|
| Documento d'Identita | Obbligatorio |
| Visura Catastale | Obbligatorio |
| Perizia o Planimetria Immobile | Obbligatorio |
| Questionario Rischi Catastrofali | Questionario |

### Azienda
| Documento | Tipo |
|-----------|------|
| Visura Camerale | Obbligatorio |
| Documento d'Identita Legale Rappresentante | Obbligatorio |
| Bilancio o Dichiarazione dei Redditi | Obbligatorio |
| Questionario Rischi Catastrofali Azienda | Questionario |

---

## Visibilita delle Azioni

Il sistema garantisce la visibilita bidirezionale di tutte le azioni effettuate sulla pratica.

### Azioni visibili al partner via API

Quando l'operatore del portale (Anton Carlo) esegue una delle seguenti azioni, il partner le vedra alla successiva chiamata `GET /api/get-practice-status`:

| Azione operatore | Dove appare nella risposta API |
|-----------------|-------------------------------|
| Cambio stato pratica (es. da "in_lavorazione" a "approvata") | Campo `status` aggiornato + nuovo evento in `timeline` con tipo "status_change" |
| Cambio stato finanziario (es. da "non_incassata" a "incassata") | Campo `financial_status` aggiornato |
| Inserimento nota/messaggio | Nuovo messaggio in `notes_chat` con nome autore dell'operatore |
| Caricamento documento | Nuovo elemento in `documents` + `required_documents[x].uploaded` diventa `true` |
| Aggiornamento dati finanziari (preventivo) | Oggetto `quote` aggiornato con nuovi valori |
| Aggiornamento dati polizza (numero, date) | Oggetto `policy` aggiornato |

### Azioni visibili all'operatore nel portale

Quando il partner esegue una delle seguenti azioni via API, l'operatore le vedra nella timeline della pratica nel portale:

| Azione partner | Dove appare nel portale |
|----------------|------------------------|
| Invio nota via `POST /api/add-practice-note` | Nella timeline della pratica con il nome indicato in `author_name` |
| Creazione pratica via `POST /api/webhook-receive-policy` | Nuova pratica con evento "Pratica creata" nella timeline |

---

## Codici di Errore

| Codice HTTP | Significato | Quando |
|:-----------:|-------------|--------|
| 200 | Successo | Richiesta GET completata |
| 201 | Creato | Nota aggiunta con successo |
| 401 | Non autorizzato | API Key mancante, non valida, disattivata o scaduta |
| 403 | Accesso negato | La pratica non appartiene alla propria API Key (tenant isolation) |
| 404 | Non trovato | Pratica non esistente con l'ID o numero fornito |
| 405 | Metodo non consentito | Metodo HTTP errato (es. POST su un endpoint GET) |
| 422 | Parametri mancanti | Campi obbligatori non forniti nel body o nei query params |
| 429 | Troppe richieste | Rate limit superato (100 req/min). Rispettare header `Retry-After` |
| 500 | Errore interno | Errore durante il salvataggio (riprovare) |
| 503 | Servizio non disponibile | Errore temporaneo di connessione al database |

---

## Riepilogo Endpoint

| Metodo | Endpoint | Funzione |
|:------:|----------|----------|
| POST | `/api/webhook-receive-policy` | Creazione nuova pratica con documenti |
| GET | `/api/get-practice-status` | Stato completo della pratica (dati, documenti obbligatori, chat, timeline) |
| POST | `/api/add-practice-note` | Invio messaggio/nota sulla pratica |
| GET | `/api/get-practice-documents` | Download documenti con URL pre-firmati |

---

*Documento tecnico a cura di Anton Carlo Santoro - Policy Portal Pro*
