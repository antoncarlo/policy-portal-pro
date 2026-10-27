#!/usr/bin/env node
// Simulatore del portale della compagnia, per provare il collegamento senza il portale vero.
//
//   node scripts/vies-portal-simulator.mjs listen   --port 4010 [--key KEY] [--secret SECRET] [--portal-id co]
//       Riceve gli invii del portale (POST con Authorization: Bearer KEY), risponde con un
//       external_reference e stampa pratica e documenti. Con --auto-reply risponde da solo a ogni
//       pratica: "received" subito, poi "deliberated" (o altro con --outcome) dopo --delay secondi.
//
//   node scripts/vies-portal-simulator.mjs receive  --port 4011 --secret SECRET [--fail 500] [--ignore-signature]
//       Fa da portale di un rappresentante fiscale (o della compagnia): riceve le notifiche in uscita,
//       ne verifica la firma con il segreto e le stampa. --fail risponde con quell'errore (per provare i ritentativi).
//
//   node scripts/vies-portal-simulator.mjs callback --url https://…/api/vies-portal-callback \
//       --portal-id co --secret SECRET --event deliberated --practice-number VIES-2026-0001-ab12cd34 \
//       [--due 2026-12-31] [--note "testo"] [--reason "testo"] [--pdf bozza.pdf] [--policy-copy copia.pdf] [--event-id evt-1]
//       Invia una risposta firmata, come farebbe la compagnia. Con deliberated --pdf e' la bozza e
//       --policy-copy la copia per la Compagnia da firmare; con issued --pdf si puo' ripetere, una
//       copia della polizza emessa per volta (data.documents).
//
// Eventi: received, info_requested, deliberated, policy_copy (copia di polizza da firmare, anche .p7m, dopo il pagamento), rejected, issued. Nessuna dipendenza: solo Node 18+.

import { createHmac, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const [command, ...rest] = process.argv.slice(2);
const args = {};
for (let i = 0; i < rest.length; i += 1) {
  if (!rest[i].startsWith("--")) continue;
  const name = rest[i].slice(2);
  const next = rest[i + 1];
  if (next === undefined || next.startsWith("--")) args[name] = true;
  else if (args[name] !== undefined) { args[name] = [].concat(args[name], next); i += 1; }
  else { args[name] = next; i += 1; }
}

const pdfAttachment = (path) => ({ file_name: String(path).split("/").pop(), mime_type: /\.p7m$/i.test(String(path)) ? "application/pkcs7-mime" : "application/pdf", content_base64: readFileSync(path).toString("base64") });

const EVENT_TYPES = { received: "practice.received", info_requested: "practice.info_requested", deliberated: "practice.deliberated", policy_copy: "practice.policy_copy", rejected: "practice.rejected", issued: "practice.issued" };

/** Firma: "sha256=" + HMAC-SHA256(secret, timestamp + "." + corpo grezzo). */
export function sign(secret, timestamp, rawBody) {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")}`;
}

/** Verifica X-Timestamp / X-Signature di una notifica ricevuta. */
export function verifyNotification(secret, headers, rawBody, nowSeconds = Math.floor(Date.now() / 1000)) {
  const timestamp = headers["x-timestamp"];
  const signature = headers["x-signature"];
  if (!timestamp || !/^\d{9,12}$/.test(String(timestamp))) return "timestamp mancante o non valido";
  if (Math.abs(nowSeconds - Number(timestamp)) > 300) return "timestamp scaduto (oltre 5 minuti)";
  if (!signature || signature !== sign(secret, String(timestamp), rawBody)) return "firma non valida";
  return null;
}

export function buildEvent(options) {
  const practice = {};
  if (options["practice-id"]) practice.id = options["practice-id"];
  if (options["practice-number"]) practice.number = options["practice-number"];
  if (options.reference) practice.reference = options.reference;
  const type = EVENT_TYPES[options.event];
  if (!type) throw new Error(`--event deve essere uno tra: ${Object.keys(EVENT_TYPES).join(", ")}`);
  const data = {};
  if (options.event === "deliberated") {
    if (options.due) data.payment_due_date = options.due;
    if (options.note) data.note = options.note;
    if (options.pdf) data.draft = pdfAttachment([].concat(options.pdf)[0]);
    if (options["policy-copy"]) data.policy_copy = pdfAttachment([].concat(options["policy-copy"])[0]);
  }
  if (options.event === "policy_copy") {
    // After the payment: the copy of the policy for the company to be signed (a .p7m file is sent as such).
    if (options["policy-number"]) data.policy_number = options["policy-number"];
    if (options["policy-copy"]) data.policy_copy = pdfAttachment([].concat(options["policy-copy"])[0]);
  }
  if (options.event === "rejected") data.reason = options.reason || "Rischio non assicurabile";
  if (options.event === "info_requested") data.message = options.message || options.note || "Allegare la documentazione richiesta";
  if (options.event === "issued") {
    if (options["policy-number"]) data.policy_number = options["policy-number"];
    if (options.pdf) {
      const copies = [].concat(options.pdf).map(pdfAttachment);
      data.document = copies[0];
      if (copies.length > 1) data.documents = copies;
    }
  }
  return { event_id: options["event-id"] || `sim-${randomUUID()}`, event_type: type, occurred_at: new Date().toISOString(), practice, data };
}

export async function sendCallback({ url, portalId, secret, event }) {
  const rawBody = JSON.stringify(event);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Portal-Id": portalId, "X-Timestamp": timestamp, "X-Signature": sign(secret, timestamp, rawBody) },
    body: rawBody,
  });
  const text = await response.text();
  return { status: response.status, body: text };
}

