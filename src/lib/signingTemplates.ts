import { supabase } from "@/integrations/supabase/client";
import { SIGNING_SLOTS, SIGNING_TEMPLATES_BUCKET, signingTemplatePath, type SigningSlotId } from "@/lib/signingDocuments";

/** Modelli dei documenti da firmare caricati dagli amministratori: lettura e scaricamento. */

export interface TemplateInfo {
  slot: SigningSlotId;
  path: string;
  updatedAt: string | null;
  size: number;
}

/** I modelli presenti nel bucket, per documento. Un errore di lettura equivale a "nessun modello". */
export async function listSigningTemplates(): Promise<Map<SigningSlotId, TemplateInfo>> {
  const found = new Map<SigningSlotId, TemplateInfo>();
  try {
    const { data, error } = await supabase.storage.from(SIGNING_TEMPLATES_BUCKET).list("vies", { limit: 100 });
    if (error || !data) return found;
    for (const slot of SIGNING_SLOTS) {
      if (!slot.hasTemplate) continue;
      const path = signingTemplatePath(slot.id);
      const item = data.find((entry) => entry.id && `vies/${entry.name}` === path);
      if (item) {
        found.set(slot.id, {
          slot: slot.id,
          path,
          updatedAt: item.updated_at ?? item.created_at ?? null,
          size: Number((item.metadata as { size?: number } | null)?.size ?? 0),
        });
      }
    }
  } catch {
    // Senza accesso allo storage i modelli risultano assenti: la pagina resta usabile.
  }
  return found;
}

export async function downloadSigningTemplate(slot: SigningSlotId): Promise<Blob> {
  const { data, error } = await supabase.storage.from(SIGNING_TEMPLATES_BUCKET).download(signingTemplatePath(slot));
  if (error || !data) throw new Error(error?.message ?? "template not found");
  return data;
}

/** Scarica un blob come file nel browser. */
export const saveBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
