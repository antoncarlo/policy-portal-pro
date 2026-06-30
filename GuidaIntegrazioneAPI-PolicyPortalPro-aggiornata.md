# Guida Integrazione API - Policy Portal Pro
**Versione:** 1.2.0
**Data:** Giugno 2026

Questa guida descrive l'integrazione con le API di **Policy Portal Pro**, consentendo ai partner di creare nuove pratiche, recuperare documenti associati e interrogare lo stato delle pratiche in modo programmatico.

---

## 1. Autenticazione

Tutte le richieste API devono essere autenticate tramite un header HTTP dedicato. Policy Portal Pro utilizza un sistema di API Key multi-tenant, che garantisce l'isolamento dei dati: una chiave API può accedere solo alle pratiche create con essa.

**Header richiesto:**
`X-API-Key: <LaTuaChiaveAPI>`

> **Nota di Sicurezza:** La chiave API deve essere conservata in modo sicuro e mai esposta nel codice lato client (es. frontend JavaScript). Tutte le chiamate devono partire dal vostro backend.

---

## 2. Endpoint Disponibili

### 2.1. Creazione Pratica (POST /api/webhook-receive-policy)

Questo endpoint permette di creare una nuova pratica nel sistema. È utilizzato principalmente per ricevere dati da webhook esterni (es. Make, Zapier) o integrazioni dirette.

**URL Endpoint:**
`POST https://policy-portal-pro.vercel.app/api/webhook-receive-policy`

**Headers:**
* `Content-Type: application/json`
* `X-API-Key: <LaTuaChiaveAPI>`

**Esempio di Payload (JSON):**
```json
{
  "practice_type": "auto",
  "client_name": "Mario Rossi",
  "client_email": "mario.rossi@example.com",
  "client_phone": "+393331234567",
  "policy_number": "POL-98765",
  "premium_gross": 488.00,
  "premium_net": 400.00,
  "premium_taxes": 88.00,
  "commission_percentage": 10.00,
  "commission_amount": 40.00,
  "notes": "Cliente VIP. Contattare solo via email."
}
```

**Esempio di Risposta (200 OK):**
```json
{
  "success": true,
  "practice_id": "123e4567-e89b-12d3-a456-426614174000",
  "practice_number": "PR-2023-001",
  "message": "Pratica creata con successo"
}
```

---

### 2.2. Recupero Stato Pratica (GET /api/get-practice-status)

Questo endpoint permette di recuperare lo stato aggiornato di una pratica, includendo i dati del cliente, della polizza, le informazioni finanziarie (bozza preventivo/quote), i metadati dei documenti associati e la timeline degli eventi.

**URL Endpoint:**
`GET https://policy-portal-pro.vercel.app/api/get-practice-status`

**Parametri di Query (Query String):**
È obbligatorio fornire **almeno uno** dei seguenti parametri:
* `practice_id` (string): L'ID univoco interno della pratica.
* `practice_number` (string): Il numero pratica leggibile (es. `PR-2023-001`).

**Esempio di Richiesta:**
```bash
curl -X GET "https://policy-portal-pro.vercel.app/api/get-practice-status?practice_number=PR-2023-001" \
  -H "X-API-Key: <LaTuaChiaveAPI>"
```

**Esempio di Risposta (200 OK):**
```json
{
  "practice_id": "123e4567-e89b-12d3-a456-426614174000",
  "practice_number": "PR-2023-001",
  "practice_type": "auto",
  "status": "approvata",
  "financial_status": "incassata",
  "client": {
    "name": "Mario Rossi",
    "email": "mario.rossi@example.com",
    "phone": "+393331234567",
    "beneficiary": null
  },
  "policy": {
    "number": "POL-98765",
    "start_date": "2023-01-01",
    "end_date": "2024-01-01"
  },
  "quote": {
    "premium_net": 400.00,
    "premium_taxable": 400.00,
    "premium_taxes": 88.00,
    "premium_gross": 488.00,
    "commission_percentage": 10.00,
    "commission_amount": 40.00
  },
  "notes": "Pratica approvata con successo.",
  "documents_count": 1,
  "documents": [
    {
      "id": "doc-1",
      "file_name": "documento_identita.pdf",
      "file_size": 1024500,
      "mime_type": "application/pdf",
      "document_type": "identity",
      "created_at": "2023-01-01T10:00:00Z"
    }
  ],
  "events": [
    {
      "event_type": "status_change",
      "description": "Pratica passata da in_lavorazione a approvata",
      "created_at": "2023-01-02T15:30:00Z"
    }
  ],
  "created_at": "2023-01-01T09:00:00Z",
  "updated_at": "2023-01-02T15:30:00Z"
}
```

