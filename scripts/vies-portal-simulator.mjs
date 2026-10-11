#!/usr/bin/env node
// Simulatore del portale della compagnia, per provare il collegamento senza il portale vero.
//
//   node scripts/vies-portal-simulator.mjs listen   --port 4010 [--key KEY] [--secret SECRET] [--portal-id co]
//       Riceve gli invii del portale (POST con Authorization: Bearer KEY), risponde con un
//       external_reference e stampa pratica e documenti. Con --auto-reply risponde da solo a ogni
//       pratica: "received" subito, poi "deliberated" (o altro con --outcome) dopo --delay secondi.
//
//   node scripts/vies-portal-simulator.mjs callback --url https://…/api/vies-portal-callback \
//       --portal-id co --secret SECRET --event deliberated --practice-number VIES-2026-0001-ab12cd34 \
//       [--due 2026-12-31] [--note "testo"] [--reason "testo"] [--pdf bozza.pdf] [--event-id evt-1]
//       Invia una risposta firmata, come farebbe la compagnia.
//
// Eventi: received, info_requested, deliberated, rejected, issued. Nessuna dipendenza: solo Node 18+.

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
  else { args[name] = next; i += 1; }
}

const EVENT_TYPES = { received: "practice.received", info_requested: "practice.info_requested", deliberated: "practice.deliberated", rejected: "practice.rejected", issued: "practice.issued" };

/** Firma: "sha256=" + HMAC-SHA256(secret, timestamp + "." + corpo grezzo). */
export function sign(secret, timestamp, rawBody) {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")}`;
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
    if (options.pdf) data.draft = { file_name: String(options.pdf).split("/").pop(), mime_type: "application/pdf", content_base64: readFileSync(options.pdf).toString("base64") };
  }
  if (options.event === "rejected") data.reason = options.reason || "Rischio non assicurabile";
  if (options.event === "info_requested") data.message = options.message || options.note || "Allegare la documentazione richiesta";
  if (options.event === "issued") {
    if (options["policy-number"]) data.policy_number = options["policy-number"];
    if (options.pdf) data.document = { file_name: String(options.pdf).split("/").pop(), mime_type: "application/pdf", content_base64: readFileSync(options.pdf).toString("base64") };
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

  console.log("Uso: listen | callback  (vedi l'intestazione del file)");
  process.exit(command ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((error) => { console.error(error.message); process.exit(1); });
