// Riconoscimento dei file caricati in blocco per un lotto: ogni file (o ogni file di uno ZIP) va alla sua pratica.
//
// Si cerca il numero pratica nel percorso o nel nome (anche se la firma o l'invio hanno tolto le cartelle); in
// mancanza, il nome del contraente, se un solo contraente del lotto compare nel nome come parola intera.
// L'amministratore vede il risultato prima di confermare e puo' correggere ogni assegnazione.

export interface RecognitionPractice {
  id: string;
  practice_number: string;
  client_name: string;
  policy_number?: string | null;
  /** Partita IVA italiana del contraente, se c'e'. */
  tax_code?: string | null;
  /** Codice unificato di credito sociale della societa' cinese, se c'e'. */
  uscc?: string | null;
}

export interface LotFileEntry {
  /** Percorso dentro lo ZIP, o il nome del file caricato. */
  path: string;
  /** Solo il nome del file. */
  name: string;
  blob: Blob;
  size: number;
}

/** Come si e' riconosciuta la pratica, e dove: nel nome (o nel percorso) del file o nel suo contenuto. */
export type MatchHow = "number_file" | "number_content" | "policy_file" | "policy_content" | "tax_content" | "name_content" | "name_file";

export interface FileMatch {
  entry: LotFileEntry;
  practiceId: string | null;
  how: MatchHow | null;
  /** Un altro file, riconosciuto meglio, ha gia' questa pratica (si assegna a mano). */
  duplicate?: boolean;
}

const accentless = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** Parole separate da un solo spazio: i confini di parola servono a non confondere "Azienda 1" e "Azienda 12". */
const words = (value: string) => ` ${accentless(value).replace(/\./g, "").replace(/[^a-z0-9]+/g, " ").trim()} `;
/** Le sigle della forma giuridica ("S.r.l.", "Co., Ltd") non fanno parte del nome: senza, il nome si riconosce anche se il documento le omette. */
const LEGAL_FORMS = new Set(["srl", "spa", "sas", "snc", "sapa", "srls", "ltd", "limited", "co", "llc", "inc", "corp", "gmbh", "sa", "bv", "plc", "company"]);
const withoutLegalForm = (needle: string) => {
  const tokens = needle.trim().split(" ");
  while (tokens.length > 1 && LEGAL_FORMS.has(tokens[tokens.length - 1])) tokens.pop();
  return ` ${tokens.join(" ")} `;
};
const MIN_NAME_LENGTH = 4;

/** Quanto ci si fida di ogni modo di riconoscere: serve a scegliere tra due file che puntano alla stessa pratica. */
const RANK: Record<MatchHow, number> = {
  number_file: 7,
  number_content: 6,
  tax_content: 5,
  policy_content: 4,
  policy_file: 4,
  name_content: 3,
  name_file: 2,
};

/** Il contraente unico che compare come parole intere nel testo; se ne compaiono piu' di uno vince il nome piu' lungo, se unico. */
function uniqueName(haystack: string, practices: RecognitionPractice[]) {
  const named = practices
    .map((practice) => {
      const full = words(practice.client_name);
      const core = withoutLegalForm(full);
      // The full name first; the name without "Srl", "Ltd"... only if it still says something (6 letters or more).
      const needle = haystack.includes(full) ? full : core.trim().length >= 6 && haystack.includes(core) ? core : "";
      return { practice, needle };
    })
    .filter(({ needle }) => needle.trim().length >= MIN_NAME_LENGTH);
  if (named.length === 0) return null;
  const longest = Math.max(...named.map(({ needle }) => needle.length));
  const top = named.filter(({ needle }) => needle.length === longest);
  return top.length === 1 ? top[0].practice : null;
}

