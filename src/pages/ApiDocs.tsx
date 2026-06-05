import React from 'react';

const BRAND = '#2A3660';

const styles = {
  page: {
    fontFamily: 'Arial, sans-serif',
    color: '#1a1a2e',
    background: '#fff',
    minHeight: '100vh',
    padding: '0',
  } as React.CSSProperties,
  header: {
    background: BRAND,
    color: '#fff',
    padding: '32px 40px',
  } as React.CSSProperties,
  headerTitle: {
    margin: '0 0 8px',
    fontSize: '28px',
    fontWeight: 700,
  } as React.CSSProperties,
  headerSub: {
    margin: 0,
    color: '#a8b8d8',
    fontSize: '15px',
  } as React.CSSProperties,
  nav: {
    background: '#f4f6fb',
    borderBottom: '1px solid #dde3f0',
    padding: '0 40px',
    display: 'flex',
    gap: '0',
    overflowX: 'auto' as const,
  } as React.CSSProperties,
  navLink: {
    display: 'inline-block',
    padding: '14px 20px',
    color: BRAND,
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: '14px',
    whiteSpace: 'nowrap' as const,
    borderBottom: '3px solid transparent',
    cursor: 'pointer',
  } as React.CSSProperties,
  container: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '40px',
  } as React.CSSProperties,
  section: {
    marginBottom: '48px',
  } as React.CSSProperties,
  h2: {
    fontSize: '22px',
    fontWeight: 700,
    color: BRAND,
    borderBottom: `3px solid ${BRAND}`,
    paddingBottom: '8px',
    marginBottom: '20px',
  } as React.CSSProperties,
  h3: {
    fontSize: '17px',
    fontWeight: 700,
    color: '#374151',
    marginBottom: '12px',
    marginTop: '24px',
  } as React.CSSProperties,
  p: {
    lineHeight: '1.7',
    color: '#374151',
    marginBottom: '12px',
  } as React.CSSProperties,
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '14px',
    marginBottom: '16px',
  } as React.CSSProperties,
  th: {
    background: BRAND,
    color: '#fff',
    padding: '10px 14px',
    textAlign: 'left' as const,
    fontWeight: 600,
  } as React.CSSProperties,
  td: {
    padding: '9px 14px',
    borderBottom: '1px solid #e5e7eb',
    verticalAlign: 'top' as const,
  } as React.CSSProperties,
  tdAlt: {
    padding: '9px 14px',
    borderBottom: '1px solid #e5e7eb',
    background: '#f9fafb',
    verticalAlign: 'top' as const,
  } as React.CSSProperties,
  code: {
    display: 'block',
    background: '#1e2a3a',
    color: '#e2e8f0',
    padding: '20px 24px',
    borderRadius: '8px',
    fontSize: '13px',
    lineHeight: '1.6',
    overflowX: 'auto' as const,
    whiteSpace: 'pre' as const,
    fontFamily: "'Courier New', monospace",
    marginBottom: '16px',
  } as React.CSSProperties,
  inlineCode: {
    background: '#f1f5f9',
    color: '#c7254e',
    padding: '2px 6px',
    borderRadius: '4px',
    fontFamily: "'Courier New', monospace",
    fontSize: '13px',
  } as React.CSSProperties,
  badge: (color: string) => ({
    display: 'inline-block',
    background: color,
    color: '#fff',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 700,
  } as React.CSSProperties),
  infoBox: {
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '8px',
    padding: '16px 20px',
    marginBottom: '16px',
    color: '#1e40af',
    fontSize: '14px',
    lineHeight: '1.6',
  } as React.CSSProperties,
  footer: {
    background: '#f4f6fb',
    borderTop: '1px solid #dde3f0',
    padding: '24px 40px',
    textAlign: 'center' as const,
    color: '#6b7280',
    fontSize: '14px',
  } as React.CSSProperties,
};

