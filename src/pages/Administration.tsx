import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FinancialStats } from "@/components/administration/FinancialStats";
import { FinancialPracticesTable } from "@/components/administration/FinancialPracticesTable";
import { EditFinancialDialog } from "@/components/administration/EditFinancialDialog";
import * as XLSX from "xlsx";

interface FinancialSummary {
  total_practices: number;
  total_premium_amount: number;
  total_commission_amount: number;
  non_incassate_count: number;
  non_incassate_amount: number;
  incassate_count: number;
  incassate_commission: number;
  provvigioni_ricevute_count: number;
  provvigioni_ricevute_amount: number;
}

interface Practice {
  id: string;
  practice_number: string;
  practice_type: string;
  client_name: string;
  premium_amount: number | null;
  commission_percentage: number | null;
  commission_amount: number | null;
  financial_status: string;
  payment_date: string | null;
  commission_received_date: string | null;
  created_at: string;
}

const Administration = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [practices, setPractices] = useState<Practice[]>([]);
  const [filteredPractices, setFilteredPractices] = useState<Practice[]>([]);
  const [selectedPractice, setSelectedPractice] = useState<Practice | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterPractices();
  }, [practices, searchQuery, statusFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast({
          variant: "destructive",
          title: "Errore",
          description: "Utente non autenticato",
        });
        return;
      }

      // Load financial summary
      const { data: summaryData, error: summaryError } = await supabase.rpc(
        "get_financial_summary",
        { user_uuid: user.id }
      );

      if (summaryError) throw summaryError;
      if (summaryData && summaryData.length > 0) {
        setSummary(summaryData[0]);
      }

      // Load practices with financial data
      const { data: practicesData, error: practicesError } = await supabase
        .from("practices")
        .select(
          "id, practice_number, practice_type, client_name, premium_amount, commission_percentage, commission_amount, financial_status, payment_date, commission_received_date, created_at"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (practicesError) throw practicesError;
      setPractices(practicesData || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore caricamento",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const filterPractices = () => {
    let filtered = practices;

    if (searchQuery) {
      filtered = filtered.filter(
        (p) =>
          p.practice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.client_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((p) => p.financial_status === statusFilter);
    }

    setFilteredPractices(filtered);
  };

  const handleEditFinancial = (practice: Practice) => {
    setSelectedPractice(practice);
    setEditDialogOpen(true);
  };

  const handleExport = () => {
    const exportData = filteredPractices.map((p) => ({
      "Numero Pratica": p.practice_number,
      Tipo: p.practice_type,
      Cliente: p.client_name,
      "Premio (€)": p.premium_amount || 0,
      "Provvigione %": p.commission_percentage || 0,
      "Provvigione (€)": p.commission_amount || 0,
      "Stato Finanziario": p.financial_status,
      "Data Incasso": p.payment_date || "-",
      "Data Provvigioni": p.commission_received_date || "-",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Amministrazione");
    XLSX.writeFile(
      wb,
      `amministrazione_${new Date().toISOString().split("T")[0]}.xlsx`
    );

    toast({
      title: "Successo",
      description: "Dati esportati in Excel",
    });
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Amministrazione</h1>
            <p className="text-gray-600 mt-1">
              Gestisci provvigioni e incassi delle pratiche
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData} disabled={loading}>
              <RefreshCw
                className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
              />
              Aggiorna
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Esporta
            </Button>
          </div>
        </div>

        {summary && <FinancialStats stats={summary} />}

        <div className="bg-white dark:bg-gray-800 rounded-lg border p-6 space-y-4">
          <h2 className="text-xl font-semibold">Filtri</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Cerca</Label>
              <Input
                id="search"
                placeholder="Numero pratica o cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Stato Finanziario</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti gli stati</SelectItem>
                  <SelectItem value="non_incassata">Non Incassate</SelectItem>
                  <SelectItem value="incassata">Incassate</SelectItem>
                  <SelectItem value="provvigioni_ricevute">
                    Provvigioni Ricevute
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <FinancialPracticesTable
            practices={filteredPractices}
            onEditFinancial={handleEditFinancial}
          />
        )}

        <EditFinancialDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          practice={selectedPractice}
          onSuccess={loadData}
        />
      </div>
    </DashboardLayout>
  );
};

export default Administration;
