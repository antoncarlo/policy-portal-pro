// How a document is read. Every document goes to the everyday model; a document whose first reading gave a code
// with a wrong check character (the portal checks it) is read once more by the more capable model, told what to
// look at: on small or rotated scans a digit of a repeated pair ("00") is the one that gets lost.

export interface ReadingSettings {
  model: string;
  effort: "medium" | "high";
  maxTokens: number;
  note: string;
}

const RECHECK_NOTE =
  "\nRilettura di verifica: in una lettura precedente un codice di questo documento non ha superato la cifra di controllo. " +
  "Rileggi ogni codice carattere per carattere, contando con attenzione le cifre ripetute (per esempio 00): il codice unificato " +
  "di credito sociale e il numero della carta d'identità cinese hanno 18 caratteri, la partita IVA italiana 11 cifre. " +
  "Se un carattere resta incerto, lascia il campo vuoto.";

export const readingSettings = (recheck: boolean): ReadingSettings =>
  recheck
    ? { model: "claude-opus-5-5", effort: "high", maxTokens: 8192, note: RECHECK_NOTE }
    : { model: "claude-sonnet-5-5", effort: "medium", maxTokens: 4096, note: "" };