const requiredDocsByType: Record<string, string[]> = {
  Car: ['preventivo_o_contratto', 'visura_camerale'],
  Fidejussioni: ['visura_camerale', 'bilancio_ultimo_anno', 'documento_identita_legale_rappresentante'],
  'Postuma Decennale': ['collaudo_statico', 'progetto_esecutivo', 'visura_camerale'],
  'All Risk': ['lista_macchinari', 'visura_camerale'],
  RC: ['visura_camerale', 'documento_identita'],
  Pet: ['libretto_sanitario_o_microchip'],
  Fotovoltaico: ['progetto_impianto', 'visura_camerale'],
  Catastrofali: ['perizia_immobile', 'visura_catastale'],
  Azienda: ['visura_camerale', 'bilancio'],
  Casa: ['visura_catastale', 'documento_identita'],
  Risparmio: ['documento_identita', 'profilo_rischio_mifid'],
  Salute: ['documento_identita', 'questionario_sanitario'],
};

const responseCodes = [
  { code: '200', color: '#16a34a', desc: 'Successo — pratica creata o già esistente (idempotency).' },
  { code: '400', color: '#ca8a04', desc: 'Corpo della richiesta non valido o non JSON.' },
  { code: '401', color: '#dc2626', desc: 'API Key mancante/non valida o firma HMAC non valida.' },
  { code: '403', color: '#dc2626', desc: 'IP non autorizzato (whitelist attiva).' },
  { code: '405', color: '#6b7280', desc: 'Metodo HTTP non consentito (solo POST).' },
  { code: '422', color: '#d97706', desc: 'Errore di validazione: campi mancanti, tipo non valido, documenti obbligatori assenti.' },
  { code: '429', color: '#7c3aed', desc: 'Troppe richieste — limite 100 req/min per IP. Vedere header Retry-After.' },
  { code: '500', color: '#dc2626', desc: 'Errore interno del server.' },
];

const jsExample = `const crypto = require('crypto');

const PORTAL_API_KEY = 'your-api-key';
const WEBHOOK_SECRET = 'your-hmac-secret';
const ENDPOINT = 'https://your-app.vercel.app/api/webhook-receive-policy';

const body = {
  source: 'portale-agente-xyz',
  practice_type: 'car',
  client_name: 'Mario Rossi',
  client_email: 'mario.rossi@example.com',
  client_phone: '+39 123 456 7890',
  policy_start_date: '2026-01-01',
  policy_end_date: '2027-01-01',
  documents: [
    {
      filename: 'preventivo_o_contratto.pdf',
      content_base64: '<base64-encoded-content>',
      mime_type: 'application/pdf',
    },
    {
      filename: 'visura_camerale.pdf',
      content_base64: '<base64-encoded-content>',
      mime_type: 'application/pdf',
    },
  ],
};

const rawBody = JSON.stringify(body);
const signature = 'sha256=' +
  crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');

const response = await fetch(ENDPOINT, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': PORTAL_API_KEY,
    'X-Signature': signature,
    'X-Idempotency-Key': 'unique-request-id-12345',
  },
  body: rawBody,
});

const result = await response.json();
console.log(result);
// { success: true, practice_id: "...", practice_number: "PR-2026-1234", message: "Pratica creata con successo." }`;

const pythonExample = `import json, hmac, hashlib, requests

PORTAL_API_KEY = 'your-api-key'
WEBHOOK_SECRET = 'your-hmac-secret'
ENDPOINT = 'https://your-app.vercel.app/api/webhook-receive-policy'

body = {
    'source': 'portale-agente-xyz',
    'practice_type': 'car',
    'client_name': 'Mario Rossi',
    'client_email': 'mario.rossi@example.com',
    'client_phone': '+39 123 456 7890',
    'documents': [
        {
            'filename': 'preventivo_o_contratto.pdf',
            'content_base64': '<base64-encoded-content>',
            'mime_type': 'application/pdf',
        },
        {
            'filename': 'visura_camerale.pdf',
            'content_base64': '<base64-encoded-content>',
            'mime_type': 'application/pdf',
        },
    ],
}

raw_body = json.dumps(body, separators=(',', ':'))
signature = 'sha256=' + hmac.new(
    WEBHOOK_SECRET.encode(), raw_body.encode(), hashlib.sha256
).hexdigest()

response = requests.post(
    ENDPOINT,
    data=raw_body,
    headers={
        'Content-Type': 'application/json',
        'X-API-Key': PORTAL_API_KEY,
        'X-Signature': signature,
        'X-Idempotency-Key': 'unique-request-id-12345',
    },
)
print(response.json())`;

