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
import { RefreshCw, Download, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { FinancialStats } from "@/components/administration/FinancialStats";
import { FinancialPracticesTable } from "@/components/administration/FinancialPracticesTable";
import { EditFinancialDialog } from "@/components/administration/EditFinancialDialog";
import { UserFilter } from "@/components/administration/UserFilter";
import { ViesAdministration } from "@/components/administration/ViesAdministration";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as XLSX from "xlsx";
import { getLanguage, getMessages, useMessages } from "@/i18n";
import { administrationMessages } from "@/i18n/messages/administration";
import { commonMessages } from "@/i18n/messages/common";
import { financialStatusLabel, practiceTypeLabel } from "@/i18n/messages/domain";

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
  user_id?: string;
  user_full_name?: string;
  user_role?: string;
}

interface HierarchicalUser {
  user_id: string;
  full_name: string;
  role: string;
}

const Administration = () => {
  const { toast } = useToast();
  const m = useMessages(administrationMessages);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentUserRole, setCurrentUserRole] = useState<string>("");
  const [availableUsers, setAvailableUsers] = useState<HierarchicalUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [practices, setPractices] = useState<Practice[]>([]);
  const [filteredPractices, setFilteredPractices] = useState<Practice[]>([]);
  const [selectedPractice, setSelectedPractice] = useState<Practice | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    initializeUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- legacy loader intentionally runs only for the dependency list below
  }, []);

  useEffect(() => {
    if (currentUserId) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- legacy loader intentionally runs only for the dependency list below
  }, [currentUserId, selectedUserId]);

  useEffect(() => {
    filterPractices();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- legacy loader intentionally runs only for the dependency list below
  }, [practices, searchQuery, statusFilter]);

  const initializeUser = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast({
          variant: "destructive",
          title: getMessages(commonMessages).error,
          description: getMessages(commonMessages).notAuthenticated,
        });
        return;
      }

      setCurrentUserId(user.id);

      // Get user role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (roleData) {
        setCurrentUserRole(roleData.role);
      }

      // Load available users based on hierarchy
      const { data: usersData, error: usersError } = await supabase.rpc(
        "get_hierarchical_user_ids",
        { requesting_user_id: user.id }
      );

      if (usersError) throw usersError;
      setAvailableUsers(usersData || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: getMessages(administrationMessages).initErrorTitle,
        description: error.message,
      });
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const targetUserId = selectedUserId === "all" ? null : selectedUserId;

      // Load financial summary with hierarchical support
      const { data: summaryData, error: summaryError } = await supabase.rpc(
        "get_hierarchical_financial_summary",
        {
          requesting_user_id: currentUserId,
          target_user_id: targetUserId,
        }
      );

      if (summaryError) throw summaryError;
      if (summaryData && summaryData.length > 0) {
        setSummary(summaryData[0]);
      }

      // Load practices with hierarchical support
      // Read page by page: Supabase returns at most 1000 rows per request.
      const practicesData = await fetchAllRows((from, to) =>
        supabase
          .rpc("get_hierarchical_practices", {
            requesting_user_id: currentUserId,
            target_user_id: targetUserId,
          })
          .range(from, to),
      );
      setPractices(practicesData);
    } catch (error) {
      toast({
        variant: "destructive",
        title: getMessages(administrationMessages).loadErrorTitle,
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
          p.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.user_full_name && p.user_full_name.toLowerCase().includes(searchQuery.toLowerCase()))
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

  const handleUserChange = (userId: string) => {
    setSelectedUserId(userId);
  };

  const handleExport = () => {
    const text = getMessages(administrationMessages);
    const columns = text.exportColumns;
    const language = getLanguage();
    const exportData = filteredPractices.map((p) => ({
      [columns.number]: p.practice_number,
      [columns.type]: practiceTypeLabel(p.practice_type, language),
      [columns.client]: p.client_name,
      ...(selectedUserId === "all" && { [columns.user]: p.user_full_name }),
      [columns.premium]: p.premium_amount || 0,
      [columns.commissionPercentage]: p.commission_percentage || 0,
      [columns.commission]: p.commission_amount || 0,
      [columns.status]: financialStatusLabel(p.financial_status, language),
      [columns.paymentDate]: p.payment_date || "-",
      [columns.commissionDate]: p.commission_received_date || "-",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, text.exportSheet);
    XLSX.writeFile(
      wb,
      `${text.exportFile}_${new Date().toISOString().split("T")[0]}.xlsx`
    );

    toast({
      title: getMessages(commonMessages).success,
      description: text.exportedText,
    });
  };

  const getPageTitle = () => {
    if (currentUserRole === "admin") {
      return m.titleAdmin;
    } else if (currentUserRole === "agente") {
      return m.titleAgent;
    }
    return m.titleOwn;
  };

  const getPageDescription = () => {
    if (currentUserRole === "admin") {
      return m.descriptionAdmin;
    } else if (currentUserRole === "agente") {
      return m.descriptionAgent;
    }
    return m.descriptionOwn;
  };

  const showUserColumn = selectedUserId === "all" && (currentUserRole === "admin" || currentUserRole === "agente");

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              {getPageTitle()}
              {(currentUserRole === "admin" || currentUserRole === "agente") && (
                <Users className="h-6 w-6 text-primary" />
              )}
            </h1>
            <p className="text-gray-600 mt-1">{getPageDescription()}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData} disabled={loading}>
              <RefreshCw
                className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
              />
              {m.refresh}
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              {m.export}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="contabilita" className="space-y-6">
          <TabsList>
            <TabsTrigger value="contabilita">{m.tabAccounting}</TabsTrigger>
            <TabsTrigger value="vies">{m.tabVies}</TabsTrigger>
          </TabsList>

          <TabsContent value="vies">
            <ViesAdministration />
          </TabsContent>

          <TabsContent value="contabilita" className="space-y-6">
        {summary && <FinancialStats stats={summary} />}

        <div className="bg-white dark:bg-gray-800 rounded-lg border p-6 space-y-4">
          <h2 className="text-xl font-semibold">{m.filters}</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {(currentUserRole === "admin" || currentUserRole === "agente") && (
              <UserFilter
                users={availableUsers}
                selectedUserId={selectedUserId}
                onUserChange={handleUserChange}
                currentUserRole={currentUserRole}
              />
            )}
            <div className="space-y-2">
              <Label htmlFor="search">{m.search}</Label>
              <Input
                id="search"
                placeholder={m.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">{m.financialStatus}</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{m.allStatuses}</SelectItem>
                  <SelectItem value="non_incassata">{m.notCollectedPlural}</SelectItem>
                  <SelectItem value="incassata">{m.collectedPlural}</SelectItem>
                  <SelectItem value="provvigioni_ricevute">
                    {m.commissionsReceived}
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
            onEditFinancial={currentUserRole === "admin" ? handleEditFinancial : undefined}
            showUserColumn={showUserColumn}
          />
        )}

          </TabsContent>
        </Tabs>

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
