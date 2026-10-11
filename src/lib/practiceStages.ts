// Sezioni (stati del flusso) in cui si dividono le pratiche.
//
// Nascono dagli stati che il portale gia' ha (stato + stato incasso), senza duplicare dati:
//   Da lavorare        in_lavorazione              pratica caricata o ricevuta, da valutare e preparare
//   In valutazione     in_attesa                   inviata al portale della compagnia, si attende la risposta
//   Deliberate         approvata, non incassata    la compagnia ha deliberato: bozza pronta, da pagare
//   Pagate             approvata, incassata        pagamento registrato, in attesa dell'emissione
//   Emesse             completata                  polizza emessa
//   Non deliberate     rifiutata                   la compagnia non ha deliberato
//
// Il file non dipende dal browser: lo usano anche le funzioni /api.

export const PRACTICE_STAGES = [
  "da_lavorare",
  "in_valutazione",
  "deliberata",
  "da_emettere",
  "emessa",
  "non_deliberata",
] as const;

export type PracticeStage = (typeof PRACTICE_STAGES)[number];

export interface StageInput {
  status: string | null | undefined;
  financial_status?: string | null;
}

export const isPaid = (financialStatus: string | null | undefined) =>
  financialStatus === "incassata" || financialStatus === "provvigioni_ricevute";

export function stageOf(practice: StageInput): PracticeStage {
  switch (practice.status) {
    case "in_attesa":
      return "in_valutazione";
    case "approvata":
      return isPaid(practice.financial_status) ? "da_emettere" : "deliberata";
    case "completata":
      return "emessa";
    case "rifiutata":
      return "non_deliberata";
    default:
      return "da_lavorare";
  }
}

export const isPracticeStage = (value: unknown): value is PracticeStage =>
  typeof value === "string" && (PRACTICE_STAGES as readonly string[]).includes(value);

// Minimo comune del costruttore di query di Supabase usato dai filtri.
interface FilterableQuery<T> {
  eq(column: string, value: string): T;
  in(column: string, values: string[]): T;
  or(filter: string): T;
}

/** Applica a una query su `practices` il filtro della sezione. */
export function applyStageFilter<T extends FilterableQuery<T>>(query: T, stage: PracticeStage): T {
  switch (stage) {
    case "da_lavorare":
      return query.eq("status", "in_lavorazione");
    case "in_valutazione":
      return query.eq("status", "in_attesa");
    case "deliberata":
      return query.eq("status", "approvata").or("financial_status.is.null,financial_status.eq.non_incassata");
    case "da_emettere":
      return query.eq("status", "approvata").in("financial_status", ["incassata", "provvigioni_ricevute"]);
    case "emessa":
      return query.eq("status", "completata");
    case "non_deliberata":
      return query.eq("status", "rifiutata");
  }
}