const phpExample = `<?php
$PORTAL_API_KEY = 'your-api-key';
$WEBHOOK_SECRET = 'your-hmac-secret';
$ENDPOINT = 'https://your-app.vercel.app/api/webhook-receive-policy';

$body = [
    'source' => 'portale-agente-xyz',
    'practice_type' => 'car',
    'client_name' => 'Mario Rossi',
    'client_email' => 'mario.rossi@example.com',
    'client_phone' => '+39 123 456 7890',
    'documents' => [
        [
            'filename' => 'preventivo_o_contratto.pdf',
            'content_base64' => '<base64-encoded-content>',
            'mime_type' => 'application/pdf',
        ],
        [
            'filename' => 'visura_camerale.pdf',
            'content_base64' => '<base64-encoded-content>',
            'mime_type' => 'application/pdf',
        ],
    ],
];

$rawBody = json_encode($body);
$signature = 'sha256=' . hash_hmac('sha256', $rawBody, $WEBHOOK_SECRET);

$ch = curl_init($ENDPOINT);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $rawBody,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'X-API-Key: ' . $PORTAL_API_KEY,
        'X-Signature: ' . $signature,
        'X-Idempotency-Key: unique-request-id-12345',
    ],
]);
$result = json_decode(curl_exec($ch), true);
curl_close($ch);
var_dump($result);`;

