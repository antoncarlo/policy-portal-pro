// Pacchetto ZIP "Ricapitolo Richiesta": il PDF del preventivo piu' la
// documentazione contrattuale Helpet (CGA e DIP aggiuntivo Danni), come negli
// allegati della mail inviata al cliente. Condiviso tra browser e Vercel Functions.

import { zipSync, strToU8 } from "fflate";
import { buildPetQuoteFileName } from "./petQuotePdf.js";

export const PET_QUOTE_ZIP_MIME_TYPE = "application/zip";

export interface PetQuoteAttachmentDef {
  /** Nome del file dentro lo ZIP */
  fileName: string;
  /** Percorso pubblico sul portale (cartella public/helpet) */
  publicPath: string;
  label: string;
}

/** Documentazione contrattuale allegata a ogni Ricapitolo Richiesta. */
export const PET_QUOTE_ATTACHMENTS: PetQuoteAttachmentDef[] = [
  {
    fileName: "Helpet-Condizioni-Generali-CGA.pdf",
    publicPath: "/helpet/Helpet-Condizioni-Generali-CGA.pdf",
    label: "Condizioni Generali di Assicurazione (CGA)",
  },
  {
    fileName: "Helpet-DIP-Aggiuntivo-Danni.pdf",
    publicPath: "/helpet/Helpet-DIP-Aggiuntivo-Danni.pdf",
    label: "DIP aggiuntivo Danni",
  },
];

export interface PetQuoteAttachment {
  fileName: string;
  bytes: Uint8Array;
}

/** Nome dello ZIP: "Ricapitolo Richiesta per <nome animale>.zip". */
export function buildPetQuoteZipFileName(petName: string | null | undefined): string {
  return buildPetQuoteFileName(petName).replace(/\.pdf$/i, ".zip");
}

/**
 * Scarica gli allegati contrattuali. `baseUrl` vuoto = percorsi relativi (browser);
 * nelle Vercel Functions va passato l'URL pubblico del portale.
 * Un allegato non raggiungibile viene saltato (il preventivo resta valido).
 */
export async function loadPetQuoteAttachments(
  baseUrl = "",
  fetchImpl: typeof fetch = fetch
): Promise<PetQuoteAttachment[]> {
  const results = await Promise.all(
    PET_QUOTE_ATTACHMENTS.map(async (def): Promise<PetQuoteAttachment | null> => {
      try {
        const res = await fetchImpl(`${baseUrl}${def.publicPath}`);
        if (!res.ok) return null;
        const buf: Uint8Array = new Uint8Array(await res.arrayBuffer());
        // Un rewrite SPA restituirebbe la pagina HTML: accettiamo solo PDF veri
        if (buf.length < 5 || String.fromCharCode(...buf.subarray(0, 5)) !== "%PDF-") return null;
        return { fileName: def.fileName, bytes: buf };
      } catch {
        return null;
      }
    })
  );
  const attachments: PetQuoteAttachment[] = [];
  for (const a of results) if (a) attachments.push(a);
  return attachments;
}

/**
 * Crea lo ZIP con il PDF del preventivo e gli allegati contrattuali.
 * I PDF sono gia' compressi: vengono salvati senza ricompressione (level 0).
 */
export function buildPetQuoteZip(input: {
  petName: string | null | undefined;
  quotePdf: Uint8Array;
  attachments: PetQuoteAttachment[];
  readme?: string;
}): Uint8Array {
  const entries: Record<string, [Uint8Array, { level: 0 | 6 }]> = {};
  entries[buildPetQuoteFileName(input.petName)] = [input.quotePdf, { level: 0 }];
  for (const a of input.attachments) entries[a.fileName] = [a.bytes, { level: 0 }];
  if (input.readme) entries["LEGGIMI.txt"] = [strToU8(input.readme), { level: 6 }];
  return zipSync(entries);
}

export function buildPetQuoteReadme(petName: string | null | undefined, attachments: PetQuoteAttachment[]): string {
  const lines = [
    `Ricapitolo Richiesta per ${(petName ?? "").trim() || "il tuo PET"}`,
    "",
    "Contenuto del pacchetto:",
    `- ${buildPetQuoteFileName(petName)} (preventivo personalizzato)`,
    ...PET_QUOTE_ATTACHMENTS.filter((d) => attachments.some((a) => a.fileName === d.fileName)).map((d) => `- ${d.fileName} (${d.label})`),
    "",
    "Ti invitiamo a prendere visione di tutta la documentazione prima di procedere con la stipula.",
    "Team Helpet - assicurazioni@helpetapp.com",
  ];
  return lines.join("\n");
}
