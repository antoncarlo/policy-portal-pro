// Invio forzato di una pratica VIES bloccata dai controlli sui documenti. La lettura dell'agent può sbagliare
// (una data, un codice, un documento non riconosciuto): l'operatore può far partire la pratica lo stesso,
// scegliendo il motivo e assumendosene la responsabilità. Chi, quando, perché e quali blocchi ha ignorato restano
// nella pratica (campo vies_forzatura) e il controllo finale prima dell'invio salta solo quei controlli.
//
// Si forzano solo i blocchi che nascono dalla lettura dei documenti. Restano bloccanti uno ZIP mancante, i dati
// dell'Excel e una pratica già esistente (servono a compilare la pratica, o la ripeterebbero) e i documenti di
// un'altra società: un codice valido di un'altra società non è una lettura sbagliata (quella dà un codice con la
// cifra di controllo errata), e lo ZIP di un'altra società non viene mai allegato alla pratica.

export const VIES_FORCING_REASONS = ["agent_misread", "manual_check", "outside_portal"] as const;
export type ViesForcingReason = (typeof VIES_FORCING_REASONS)[number];

/** Come il motivo compare nella pratica (le traduzioni della pagina VIES sono nei suoi messaggi). */
export const VIES_FORCING_REASON_LABELS: Record<ViesForcingReason, string> = {
  agent_misread: "Lettura dell'agent errata",
  manual_check: "Documento verificato a mano dall'operatore",
  outside_portal: "Documento integrato dal cliente fuori portale",
};

/** Registro dell'invio forzato, salvato nella pratica. */
export interface ViesForcingRecord {
  /** E-mail di chi ha forzato. */
  operatore: string;
  /** Quando (ISO 8601). */
  data: string;
  motivo: ViesForcingReason;
  nota: string;
  /** I blocchi ignorati, come la pagina li mostrava. */
  blocchi: string[];
}

const FORCEABLE_ERRORS = [
  /^Documento d'identità scaduto/,
  /^Business Registration Certificate di Hong Kong scaduto/,
  /^Nei documenti dello ZIP non compa.*identità non verificabile/,
  /^Documento del legale rappresentante non corrispondente/,
  /^\d+ documenti non verificati dall'agent/,
  /^Verifica approfondita dell'agent non riuscita/,
];

/** True for a block that comes from reading the documents: the operator may force it. */
export const isForceableError = (error: string) => FORCEABLE_ERRORS.some((pattern) => pattern.test(error));

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** The forcing record of a practice, or null when there is none or it lacks who, why or what. */
export const readViesForcing = (value: unknown): ViesForcingRecord | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const motivo = text(record.motivo) as ViesForcingReason;
  const blocchi = Array.isArray(record.blocchi) ? record.blocchi.map(text).filter(Boolean) : [];
  if (!text(record.operatore) || !VIES_FORCING_REASONS.includes(motivo) || !blocchi.length) return null;
  return { operatore: text(record.operatore), data: text(record.data), motivo, nota: text(record.nota), blocchi };
};

const formatWhen = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

/** The forcing as the practice shows it, one line each: who and when, why, the note, every block ignored. */
export const describeViesForcing = (record: ViesForcingRecord) => {
  const when = formatWhen(record.data);
  return [
    `Forzato da ${record.operatore}${when ? ` il ${when}` : ""}`,
    `Motivo: ${VIES_FORCING_REASON_LABELS[record.motivo]}`,
    ...(record.nota ? [`Nota: ${record.nota}`] : []),
    ...record.blocchi.map((block) => `Blocco ignorato: ${block}`),
  ].join("\n");
};