export default function ApiDocs() {
  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>Tecno Advance MGA — API di Integrazione</h1>
        <p style={styles.headerSub}>Documentazione per la ricezione automatica di pratiche assicurative</p>
      </div>

      <nav style={styles.nav}>
        {['Introduzione','Autenticazione','Endpoint','Documenti','Risposte','Idempotency','Esempi','Contatti'].map(s => (
          <a
            key={s}
            href={`#${s.toLowerCase()}`}
            style={styles.navLink}
          >
            {s}
          </a>
        ))}
      </nav>

      <div style={styles.container}>

        {/* 1. Introduzione */}
        <section id="introduzione" style={styles.section}>
          <h2 style={styles.h2}>1. Introduzione</h2>
          <p style={styles.p}>
            Questo documento descrive come integrare il vostro sistema con il Portale Tecno Advance MGA
            per inviare pratiche assicurative in modo automatico.
          </p>
          <p style={styles.p}>
            L'API accetta richieste <strong>POST</strong> con payload JSON, autentica ogni richiesta tramite
            API Key e firma HMAC-SHA256, applica rate limiting e supporta idempotency per evitare duplicati.
          </p>
          <div style={styles.infoBox}>
            Per richiedere le credenziali API contattare: <strong>info@tecnomga.com</strong>
          </div>
        </section>

        {/* 2. Autenticazione */}
        <section id="autenticazione" style={styles.section}>
          <h2 style={styles.h2}>2. Autenticazione</h2>
          <p style={styles.p}>
            Ogni richiesta deve includere due header di sicurezza:
          </p>

          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Header</th>
                <th style={styles.th}>Descrizione</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={styles.td}><code style={styles.inlineCode}>X-API-Key</code></td>
                <td style={styles.td}>Chiave API statica fornita da Tecno Advance MGA.</td>
              </tr>
              <tr>
                <td style={styles.tdAlt}><code style={styles.inlineCode}>X-Signature</code></td>
                <td style={styles.tdAlt}>
                  Firma HMAC-SHA256 del body raw nel formato{' '}
                  <code style={styles.inlineCode}>sha256=&lt;hex-digest&gt;</code>.
                  Calcolata con il <code style={styles.inlineCode}>WEBHOOK_SECRET</code> fornito.
                </td>
              </tr>
            </tbody>
          </table>

          <div style={styles.infoBox}>
            Ogni partner riceve una chiave univoca. Le chiavi vengono create dall&apos;amministratore in{' '}
            <strong>Impostazioni → Chiavi API</strong>. Non è possibile recuperare una chiave dopo la creazione.
          </div>

          <h3 style={styles.h3}>Come calcolare la firma</h3>
          <p style={styles.p}>La firma va calcolata sull'intero body JSON serializzato, prima dell'invio:</p>
          <pre style={styles.code}>{`// JavaScript
const signature = 'sha256=' + crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(rawBody, 'utf8')
  .digest('hex');

# Python
import hmac, hashlib
signature = 'sha256=' + hmac.new(secret.encode(), raw_body.encode(), hashlib.sha256).hexdigest()

# PHP
$signature = 'sha256=' . hash_hmac('sha256', $rawBody, $secret);`}</pre>
        </section>

        {/* 3. Endpoint */}
        <section id="endpoint" style={styles.section}>
          <h2 style={styles.h2}>3. Endpoint</h2>

          <table style={styles.table}>
            <tbody>
              <tr>
                <td style={{ ...styles.td, fontWeight: 600, width: '140px' }}>URL</td>
                <td style={styles.td}><code style={styles.inlineCode}>POST /api/webhook-receive-policy</code></td>
              </tr>
              <tr>
                <td style={{ ...styles.tdAlt, fontWeight: 600 }}>Content-Type</td>
                <td style={styles.tdAlt}><code style={styles.inlineCode}>application/json</code></td>
              </tr>
            </tbody>
          </table>

          <h3 style={styles.h3}>Headers richiesti</h3>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Header</th>
                <th style={styles.th}>Obbligatorio</th>
                <th style={styles.th}>Descrizione</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Content-Type', 'Sì', 'application/json'],
                ['X-API-Key', 'Sì', 'Chiave API fornita da Tecno Advance MGA'],
                ['X-Signature', 'Sì', 'Firma HMAC-SHA256 del body'],
                ['X-Idempotency-Key', 'No', 'Chiave univoca per prevenire duplicati'],
              ].map(([h, req, desc], i) => (
                <tr key={h}>
                  <td style={i % 2 === 0 ? styles.td : styles.tdAlt}>
                    <code style={styles.inlineCode}>{h}</code>
                  </td>
                  <td style={i % 2 === 0 ? styles.td : styles.tdAlt}>
                    <span style={styles.badge(req === 'Sì' ? '#dc2626' : '#6b7280')}>{req}</span>
                  </td>
                  <td style={i % 2 === 0 ? styles.td : styles.tdAlt}>{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={styles.h3}>Campi del body</h3>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Campo</th>
                <th style={styles.th}>Tipo</th>
                <th style={styles.th}>Obbligatorio</th>
                <th style={styles.th}>Descrizione</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['source', 'string', 'Sì', 'Identificativo del portale mittente'],
                ['practice_type', 'string', 'Sì', 'Tipo polizza (vedi tipi validi sotto)'],
                ['client_name', 'string', 'Sì', 'Nome completo del cliente'],
                ['client_email', 'string', 'Sì', 'Email del cliente'],
                ['client_phone', 'string', 'Sì', 'Telefono del cliente'],
                ['policy_number', 'string', 'No', 'Numero di polizza'],
                ['policy_start_date', 'string', 'No', 'Data inizio (ISO 8601: YYYY-MM-DD)'],
                ['policy_end_date', 'string', 'No', 'Data fine (ISO 8601: YYYY-MM-DD)'],
                ['beneficiary', 'string', 'No', 'Nome del beneficiario'],
                ['notes', 'string', 'No', 'Note aggiuntive'],
                ['idempotency_key', 'string', 'No', "Alternativa all'header X-Idempotency-Key"],
                ['dynamic_fields', 'object', 'No', 'Campi specifici per tipologia'],
                ['documents', 'array', 'Condizionale', 'Documenti allegati (obbligatori per alcune tipologie)'],
              ].map(([f, t, req, desc], i) => (
                <tr key={f}>
                  <td style={i % 2 === 0 ? styles.td : styles.tdAlt}>
                    <code style={styles.inlineCode}>{f}</code>
                  </td>
                  <td style={i % 2 === 0 ? styles.td : styles.tdAlt}>{t}</td>
                  <td style={i % 2 === 0 ? styles.td : styles.tdAlt}>
                    <span style={styles.badge(req === 'Sì' ? '#dc2626' : req === 'Condizionale' ? '#d97706' : '#6b7280')}>
                      {req}
                    </span>
                  </td>
                  <td style={i % 2 === 0 ? styles.td : styles.tdAlt}>{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={styles.h3}>Tipi pratica validi</h3>
          <p style={styles.p}>Il campo <code style={styles.inlineCode}>practice_type</code> accetta (case-insensitive):</p>
          <pre style={styles.code}>{`car | casa | fidejussioni | rc | pet | fotovoltaico |
catastrofali | azienda | postuma_decennale | all_risk | risparmio | salute`}</pre>

          <h3 style={styles.h3}>Struttura documento</h3>
          <pre style={styles.code}>{`{
  "filename": "preventivo_o_contratto.pdf",
  "content_base64": "<base64-encoded-file-content>",
  "mime_type": "application/pdf"
}
// mime_type validi: application/pdf, image/jpeg, image/png,
// application/vnd.openxmlformats-officedocument.wordprocessingml.document
// Dimensione massima per documento: 10 MB`}</pre>
        </section>

          <h3 style={styles.h3}>GET /api/get-practice-documents</h3>
          <p style={styles.p}>
            Recupera i documenti allegati a una pratica creata con la propria chiave API.
            I link di download sono URL firmati con scadenza di <strong>1 ora</strong>.
          </p>

          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Query Param</th>
                <th style={styles.th}>Obbligatorio</th>
                <th style={styles.th}>Descrizione</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={styles.td}><code style={styles.inlineCode}>practice_id</code></td>
                <td style={styles.td}><span style={styles.badge('#d97706')}>uno dei due</span></td>
                <td style={styles.td}>UUID della pratica</td>
              </tr>
              <tr>
                <td style={styles.tdAlt}><code style={styles.inlineCode}>practice_number</code></td>
                <td style={styles.tdAlt}><span style={styles.badge('#d97706')}>uno dei due</span></td>
                <td style={styles.tdAlt}>Numero pratica (es. PR-2026-1234)</td>
              </tr>
            </tbody>
          </table>

          <h3 style={styles.h3}>Esempio risposta GET documenti</h3>
          <pre style={styles.code}>{`GET /api/get-practice-documents?practice_id=550e8400-e29b-41d4-a716-446655440000
X-API-Key: tmga_a1b2c3d4...

{
  "practice_id": "550e8400-e29b-41d4-a716-446655440000",
  "practice_number": "PR-2026-1234",
  "documents": [
    {
      "id": "...",
      "file_name": "preventivo_o_contratto.pdf",
      "file_size": 204800,
      "mime_type": "application/pdf",
      "created_at": "2026-06-05T10:00:00Z",
      "download_url": "https://xxx.supabase.co/storage/v1/...",
      "expires_at": "2026-06-05T11:00:00Z"
    }
  ]
}`}</pre>

        {/* 4. Documenti Obbligatori */}
        <section id="documenti" style={styles.section}>
          <h2 style={styles.h2}>4. Documenti Obbligatori</h2>
          <p style={styles.p}>
            Per alcune tipologie la presenza di documenti specifici è obbligatoria.
            Il filename deve <em>contenere</em> il nome del documento richiesto.
          </p>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Tipologia</th>
                <th style={styles.th}>Documenti obbligatori (il filename deve contenere questi termini)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(requiredDocsByType).map(([type, docs], i) => (
                <tr key={type}>
                  <td style={i % 2 === 0 ? styles.td : styles.tdAlt}><strong>{type}</strong></td>
                  <td style={i % 2 === 0 ? styles.td : styles.tdAlt}>{docs.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* 5. Codici di risposta */}
        <section id="risposte" style={styles.section}>
          <h2 style={styles.h2}>5. Codici di Risposta</h2>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Codice</th>
                <th style={styles.th}>Significato</th>
              </tr>
            </thead>
            <tbody>
              {responseCodes.map(({ code, color, desc }, i) => (
                <tr key={code}>
                  <td style={i % 2 === 0 ? styles.td : styles.tdAlt}>
                    <span style={styles.badge(color)}>{code}</span>
                  </td>
                  <td style={i % 2 === 0 ? styles.td : styles.tdAlt}>{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={styles.h3}>Esempio risposta 200</h3>
          <pre style={styles.code}>{`{
  "success": true,
  "practice_id": "550e8400-e29b-41d4-a716-446655440000",
  "practice_number": "PR-2026-1234",
  "message": "Pratica creata con successo."
}`}</pre>

          <h3 style={styles.h3}>Esempio risposta 422 (documenti mancanti)</h3>
          <pre style={styles.code}>{`{
  "error": "missing_required_documents",
  "missing": ["visura_camerale", "bilancio_ultimo_anno"],
  "message": "Documenti obbligatori mancanti per la tipologia \\"fidejussioni\\"."
}`}</pre>
        </section>

        {/* 6. Idempotency */}
        <section id="idempotency" style={styles.section}>
          <h2 style={styles.h2}>6. Idempotency</h2>
          <p style={styles.p}>
            Per prevenire la creazione di pratiche duplicate in caso di retry, è possibile inviare
            una chiave di idempotency tramite header <code style={styles.inlineCode}>X-Idempotency-Key</code>
            oppure nel campo <code style={styles.inlineCode}>idempotency_key</code> del body.
          </p>
          <p style={styles.p}>
            Se una pratica con la stessa chiave esiste già, l'API risponde con <strong>200</strong>
            e il campo <code style={styles.inlineCode}>duplicate: true</code> senza creare una nuova pratica.
          </p>
          <div style={styles.infoBox}>
            Usare un identificativo univoco per ogni richiesta, ad esempio un UUID o l'ID interno
            del vostro sistema. La chiave deve essere unica per ogni pratica distinta.
          </div>
          <pre style={styles.code}>{`// Risposta in caso di duplicato
{
  "success": true,
  "practice_id": "...",
  "practice_number": "PR-2026-1234",
  "message": "Pratica già esistente (idempotency key riconosciuta).",
  "duplicate": true
}`}</pre>
        </section>

        {/* 7. Esempi completi */}
        <section id="esempi" style={styles.section}>
          <h2 style={styles.h2}>7. Esempi Completi</h2>

          <h3 style={styles.h3}>JavaScript / Node.js</h3>
          <pre style={styles.code}>{jsExample}</pre>

          <h3 style={styles.h3}>Python</h3>
          <pre style={styles.code}>{pythonExample}</pre>

          <h3 style={styles.h3}>PHP</h3>
          <pre style={styles.code}>{phpExample}</pre>
        </section>

        {/* 8. Contatti */}
        <section id="contatti" style={styles.section}>
          <h2 style={styles.h2}>8. Contatti</h2>
          <p style={styles.p}>
            Per richiedere le credenziali API o per supporto tecnico:
          </p>
          <table style={styles.table}>
            <tbody>
              <tr>
                <td style={{ ...styles.td, fontWeight: 600, width: '160px' }}>Email</td>
                <td style={styles.td}><a href="mailto:info@tecnomga.com" style={{ color: BRAND }}>info@tecnomga.com</a></td>
              </tr>
              <tr>
                <td style={{ ...styles.tdAlt, fontWeight: 600 }}>Oggetto</td>
                <td style={styles.tdAlt}>Richiesta credenziali API integrazione portale</td>
              </tr>
            </tbody>
          </table>
        </section>

      </div>

      <footer style={styles.footer}>
        <p style={{ margin: 0 }}>
          © {new Date().getFullYear()} Tecno Advance MGA Broker — Documentazione API v1.0
        </p>
      </footer>
    </div>
  );
}