async function main() {
  if (command === "callback") {
    for (const required of ["url", "portal-id", "secret", "event"]) if (!args[required]) throw new Error(`Manca --${required}`);
    const event = buildEvent(args);
    console.log(`> ${event.event_type} (${event.event_id})`);
    const result = await sendCallback({ url: args.url, portalId: args["portal-id"], secret: args.secret, event });
    console.log(`< HTTP ${result.status} ${result.body}`);
    process.exit(result.status === 200 ? 0 : 1);
  }

  if (command === "receive") {
    const port = Number(args.port || 4011);
    const fail = args.fail ? Number(args.fail) : 0;
    createServer((request, response) => {
      let raw = "";
      request.on("data", (chunk) => (raw += chunk));
      request.on("end", () => {
        const problem = args.secret && !args["ignore-signature"] ? verifyNotification(args.secret, request.headers, raw) : null;
        let body = {};
        try { body = JSON.parse(raw || "{}"); } catch { /* not json */ }
        console.log(`\n< ${body.event_type ?? "?"} (${request.headers["idempotency-key"]}, tentativo ${request.headers["x-delivery-attempt"] ?? "1"}) firma: ${problem ?? (args.secret ? "valida" : "non verificata")}`);
        if (body.practice) console.log(`  pratica ${body.practice.number} · sezione ${body.stage ?? "-"} · ${JSON.stringify(body.data ?? {}).slice(0, 300)}`);
        if (body.lot) console.log(`  lotto ${body.lot.source_reference} · ${body.lot.status} · ${(body.data?.practices ?? []).length} pratiche`);
        if (problem) { response.writeHead(401, { "Content-Type": "application/json" }).end(JSON.stringify({ error: problem })); return; }
        if (fail) { response.writeHead(fail, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "errore simulato" })); return; }
        response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: true }));
      });
    }).listen(port, () => console.log(`In ascolto delle notifiche su http://127.0.0.1:${port}${args.secret ? " (firma verificata)" : ""}`));
    return;
  }

  if (command === "listen") {
    const port = Number(args.port || 4010);
    const key = args.key || "simulator-key";
    const delay = Number(args.delay || 5) * 1000;
    const server = createServer((request, response) => {
      let raw = "";
      request.on("data", (chunk) => (raw += chunk));
      request.on("end", () => {
        if (request.headers.authorization !== `Bearer ${key}`) { response.writeHead(401).end(JSON.stringify({ error: "chiave non valida" })); return; }
        const body = JSON.parse(raw || "{}");
        if (body.event_type) {
          // Una notifica del portale (pagamento registrato, integrazioni inviate, riapertura), non un invio.
          const problem = args.secret ? verifyNotification(args.secret, request.headers, raw) : null;
          console.log(`\n< notifica ${body.event_type} per ${body.practice?.number ?? "-"} (firma: ${problem ?? (args.secret ? "valida" : "non verificata")})`);
          response.writeHead(problem ? 401 : 200, { "Content-Type": "application/json" }).end(JSON.stringify(problem ? { error: problem } : { ok: true }));
          return;
        }
        const reference = `SIM-${Date.now()}`;
        console.log(`\n< invio ricevuto (Idempotency-Key ${request.headers["idempotency-key"]})`);
        console.log(`  pratica: ${body.practice?.number} (${body.practice?.id}) · ${body.contraente}`);
        console.log(`  documenti: ${(body.documents || []).map((d) => `${d.file_name} [${d.mime_type}, ${d.size} B]`).join(", ") || "nessuno"}`);
        console.log(`  risposte a: ${body.callback?.url ?? "(non configurate)"}`);
        response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ external_reference: reference }));
        if (args["auto-reply"] && body.callback?.url && args.secret) {
          const base = { url: body.callback.url, portalId: args["portal-id"] || body.callback.portal_id, secret: args.secret };
          const practice = { "practice-id": body.practice?.id, reference };
          setTimeout(async () => { console.log("  > received:", (await sendCallback({ ...base, event: buildEvent({ ...practice, event: "received" }) })).status); }, 500);
          setTimeout(async () => {
            const outcome = args.outcome || "deliberated";
            const event = buildEvent({ ...practice, event: outcome, due: args.due || new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10), note: "Risposta del simulatore", reason: "Rifiuto del simulatore" });
            const result = await sendCallback({ ...base, event });
            console.log(`  > ${outcome}: HTTP ${result.status} ${result.body}`);
          }, delay);
        }
      });
    });
    server.listen(port, () => console.log(`Simulatore in ascolto su http://127.0.0.1:${port} (chiave: ${key})`));
    return;
  }

  console.log("Uso: listen | receive | callback  (vedi l'intestazione del file)");
  process.exit(command ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((error) => { console.error(error.message); process.exit(1); });
