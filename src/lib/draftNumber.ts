// Numero di bozza della compagnia, letto dal nome del file della bozza caricata dopo la delibera. Serve a riconciliare
// il pagamento dell'estratto conto con la bozza giusta e a indicare la proposta nel MUP. Funzioni pure.

/**
 * Il numero di bozza che la compagnia mette all'inizio del nome del file della bozza ("1514223_ViesBozza_Markel_2026.pdf")
 * o dopo la parola bozza ("Bozza n. 1514223.pdf"): almeno 5 cifre, perche' un anno ("2026_bozza.pdf") non lo e'.
 */
export const draftNumberFromFileName = (fileName: string): string | null => {
  const name = fileName.split("/").pop() ?? fileName;
  return /^(\d{5,})(?=[_\-\s.])/.exec(name)?.[1] ?? /bozza\s*(?:n\.?|nr\.?|numero)?\s*(\d{5,})/i.exec(name)?.[1] ?? null;
};

/** Il numero dell'ultima bozza caricata per ogni pratica, tra quelle che ne hanno uno. */
export const latestDraftNumbers = (drafts: Array<{ practice_id: string; file_name: string; created_at: string }>) => {
  const numbers = new Map<string, string>();
  for (const draft of [...drafts].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const number = draftNumberFromFileName(draft.file_name);
    if (number) numbers.set(draft.practice_id, number);
  }
  return numbers;
};
