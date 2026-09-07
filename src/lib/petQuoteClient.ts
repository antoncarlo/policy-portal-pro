import { supabase } from "@/integrations/supabase/client";

export interface PetQuoteDocumentInfo {
  document_id: string | null;
  file_name: string;
  document_type: string;
  file_size: number;
  attachments: string[];
}

/**
 * Chiede alla function /api/pet-quote di generare lato server il Ricapitolo
 * Richiesta (ZIP con preventivo PDF e documentazione Helpet) e di allegarlo
 * alla pratica. Il browser invia solo una richiesta leggera: niente download
 * degli allegati ne' upload dello ZIP dal client.
 */
export async function requestPetQuoteDocument(practiceId: string): Promise<PetQuoteDocumentInfo> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Sessione scaduta: accedi di nuovo.");

  const res = await fetch("/api/pet-quote", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action: "attach", practice_id: practiceId }),
  });

  const payload = (await res.json().catch(() => ({}))) as { error?: string; document?: PetQuoteDocumentInfo };
  if (!res.ok || !payload.document) {
    throw new Error(payload.error || `Generazione del Ricapitolo Richiesta non riuscita (HTTP ${res.status}).`);
  }
  return payload.document;
}
