import { supabase } from "@/integrations/supabase/client";
import type { SigningSlotId } from "@/lib/signingDocuments";
import { loadAmlData } from "@/lib/amlExtractionRun";
import { buildPrefillValues, fillSigningDocument, type AmlData, type PrefillDocument, type PrefillPractice } from "@/lib/signingPrefill";

/** Dati della pratica (e quelli letti dai suoi documenti) con cui si compilano i modelli. */
export interface PrefillInput {
  practice: PrefillPractice;
  aml: AmlData;
}

const COLUMNS = "id, practice_number, policy_number, client_name, client_email, owner_tax_code, beneficiary, notes";
const CHUNK = 100;

/** Legge dal database i dati per compilare i documenti di piu' pratiche. Una pratica illeggibile manca dall'elenco. */
export async function loadPrefillInputs(practiceIds: string[]): Promise<Map<string, PrefillInput>> {
  const found = new Map<string, PrefillInput>();
  for (let start = 0; start < practiceIds.length; start += CHUNK) {
    const slice = practiceIds.slice(start, start + CHUNK);
    const { data } = await supabase.from("practices").select(COLUMNS).in("id", slice);
    for (const row of (data ?? []) as Array<PrefillPractice & { id: string }>) {
      found.set(row.id, { practice: row, aml: {} });
    }
  }
  // Quello che e' stato letto dai documenti dello ZIP (se e' stato letto): una bozza da verificare.
  try {
    for (const [practiceId, stored] of await loadAmlData([...found.keys()])) {
      const entry = found.get(practiceId);
      if (entry) entry.aml = stored.aml;
    }
  } catch {
    // Senza i dati letti dai documenti i moduli si compilano con quelli della pratica.
  }
  return found;
}

const DOCUMENT_OF_SLOT: Partial<Record<SigningSlotId, PrefillDocument>> = {
  mup: "mup",
};

/** Il documento da firmare compilato per una pratica; senza dati (`input` assente) il modello in bianco. */
export async function generateSigningDocument(slot: SigningSlotId, input?: PrefillInput | null): Promise<Blob> {
  const document = DOCUMENT_OF_SLOT[slot];
  if (!document) throw new Error(`no built-in template for ${slot}`);
  return fillSigningDocument(document, input ? buildPrefillValues(input.practice, input.aml) : {});
}
