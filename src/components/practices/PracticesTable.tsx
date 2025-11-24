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
import { supabase } from "@/integrations/supabase/client";
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

interface PracticesTableProps {
  searchQuery: string;
  filters: PracticeFilters;
}

type PracticeStatus = "in_lavorazione" | "in_attesa" | "approvata" | "rifiutata" | "completata";
type PracticeType = "auto" | "casa" | "vita" | "salute" | "responsabilita" | "altro";

interface Practice {
  id: string;
  practice_number: string;
  practice_type: PracticeType;
  client_name: string;
  policy_number: string | null;
  status: PracticeStatus;
  created_at: string;
}

export const PracticesTable = ({ searchQuery, filters }: PracticesTableProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [practices, setPractices] = useState<Practice[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [practiceToDelete, setPracticeToDelete] = useState<Practice | null>(null);

  const loadPractices = async () => {
    setLoading(true);
    
    let query = supabase
      .from("practices")
      .select("id, practice_number, practice_type, client_name, policy_number, status, created_at, user_id");

    // Apply filters
    if (filters.practiceType !== "all") {
      query = query.eq("practice_type", filters.practiceType as PracticeType);
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

    query = query.order("created_at", { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error("Error loading practices:", error);
    } else {
      setPractices(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadPractices();
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
          title: "Nessun documento",
          description: "Non ci sono documenti da scaricare per questa pratica.",
        });
        return;
      }

      // Download each document
      for (const doc of documents) {
        const { data, error: downloadError } = await supabase.storage
          .from("practice-documents")
          .download(doc.file_path);

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
        title: "Download completato",
        description: `${documents.length} documento/i scaricato/i con successo.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore download",
        description: error.message,
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
        title: "Pratica eliminata",
        description: `La pratica ${practiceToDelete.practice_number} è stata eliminata con successo.`,
      });

      // Reload practices
      loadPractices();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore eliminazione",
        description: error.message,
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

  const getStatusLabel = (status: PracticeStatus) => {
    const labels: Record<PracticeStatus, string> = {
      completata: "Completata",
      in_lavorazione: "In Lavorazione",
      in_attesa: "In Attesa",
      approvata: "Approvata",
      rifiutata: "Rifiutata",
    };
    return labels[status];
  };

  const getPracticeTypeLabel = (type: PracticeType) => {
    const labels: Record<PracticeType, string> = {
      auto: "Auto",
      casa: "Casa",
      vita: "Vita",
      salute: "Salute",
      responsabilita: "Responsabilità Civile",
      altro: "Altro",
    };
    return labels[type];
  };

  const filteredPractices = practices.filter((practice) => {
    const query = searchQuery.toLowerCase();
    return (
      practice.practice_number.toLowerCase().includes(query) ||
      practice.client_name.toLowerCase().includes(query) ||
      getPracticeTypeLabel(practice.practice_type).toLowerCase().includes(query) ||
      (practice.policy_number && practice.policy_number.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <PracticesExport practices={filteredPractices} />
      </div>
      <Card>
        <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Numero Pratica</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Polizza</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Stato</TableHead>
            <TableHead className="text-right">Azioni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                Caricamento pratiche...
              </TableCell>
            </TableRow>
          ) : filteredPractices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                Nessuna pratica trovata
              </TableCell>
            </TableRow>
          ) : (
            filteredPractices.map((practice) => (
              <TableRow key={practice.id}>
                <TableCell className="font-medium">{practice.practice_number}</TableCell>
                <TableCell>{practice.client_name}</TableCell>
                <TableCell>{getPracticeTypeLabel(practice.practice_type)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {practice.policy_number || "-"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(practice.created_at).toLocaleDateString("it-IT")}
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
                      title="Scarica documenti"
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
                          Modifica
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            setPracticeToDelete(practice);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Elimina
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma Eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare la pratica {practiceToDelete?.practice_number}?
              Questa azione eliminerà anche tutti i documenti e gli eventi associati e non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePractice}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
