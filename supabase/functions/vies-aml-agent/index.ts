// VIES AML agent: reads the documents of a contraente's ZIP (business licence, legal representative's
// identity document, UBO declaration; Chinese and/or Italian, scans or PDFs) with Claude and returns, as
// structured JSON, the data the anti-money-laundering questionnaire asks for. The portal prints it on the
// questionnaire as a draft the signer verifies: nothing is guessed, a missing or unreadable item is empty.
//
// Secrets: ANTHROPIC_API_KEY (required). SUPABASE_URL / SUPABASE_ANON_KEY are provided by Supabase.
// Only authenticated portal users may call it.

import Anthropic from "npm:@anthropic-ai/sdk@^0.131.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { isOutOfCredit, NO_CREDIT_MESSAGE } from "../_shared/agent-errors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "claude-opus-5-5";
const MAX_DOCUMENTS = 5;
const MAX_TOTAL_BASE64 = 30 * 1024 * 1024;
const MEDIA_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type MediaType = (typeof MEDIA_TYPES)[number];

const stringField = { type: "string" };
const personProperties = {
  name: stringField,
  sex: stringField,
  birth_date: stringField,
  birth_place: stringField,
  birth_country: stringField,
  nationality: stringField,
  residence: stringField,
  residence_country: stringField,
  id_number: stringField,
  id_issue_date: stringField,
  id_expiry_date: stringField,
  id_authority: stringField,
};
const PERSON_KEYS = Object.keys(personProperties);

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["company", "legal_representative", "owners", "issues"],
  properties: {
    company: {
      type: "object",
      additionalProperties: false,
      required: ["legal_form", "establishment_date", "registered_capital"],
      properties: { legal_form: stringField, establishment_date: stringField, registered_capital: stringField },
    },
    legal_representative: { type: "object", additionalProperties: false, required: PERSON_KEYS, properties: personProperties },
    owners: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [...PERSON_KEYS, "share_percent", "control"],
        properties: { ...personProperties, share_percent: stringField, control: stringField },
      },
    },
    issues: { type: "array", items: stringField },
  },
};

