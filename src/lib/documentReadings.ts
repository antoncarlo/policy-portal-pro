// Register of the document checks of a VIES lot (table vies_document_readings): for every document of the ZIPs,
// how the portal recognised it (from its text or by the document agent), every reading of the agent with its model,
// what it read and which codes passed the check character, and the fingerprint of the file. Written once, when the
// lot is created: it is the trace of the customer due diligence, kept for 10 years.

import { verifiedAgentIdentifiers, type AgentCallOutcome, type AgentDocumentResult } from "./viesDocumentAgent.js";

/** lettura: first reading of a scan; verifica_approfondita: whole document read again for a missing requirement;
 * dati_anagrafici: identity document recognised from its text, read for the legal representative's data. */
export type ReadingPurpose = "lettura" | "verifica_approfondita" | "dati_anagrafici";

export interface AgentReadingRecord {
  purpose: ReadingPurpose;
  status: "ok" | "error" | "unavailable";
  /** When the portal got the answer (ISO). */
  at: string;
  model: string | null;
  /** Only the first pages and the last one were sent. */
  excerpt: boolean;
  /** Read again by the more capable model after a code with a wrong check character. */
  rechecked: boolean;
  /** Reading done earlier in the same browser tab and reused. */
  reused: boolean;
  result: AgentDocumentResult | null;
  verified: { usccs: string[]; vatNumbers: string[]; chineseIds: string[]; issues: string[] } | null;
  error: string | null;
}

export function agentReadingRecord(purpose: ReadingPurpose, outcome: AgentCallOutcome, at = new Date()): AgentReadingRecord {
  if (outcome.status !== "ok") {
    return {
      purpose, status: outcome.status, at: at.toISOString(), model: null, excerpt: false, rechecked: false, reused: false,
      result: null, verified: null, error: outcome.message,
    };
  }
  return {
    purpose,
    status: "ok",
    at: at.toISOString(),
    model: outcome.model ?? null,
    excerpt: Boolean(outcome.excerpt),
    rechecked: Boolean(outcome.rechecked),
    reused: Boolean(outcome.cached),
    result: outcome.result,
    verified: verifiedAgentIdentifiers(outcome.result),
    error: null,
  };
}

export interface ReadingDocument {
  path: string;
  name: string;
  size: number;
  /** SHA-256 of the file, when its bytes were read. */
  contentHash: string | null;
  recognisedBy: "testo" | "agent" | null;
  documentType: string | null;
  extraDocumentTypes: string[];
  vatNumbers: string[];
  usccs: string[];
  chineseIds: string[];
  agentIssues: string[];
  /** Required document types the document counts for in its practice. */
  acceptedTypes: string[];
  agentReadings: AgentReadingRecord[];
}

export interface ReadingLotRow {
  rowNumber: number;
  zipName: string | null;
  zipFileName: string | null;
  /** Null for a row left out of the lot. */
  practiceId: string | null;
  practiceNumber: string | null;
  documents: ReadingDocument[];
}

/** One row of vies_document_readings per document of the lot. */
export function documentReadingRows({ batchId, lotNumber, recordedBy, rows }: { batchId: string; lotNumber: number; recordedBy: string; rows: ReadingLotRow[] }) {
  return rows.flatMap((row) =>
    row.documents.map((document) => ({
      batch_id: batchId,
      lot_number: lotNumber,
      practice_id: row.practiceId,
      practice_number: row.practiceNumber,
      row_number: row.rowNumber,
      zip_name: row.zipName,
      zip_file_name: row.zipFileName,
      document_path: document.path,
      file_name: document.name,
      file_size: document.size,
      content_sha256: document.contentHash,
      recognised_by: document.recognisedBy,
      document_type: document.documentType,
      extra_document_types: document.extraDocumentTypes,
      accepted_types: document.acceptedTypes,
      codes: { usccs: document.usccs, vat_numbers: document.vatNumbers, chinese_ids: document.chineseIds },
      agent_readings: document.agentReadings,
      issues: document.agentIssues,
      recorded_by: recordedBy,
    })),
  );
}
