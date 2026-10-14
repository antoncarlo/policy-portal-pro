import { supabase } from "@/integrations/supabase/client";
import { stageOf } from "@/lib/practiceStages";
import {
  buildViesStatementFileName,
  computeViesLotTotals,
  generateViesStatementPdf,
  viesStatementPdfToBytes,
  type ViesStatementImage,
} from "@/lib/viesStatementPdf";

const VIES_BUCKET = "vies-batch-files";
// Shared by every user: the administrators upload it, everyone reads it for the client statement.
const SIGNATURE_PATH = "00000000-0000-0000-0000-000000000000/impostazioni/firma-estratti-conto";

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
    .select("practice_number, client_name, policy_number, policy_start_date, premium_gross, premium_net, status, financial_status")
    .eq("vies_batch_id", batchId)
    .order("practice_number");
  if (practiceError) throw new Error(practiceError.message);

  // L'estratto conto riguarda le pratiche deliberate (le altre non hanno ancora un premio da pagare).
  const policies = (rows ?? [])
    .filter((practice) => ["deliberata", "da_emettere", "emessa"].includes(stageOf(practice)))
    .map((practice) => ({
      contraente: practice.client_name,
      policyNumber: practice.policy_number && !/^VIES-/i.test(practice.policy_number) ? practice.policy_number : null,
      practiceNumber: practice.practice_number,
      date: practice.policy_start_date,
      premiumGross: practice.premium_gross ?? 0,
      premiumNet: practice.premium_net ?? 0,
    }));
  if (policies.length === 0) throw new Error("no policies");

  const [logoBlob, signatureBlob] = await Promise.all([
    fetch("/brand/tecno-mga-logo.png").then((response) => (response.ok ? response.blob() : null)).catch(() => null),
    supabase.storage.from(VIES_BUCKET).download(SIGNATURE_PATH).then(({ data }) => data).catch(() => null),
  ]);
  const input = {
    kind: "cliente" as const,
    lotNumber: batch.lot_number ?? 0,
    lotDate: batch.created_at,
    representative: { name: representative?.name ?? "", taxCode: representative?.tax_code ?? "" },
    policies,
    logo: logoBlob ? await blobToImage(logoBlob).catch(() => null) : null,
    signature: signatureBlob ? await blobToImage(signatureBlob).catch(() => null) : null,
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
