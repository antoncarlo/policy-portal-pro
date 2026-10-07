// VIES document agent: reads one document of a VIES ZIP (scanned PDF or
// image, Chinese and/or Italian) with Claude and returns its type and the
// identifiers printed on it as structured JSON. The portal compares these
// values with the Excel deterministically and validates every code's check
// character, so a misread code is rejected, never accepted.
//
// Secrets: ANTHROPIC_API_KEY (required). SUPABASE_URL / SUPABASE_ANON_KEY are
// provided by Supabase. Only authenticated portal users may call it.

import Anthropic from "npm:@anthropic-ai/sdk@^0.131.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "claude-opus-5-5";
const MAX_BASE64_LENGTH = 30 * 1024 * 1024;
const MEDIA_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type MediaType = (typeof MEDIA_TYPES)[number];

const DOCUMENT_TYPES = [
  "licenza_commerciale",
  "documento_identita",
  "report_credito",
  "dichiarazione_sostitutiva",
  "ubo",
  "mandato_rappresentanza",
  "visura_rappresentante",
  "bilancio_rappresentante",
  "statuto_rappresentante",
  "altro",
];

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "document_type",
    "company_name_latin",
    "company_name_chinese",
    "unified_social_credit_code",
    "italian_vat_number",
    "legal_representative_name",
    "legal_representative_id_number",
    "fiscal_representative_name",
    "fiscal_representative_tax_code",
    "document_date",
    "expiry_date",
    "has_italian_translation",
    "is_signed",
    "issues",
  ],
  properties: {
    document_type: { type: "string", enum: DOCUMENT_TYPES },
    company_name_latin: { type: "string" },
    company_name_chinese: { type: "string" },
    unified_social_credit_code: { type: "string" },
    italian_vat_number: { type: "string" },
    legal_representative_name: { type: "string" },
    legal_representative_id_number: { type: "string" },
    fiscal_representative_name: { type: "string" },
    fiscal_representative_tax_code: { type: "string" },
    document_date: { type: "string" },
    expiry_date: { type: "string" },
    has_italian_translation: { type: "boolean" },
    is_signed: { type: "boolean" },
    issues: { type: "array", items: { type: "string" } },
  },
};

const SYSTEM_PROMPT = `Sei l'addetto al controllo documentale di un intermediario assicurativo italiano che emette fideiussioni VIES (art. 35, comma 7-quater, DPR 633/1972) per società cinesi rappresentate fiscalmente in Italia. I dati che estrai vengono confrontati con l'anagrafica e inviati alla compagnia: un dato sbagliato è peggio di un dato mancante.

Ricevi un solo documento. Classificalo in document_type:
- licenza_commerciale: licenza commerciale cinese (营业执照), originale o traduzione.
- documento_identita: carta d'identità cinese (身份证) o passaporto del legale rappresentante, con o senza traduzione.
- report_credito: report del Sistema nazionale di informazioni sul credito d'impresa (国家企业信用信息公示系统), con o senza traduzione.
- dichiarazione_sostitutiva: dichiarazione sostitutiva a supporto della fideiussione assicurativa firmata dal legale rappresentante (保险担保出具所需声明).
- ubo: dichiarazione del titolare effettivo (Ultimate Beneficial Owner, 最终受益人声明书).
- mandato_rappresentanza: mandato di rappresentanza fiscale / incarico al rappresentante fiscale (税务代表授权书).
- visura_rappresentante: visura camerale italiana del rappresentante fiscale.
- bilancio_rappresentante: bilancio d'esercizio del rappresentante fiscale.
- statuto_rappresentante: statuto del rappresentante fiscale.
- altro: qualsiasi altro documento (anche certificati notarili o ricevute che citano uno dei documenti sopra).

Trascrivi i dati esattamente come stampati, carattere per carattere; scrivi una stringa vuota se un dato non è presente o non è leggibile con certezza. Non dedurre, non completare e non correggere codici: il portale ne verifica la cifra di controllo.
- unified_social_credit_code: codice unificato di credito sociale di 18 caratteri della società cinese.
- italian_vat_number: partita IVA italiana di 11 cifre della società cinese, se presente (non quella del rappresentante fiscale).
- fiscal_representative_name / fiscal_representative_tax_code: società di rappresentanza fiscale italiana citata e il suo codice fiscale.
- document_date: data di emissione o firma (GG/MM/AAAA); expiry_date: scadenza del documento d'identità (GG/MM/AAAA).
- issues: problemi oggettivi in italiano (pagine illeggibili, documento tagliato, firma mancante, documento scaduto, traduzione assente); lista vuota se non ce ne sono.`;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Metodo non consentito." });

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return json(503, { error: "Agent documentale non configurato: manca il segreto ANTHROPIC_API_KEY.", code: "AGENT_NOT_CONFIGURED" });
  }

  const authorization = req.headers.get("Authorization") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json(401, { error: "Sessione non valida." });

  let body: { file_name?: string; media_type?: string; data?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Richiesta non valida." });
  }
  const mediaType = body.media_type as MediaType;
  if (!body.data || !MEDIA_TYPES.includes(mediaType)) {
    return json(400, { error: "Servono data (base64) e un media_type tra PDF, JPEG, PNG, WEBP, GIF." });
  }
  if (body.data.length > MAX_BASE64_LENGTH) return json(413, { error: "Documento troppo grande per l'agent (massimo circa 22 MB)." });

  const source =
    mediaType === "application/pdf"
      ? ({ type: "document", source: { type: "base64", media_type: "application/pdf", data: body.data } } as const)
      : ({ type: "image", source: { type: "base64", media_type: mediaType, data: body.data } } as const);

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4096,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      output_config: { effort: "medium", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [source, { type: "text", text: `Nome del file (può essere fuorviante): ${body.file_name ?? "sconosciuto"}` }],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return json(422, { error: "L'agent non ha elaborato il documento.", code: "AGENT_REFUSAL" });
    }
    if (response.stop_reason === "max_tokens") {
      return json(502, { error: "Risposta dell'agent incompleta.", code: "AGENT_TRUNCATED" });
    }
    const text = response.content.find((block) => block.type === "text");
    if (!text || text.type !== "text") return json(502, { error: "Risposta dell'agent vuota.", code: "AGENT_EMPTY" });

    return json(200, { model: response.model, result: JSON.parse(text.text) });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return json(429, { error: "Agent occupato: riprovare tra poco.", code: "AGENT_RATE_LIMITED" });
    if (error instanceof Anthropic.AuthenticationError) return json(503, { error: "Chiave API dell'agent non valida.", code: "AGENT_NOT_CONFIGURED" });
    if (error instanceof Anthropic.BadRequestError) return json(400, { error: `Documento non elaborabile: ${error.message}`, code: "AGENT_BAD_REQUEST" });
    if (error instanceof Anthropic.APIError) return json(502, { error: `Errore dell'agent (${error.status}).`, code: "AGENT_API_ERROR" });
    return json(500, { error: error instanceof Error ? error.message : "Errore dell'agent.", code: "AGENT_ERROR" });
  }
});
