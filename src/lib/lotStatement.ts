import { supabase } from "@/integrations/supabase/client";
import { stageOf } from "@/lib/practiceStages";
import {
  buildViesStatementFileName,
  computeViesLotTotals,
  generateViesStatementPdf,
  latestDraftNumbers,
  viesStatementPdfToBytes,
  type ViesStatementImage,
} from "@/lib/viesStatementPdf";


const blobToImage = (blob: Blob) =>
  new Promise<ViesStatementImage>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("image"));
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const image = new Image();
      image.onload = () => resolve({ dataUrl, width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error("image"));
      image.src = dataUrl;
    };
    reader.readAsDataURL(blob);
  });

/**
 * Il numero di bozza di ogni pratica, dal nome dell'ultima bozza caricata dopo la delibera. Se le bozze non si leggono
 * l'estratto conto esce lo stesso, con il numero di pratica al posto di quello di bozza.
 */
export async function fetchDraftNumbers(practiceIds: string[]): Promise<Map<string, string>> {
  const drafts: Array<{ practice_id: string; file_name: string; created_at: string }> = [];
  for (let index = 0; index < practiceIds.length; index += 100) {
    const { data, error } = await supabase
      .from("practice_documents")
      .select("practice_id, file_name, created_at")
      .eq("document_type", "bozza_deliberata")
      .in("practice_id", practiceIds.slice(index, index + 100));
    if (error) return new Map();
    drafts.push(...(data ?? []));
  }
  return latestDraftNumbers(drafts);
}

export interface ClientStatement {
  blob: Blob;
  fileName: string;
  /** Totale premi da pagare, in euro. */
  total: number;
  policies: number;
}

/**
 * L'estratto conto del lotto per il rappresentante fiscale che paga (polizze deliberate e totale premi da pagare,
 * senza provvigioni ne' ritenuta): lo stesso documento che l'amministrazione genera, con firma e logo dell'agenzia.
 */
export async function buildClientStatement(batchId: string): Promise<ClientStatement> {
  const { data: batch, error } = await supabase
    .from("vies_batches")
    .select("id, lot_number, created_at, fiscal_representative_id, paid_at")
    .eq("id", batchId)
    .maybeSingle();
  if (error || !batch) throw new Error(error?.message ?? "lot");
  const { data: representative } = batch.fiscal_representative_id
    ? await supabase.from("vies_fiscal_representatives").select("name, tax_code").eq("id", batch.fiscal_representative_id).maybeSingle()
    : { data: null };
  const { data: rows, error: practiceError } = await supabase
    .from("practices")
    .select("id, practice_number, client_name, policy_number, policy_start_date, premium_gross, premium_net, status, financial_status")
    .eq("vies_batch_id", batchId)
    .order("practice_number");
  if (practiceError) throw new Error(practiceError.message);

  // L'estratto conto riguarda le pratiche deliberate (le altre non hanno ancora un premio da pagare).
  const approved = (rows ?? []).filter((practice) => ["deliberata", "da_emettere", "emessa"].includes(stageOf(practice)));
  const draftNumbers = await fetchDraftNumbers(approved.map((practice) => practice.id));
  const policies = approved
    .map((practice) => ({
      contraente: practice.client_name,
      policyNumber: practice.policy_number && !/^VIES-/i.test(practice.policy_number) ? practice.policy_number : null,
      draftNumber: draftNumbers.get(practice.id) ?? null,
      practiceNumber: practice.practice_number,
      date: practice.policy_start_date,
      premiumGross: practice.premium_gross ?? 0,
      premiumNet: practice.premium_net ?? 0,
    }));
  if (policies.length === 0) throw new Error("no policies");

  // The statement is signed by the fiscal representative who pays: the agency's signature is not on it.
  const logoBlob = await fetch("/brand/tecno-mga-logo.png").then((response) => (response.ok ? response.blob() : null)).catch(() => null);
  const input = {
    kind: "cliente" as const,
    lotNumber: batch.lot_number ?? 0,
    lotDate: batch.created_at,
    representative: { name: representative?.name ?? "", taxCode: representative?.tax_code ?? "" },
    policies,
    logo: logoBlob ? await blobToImage(logoBlob).catch(() => null) : null,
    signature: null,
    paidAt: batch.paid_at,
  };
  const doc = generateViesStatementPdf(input);
  return {
    blob: new Blob([viesStatementPdfToBytes(doc) as BlobPart], { type: "application/pdf" }),
    fileName: buildViesStatementFileName(input),
    total: computeViesLotTotals(policies, 0, 0).premiums,
    policies: policies.length,
  };
}
