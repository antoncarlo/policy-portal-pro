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
}

export interface LotFileEntry {
  /** Percorso dentro lo ZIP, o il nome del file caricato. */
  path: string;
  /** Solo il nome del file. */
  name: string;
  blob: Blob;
  size: number;
}

export type MatchHow = "number" | "name" | "policy" | null;

export interface FileMatch {
  entry: LotFileEntry;
  practiceId: string | null;
  how: MatchHow;
}

const accentless = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** Parole separate da un solo spazio: i confini di parola servono a non confondere "Azienda 1" e "Azienda 12". */
const words = (value: string) => ` ${accentless(value).replace(/[^a-z0-9]+/g, " ").trim()} `;
const MIN_NAME_LENGTH = 4;

export function matchEntries(entries: LotFileEntry[], practices: RecognitionPractice[]): FileMatch[] {
  return entries.map((entry) => {
    const lowerPath = accentless(entry.path);
    const folders = lowerPath.split("/").filter(Boolean).slice(0, -1);

    // 1. Il numero pratica: la cartella con quel nome, oppure scritto nel percorso o nel nome del file (il piu' lungo).
    let best: RecognitionPractice | null = null;
    for (const practice of practices) {
      const number = accentless(practice.practice_number);
      if (!number) continue;
      if (folders.includes(number)) return { entry, practiceId: practice.id, how: "number" as const };
      if (lowerPath.includes(number) && (!best || number.length > best.practice_number.length)) best = practice;
    }
    if (best) return { entry, practiceId: best.id, how: "number" as const };

    // 2. Il numero di polizza della compagnia, se la pratica ce l'ha.
    const byPolicy = practices.filter((practice) => practice.policy_number && !/^VIES-/i.test(practice.policy_number) && lowerPath.includes(accentless(practice.policy_number)));
    if (byPolicy.length === 1) return { entry, practiceId: byPolicy[0].id, how: "policy" as const };

    // 3. Il contraente, come parole intere nel nome: se piu' contraenti ci stanno tutti, vince il nome piu' lungo, se unico.
    const haystack = words(entry.path);
    const named = practices
      .map((practice) => ({ practice, needle: words(practice.client_name) }))
      .filter(({ needle }) => needle.trim().length >= MIN_NAME_LENGTH && haystack.includes(needle));
    if (named.length > 0) {
      const longest = Math.max(...named.map(({ needle }) => needle.length));
      const top = named.filter(({ needle }) => needle.length === longest);
      if (top.length === 1) return { entry, practiceId: top[0].practice.id, how: "name" as const };
    }
    return { entry, practiceId: null, how: null };
  });
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