**Dettaglio Campi Risposta:**
* `status`: `in_lavorazione`, `in_attesa`, `approvata`, `rifiutata`, `completata`.
* `financial_status`: `non_incassata`, `incassata`, `provvigioni_ricevute`.
* `quote`: Contiene i dati finanziari e provvigionali della pratica.
* `documents`: Restituisce solo i metadati dei documenti (fino a 100). Per scaricare i file effettivi, utilizzare l'endpoint `/api/get-practice-documents`.
* `events`: Restituisce la timeline degli eventi associati alla pratica (fino a 50 eventi).

---

### 2.3. Download Documenti (GET /api/get-practice-documents)

Questo endpoint restituisce i link firmati (signed URLs) per il download sicuro dei documenti associati a una pratica. I link generati hanno una validità limitata nel tempo (1 ora).

**URL Endpoint:**
`GET https://policy-portal-pro.vercel.app/api/get-practice-documents`

**Parametri di Query (Query String):**
È obbligatorio fornire **almeno uno** dei seguenti parametri:
* `practice_id` (string): L'ID univoco interno della pratica.
* `practice_number` (string): Il numero pratica leggibile.

**Esempio di Richiesta:**
```bash
curl -X GET "https://policy-portal-pro.vercel.app/api/get-practice-documents?practice_number=PR-2023-001" \
  -H "X-API-Key: <LaTuaChiaveAPI>"
```

**Esempio di Risposta (200 OK):**
```json
{
  "practice_id": "123e4567-e89b-12d3-a456-426614174000",
  "practice_number": "PR-2023-001",
  "documents": [
    {
      "id": "doc-1",
      "file_name": "documento_identita.pdf",
      "file_size": 1024500,
      "mime_type": "application/pdf",
      "created_at": "2023-01-01T10:00:00Z",
      "download_url": "https://[PROJECT_REF].supabase.co/storage/v1/object/sign/practice-documents/..."
    }
  ]
}
```

---

## 3. Gestione Errori

Le API utilizzano i codici di stato HTTP standard per indicare l'esito della richiesta:

* **200 OK:** La richiesta è andata a buon fine.
* **401 Unauthorized:** Chiave API mancante, non valida o disattivata.
* **403 Forbidden:** La chiave API fornita non ha i permessi per accedere alla pratica richiesta (Tenant isolation).
* **404 Not Found:** La pratica specificata non esiste.
* **405 Method Not Allowed:** Il metodo HTTP utilizzato non è corretto (es. GET invece di POST).
* **422 Unprocessable Entity:** Parametri mancanti o non validi.
* **429 Too Many Requests:** È stato superato il limite di richieste consentite (Rate Limiting: 100 req/min).
* **500/503 Server Error:** Errore interno del server o servizio temporaneamente non disponibile.

In caso di errore, il corpo della risposta conterrà un oggetto JSON con il dettaglio del problema:
```json
{
  "error": "Accesso negato: questa pratica non appartiene alla tua chiave API."
}
```

---

## 4. Limiti e Performance (Rate Limiting)

Per garantire la stabilità del servizio, tutte le API implementano un sistema di **Rate Limiting**:
* **Limite:** 100 richieste al minuto per indirizzo IP.
* **Comportamento:** Al superamento del limite, l'API restituirà un errore `429 Too Many Requests` e includerà un header `Retry-After` con il numero di secondi da attendere prima di poter effettuare nuove richieste.

Si consiglia di implementare una logica di *exponential backoff* nei vostri sistemi in caso di ricezione del codice 429.

---

## 5. Modulo VIES (Batch Upload)

Il modulo VIES (Vat Information Exchange System) gestisce caricamenti massivi di pratiche tramite file ZIP contenenti documenti e un file Excel di riconciliazione.

L'elaborazione dei batch VIES avviene in modo asincrono:
1. Il file ZIP viene caricato tramite protocollo TUS resumable (gestito dall'interfaccia web).
2. Un job di elaborazione viene accodato.
3. Il processo `cron-vies-orchestrator` elabora sequenzialmente i file all'interno dello ZIP (con un limite di concorrenza per ottimizzare le risorse).
4. Le pratiche vengono materializzate nel database.

Per interrogare lo stato delle pratiche VIES materializzate, è possibile utilizzare i normali endpoint di lettura descritti in questa guida (es. `/api/get-practice-status`).

---

*Documento generato automaticamente. Per supporto tecnico, contattare l'amministratore del portale.*
