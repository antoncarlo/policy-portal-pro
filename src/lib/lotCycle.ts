// Ciclo di un lotto VIES, dalla bozza della compagnia alle polizze emesse.
//
//   1  bozze              l'amministratore delibera le pratiche e carica le bozze della compagnia
//   2  verifica           il collaboratore scarica bozze e MUP, le controlla e conferma di averle verificate
//   3  pagamento          il collaboratore paga l'estratto conto (saldo), lo firma e allega il bonifico
//   4  conferma           l'amministratore riceve l'ok e conferma l'incasso: le pratiche passano a "pagate"
//   5  copie              l'amministratore carica la polizza copia Compagnia di ogni cliente
//   6  firme              il collaboratore scarica lo ZIP (MUP, polizze, documenti), firma in blocco e ricarica
//   7  invio              l'amministratore scarica le firme e le invia alla compagnia
//   8  emesse             la compagnia risponde: l'amministratore carica le polizze emesse (4 copie) e il lotto si chiude
//
// Il file non dipende dal browser: lo usano anche le funzioni /api (stessi passaggi, stessi controlli).

import { stageOf, type PracticeStage } from "./practiceStages.js";

export const LOT_STEPS = ["drafts", "verify", "payment", "payment_check", "copies", "sign", "send", "issued"] as const;
export type LotStepId = (typeof LOT_STEPS)[number];

/** Chi deve agire in ogni passaggio. */
export const LOT_STEP_ACTOR: Record<LotStepId, "admin" | "collaborator"> = {
  drafts: "admin",
  verify: "collaborator",
  payment: "collaborator",
  payment_check: "admin",
  copies: "admin",
  sign: "collaborator",
  send: "admin",
  issued: "admin",
};

export interface LotFlowRow {
  drafts_uploaded_at: string | null;
  drafts_uploaded_by: string | null;
  drafts_confirmed_at: string | null;
  drafts_confirmed_by: string | null;
  payment_submitted_at: string | null;
  payment_submitted_by: string | null;
  payment_confirmed_at: string | null;
  payment_confirmed_by: string | null;
  copies_uploaded_at: string | null;
  copies_uploaded_by: string | null;
  sent_to_company_at: string | null;
  sent_to_company_by: string | null;
  issued_uploaded_at: string | null;
  issued_uploaded_by: string | null;
  closed_at: string | null;
}

export const EMPTY_FLOW: LotFlowRow = {
  drafts_uploaded_at: null,
  drafts_uploaded_by: null,
  drafts_confirmed_at: null,
  drafts_confirmed_by: null,
  payment_submitted_at: null,
  payment_submitted_by: null,
  payment_confirmed_at: null,
  payment_confirmed_by: null,
  copies_uploaded_at: null,
  copies_uploaded_by: null,
  sent_to_company_at: null,
  sent_to_company_by: null,
  issued_uploaded_at: null,
  issued_uploaded_by: null,
  closed_at: null,
};

/** Cio' che il ciclo deve sapere di una pratica del lotto. */
export interface LotPracticeState {
  id: string;
  practice_number: string;
  client_name?: string;
  status: string;
  financial_status: string | null;
  hasDraft: boolean;
  hasCompanyCopy: boolean;
  signaturesComplete: boolean;
  issuedCopies: number;
}

export interface LotStepState {
  id: LotStepId;
  actor: "admin" | "collaborator";
  done: boolean;
  at: string | null;
  by: string | null;
}

export interface LotCycleState {
  steps: LotStepState[];
  /** Il primo passaggio non completato; null a lotto chiuso. */
  current: LotStepId | null;
  /** Le pratiche del ciclo: deliberate (da "Deliberate" in poi). Le altre aspettano la delibera. */
  active: LotPracticeState[];
  waiting: LotPracticeState[];
  /** Per passaggio, i numeri delle pratiche che non sono a posto. */
  missing: Partial<Record<LotStepId, string[]>>;
  closed: boolean;
}

const DELIBERATED: PracticeStage[] = ["deliberata", "da_emettere", "emessa"];

export const isActiveInCycle = (practice: Pick<LotPracticeState, "status" | "financial_status">) => DELIBERATED.includes(stageOf(practice));

export function lotCycleOf(flow: Partial<LotFlowRow> | null | undefined, practices: LotPracticeState[]): LotCycleState {
  const row = { ...EMPTY_FLOW, ...(flow ?? {}) };
  const active = practices.filter(isActiveInCycle);
  const waiting = practices.filter((practice) => !isActiveInCycle(practice) && stageOf(practice) !== "non_deliberata");
  const numbers = (list: LotPracticeState[]) => list.map((practice) => practice.practice_number);

  const missing: LotCycleState["missing"] = {
    drafts: numbers(active.filter((practice) => !practice.hasDraft)),
    copies: numbers(active.filter((practice) => !practice.hasCompanyCopy)),
    sign: numbers(active.filter((practice) => !practice.signaturesComplete)),
    issued: numbers(active.filter((practice) => practice.issuedCopies === 0)),
  };

  const done: Record<LotStepId, { done: boolean; at: string | null; by: string | null }> = {
    drafts: { done: Boolean(row.drafts_uploaded_at), at: row.drafts_uploaded_at, by: row.drafts_uploaded_by },
    verify: { done: Boolean(row.drafts_confirmed_at), at: row.drafts_confirmed_at, by: row.drafts_confirmed_by },
    payment: { done: Boolean(row.payment_submitted_at), at: row.payment_submitted_at, by: row.payment_submitted_by },
    payment_check: { done: Boolean(row.payment_confirmed_at), at: row.payment_confirmed_at, by: row.payment_confirmed_by },
    copies: { done: Boolean(row.copies_uploaded_at), at: row.copies_uploaded_at, by: row.copies_uploaded_by },
    // Le firme sono complete quando ogni pratica del ciclo ha tutti i documenti firmati.
    sign: { done: active.length > 0 && missing.sign!.length === 0 && Boolean(row.copies_uploaded_at), at: null, by: null },
    send: { done: Boolean(row.sent_to_company_at), at: row.sent_to_company_at, by: row.sent_to_company_by },
    issued: { done: Boolean(row.issued_uploaded_at), at: row.issued_uploaded_at, by: row.issued_uploaded_by },
  };

  const steps = LOT_STEPS.map((id): LotStepState => ({ id, actor: LOT_STEP_ACTOR[id], ...done[id] }));
  const closed = Boolean(row.closed_at);
  const current = closed ? null : (steps.find((step) => !step.done)?.id ?? null);
  return { steps, current, active, waiting, missing, closed };
}

/** Il passaggio e' possibile solo se i precedenti sono fatti (l'amministratore puo' forzare dove lo dice l'azione). */
export function stepBlockedBy(state: LotCycleState, step: LotStepId): LotStepId | null {
  const index = LOT_STEPS.indexOf(step);
  for (const previous of state.steps.slice(0, index)) {
    // La firma e l'invio non bloccano il caricamento delle polizze emesse: la compagnia puo' rispondere prima.
    if (!previous.done) return previous.id;
  }
  return null;
}
