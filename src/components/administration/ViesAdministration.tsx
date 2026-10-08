import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, CheckCircle2, ChevronDown, ChevronRight, Download, FileSpreadsheet, FileText, Loader2, PenLine, RefreshCw, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate, formatNumber, getMessages, useMessages } from "@/i18n";
import { administrationMessages } from "@/i18n/messages/administration";
import { translateViesText } from "@/i18n/viesText";
import { financialStatusLabel } from "@/i18n/messages/domain";
import {
  buildViesStatementFileName,
  computeViesLotTotals,
  generateViesStatementPdf,
  safeFileName,
  VIES_DEFAULT_WITHHOLDING_PERCENTAGE,
  viesStatementPdfToBytes,
  type ViesStatementImage,
  type ViesStatementInput,
  type ViesStatementKind,
} from "@/lib/viesStatementPdf";

const VIES_BUCKET = "vies-batch-files";
const BUCKET_PREFIX = `${VIES_BUCKET}://`;
const SIGNATURE_FILE = "impostazioni/firma-estratti-conto";
const COMPANY_NAME_KEY = "vies-statement-company-name";

type Representative = {
  id: string;
  name: string;
  tax_code: string;
  administrator_name: string | null;
  administrator_tax_code: string | null;
  address: string | null;
  pec: string | null;
  visura_reference: string | null;
  visura_storage_path: string | null;
};

type Lot = {
  id: string;
  name: string;
  created_at: string;
  lot_number: number | null;
  fiscal_representative_id: string | null;
  paid_at: string | null;
  commission_percentage: number | null;
  withholding_percentage: number | null;
  commissions_received_at: string | null;
  statement_generated_at: string | null;
  excel_storage_path: string | null;
  source_excel_file_name: string | null;
};

type LotPractice = {
  id: string;
  practice_number: string;
  client_name: string;
  policy_number: string | null;
  policy_start_date: string | null;
  premium_gross: number | null;
  premium_net: number | null;
  commission_percentage: number | null;
  commission_amount: number | null;
  financial_status: string;
  payment_date: string | null;
  commission_received_date: string | null;
};

const text = () => getMessages(administrationMessages).vies;

const today = () => new Date().toISOString().slice(0, 10);

const readStoredCompanyName = () => {
  try {
    return window.localStorage.getItem(COMPANY_NAME_KEY) ?? "";
  } catch {
    return "";
  }
};

const storeCompanyName = (value: string) => {
  try {
    window.localStorage.setItem(COMPANY_NAME_KEY, value);
  } catch {
    // Solo una comodità: senza storage il nome si reinserisce ogni volta.
  }
};

const parsePercent = (value: string) => {
  const number = Number(value.replace(",", "."));
  return value.trim() !== "" && Number.isFinite(number) && number >= 0 && number <= 100 ? Math.round(number * 100) / 100 : null;
};

const blobToImage = (blob: Blob) =>
  new Promise<ViesStatementImage>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(text().imageUnreadable));
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const image = new Image();
      image.onload = () => resolve({ dataUrl, width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error(text().imageInvalid));
      image.src = dataUrl;
    };
    reader.readAsDataURL(blob);
  });

const toStatementPolicies = (practices: LotPractice[]) =>
  practices.map((practice) => ({
    contraente: practice.client_name,
    policyNumber: practice.policy_number && !/^VIES-/i.test(practice.policy_number) ? practice.policy_number : null,
    practiceNumber: practice.practice_number,
    date: practice.policy_start_date,
    premiumGross: practice.premium_gross ?? 0,
    premiumNet: practice.premium_net ?? 0,
  }));

const lotWithholding = (lot: Lot) => lot.withholding_percentage ?? VIES_DEFAULT_WITHHOLDING_PERCENTAGE;

const lotTotals = (lot: Lot, practices: LotPractice[]) =>
  computeViesLotTotals(toStatementPolicies(practices), lot.commission_percentage ?? 0, lotWithholding(lot));