function matchOne(entry: LotFileEntry, practices: RecognitionPractice[], text: string): { practiceId: string | null; how: MatchHow | null } {
  const lowerPath = accentless(entry.path);
  const folders = lowerPath.split("/").filter(Boolean).slice(0, -1);
  const found = (practice: RecognitionPractice | null | undefined, how: MatchHow) => ({ practiceId: practice?.id ?? null, how: practice ? how : null });

  // 1. Il numero pratica nel percorso o nel nome: la cartella con quel nome, oppure scritto nel nome (il piu' lungo).
  let best: RecognitionPractice | null = null;
  for (const practice of practices) {
    const number = accentless(practice.practice_number);
    if (!number) continue;
    if (folders.includes(number)) return found(practice, "number_file");
    if (lowerPath.includes(number) && (!best || number.length > best.practice_number.length)) best = practice;
  }
  if (best) return found(best, "number_file");

  const body = accentless(text);
  if (body.trim()) {
    // 2. Il numero pratica scritto nel documento.
    let inside: RecognitionPractice | null = null;
    for (const practice of practices) {
      const number = accentless(practice.practice_number);
      if (number && body.includes(number) && (!inside || number.length > inside.practice_number.length)) inside = practice;
    }
    if (inside) return found(inside, "number_content");

    // 3. La partita IVA o il codice unificato del contraente, scritti nel documento (un solo contraente).
    const digits = body.replace(/[^a-z0-9]+/g, " ");
    const byTax = practices.filter((practice) => [practice.tax_code, practice.uscc].some((code) => code && code.trim().length >= 9 && ` ${digits} `.includes(` ${accentless(code).replace(/\s+/g, "")} `)));
    if (byTax.length === 1) return found(byTax[0], "tax_content");

    // 4. Il numero di polizza della compagnia, se la pratica ce l'ha.
    const byPolicyText = practices.filter((practice) => practice.policy_number && !/^VIES-/i.test(practice.policy_number) && body.includes(accentless(practice.policy_number)));
    if (byPolicyText.length === 1) return found(byPolicyText[0], "policy_content");
  }

  const byPolicy = practices.filter((practice) => practice.policy_number && !/^VIES-/i.test(practice.policy_number) && lowerPath.includes(accentless(practice.policy_number)));
  if (byPolicy.length === 1) return found(byPolicy[0], "policy_file");

  // 5. Il nome del contraente come parole intere: prima nel documento, poi nel nome del file.
  if (body.trim()) {
    const inText = uniqueName(words(text), practices);
    if (inText) return found(inText, "name_content");
  }
  return found(uniqueName(words(entry.path), practices), "name_file");
}

/**
 * Assegna ogni file a una pratica. Con `exclusive` (una bozza o una copia per pratica) due file non possono avere la
 * stessa pratica: resta quello riconosciuto meglio (a parita', il primo) e l'altro va assegnato a mano.
 * `texts` e' il testo letto dentro ogni file, per percorso.
 */
export function matchEntries(entries: LotFileEntry[], practices: RecognitionPractice[], options: { exclusive?: boolean; texts?: Map<string, string> } = {}): FileMatch[] {
  const matches: FileMatch[] = entries.map((entry) => ({ entry, ...matchOne(entry, practices, options.texts?.get(entry.path) ?? "") }));
  if (!options.exclusive) return matches;
  const winner = new Map<string, number>();
  matches.forEach((match, index) => {
    if (!match.practiceId || !match.how) return;
    const current = winner.get(match.practiceId);
    if (current === undefined || RANK[match.how] > RANK[matches[current].how as MatchHow]) winner.set(match.practiceId, index);
  });
  return matches.map((match, index) =>
    match.practiceId && winner.get(match.practiceId) !== index ? { entry: match.entry, practiceId: null, how: null, duplicate: true } : match,
  );
}

/** Il testo dei PDF (le prime pagine), per riconoscere le pratiche dal contenuto. Un PDF scansito non ha testo: resta il nome. */
export async function readEntryTexts(entries: LotFileEntry[], onProgress?: (done: number, total: number) => void): Promise<Map<string, string>> {
  const { extractPdfText } = await import("./pdfText");
  const texts = new Map<string, string>();
  let done = 0;
  const queue = [...entries];
  const worker = async () => {
    for (let entry = queue.shift(); entry; entry = queue.shift()) {
      try {
        const result = await extractPdfText(new Uint8Array(await entry.blob.arrayBuffer()));
        texts.set(entry.path, result.lines.join("\n").slice(0, 30000));
      } catch {
        texts.set(entry.path, "");
      }
      done += 1;
      onProgress?.(done, entries.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, entries.length) }, worker));
  return texts;
}

const IGNORED = /(^|\/)(__MACOSX\/|\.[^/]*$|thumbs\.db$)/i;

/**
 * I file da assegnare: i PDF scelti e quelli dentro gli ZIP (anche ZIP annidati). Il resto viene ignorato e
 * elencato: l'amministratore sa cosa non e' stato letto.
 */
export async function expandFiles(files: File[], accept: RegExp = /\.pdf$/i): Promise<{ entries: LotFileEntry[]; ignored: string[] }> {
  const entries: LotFileEntry[] = [];
  const ignored: string[] = [];
  const { default: JSZip } = await import("jszip");

  const readZip = async (data: Blob, prefix: string, depth: number) => {
    const zip = await JSZip.loadAsync(await data.arrayBuffer());
    for (const item of Object.values(zip.files)) {
      if (item.dir) continue;
      const path = `${prefix}${item.name}`;
      if (IGNORED.test(item.name)) continue;
      if (/\.zip$/i.test(item.name) && depth < 2) {
        await readZip(await item.async("blob"), `${path}/`, depth + 1);
      } else if (accept.test(item.name)) {
        const blob = await item.async("blob");
        entries.push({ path, name: item.name.split("/").pop() ?? item.name, blob, size: blob.size });
      } else {
        ignored.push(path);
      }
    }
  };

  for (const file of files) {
    if (/\.zip$/i.test(file.name)) await readZip(file, "", 0);
    else if (accept.test(file.name)) entries.push({ path: file.name, name: file.name, blob: file, size: file.size });
    else ignored.push(file.name);
  }
  return { entries, ignored };
}
