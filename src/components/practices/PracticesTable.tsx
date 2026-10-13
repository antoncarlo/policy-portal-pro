import { Fragment, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronRight, Download, Eye, FileSignature, Layers, List, Loader2, MoreVertical, Pencil, Trash2, Upload, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { bulkChangeStatus } from "@/lib/workflowApi";
import { Input } from "@/components/ui/input";
import type { Enums } from "@/integrations/supabase/types";
import { PracticesExport } from "./PracticesExport";
import { PracticeFilters } from "./PracticesFilters";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { TABLE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { formatDate, getMessages, useMessages } from "@/i18n";
import { practicesMessages } from "@/i18n/messages/practices";
import { commonMessages } from "@/i18n/messages/common";
import { PRACTICE_STATUSES, practiceStatusLabel, practiceTypeLabel } from "@/i18n/messages/domain";
import { applyStageFilter, stageOf, type PracticeStage, type StageFilterable } from "@/lib/practiceStages";
import { fetchPracticeLots, lotTitle, type PracticeLot } from "@/lib/practiceLots";
import { downloadLotDocuments, LotZipTooLargeError } from "@/lib/lotDocuments";
import { downloadSigningBundle, uploadSignedBundle } from "@/lib/signingBundle";
import { signingMessages } from "@/i18n/messages/signing";
import { workflowMessages } from "@/i18n/messages/workflow";
import { cn } from "@/lib/utils";

interface PracticesTableProps {
  searchQuery: string;
  filters: PracticeFilters;
  /** Section of the flow ("all" shows every practice). */
  stage?: PracticeStage | "all";
}

type PracticeStatus = "in_lavorazione" | "in_attesa" | "integrazioni" | "approvata" | "rifiutata" | "completata";
type PracticeType = string;

interface Practice {
  id: string;
  practice_number: string;
  practice_type: PracticeType;
  client_name: string;
  policy_number: string | null;
  beneficiary: string | null;
  status: PracticeStatus;
  created_at: string;
  user_id: string;
  financial_status: string | null;
  /** The VIES lot the practice comes from, when it comes from one. */
  vies_batch_id: string | null;
}

type ListView = "lots" | "flat";
type LotGroup = { lot: PracticeLot; practices: Practice[] };
const VIEW_STORAGE_KEY = "practices-list-view";
const readStoredView = (): ListView => {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === "flat" ? "flat" : "lots";
  } catch {
    return "lots";
  }
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : getMessages(practicesMessages).table.unexpectedError;

const PRACTICE_DOCUMENTS_BUCKET = "practice-documents";
const VIES_BATCH_FILES_BUCKET = "vies-batch-files";
const VIES_BATCH_FILES_PREFIX = `${VIES_BATCH_FILES_BUCKET}://`;

const getDocumentStorageReference = (filePath: string) => {
  if (filePath.startsWith(VIES_BATCH_FILES_PREFIX)) {
    return {
      bucket: VIES_BATCH_FILES_BUCKET,
      path: filePath.slice(VIES_BATCH_FILES_PREFIX.length),
    };
  }

  return {
    bucket: PRACTICE_DOCUMENTS_BUCKET,
    path: filePath,
  };
};

export const PracticesTable = ({ searchQuery, filters, stage = "all" }: PracticesTableProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const m = useMessages(practicesMessages).table;
  const lotText = useMessages(practicesMessages).lots;
  const signingText = useMessages(signingMessages);
  const flow = useMessages(workflowMessages);
  const common = useMessages(commonMessages);
  const compact = !useMediaQuery(TABLE_QUERY);
  const [searchParams, setSearchParams] = useSearchParams();
  const lotId = searchParams.get("lot");
  const [practices, setPractices] = useState<Practice[]>([]);
  const [lots, setLots] = useState<Map<string, PracticeLot>>(new Map());
  const [expandedLots, setExpandedLots] = useState<Set<string>>(new Set());
  const [viewPreference, setViewPreference] = useState<ListView>(readStoredView);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [practiceToDelete, setPracticeToDelete] = useState<Practice | null>(null);
  const [selectedPracticeIds, setSelectedPracticeIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<PracticeStatus>("in_lavorazione");
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [downloadingLot, setDownloadingLot] = useState<string | null>(null);
  // Reason or request text: the company flow asks for it when a practice is rejected or more documents are needed.
  const [bulkNote, setBulkNote] = useState("");
  const bulkNeedsNote = bulkStatus === "rifiutata" || bulkStatus === "integrazioni";
  // Solo gli amministratori possono cambiare lo stato delle pratiche
  const [canChangeStatus, setCanChangeStatus] = useState(false);

  const loadPractices = async () => {
    setLoading(true);
    
    // Get current user's session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      return;
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .single();

    const isAdmin = roleData?.role === 'admin';
    setCanChangeStatus(isAdmin);

    let allowedTypes: Enums<"practice_type">[] | null = null;
    // Filter by allowed practice types if not admin
    if (!isAdmin) {
      const { data: permissions } = await supabase
        .from("user_product_permissions")
        .select("practice_type")
        .eq("user_id", session.user.id);

      if (permissions && permissions.length > 0) {
        allowedTypes = permissions.map(p => p.practice_type);
      } else {
        // User has no permissions, return empty
        setPractices([]);
        setLoading(false);
        return;
      }
    }

    // One query per page: Supabase returns at most 1000 rows per request.
    const buildQuery = () => {
      let query = supabase
        .from("practices")
        .select("id, practice_number, practice_type, client_name, beneficiary, policy_number, status, created_at, user_id, financial_status, vies_batch_id");

      if (allowedTypes) {
        query = query.in("practice_type", allowedTypes);
      }

      // Apply filters
      if (filters.practiceType !== "all") {
        query = query.eq("practice_type", filters.practiceType as Enums<"practice_type">);
      }

      if (filters.status !== "all") {
        query = query.eq("status", filters.status as PracticeStatus);
      }

      if (stage !== "all") {
        query = applyStageFilter(query as unknown as StageFilterable, stage) as unknown as typeof query;
      }

      if (filters.dateFrom) {
        query = query.gte("created_at", filters.dateFrom.toISOString());
      }

      if (filters.dateTo) {
        const endOfDay = new Date(filters.dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("created_at", endOfDay.toISOString());
      }

      if (filters.userId !== "all") {
        query = query.eq("user_id", filters.userId);
      }

      if (lotId) {
        query = query.eq("vies_batch_id", lotId);
      }

      return query.order("created_at", { ascending: false }).order("id");
    };

    try {
      const rows = (await fetchAllRows((from, to) => buildQuery().range(from, to))) as Practice[];
      // The lots the practices come from: one question for all of them.
      const batchIds = [...new Set(rows.map((row) => row.vies_batch_id).filter((id): id is string => Boolean(id)))];
      const lotRows = batchIds.length > 0 ? await fetchPracticeLots({ batchIds }).catch(() => []) : [];
      setLots(new Map(lotRows.map((lot) => [lot.batchId, lot])));
      setPractices(rows);
      setSelectedPracticeIds(new Set());
    } catch (error) {
      console.error("Error loading practices:", error);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadPractices();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- legacy loader intentionally runs only for the dependency list below
  }, [filters, stage, lotId]);

  const handleDownloadDocuments = async (practice: Practice) => {
    try {
      const { data: documents, error } = await supabase
        .from("practice_documents")
        .select("*")
        .eq("practice_id", practice.id);

      if (error) throw error;

      if (!documents || documents.length === 0) {
        toast({
          title: m.noDocumentsTitle,
          description: m.noDocumentsText,
        });
        return;
      }

      // Download each document
      for (const doc of documents) {
        const storageReference = getDocumentStorageReference(doc.file_path);
        const { data, error: downloadError } = await supabase.storage
          .from(storageReference.bucket)
          .download(storageReference.path);

        if (downloadError) {
          console.error("Error downloading:", doc.file_name, downloadError);
          continue;
        }

        // Create download link
        const url = URL.createObjectURL(data);
        const a = document.createElement("a");
        a.href = url;
        a.download = doc.file_name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      toast({
        title: m.downloadDoneTitle,
        description: m.downloadDoneText(documents.length),
      });
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: m.downloadErrorTitle,
        description: getErrorMessage(error),
      });
    }
  };

  /** Everything of the lot in one ZIP: the documents of all its practices and the files of the lot itself. */
  const handleDownloadLot = async (lot: PracticeLot, title: string) => {
    if (downloadingLot) return;
    setDownloadingLot(lot.batchId);
    const progress = toast({ title: lotText.downloadPreparing(title), duration: 600_000 });
    try {
      const result = await downloadLotDocuments({
        batchId: lot.batchId,
        fileLabel: lotText.zipName(title),
        labels: lotText.zipFolders,
        includeInternal: canChangeStatus,
        onProgress: (done, total) =>
          progress.update({ id: progress.id, title: lotText.downloadPreparing(title), description: lotText.downloadProgress(done, total), duration: 600_000 }),
      });
      if (result.files === 0) {
        progress.update({ id: progress.id, title: m.noDocumentsTitle, description: lotText.downloadNone, duration: 8000 });
      } else if (result.downloaded === 0) {
        throw new Error(lotText.downloadPartial(result.failed.length).trim());
      } else {
        progress.update({
          id: progress.id,
          title: lotText.downloadDoneTitle,
          description: lotText.downloadDone(result.downloaded, result.practices) + (result.failed.length > 0 ? lotText.downloadPartial(result.failed.length) : ""),
          duration: 8000,
        });
      }
    } catch (error: unknown) {
      progress.update({
        id: progress.id,
        variant: "destructive",
        title: lotText.downloadErrorTitle,
        description: error instanceof LotZipTooLargeError ? lotText.downloadTooLarge((error.bytes / 1024 ** 3).toFixed(1)) : getErrorMessage(error),
        duration: 12000,
      });
    } finally {
      setDownloadingLot(null);
    }
  };

  /** The documents to sign of every practice of the lot, one folder per practice, to sign in bulk. */
  const handleDownloadSigning = async (lot: PracticeLot, title: string) => {
    if (downloadingLot) return;
    setDownloadingLot(lot.batchId);
    const text = getMessages(signingMessages).bundle;
    const progress = toast({ title: text.preparing(title), duration: 600_000 });
    try {
      const result = await downloadSigningBundle({
        batchId: lot.batchId,
        fileLabel: text.zipName(title),
        labels: { readme: text.readme, readmeText: text.readmeText },
        onProgress: (done, total) => progress.update({ id: progress.id, title: text.preparing(title), description: text.progress(done, total), duration: 600_000 }),
      });
      if (result.files === 0) progress.update({ id: progress.id, title: text.downloadDoneTitle, description: text.nothingToSign, duration: 10000 });
      else progress.update({ id: progress.id, title: text.downloadDoneTitle, description: text.downloadDone(result.practices, result.files), duration: 8000 });
    } catch (error: unknown) {
      progress.update({ id: progress.id, variant: "destructive", title: text.errorTitle, description: getErrorMessage(error), duration: 12000 });
    } finally {
      setDownloadingLot(null);
    }
  };

  /** The same ZIP, signed: each file goes into the practice of its folder. */
  const handleUploadSigned = async (lot: PracticeLot, title: string, file: File) => {
    if (downloadingLot) return;
    const text = getMessages(signingMessages).bundle;
    if (!(/\.zip$/i.test(file.name) || file.type.includes("zip"))) {
      toast({ variant: "destructive", title: text.errorTitle, description: text.notZip });
      return;
    }
    setDownloadingLot(lot.batchId);
    const progress = toast({ title: text.uploadPreparing(title), duration: 600_000 });
    try {
      const result = await uploadSignedBundle({
        batchId: lot.batchId,
        file,
        onProgress: (done, total) => progress.update({ id: progress.id, title: text.uploadPreparing(title), description: text.uploadProgress(done, total), duration: 600_000 }),
      });
      if (result.uploaded === 0) {
        progress.update({ id: progress.id, variant: "destructive", title: text.errorTitle, description: text.uploadNone, duration: 12000 });
      } else {
        progress.update({
          id: progress.id,
          title: text.uploadDoneTitle,
          description: text.uploadDone(result.uploaded, result.practices) + (result.skipped.length > 0 ? text.uploadSkipped(result.skipped.length) : ""),
          duration: 10000,
        });
        void loadPractices();
      }
    } catch (error: unknown) {
      progress.update({ id: progress.id, variant: "destructive", title: text.errorTitle, description: getErrorMessage(error), duration: 12000 });
    } finally {
      setDownloadingLot(null);
    }
  };

  const handleDeletePractice = async () => {
    if (!practiceToDelete) return;

    try {
      // Delete practice (cascade will delete related records)
      const { error } = await supabase
        .from("practices")
        .delete()
        .eq("id", practiceToDelete.id);

      if (error) throw error;

      toast({
        title: m.deletedTitle,
        description: m.deletedText(practiceToDelete.practice_number),
      });

      // Reload practices
      loadPractices();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: m.deleteErrorTitle,
        description: getErrorMessage(error),
      });
    } finally {
      setDeleteDialogOpen(false);
      setPracticeToDelete(null);
    }
  };
  const getStatusColor = (status: PracticeStatus) => {
    const colors: Record<PracticeStatus, string> = {
      completata: "bg-green-600/10 text-green-600 border-green-600/20",
      in_lavorazione: "bg-chart-2/10 text-chart-2 border-chart-2/20",
      in_attesa: "bg-yellow-600/10 text-yellow-600 border-yellow-600/20",
      integrazioni: "bg-orange-600/10 text-orange-600 border-orange-600/20",
      approvata: "bg-blue-600/10 text-blue-600 border-blue-600/20",
      rifiutata: "bg-destructive/10 text-destructive border-destructive/20",
    };
    return colors[status] || "bg-muted text-muted-foreground";
  };

  const getStatusLabel = (status: PracticeStatus) => practiceStatusLabel(status);

  const getPracticeTypeLabel = (type: PracticeType) => practiceTypeLabel(type);

  const lotLabelOf = (batchId: string | null) => {
    const lot = batchId ? lots.get(batchId) : undefined;
    return lot ? lotTitle(lot, lotText.lotName) : "";
  };

  const filteredPractices = practices.filter((practice) => {
    const query = searchQuery.toLowerCase();
    const lot = practice.vies_batch_id ? lots.get(practice.vies_batch_id) : undefined;
    return (
      lotLabelOf(practice.vies_batch_id).toLowerCase().includes(query) ||
      (lot?.representative && lot.representative.toLowerCase().includes(query)) ||
      practice.practice_number.toLowerCase().includes(query) ||
      practice.client_name.toLowerCase().includes(query) ||
      (practice.beneficiary && practice.beneficiary.toLowerCase().includes(query)) ||
      getPracticeTypeLabel(practice.practice_type).toLowerCase().includes(query) ||
      (practice.policy_number && practice.policy_number.toLowerCase().includes(query))
    );
  });

  const selectedPractices = filteredPractices.filter((practice) => selectedPracticeIds.has(practice.id));

  // Grouping by lot: the practices of a lot together, the others as single rows below.
  const lotGroups = [...lots.values()]
    .map((lot) => ({ lot, practices: filteredPractices.filter((practice) => practice.vies_batch_id === lot.batchId) }))
    .filter((group) => group.practices.length > 0)
    .sort((a, b) => (a.lot.createdAt < b.lot.createdAt ? 1 : a.lot.createdAt > b.lot.createdAt ? -1 : 0));
  const singles = filteredPractices.filter((practice) => !practice.vies_batch_id || !lots.has(practice.vies_batch_id));
  const viewParam = searchParams.get("view");
  const view: ListView = lots.size === 0 ? "flat" : viewParam === "lots" ? "lots" : viewParam === "flat" ? "flat" : viewPreference;
  const filtering = Boolean(searchQuery) || stage !== "all" || Boolean(lotId) || filters.practiceType !== "all" || filters.status !== "all" || filters.userId !== "all" || Boolean(filters.dateFrom) || Boolean(filters.dateTo);

  const changeView = (next: ListView) => {
    setViewPreference(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // The choice is only a convenience.
    }
    if (searchParams.has("view")) {
      const params = new URLSearchParams(searchParams);
      params.delete("view");
      setSearchParams(params, { replace: true });
    }
  };

  // With a filter on, the lots that match are open: the user sees what matched, inside its lot.
  const lotKey = lotGroups.map((group) => group.lot.batchId).join(",");
  useEffect(() => {
    if (filtering) setExpandedLots(new Set(lotKey ? lotKey.split(",") : []));
  }, [filtering, searchQuery, stage, lotId, lotKey]);

  const toggleLot = (batchId: string) =>
    setExpandedLots((current) => {
      const next = new Set(current);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });

  const toggleLotSelection = (group: { practices: Practice[] }) =>
    setSelectedPracticeIds((current) => {
      const ids = group.practices.map((practice) => practice.id);
      const allSelected = ids.every((id) => current.has(id));
      if (allSelected) return new Set([...current].filter((id) => !ids.includes(id)));
      return new Set([...current, ...ids]);
    });

  const clearLotFilter = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("lot");
    setSearchParams(params);
  };

  const togglePracticeSelection = (practiceId: string) => {
    setSelectedPracticeIds((current) => {
      const next = new Set(current);
      if (next.has(practiceId)) next.delete(practiceId);
      else next.add(practiceId);
      return next;
    });
  };

  const toggleAllFilteredPractices = () => {
    setSelectedPracticeIds((current) => {
      const filteredIds = filteredPractices.map((practice) => practice.id);
      const allSelected = filteredIds.length > 0 && filteredIds.every((id) => current.has(id));
      if (allSelected) return new Set([...current].filter((id) => !filteredIds.includes(id)));
      return new Set([...current, ...filteredIds]);
    });
  };

  const handleBulkStatusUpdate = async () => {
    if (!canChangeStatus || selectedPracticeIds.size === 0) return;
    const note = bulkNote.trim();
    if (bulkNeedsNote && !note) {
      toast({ variant: "destructive", title: m.bulkReasonRequiredTitle, description: m.bulkReasonRequiredText });
      return;
    }
    setBulkUpdating(true);
    try {
      // Through the company flow, as the single-practice buttons do: history, partners' notifications, emails,
      // and only the passages the flow allows. What cannot pass is left as it is and reported.
      const outcome = await bulkChangeStatus(Array.from(selectedPracticeIds), bulkStatus, bulkNeedsNote ? note : undefined);
      const notChanged = outcome.results.filter((row) => row.outcome === "blocked" || row.outcome === "error" || row.outcome === "missing");
      const reasons = notChanged
        .slice(0, 3)
        .map((row) => m.bulkBlockedLine(row.practiceNumber ?? row.practiceId.slice(0, 8), row.message ?? ""))
        .join("\n");
      const more = notChanged.length > 3 ? `\n${m.bulkBlockedMore(notChanged.length - 3)}` : "";

      if (outcome.changed === 0 && notChanged.length > 0) {
        toast({ variant: "destructive", title: m.bulkNothingTitle, description: reasons + more });
      } else if (notChanged.length > 0) {
        toast({ title: m.bulkPartialTitle, description: `${m.bulkPartialText(outcome.changed, notChanged.length)}\n${reasons}${more}` });
      } else if (outcome.changed === 0) {
        toast({ title: m.bulkNothingTitle, description: m.bulkUnchangedText(outcome.unchanged) });
      } else {
        toast({
          title: m.statusUpdatedTitle,
          description: m.statusUpdatedText(outcome.changed, getStatusLabel(bulkStatus)),
        });
      }
      setSelectedPracticeIds(new Set());
      setBulkNote("");
      await loadPractices();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: m.bulkErrorTitle,
        description: getErrorMessage(error),
      });
    } finally {
      setBulkUpdating(false);
    }
  };

  const renderActions = (practice: Practice) => (
    <div className="flex justify-end gap-2">
      <Button 
        variant="ghost" 
        size="sm"
        onClick={() => navigate(`/practices/${practice.id}`)}
      >
        <Eye className="h-4 w-4" />
      </Button>
      <Button 
        variant="ghost" 
        size="sm"
        onClick={() => handleDownloadDocuments(practice)}
        title={m.downloadDocuments}
      >
        <Download className="h-4 w-4" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => navigate(`/practices/${practice.id}`)}
          >
            <Pencil className="mr-2 h-4 w-4" />
            {m.edit}
          </DropdownMenuItem>
          {/* Deleting changes lots, statements and accounting: administrators only. */}
          {canChangeStatus && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => {
                  setPracticeToDelete(practice);
                  setDeleteDialogOpen(true);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {m.delete}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const renderPracticeRow = (practice: Practice, nested = false) => (
    <TableRow key={practice.id} data-testid="practice-row" className={nested ? "bg-muted/20" : undefined}>
      <TableCell>
        <Checkbox
          aria-label={m.selectOne(practice.practice_number)}
          checked={selectedPracticeIds.has(practice.id)}
          onCheckedChange={() => togglePracticeSelection(practice.id)}
        />
      </TableCell>
      <TableCell className={cn("font-medium whitespace-nowrap", nested && "pl-10")}>{practice.practice_number}</TableCell>
      <TableCell className="max-w-[220px] break-words">{practice.client_name}</TableCell>
      <TableCell className="hidden max-w-[220px] break-words text-muted-foreground min-[1440px]:table-cell">{practice.beneficiary || "-"}</TableCell>
      <TableCell className="whitespace-nowrap">{getPracticeTypeLabel(practice.practice_type)}</TableCell>
      <TableCell className="hidden max-w-[180px] break-words text-muted-foreground min-[1440px]:table-cell">
        {practice.policy_number || "-"}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatDate(practice.created_at)}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={getStatusColor(practice.status)}>
          {getStatusLabel(practice.status)}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        {renderActions(practice)}
      </TableCell>
    </TableRow>

  );

  const renderPracticeCard = (practice: Practice, nested = false) => (
    <div key={practice.id} data-testid="practice-row" className={cn("rounded-lg border bg-card p-3", nested && "ml-4 bg-muted/20")}>
      <div className="flex items-start gap-3">
        <Checkbox
          className="mt-1"
          aria-label={m.selectOne(practice.practice_number)}
          checked={selectedPracticeIds.has(practice.id)}
          onCheckedChange={() => togglePracticeSelection(practice.id)}
        />
        <div className="min-w-0 flex-1">
          <div className="break-all font-medium">{practice.practice_number}</div>
          <div className="break-words text-sm">{practice.client_name}</div>
          {practice.beneficiary && <div className="break-words text-sm text-muted-foreground">{practice.beneficiary}</div>}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span>{getPracticeTypeLabel(practice.practice_type)}</span>
            {practice.policy_number && <span className="break-all">· {practice.policy_number}</span>}
            <span>· {formatDate(practice.created_at)}</span>
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 pl-7">
        <Badge variant="outline" className={getStatusColor(practice.status)}>
          {getStatusLabel(practice.status)}
        </Badge>
        {renderActions(practice)}
      </div>
    </div>
  );

  const signedInputId = (lot: PracticeLot) => `signed-upload-${lot.batchId}`;
  /** Hidden file input for the signed ZIP of a lot (one per place the action is offered). */
  const signedInput = (lot: PracticeLot, title: string) => (
    <input
      id={signedInputId(lot)}
      type="file"
      accept=".zip,application/zip,application/x-zip-compressed"
      className="hidden"
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) void handleUploadSigned(lot, title, file);
      }}
    />
  );

  const lotActions = (lot: PracticeLot, title: string) => {
    const busy = downloadingLot === lot.batchId;
    return (
      <div className="flex items-center justify-end gap-1">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/practices?lot=${lot.batchId}`)}>
          {lotText.openLot}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" aria-label={lotText.actions} disabled={busy} data-testid="lot-menu">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => void handleDownloadLot(lot, title)} data-testid="lot-download-all">
              <Download className="mr-2 h-4 w-4" />
              {lotText.downloadAll}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void handleDownloadSigning(lot, title)} data-testid="lot-download-signing">
              <FileSignature className="mr-2 h-4 w-4" />
              {signingText.bundle.downloadAction}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => document.getElementById(signedInputId(lot))?.click()} data-testid="lot-upload-signed">
              <Upload className="mr-2 h-4 w-4" />
              {signingText.bundle.uploadAction}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {signedInput(lot, title)}
      </div>
    );
  };

  const lotSummary = (group: LotGroup, title: string, open: boolean, stageCounts: Map<PracticeStage, number>) => {
    const { lot } = group;
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          className="flex min-h-9 items-center gap-2 text-left font-semibold"
          aria-expanded={open}
          aria-label={`${open ? lotText.collapse : lotText.expand}: ${title}`}
          onClick={() => toggleLot(lot.batchId)}
          data-testid="lot-toggle"
        >
          <ChevronRight className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-90")} />
          {title}
        </button>
        <Badge variant="secondary" data-testid="lot-count">
          {group.practices.length < lot.practiceCount ? lotText.shownOf(group.practices.length, lot.practiceCount) : lotText.count(lot.practiceCount)}
        </Badge>
        {lot.representative && <span className="text-sm text-muted-foreground">{lot.representative}</span>}
        <span className="text-sm text-muted-foreground">{formatDate(lot.createdAt)}</span>
        <span className="flex flex-wrap gap-1.5">
          {[...stageCounts.entries()].map(([key, count]) => (
            <span key={key} className="rounded-full border border-border bg-background px-2 py-0.5 text-xs">
              {count} · {flow.stages[key]}
            </span>
          ))}
        </span>
      </div>
    );
  };

  const stageCountsOf = (group: LotGroup) => {
    const counts = new Map<PracticeStage, number>();
    for (const practice of group.practices) {
      const key = stageOf({ status: practice.status, financial_status: practice.financial_status });
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  };

  const renderLotCards = () => (
    <>
      {lotGroups.map((group) => {
        const { lot } = group;
        const open = expandedLots.has(lot.batchId);
        const title = lotTitle(lot, lotText.lotName);
        const allSelected = group.practices.every((practice) => selectedPracticeIds.has(practice.id));
        const someSelected = group.practices.some((practice) => selectedPracticeIds.has(practice.id));
        return (
          <div key={lot.batchId} className="space-y-2">
            <div className="rounded-lg border bg-muted/40 p-3" data-testid="lot-row" data-lot-id={lot.batchId}>
              <div className="flex items-start gap-3">
                <Checkbox
                  className="mt-2.5"
                  aria-label={lotText.selectLot(title)}
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={() => toggleLotSelection(group)}
                />
                <div className="min-w-0 flex-1">{lotSummary(group, title, open, stageCountsOf(group))}</div>
              </div>
              <div className="mt-1">{lotActions(lot, title)}</div>
            </div>
            {open && group.practices.map((practice) => renderPracticeCard(practice, true))}
          </div>
        );
      })}
      {singles.length > 0 && lotGroups.length > 0 && (
        <p className="pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{lotText.others}</p>
      )}
      {singles.map((practice) => renderPracticeCard(practice))}
    </>
  );

  const renderLotRows = () => (
    <>
      {lotGroups.map((group) => {
        const { lot } = group;
        const open = expandedLots.has(lot.batchId);
        const title = lotTitle(lot, lotText.lotName);
        const allSelected = group.practices.every((practice) => selectedPracticeIds.has(practice.id));
        const someSelected = group.practices.some((practice) => selectedPracticeIds.has(practice.id));
        const stageCounts = stageCountsOf(group);
        return (
          <Fragment key={lot.batchId}>
            <TableRow className="bg-muted/40 hover:bg-muted/60" data-testid="lot-row" data-lot-id={lot.batchId}>
              <TableCell>
                <Checkbox
                  aria-label={lotText.selectLot(title)}
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={() => toggleLotSelection(group)}
                />
              </TableCell>
              <TableCell colSpan={7}>
                {lotSummary(group, title, open, stageCounts)}
              </TableCell>
              <TableCell className="text-right">{lotActions(lot, title)}</TableCell>
            </TableRow>
            {open && group.practices.map((practice) => renderPracticeRow(practice, true))}
          </Fragment>
        );
      })}
      {singles.length > 0 && lotGroups.length > 0 && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={9} className="pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {lotText.others}
          </TableCell>
        </TableRow>
      )}
      {singles.map((practice) => renderPracticeRow(practice))}
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {canChangeStatus ? (
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 md:flex-row md:items-center">
            <span className="text-sm font-medium">{m.selected(selectedPractices.length)}</span>
            <Select value={bulkStatus} onValueChange={(value) => setBulkStatus(value as PracticeStatus)}>
              <SelectTrigger className="w-full md:w-[190px]">
                <SelectValue placeholder={m.newStatus} />
              </SelectTrigger>
              <SelectContent>
                {PRACTICE_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {practiceStatusLabel(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {bulkNeedsNote && (
              <Input
                value={bulkNote}
                onChange={(event) => setBulkNote(event.target.value)}
                placeholder={bulkStatus === "rifiutata" ? m.bulkReasonRejected : m.bulkReasonInfo}
                aria-label={bulkStatus === "rifiutata" ? m.bulkReasonRejected : m.bulkReasonInfo}
                className="w-full md:w-[320px]"
                maxLength={1000}
                data-testid="bulk-note"
              />
            )}
            <Button onClick={handleBulkStatusUpdate} disabled={selectedPractices.length === 0 || bulkUpdating}>
              {m.changeStatus}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {m.statusByOffice}
          </p>
        )}
        <PracticesExport
          practices={filteredPractices.map((practice) => {
            const lot = practice.vies_batch_id ? lots.get(practice.vies_batch_id) : undefined;
            return { ...practice, lotNumber: lot?.number ?? null, lotRepresentative: lot?.representative ?? null };
          })}
        />
      </div>
      {(lotId || lots.size > 0) && (
        <div className="flex flex-wrap items-center gap-3">
          {lotId && lots.get(lotId) && (
            <Badge variant="secondary" className="gap-2 py-1 text-sm" data-testid="lot-chip">
              {lotText.filterChip(lotTitle(lots.get(lotId) as PracticeLot, lotText.lotName))}
              <button type="button" aria-label={lotText.clearLot} onClick={clearLotFilter}>
                <X className="h-3.5 w-3.5" />
              </button>
            </Badge>
          )}
          {lotId && lots.get(lotId) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              disabled={downloadingLot === lotId}
              onClick={() => void handleDownloadLot(lots.get(lotId) as PracticeLot, lotTitle(lots.get(lotId) as PracticeLot, lotText.lotName))}
              data-testid="lot-download-chip"
            >
              {downloadingLot === lotId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {lotText.downloadAll}
            </Button>
          )}
          {lotId && lots.get(lotId) && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                disabled={downloadingLot === lotId}
                onClick={() => void handleDownloadSigning(lots.get(lotId) as PracticeLot, lotTitle(lots.get(lotId) as PracticeLot, lotText.lotName))}
                data-testid="lot-download-signing-chip"
              >
                <FileSignature className="h-4 w-4" />
                {signingText.bundle.downloadAction}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                disabled={downloadingLot === lotId}
                onClick={() => document.getElementById(`${signedInputId(lots.get(lotId) as PracticeLot)}-chip`)?.click()}
                data-testid="lot-upload-signed-chip"
              >
                <Upload className="h-4 w-4" />
                {signingText.bundle.uploadAction}
              </Button>
              <input
                id={`${signedInputId(lots.get(lotId) as PracticeLot)}-chip`}
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void handleUploadSigned(lots.get(lotId) as PracticeLot, lotTitle(lots.get(lotId) as PracticeLot, lotText.lotName), file);
                }}
              />
            </>
          )}
          {lots.size > 0 && (
            <div className="ml-auto inline-flex rounded-md border border-border p-0.5" role="group" aria-label={lotText.viewLabel}>
              <Button type="button" size="sm" variant={view === "lots" ? "secondary" : "ghost"} className="h-8 gap-1.5" aria-pressed={view === "lots"} onClick={() => changeView("lots")} data-testid="view-lots">
                <Layers className="h-4 w-4" />
                {lotText.viewByLot}
              </Button>
              <Button type="button" size="sm" variant={view === "flat" ? "secondary" : "ghost"} className="h-8 gap-1.5" aria-pressed={view === "flat"} onClick={() => changeView("flat")} data-testid="view-flat">
                <List className="h-4 w-4" />
                {lotText.viewFlat}
              </Button>
            </div>
          )}
        </div>
      )}
      {compact ? (
        <div className="space-y-2" data-testid="practice-cards">
          {loading ? (
            <p className="py-8 text-center text-muted-foreground">{m.loading}</p>
          ) : filteredPractices.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">{m.empty}</p>
          ) : (
            <>
              <label className="flex items-center gap-3 px-1 py-1 text-sm">
                <Checkbox
                  aria-label={m.selectAll}
                  checked={filteredPractices.length > 0 && filteredPractices.every((practice) => selectedPracticeIds.has(practice.id))}
                  onCheckedChange={toggleAllFilteredPractices}
                />
                <span>{m.selectAll}</span>
              </label>
              {view === "lots" ? renderLotCards() : filteredPractices.map((practice) => renderPracticeCard(practice))}
            </>
          )}
        </div>
      ) : (
      <Card className="overflow-hidden">
        <div className="w-full overflow-x-auto">
        <Table className="min-w-[760px] min-[1440px]:min-w-[1050px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                aria-label={m.selectAll}
                checked={filteredPractices.length > 0 && filteredPractices.every((practice) => selectedPracticeIds.has(practice.id))}
                onCheckedChange={toggleAllFilteredPractices}
              />
            </TableHead>
            <TableHead>{m.number}</TableHead>
            <TableHead>{m.client}</TableHead>
            <TableHead className="hidden min-[1440px]:table-cell">{m.beneficiary}</TableHead>
            <TableHead>{m.type}</TableHead>
            <TableHead className="hidden min-[1440px]:table-cell">{m.policy}</TableHead>
            <TableHead>{m.date}</TableHead>
            <TableHead>{m.status}</TableHead>
            <TableHead className="text-right">{m.actions}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                {m.loading}
              </TableCell>
            </TableRow>
          ) : filteredPractices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                {m.empty}
              </TableCell>
            </TableRow>
          ) : (
            view === "lots" ? renderLotRows() : filteredPractices.map((practice) => renderPracticeRow(practice))
          )}
        </TableBody>
        </Table>
        </div>
    </Card>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.confirmDeleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {m.confirmDeleteText(practiceToDelete?.practice_number ?? "")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePractice}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {m.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
