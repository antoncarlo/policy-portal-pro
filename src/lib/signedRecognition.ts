// I file firmati ricaricati dal collaboratore: a quale pratica e a quale documento da firmare appartengono.
//
// Il collaboratore firma la copia per la Compagnia (un .p7m della compagnia, che firma di nuovo) e il MUP. I nomi
// dei file dipendono da chi li ha preparati e dal programma di firma: la cartella dello ZIP del portale
// ("VIES-2026-0008-…/1_polizza_copia_compagnia_….p7m"), il nome della compagnia ("1514223_ViesCompagnia_….pdf.p7m"),
// o un nome rifatto dal programma ("VIES-2026-0008-…_mup_signed.p7m"). Si riconosce:
//   - la pratica dal numero pratica (cartella, nome o contenuto), dal numero della bozza della compagnia (nome o
//     contenuto), dalla partita IVA o dal numero di polizza scritti nel documento. Il solo nome del cliente non basta:
//     un documento firmato non deve finire nella pratica sbagliata;
//   - il documento dal nome ("polizza", "copia compagnia", "ViesCompagnia", "mup") o dall'intestazione del documento
//     ("Copia COMPAGNIA/CONTRAENTE", "Modulo Unico Precontrattuale").
// La copia per il Beneficiario non e' un documento da firmare: non si carica.

import { isBeneficiaryCopy, matchEntries, type LotFileEntry, type MatchHow, type RecognitionPractice } from "./lotRecognition";
import { inferSigningSlotFromFileName, type SigningSlotId } from "./signingDocuments";

export interface SignedPractice extends RecognitionPractice {
  /** La pratica e' nella sezione in cui si firma (deliberata o pagata). */
  signing: boolean;
}

export type SignedSkipReason = "beneficiary_copy" | "unknown_practice" | "unknown_type" | "not_signing";

export type SignedFileOutcome =
  | { practiceId: string; slotId: SigningSlotId }
  | { skip: SignedSkipReason; practiceId: string | null; slotId: SigningSlotId | null };

/** Modi di riconoscere la pratica abbastanza sicuri per allegarle un documento firmato: non il solo nome del cliente. */
const SURE: ReadonlySet<MatchHow> = new Set<MatchHow>(["number_file", "draft_file", "number_content", "draft_content", "tax_content", "policy_file", "policy_content"]);

const accentless = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Il documento da firmare: dal nome del file, poi dall'intestazione del documento. "beneficiary": la copia per il Beneficiario. */
export function signedSlotOf(name: string, text = ""): SigningSlotId | "beneficiary" | null {
  if (isBeneficiaryCopy(name, text)) return "beneficiary";
  const byName = inferSigningSlotFromFileName(name);
  if (byName) return byName.id;
  // Senza spazi: nel testo letto "Copia" e "COMPAGNIA/CONTRAENTE" possono finire su righe diverse, e alcuni PDF (il
  // modello del MUP) escono con le lettere staccate ("M o d u l o U n ic o P r ec ontr a ttu a le").
  const head = accentless(text.slice(0, 6000)).replace(/\s+/g, "");
  if (/copia(perla)?compagnia|compagnia\/contraente/.test(head)) return "polizza_firmata";
  if (/modulounicoprecontrattuale/.test(head)) return "mup";
  return null;
}

/** La pratica e il documento di un file firmato, o perche' non si carica. `text`: il testo letto nel documento, se c'e'. */
export function classifySignedFile(entry: LotFileEntry, practices: SignedPractice[], text = ""): SignedFileOutcome {
  const slot = signedSlotOf(entry.name, text);
  if (slot === "beneficiary") return { skip: "beneficiary_copy", practiceId: null, slotId: null };
  const [match] = matchEntries([entry], practices, { texts: new Map([[entry.path, text]]) });
  const practice = match?.practiceId && match.how && SURE.has(match.how) ? practices.find((item) => item.id === match.practiceId) ?? null : null;
  if (!practice) return { skip: "unknown_practice", practiceId: null, slotId: slot };
  if (!slot) return { skip: "unknown_type", practiceId: practice.id, slotId: null };
  if (!practice.signing) return { skip: "not_signing", practiceId: practice.id, slotId: slot };
  return { practiceId: practice.id, slotId: slot };
}
