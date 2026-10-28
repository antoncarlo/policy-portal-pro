// Nome dello ZIP di una pratica VIES: il valore della colonna ZIP dell'Excel del lotto e' il nome del file ZIP
// con i documenti del cliente. Puo' essere un numero (1 … 20), un codice cliente (CNTBA03717) o una sigla:
// la riga "CNTBA03717" trova CNTBA03717.zip. Funzioni pure, usate dalla pagina VIES e dal controllo del lotto.

/** Oltre questa lunghezza il nome dello ZIP archiviato verrebbe troncato e non coinciderebbe piu' con la riga. */
export const MAX_ZIP_NAME_LENGTH = 80;

const LEGACY_PRACTICE_NUMBER = /^([1-9]|1\d|20)$/;

/** Chiave di confronto: "CNTBA03717", "cntba03717.zip" e " CNTBA03717 " coincidono; chiavi diverse restano distinte. */
export const zipKeyOf = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\.zip$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Il valore della colonna ZIP puo' dare il nome a uno ZIP: almeno una lettera o cifra, al massimo 80 caratteri. */
export const isValidZipName = (value: unknown) => {
  const key = zipKeyOf(value);
  return key.length > 0 && key.length <= MAX_ZIP_NAME_LENGTH;
};

/** Le chiavi ZIP delle righe dell'Excel. */
export const practiceZipKeys = (names: Iterable<unknown>) =>
  new Set([...names].map(zipKeyOf).filter(Boolean));

/**
 * Il nome (di file o cartella) e' quello di una pratica del lotto: una delle chiavi della colonna ZIP;
 * senza Excel caricato, un numero da 1 a 20 come nel modello di prima.
 */
export const isPracticeZipName = (name: string, practiceKeys: ReadonlySet<string>) => {
  const base = name.trim().replace(/\.zip$/i, "").trim();
  return practiceKeys.size ? practiceKeys.has(zipKeyOf(base)) : LEGACY_PRACTICE_NUMBER.test(base);
};

export type ZipBundlePart =
  | { fileName: string; zipEntry: string }
  | { fileName: string; folderEntries: Array<{ entry: string; path: string }> };

/**
 * Un unico ZIP caricato puo' contenere tutto il lotto: uno ZIP o una cartella per pratica, chiamati come nella
 * colonna ZIP (CNTBA03717.zip o CNTBA03717/…, 1.zip … 20.zip o cartelle 1 … 20). `entryNames` sono i file
 * dell'archivio (senza cartelle ne' file di sistema). Restituisce uno ZIP per pratica, oppure null quando
 * l'archivio e' quello di una sola pratica e va tenuto com'e'.
 */
export function planZipBundle(fileName: string, entryNames: string[], practiceKeys: ReadonlySet<string>): ZipBundlePart[] | null {
  // Un archivio compresso dalla cartella che lo contiene ("lotto/CNTBA03717.zip") ha una sola cartella radice.
  const roots = new Set(entryNames.map((name) => (name.includes("/") ? name.split("/")[0] : "")));
  const commonRoot = roots.size === 1 && !roots.has("") ? `${[...roots][0]}/` : "";
  const zips = new Map<string, { name: string; entry: string }>();
  const folders = new Map<string, { name: string; entries: Array<{ entry: string; path: string }> }>();

  for (const entry of entryNames) {
    const segments = entry.slice(commonRoot.length).split("/");
    if (segments.length === 1) {
      const name = /^(.+)\.zip$/i.exec(segments[0].trim())?.[1]?.trim();
      if (name && isPracticeZipName(name, practiceKeys)) zips.set(zipKeyOf(name), { name, entry });
    } else if (isPracticeZipName(segments[0], practiceKeys)) {
      const name = segments[0].trim();
      const folder = folders.get(zipKeyOf(name)) ?? { name, entries: [] };
      folder.entries.push({ entry, path: segments.slice(1).join("/") });
      folders.set(zipKeyOf(name), folder);
    }
  }

  const keys = new Set([...zips.keys(), ...folders.keys()]);
  // Lo ZIP di una pratica che contiene la cartella col suo stesso nome (e altri file) non e' un lotto.
  if (keys.size === 0 || (keys.size === 1 && keys.has(zipKeyOf(fileName)))) return null;

  const parts: ZipBundlePart[] = [...zips.values()].map(({ name, entry }) => ({ fileName: `${name}.zip`, zipEntry: entry }));
  for (const [key, { name, entries }] of folders) {
    if (!zips.has(key)) parts.push({ fileName: `${name}.zip`, folderEntries: entries });
  }
  return parts;
}
