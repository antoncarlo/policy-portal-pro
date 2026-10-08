import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { Eye, Download, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
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
import { formatDate, getMessages, useMessages } from "@/i18n";
import { practicesMessages } from "@/i18n/messages/practices";
import { commonMessages } from "@/i18n/messages/common";
import { PRACTICE_STATUSES, practiceStatusLabel, practiceTypeLabel } from "@/i18n/messages/domain";

interface PracticesTableProps {
  searchQuery: string;
  filters: PracticeFilters;
}

type PracticeStatus = "in_lavorazione" | "in_attesa" | "approvata" | "rifiutata" | "completata";
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
}

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

export const PracticesTable = ({ searchQuery, filters }: PracticesTableProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const m = useMessages(practicesMessages).table;
  const common = useMessages(commonMessages);
  const [practices, setPractices] = useState<Practice[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [practiceToDelete, setPracticeToDelete] = useState<Practice | null>(null);
  const [selectedPracticeIds, setSelectedPracticeIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<PracticeStatus>("in_lavorazione");
  const [bulkUpdating, setBulkUpdating] = useState(false);
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
        .select("id, practice_number, practice_type, client_name, beneficiary, policy_number, status, created_at, user_id");

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

      return query.order("created_at", { ascending: false }).order("id");
    };

    try {
      setPractices(await fetchAllRows((from, to) => buildQuery().range(from, to)));
      setSelectedPracticeIds(new Set());
    } catch (error) {
      console.error("Error loading practices:", error);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadPractices();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- legacy loader intentionally runs only for the dependency list below
  }, [filters]);

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
      approvata: "bg-blue-600/10 text-blue-600 border-blue-600/20",
      rifiutata: "bg-destructive/10 text-destructive border-destructive/20",
    };
    return colors[status] || "bg-muted text-muted-foreground";
  };

  const getStatusLabel = (status: PracticeStatus) => practiceStatusLabel(status);

  const getPracticeTypeLabel = (type: PracticeType) => practiceTypeLabel(type);

  const filteredPractices = practices.filter((practice) => {
    const query = searchQuery.toLowerCase();
    return (
      practice.practice_number.toLowerCase().includes(query) ||
      practice.client_name.toLowerCase().includes(query) ||
      (practice.beneficiary && practice.beneficiary.toLowerCase().includes(query)) ||
      getPracticeTypeLabel(practice.practice_type).toLowerCase().includes(query) ||
      (practice.policy_number && practice.policy_number.toLowerCase().includes(query))
    );
  });

  const selectedPractices = filteredPractices.filter((practice) => selectedPracticeIds.has(practice.id));

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
    setBulkUpdating(true);
    try {
      const { error } = await supabase
        .from("practices")
        .update({ status: bulkStatus })
        .in("id", Array.from(selectedPracticeIds));

      if (error) throw error;

      toast({
        title: m.statusUpdatedTitle,
        description: m.statusUpdatedText(selectedPracticeIds.size, getStatusLabel(bulkStatus)),
      });
      setSelectedPracticeIds(new Set());
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
            <Button onClick={handleBulkStatusUpdate} disabled={selectedPractices.length === 0 || bulkUpdating}>
              {m.changeStatus}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {m.statusByOffice}
          </p>
        )}
        <PracticesExport practices={filteredPractices} />
      </div>
      <Card className="overflow-hidden">
        <div className="w-full overflow-x-auto">
        <Table className="min-w-[1050px]">
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
            <TableHead>{m.beneficiary}</TableHead>
            <TableHead>{m.type}</TableHead>
            <TableHead>{m.policy}</TableHead>
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
            filteredPractices.map((practice) => (
              <TableRow key={practice.id}>
                <TableCell>
                  <Checkbox
                    aria-label={m.selectOne(practice.practice_number)}
                    checked={selectedPracticeIds.has(practice.id)}
                    onCheckedChange={() => togglePracticeSelection(practice.id)}
                  />
                </TableCell>
                <TableCell className="font-medium whitespace-nowrap">{practice.practice_number}</TableCell>
                <TableCell className="max-w-[220px] break-words">{practice.client_name}</TableCell>
                <TableCell className="max-w-[220px] break-words text-muted-foreground">{practice.beneficiary || "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{getPracticeTypeLabel(practice.practice_type)}</TableCell>
                <TableCell className="max-w-[180px] break-words text-muted-foreground">
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
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
        </Table>
        </div>
    </Card>

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