export const ViesAdministration = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const m = useMessages(administrationMessages).vies;
  const [loading, setLoading] = useState(true);
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [practicesByLot, setPracticesByLot] = useState<Map<string, LotPractice[]>>(new Map());
  const [selectedRepresentativeId, setSelectedRepresentativeId] = useState<string | null>(null);
  const [openLotId, setOpenLotId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [settleLot, setSettleLot] = useState<Lot | null>(null);
  const [settleForm, setSettleForm] = useState({ paidAt: today(), commission: "0", withholding: "", commissionsReceivedAt: "" });
  const [statementLot, setStatementLot] = useState<Lot | null>(null);
  const [statementForm, setStatementForm] = useState({ kind: "cliente" as ViesStatementKind, companyName: "", commission: "0", withholding: "" });
  const [signature, setSignature] = useState<ViesStatementImage | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;
      setUserId(uid);

      const [{ data: reps, error: repsError }, { data: lotRows, error: lotsError }] = await Promise.all([
        supabase.from("vies_fiscal_representatives").select("id,name,tax_code,administrator_name,administrator_tax_code,address,pec,visura_reference,visura_storage_path").order("name"),
        supabase
          .from("vies_batches")
          .select("id,name,created_at,lot_number,fiscal_representative_id,paid_at,commission_percentage,withholding_percentage,commissions_received_at,statement_generated_at,excel_storage_path,source_excel_file_name")
          .not("fiscal_representative_id", "is", null)
          .order("lot_number", { ascending: true }),
      ]);
      if (repsError) throw repsError;
      if (lotsError) throw lotsError;

      const lotList = (lotRows ?? []) as Lot[];
      const byLot = new Map<string, LotPractice[]>();
      if (lotList.length) {
        const { data: jobs, error: jobsError } = await supabase
          .from("vies_jobs")
          .select("batch_id, external_reference")
          .in("batch_id", lotList.map((lot) => lot.id));
        if (jobsError) throw jobsError;
        const practiceIds = [...new Set((jobs ?? []).map((job) => job.external_reference).filter((id): id is string => Boolean(id)))];
        const practices: LotPractice[] = [];
        for (let index = 0; index < practiceIds.length; index += 100) {
          const { data, error } = await supabase
            .from("practices")
            .select("id,practice_number,client_name,policy_number,policy_start_date,premium_gross,premium_net,commission_percentage,commission_amount,financial_status,payment_date,commission_received_date")
            .in("id", practiceIds.slice(index, index + 100));
          if (error) throw error;
          practices.push(...((data ?? []) as LotPractice[]));
        }
        const practiceById = new Map(practices.map((practice) => [practice.id, practice]));
        for (const job of jobs ?? []) {
          const practice = job.external_reference ? practiceById.get(job.external_reference) : undefined;
          if (practice) byLot.set(job.batch_id, [...(byLot.get(job.batch_id) ?? []), practice]);
        }
        for (const list of byLot.values()) list.sort((a, b) => a.practice_number.localeCompare(b.practice_number));
      }

      setRepresentatives((reps ?? []) as Representative[]);
      setLots(lotList);
      setPracticesByLot(byLot);
      setSelectedRepresentativeId((current) => current ?? reps?.[0]?.id ?? null);

      if (uid) {
        const { data: signatureBlob } = await supabase.storage.from(VIES_BUCKET).download(`${uid}/${SIGNATURE_FILE}`);
        setSignature(signatureBlob ? await blobToImage(signatureBlob).catch(() => null) : null);
      }
    } catch (error) {
      toast({ variant: "destructive", title: text().loadErrorTitle, description: error instanceof Error ? error.message : text().readError });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = representatives.find((representative) => representative.id === selectedRepresentativeId) ?? null;
  const selectedLots = useMemo(() => lots.filter((lot) => lot.fiscal_representative_id === selectedRepresentativeId), [lots, selectedRepresentativeId]);

  const summaryFor = (representativeId: string) => {
    const representativeLots = lots.filter((lot) => lot.fiscal_representative_id === representativeId);
    let practices = 0;
    let toPay = 0;
    let paid = 0;
    for (const lot of representativeLots) {
      const lotPractices = practicesByLot.get(lot.id) ?? [];
      practices += lotPractices.length;
      const totals = lotTotals(lot, lotPractices);
      if (lot.paid_at) paid += totals.premiums;
      else toPay += totals.premiums;
    }
    return { lots: representativeLots.length, practices, toPay, paid };
  };

  const openStorageFile = async (storagePath: string, fileName: string) => {
    const path = storagePath.startsWith(BUCKET_PREFIX) ? storagePath.slice(BUCKET_PREFIX.length) : storagePath;
    const { data, error } = await supabase.storage.from(VIES_BUCKET).createSignedUrl(path, 120, { download: fileName });
    if (error || !data?.signedUrl) throw new Error(error?.message ?? text().fileUnavailable);
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const handleDownloadExcel = async (lot: Lot) => {
    if (!lot.excel_storage_path) return;
    setBusy(`excel-${lot.id}`);
    try {
      const extension = /\.xls$/i.test(lot.source_excel_file_name ?? "") ? "xls" : "xlsx";
      const owner = selected ? ` - ${safeFileName(selected.name)}` : "";
      await openStorageFile(lot.excel_storage_path, `Excel Lotto ${lot.lot_number}${owner}.${extension}`);
    } catch (error) {
      toast({ variant: "destructive", title: text().excelErrorTitle, description: error instanceof Error ? error.message : text().genericError });
    } finally {
      setBusy(null);
    }
  };

  // Aligns the lot and its practices on the commission (on the net premium) and the
  // withholding, so Contabilità and Pratiche show the same commission as the statements.
  const applyCommissionTerms = async (lot: Lot, commission: number, withholding: number) => {
    for (const practice of practicesByLot.get(lot.id) ?? []) {
      if (practice.commission_percentage !== null && Number(practice.commission_percentage) === commission) continue;
      const { error } = await supabase.from("practices").update({ commission_percentage: commission }).eq("id", practice.id);
      if (error) throw new Error(`${practice.practice_number}: ${error.message}`);
    }
    const { error } = await supabase
      .from("vies_batches")
      .update({ commission_percentage: commission, withholding_percentage: withholding })
      .eq("id", lot.id);
    if (error) throw error;
  };

  const openStatement = (lot: Lot) => {
    setStatementLot(lot);
    setStatementForm({
      kind: "cliente",
      companyName: readStoredCompanyName(),
      commission: String(lot.commission_percentage ?? 0),
      withholding: String(lotWithholding(lot)),
    });
  };

  const handleStatement = async () => {
    const lot = statementLot;
    if (!lot || !selected || !lot.lot_number) return;
    const internal = statementForm.kind === "provvigioni";
    const commission = parsePercent(statementForm.commission);
    const withholding = parsePercent(statementForm.withholding);
    const companyName = statementForm.companyName.trim();
    const internalTerms = commission !== null && withholding !== null && companyName ? { commission, withholding, companyName } : null;
    if (internal && !internalTerms) {
      toast({ variant: "destructive", title: text().invalidDataTitle, description: text().invalidStatementData });
      return;
    }
    setBusy(`statement-${lot.id}`);
    try {
      const practices = practicesByLot.get(lot.id) ?? [];
      if (!practices.length) throw new Error(text().noPractices);
      // The internal statement fixes the lot's commission terms first: the PDF never shows
      // figures that Contabilità does not have.
      if (internal && internalTerms) {
        await applyCommissionTerms(lot, internalTerms.commission, internalTerms.withholding);
        storeCompanyName(internalTerms.companyName);
      }
      const logoBlob = await fetch("/brand/tecno-mga-logo.png").then((response) => (response.ok ? response.blob() : null));
      const base = {
        lotNumber: lot.lot_number,
        lotDate: lot.created_at,
        representative: { name: selected.name, taxCode: selected.tax_code },
        policies: toStatementPolicies(practices),
        logo: logoBlob ? await blobToImage(logoBlob) : null,
        signature,
      };
      const input: ViesStatementInput =
        internal && internalTerms
          ? {
              ...base,
              kind: "provvigioni",
              companyName: internalTerms.companyName,
              commissionPercentage: internalTerms.commission,
              withholdingPercentage: internalTerms.withholding,
              commissionsReceivedAt: lot.commissions_received_at,
            }
          : { ...base, kind: "cliente", paidAt: lot.paid_at };
      const doc = generateViesStatementPdf(input);
      const blob = new Blob([viesStatementPdfToBytes(doc) as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = buildViesStatementFileName(input);
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
      await supabase.from("vies_batches").update({ statement_generated_at: new Date().toISOString() }).eq("id", lot.id);
      setStatementLot(null);
      toast({
        title: internal ? text().internalGenerated(lot.lot_number) : text().clientGenerated(lot.lot_number),
        description: signature ? undefined : text().noSignatureWarning,
      });
      if (internal) await load();
    } catch (error) {
      toast({ variant: "destructive", title: text().statementErrorTitle, description: error instanceof Error ? error.message : text().genericError });
    } finally {
      setBusy(null);
    }
  };

  const openSettle = (lot: Lot) => {
    setSettleLot(lot);
    setSettleForm({
      paidAt: lot.paid_at ?? today(),
      commission: String(lot.commission_percentage ?? 0),
      withholding: String(lotWithholding(lot)),
      commissionsReceivedAt: lot.commissions_received_at ?? "",
    });
  };

  // Settles the lot and updates every practice of it, so Contabilità and Pratiche show the same state.
  const handleSettle = async (cancel = false) => {
    if (!settleLot) return;
    const commission = parsePercent(settleForm.commission);
    const withholding = parsePercent(settleForm.withholding);
    if (!cancel && (commission === null || withholding === null || !settleForm.paidAt)) {
      toast({ variant: "destructive", title: text().invalidDataTitle, description: text().invalidSettleData });
      return;
    }
    setBusy(`settle-${settleLot.id}`);
    try {
      const practices = practicesByLot.get(settleLot.id) ?? [];
      const received = !cancel && settleForm.commissionsReceivedAt ? settleForm.commissionsReceivedAt : null;
      for (const practice of practices) {
        const { error } = await supabase
          .from("practices")
          .update(
            cancel
              ? { financial_status: "non_incassata", payment_date: null, commission_received_date: null }
              : {
                  commission_percentage: commission,
                  financial_status: received ? "provvigioni_ricevute" : "incassata",
                  payment_date: settleForm.paidAt,
                  commission_received_date: received,
                },
          )
          .eq("id", practice.id);
        if (error) throw new Error(`${practice.practice_number}: ${error.message}`);
      }
      const { error: lotError } = await supabase
        .from("vies_batches")
        .update(
          cancel
            ? { paid_at: null, commissions_received_at: null }
            : {
                paid_at: settleForm.paidAt,
                commission_percentage: commission,
                withholding_percentage: withholding,
                commissions_received_at: received,
              },
        )
        .eq("id", settleLot.id);
      if (lotError) throw lotError;
      toast({
        title: cancel ? text().settlementCancelled : text().lotSettled(settleLot.lot_number),
        description: text().practicesUpdated(practices.length),
      });
      setSettleLot(null);
      await load();
    } catch (error) {
      toast({ variant: "destructive", title: text().updateErrorTitle, description: error instanceof Error ? error.message : text().genericError });
    } finally {
      setBusy(null);
    }
  };

  const handleSignatureUpload = async (file: File | undefined) => {
    if (!file || !userId) return;
    if (!/^image\/(png|jpe?g)$/.test(file.type)) {
      toast({ variant: "destructive", title: text().formatTitle, description: text().formatText });
      return;
    }
    setBusy("signature");
    try {
      const { error } = await supabase.storage.from(VIES_BUCKET).upload(`${userId}/${SIGNATURE_FILE}`, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      setSignature(await blobToImage(file));
      toast({ title: text().signatureSavedTitle, description: text().signatureSavedText });
    } catch (error) {
      toast({ variant: "destructive", title: text().signatureErrorTitle, description: error instanceof Error ? error.message : text().genericError });
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const settlePractices = settleLot ? practicesByLot.get(settleLot.id) ?? [] : [];
  const settlePreview = settleLot
    ? computeViesLotTotals(toStatementPolicies(settlePractices), parsePercent(settleForm.commission) ?? 0, parsePercent(settleForm.withholding) ?? 0)
    : null;
  const statementInternal = statementForm.kind === "provvigioni";
  const statementPreview = statementLot
    ? computeViesLotTotals(
        toStatementPolicies(practicesByLot.get(statementLot.id) ?? []),
        statementInternal ? parsePercent(statementForm.commission) ?? 0 : 0,
        statementInternal ? parsePercent(statementForm.withholding) ?? 0 : 0,
      )
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-muted-foreground">
          {m.intro}
        </p>
        <Button variant="outline" size="sm" onClick={() => load()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {getMessages(administrationMessages).refresh}
        </Button>
      </div>

      {representatives.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {m.noRepresentatives}
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {representatives.map((representative) => {
              const summary = summaryFor(representative.id);
              const active = representative.id === selectedRepresentativeId;
              return (
                <button
                  key={representative.id}
                  type="button"
                  onClick={() => setSelectedRepresentativeId(representative.id)}
                  className={`rounded-lg border p-4 text-left transition ${active ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"}`}
                >
                  <div className="flex items-start gap-2">
                    <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="break-words font-semibold">{representative.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{m.taxCodeShort(representative.tax_code)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <Badge variant="secondary">{m.lots(summary.lots)}</Badge>
                    <Badge variant="secondary">{m.practices(summary.practices)}</Badge>
                    {summary.toPay > 0 && <Badge variant="destructive">{m.toPay(formatCurrency(summary.toPay))}</Badge>}
                    {summary.paid > 0 && <Badge className="bg-emerald-600 hover:bg-emerald-600">{m.paid(formatCurrency(summary.paid))}</Badge>}
                  </div>
                </button>
              );
            })}
          </div>

          {selected && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="break-words">{selected.name}</CardTitle>
                  <CardDescription>{m.representativeData}</CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="grid gap-x-8 gap-y-3 text-sm md:grid-cols-2">
                    {[
                      [m.taxCode, selected.tax_code],
                      [
                        m.administrator,
                        [selected.administrator_name, selected.administrator_tax_code && m.taxCodeShort(selected.administrator_tax_code)]
                          .filter(Boolean)
                          .join(" · "),
                      ],
                      [m.office, selected.address],
                      [m.pec, selected.pec],
                      [m.visura, selected.visura_reference ? translateViesText(selected.visura_reference) : null],
                    ].map(([label, value]) => (
                      <div key={label as string}>
                        <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
                        <dd className="break-words font-medium">{value || "—"}</dd>
                      </div>
                    ))}
                  </dl>
                  {selected.visura_storage_path && (
                    <Button
                      variant="link"
                      className="mt-3 h-auto p-0"
                      onClick={() => openStorageFile(selected.visura_storage_path as string, `Visura ${selected.tax_code}.pdf`).catch((error: Error) => toast({ variant: "destructive", title: m.visuraUnavailable, description: error.message }))}
                    >
                      <Download className="mr-1 h-4 w-4" />
                      {m.downloadVisura}
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{m.lotsTitle}</CardTitle>
                  <CardDescription>{m.lotsDescription}</CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedLots.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{m.noLots}</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="min-w-36">{m.colLot}</TableHead>
                            <TableHead className="text-right">{m.colPractices}</TableHead>
                            <TableHead className="text-right">{m.colTotalPremiums}</TableHead>
                            <TableHead className="text-right">{m.colCommissions}</TableHead>
                            <TableHead>{m.colStatus}</TableHead>
                            <TableHead className="text-right">{m.colActions}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedLots.map((lot) => {
                            const practices = practicesByLot.get(lot.id) ?? [];
                            const totals = lotTotals(lot, practices);
                            const open = openLotId === lot.id;
                            return (
                              <Fragment key={lot.id}>
                                <TableRow>
                                  <TableCell>
                                    <button type="button" className="flex items-center gap-1 font-semibold" onClick={() => setOpenLotId(open ? null : lot.id)}>
                                      {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                      {m.lotName(lot.lot_number)}
                                    </button>
                                    <p className="pl-5 text-xs text-muted-foreground">{m.createdOn(formatDate(lot.created_at))}</p>
                                  </TableCell>
                                  <TableCell className="text-right">{practices.length}</TableCell>
                                  <TableCell className="whitespace-nowrap text-right font-semibold">{formatCurrency(totals.premiums)}</TableCell>
                                  <TableCell className="whitespace-nowrap text-right">
                                    {formatCurrency(totals.commissions)}
                                    <p className="text-xs text-muted-foreground">{m.percentOnNet(formatNumber(lot.commission_percentage ?? 0))}</p>
                                  </TableCell>
                                  <TableCell>
                                    {lot.paid_at ? (
                                      <Badge className="bg-emerald-600 hover:bg-emerald-600">{m.paidOn(formatDate(lot.paid_at))}</Badge>
                                    ) : (
                                      <Badge variant="outline" className="border-amber-300 text-amber-900">{m.toSettle}</Badge>
                                    )}
                                    {lot.commissions_received_at && (
                                      <p className="mt-1 text-xs text-muted-foreground">{m.commissionsReceivedOn(formatDate(lot.commissions_received_at))}</p>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-wrap justify-end gap-2">
                                      <Button size="sm" variant="outline" onClick={() => handleDownloadExcel(lot)} disabled={!lot.excel_storage_path || Boolean(busy)}>
                                        {busy === `excel-${lot.id}` ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-1 h-4 w-4" />}
                                        {m.excel}
                                      </Button>
                                      <Button size="sm" variant="outline" onClick={() => openStatement(lot)} disabled={!practices.length || Boolean(busy)}>
                                        {busy === `statement-${lot.id}` ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileText className="mr-1 h-4 w-4" />}
                                        {m.statement}
                                      </Button>
                                      <Button size="sm" onClick={() => openSettle(lot)} disabled={!practices.length || Boolean(busy)}>
                                        <CheckCircle2 className="mr-1 h-4 w-4" />
                                        {lot.paid_at ? m.editSettlement : m.settle}
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                                {open && (
                                  <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={6} className="bg-muted/30">
                                      <div className="overflow-x-auto">
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead>{m.colPractice}</TableHead>
                                              <TableHead>{m.colClient}</TableHead>
                                              <TableHead className="text-right">{m.colGross}</TableHead>
                                              <TableHead className="text-right">{m.colNet}</TableHead>
                                              <TableHead className="text-right">{m.colCommission}</TableHead>
                                              <TableHead>{m.colAccounting}</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {practices.map((practice) => (
                                              <TableRow key={practice.id}>
                                                <TableCell className="whitespace-nowrap">
                                                  <Button variant="link" className="h-auto p-0 font-mono text-xs" onClick={() => navigate(`/practices/${practice.id}`)}>
                                                    {practice.practice_number}
                                                  </Button>
                                                </TableCell>
                                                <TableCell className="min-w-48 break-words">{practice.client_name}</TableCell>
                                                <TableCell className="whitespace-nowrap text-right">{formatCurrency(practice.premium_gross ?? 0)}</TableCell>
                                                <TableCell className="whitespace-nowrap text-right">{formatCurrency(practice.premium_net ?? 0)}</TableCell>
                                                <TableCell className="whitespace-nowrap text-right">{formatCurrency(practice.commission_amount ?? 0)}</TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                  {financialStatusLabel(practice.financial_status)}
                                                  {practice.payment_date && <span className="text-xs text-muted-foreground"> · {formatDate(practice.payment_date)}</span>}
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </Fragment>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5" />
            {m.signatureTitle}
          </CardTitle>
          <CardDescription>{m.signatureDescription}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="flex h-20 w-56 items-center justify-center rounded-md border bg-white">
            {signature ? (
              <img src={signature.dataUrl} alt={m.signatureAlt} className="max-h-16 max-w-52 object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground">{m.noSignature}</span>
            )}
          </div>
          <Label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
            {busy === "signature" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {signature ? m.replaceSignature : m.uploadSignature}
            <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(event) => handleSignatureUpload(event.target.files?.[0])} />
          </Label>
        </CardContent>
      </Card>

      <Dialog open={Boolean(statementLot)} onOpenChange={(open) => !open && setStatementLot(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{m.statementTitle(statementLot?.lot_number ?? null)}</DialogTitle>
            <DialogDescription>{m.statementDescription}</DialogDescription>
          </DialogHeader>
          <RadioGroup
            value={statementForm.kind}
            onValueChange={(value) => setStatementForm((form) => ({ ...form, kind: value as ViesStatementKind }))}
            className="gap-3"
          >
            {(
              [
                ["cliente", m.kindClientTitle, m.kindClientText],
                ["provvigioni", m.kindInternalTitle, m.kindInternalText],
              ] as const
            ).map(([value, title, text]) => (
              <Label
                key={value}
                htmlFor={`statement-${value}`}
                className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 font-normal ${statementForm.kind === value ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
              >
                <RadioGroupItem id={`statement-${value}`} value={value} className="mt-0.5" />
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-xs text-muted-foreground">{text}</span>
                </span>
              </Label>
            ))}
          </RadioGroup>
          {statementInternal && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="statement-company">{m.company}</Label>
                <Input
                  id="statement-company"
                  value={statementForm.companyName}
                  placeholder={m.companyPlaceholder}
                  onChange={(event) => setStatementForm((form) => ({ ...form, companyName: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="statement-commission">{m.commissionOnNet}</Label>
                <Input id="statement-commission" inputMode="decimal" value={statementForm.commission} onChange={(event) => setStatementForm((form) => ({ ...form, commission: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="statement-withholding">{m.withholding}</Label>
                <Input id="statement-withholding" inputMode="decimal" value={statementForm.withholding} onChange={(event) => setStatementForm((form) => ({ ...form, withholding: event.target.value }))} />
              </div>
            </div>
          )}
          {statementPreview && (
            <dl className="grid grid-cols-2 gap-y-1 rounded-md bg-muted/50 p-3 text-sm">
              <dt>{m.policies}</dt>
              <dd className="text-right">{statementPreview.rows.length}</dd>
              <dt className={statementInternal ? undefined : "font-semibold"}>{statementInternal ? m.totalPremiums : m.totalToPay}</dt>
              <dd className={`text-right ${statementInternal ? "" : "font-semibold"}`}>{formatCurrency(statementPreview.premiums)}</dd>
              {statementInternal && (
                <>
                  <dt>{m.commissionsOnNet}</dt>
                  <dd className="text-right">{formatCurrency(statementPreview.commissions)}</dd>
                  <dt>{m.withholdingAmount}</dt>
                  <dd className="text-right">{formatCurrency(statementPreview.withholding)}</dd>
                  <dt className="font-semibold">{m.totalRemitted}</dt>
                  <dd className="text-right font-semibold">{formatCurrency(statementPreview.remitted)}</dd>
                </>
              )}
            </dl>
          )}
          {statementLot && (
            <p className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
              {statementInternal
                ? statementLot.commissions_received_at
                  ? m.commissionsMarked(formatDate(statementLot.commissions_received_at))
                  : m.commissionsNotMarked
                : statementLot.paid_at
                  ? m.lotMarkedPaid(formatDate(statementLot.paid_at))
                  : m.lotNotPaid}
              {statementInternal && m.percentagesSaved}
            </p>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setStatementLot(null)} disabled={Boolean(busy)}>
              {m.cancel}
            </Button>
            <Button onClick={() => handleStatement()} disabled={Boolean(busy)}>
              {busy?.startsWith("statement-") ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              {m.generatePdf}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(settleLot)} onOpenChange={(open) => !open && setSettleLot(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{m.settleTitle(settleLot?.lot_number ?? null)}</DialogTitle>
            <DialogDescription>{m.settleDescription(settlePractices.length)}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="settle-paid">{m.paidAt}</Label>
              <Input id="settle-paid" type="date" value={settleForm.paidAt} onChange={(event) => setSettleForm((form) => ({ ...form, paidAt: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settle-received">{m.receivedAt}</Label>
              <Input id="settle-received" type="date" value={settleForm.commissionsReceivedAt} onChange={(event) => setSettleForm((form) => ({ ...form, commissionsReceivedAt: event.target.value }))} />
              <p className="text-xs text-muted-foreground">{m.receivedHint}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settle-commission">{m.commissionOnNet}</Label>
              <Input id="settle-commission" inputMode="decimal" value={settleForm.commission} onChange={(event) => setSettleForm((form) => ({ ...form, commission: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settle-withholding">{m.withholding}</Label>
              <Input id="settle-withholding" inputMode="decimal" value={settleForm.withholding} onChange={(event) => setSettleForm((form) => ({ ...form, withholding: event.target.value }))} />
            </div>
          </div>
          {settlePreview && (
            <dl className="grid grid-cols-2 gap-y-1 rounded-md bg-muted/50 p-3 text-sm">
              <dt className="font-semibold">{m.premiumsPaidByClient}</dt>
              <dd className="text-right font-semibold">{formatCurrency(settlePreview.premiums)}</dd>
              <dt>{m.commissionsOnNet}</dt>
              <dd className="text-right">{formatCurrency(settlePreview.commissions)}</dd>
              <dt>{m.withholdingAmount}</dt>
              <dd className="text-right">{formatCurrency(settlePreview.withholding)}</dd>
              <dt>{m.totalRemittedInternal}</dt>
              <dd className="text-right">{formatCurrency(settlePreview.remitted)}</dd>
            </dl>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            {settleLot?.paid_at ? (
              <Button variant="outline" className="text-destructive" onClick={() => handleSettle(true)} disabled={Boolean(busy)}>
                {m.cancelSettlement}
              </Button>
            ) : (
              <span />
            )}
            <Button onClick={() => handleSettle(false)} disabled={Boolean(busy)}>
              {busy?.startsWith("settle-") && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {m.saveSettlement}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