const SYSTEM_PROMPT = `Sei l'addetto all'adeguata verifica antiriciclaggio di un intermediario assicurativo italiano che emette fideiussioni VIES (art. 35, comma 7-quater, DPR 633/1972) per società cinesi. Ricevi i documenti di UNA società: licenza commerciale (营业执照), documento d'identità del legale rappresentante (身份证 o passaporto), dichiarazione del titolare effettivo UBO (最终受益人声明书), talvolta il report del Sistema nazionale di informazioni sul credito d'impresa. I dati che estrai finiscono in un questionario che il cliente firma sotto responsabilità penale: un dato sbagliato è peggio di un dato mancante.

Regole:
- Trascrivi solo ciò che è stampato nei documenti. Se un dato non c'è o non è leggibile con certezza, scrivi una stringa vuota. Non dedurre, non completare, non correggere.
- Nomi di persona: nella forma latina stampata (pinyin) se c'è, altrimenti gli ideogrammi esattamente come stampati.
- Date: GG/MM/AAAA. Sesso: "M" o "F". Cittadinanza e nazione: in italiano ("Cinese", "Cina").
- legal_form: la forma giuridica come stampata nella licenza, resa con l'equivalente italiano più vicino (有限责任公司 = "Società a responsabilità limitata", 股份有限公司 = "Società per azioni"); se non sei certo dell'equivalente, scrivi il testo stampato.
- establishment_date: data di costituzione / fondazione (成立日期). registered_capital: capitale sociale (注册资本) con la valuta, come stampato.
- legal_representative: il legale rappresentante (法定代表人). Dati anagrafici dal suo documento d'identità; residenza dall'indirizzo stampato sul documento. id_number: numero del documento, carattere per carattere. Date di rilascio e scadenza e ente di rilascio solo se stampati.
- owners: i titolari effettivi dichiarati nel documento UBO: una voce per persona fisica, con quota di partecipazione (share_percent, per esempio "60%") e, se la quota non basta, control con la descrizione del controllo. Se il legale rappresentante è anche titolare effettivo, inserisci comunque la persona. Se non c'è un documento UBO, elenco vuoto.
- issues: problemi oggettivi in italiano (pagina illeggibile, documento tagliato, scaduto, dati in contrasto tra documenti, titolari effettivi non individuabili); lista vuota se non ce ne sono.`;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Metodo non consentito." });

  // The body is read before any early return: answering while a large upload is still in flight leaves the
  // connection hanging until the gateway times out.
  let body: { documents?: Array<{ file_name?: string; media_type?: string; data?: string }>; probe?: boolean };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Richiesta non valida." });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json(503, { error: "Agent documentale non configurato: manca il segreto ANTHROPIC_API_KEY.", code: "AGENT_NOT_CONFIGURED" });

  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json(401, { error: "Sessione non valida." });

  if (body.probe) return json(200, { ready: true, model: MODEL });

  const documents = body.documents ?? [];
  if (documents.length === 0 || documents.length > MAX_DOCUMENTS) return json(400, { error: `Servono da 1 a ${MAX_DOCUMENTS} documenti.` });
  let total = 0;
  const content: Array<Record<string, unknown>> = [];
  for (const document of documents) {
    const mediaType = document.media_type as MediaType;
    if (!document.data || !MEDIA_TYPES.includes(mediaType)) return json(400, { error: "Ogni documento richiede data (base64) e un media_type tra PDF, JPEG, PNG, WEBP, GIF." });
    total += document.data.length;
    content.push({ type: "text", text: `Documento: ${document.file_name ?? "sconosciuto"} (il nome può essere fuorviante)` });
    content.push(
      mediaType === "application/pdf"
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: document.data } }
        : { type: "image", source: { type: "base64", media_type: mediaType, data: document.data } },
    );
  }
  if (total > MAX_TOTAL_BASE64) return json(413, { error: "Documenti troppo grandi per l'agent (massimo circa 22 MB in totale)." });

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 6000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      output_config: { effort: "medium", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
      messages: [{ role: "user", content: content as never }],
    });
    // One line per reading in the function's logs, for the cost of the questionnaires (no file names).
    console.log(
      JSON.stringify({
        event: "vies_aml_reading",
        documents: documents.length,
        kb: Math.round((total * 3) / 4 / 1024),
        model: response.model,
        stop_reason: response.stop_reason,
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      }),
    );

    if (response.stop_reason === "refusal") return json(422, { error: "L'agent non ha elaborato i documenti.", code: "AGENT_REFUSAL" });
    if (response.stop_reason === "max_tokens") return json(502, { error: "Risposta dell'agent incompleta.", code: "AGENT_TRUNCATED" });
    const text = response.content.find((block) => block.type === "text");
    if (!text || text.type !== "text") return json(502, { error: "Risposta dell'agent vuota.", code: "AGENT_EMPTY" });
    return json(200, { model: response.model, result: JSON.parse(text.text) });
  } catch (error) {
    if (error instanceof Anthropic.APIError && isOutOfCredit(error.status, error.message)) {
      return json(503, { error: NO_CREDIT_MESSAGE, code: "AGENT_NO_CREDIT" });
    }
    if (error instanceof Anthropic.RateLimitError) return json(429, { error: "Agent occupato: riprovare tra poco.", code: "AGENT_RATE_LIMITED" });
    if (error instanceof Anthropic.AuthenticationError) return json(503, { error: "Chiave API dell'agent non valida.", code: "AGENT_NOT_CONFIGURED" });
    if (error instanceof Anthropic.BadRequestError) return json(400, { error: `Documenti non elaborabili: ${error.message}`, code: "AGENT_BAD_REQUEST" });
    if (error instanceof Anthropic.APIError) return json(502, { error: `Errore dell'agent (${error.status}).`, code: "AGENT_API_ERROR" });
    return json(500, { error: "Errore imprevisto dell'agent.", code: "AGENT_ERROR" });
  }
});
