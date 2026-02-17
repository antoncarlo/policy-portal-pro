import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, Download, RefreshCw } from "lucide-react";
import { UserManagementStats } from "@/components/admin/users/UserManagementStats";
import { UserFilters } from "@/components/admin/users/UserFilters";
import { UserTable } from "@/components/admin/users/UserTable";
import { OrganizationalChart } from "@/components/admin/users/OrganizationalChart";
import { EditRoleDialog } from "@/components/admin/users/EditRoleDialog";
import { AssignAgentDialog } from "@/components/admin/users/AssignAgentDialog";
import { InviteUserDialog } from "@/components/admin/users/InviteUserDialog";
import { EditUserProductsDialog } from "@/components/admin/users/EditUserProductsDialog";
import * as XLSX from "xlsx";

interface User {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  avatar_url: string | null;
  role: string;
  agent_name: string | null;
  practice_count: number;
}

const UserManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"table" | "org">("table");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editRoleDialogOpen, setEditRoleDialogOpen] = useState(false);
  const [editProductsDialogOpen, setEditProductsDialogOpen] = useState(false);
  const [assignAgentDialogOpen, setAssignAgentDialogOpen] = useState(false);
  const [inviteUserDialogOpen, setInviteUserDialogOpen] = useState(false);

  useEffect(() => {
    checkAccess();
    loadUsers();
  }, []);

  const checkAccess = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleData?.role !== "admin") {
      toast({
        variant: "destructive",
        title: "Accesso Negato",
        description: "Solo gli amministratori possono accedere a questa pagina",
      });
      navigate("/dashboard");
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_all_users_with_details");

      if (error) throw error;

      setUsers(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Impossibile caricare gli utenti",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.phone.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === "all" || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const stats = {
    total: users.length,
    admins: users.filter((u) => u.role === "admin").length,
    agents: users.filter((u) => u.role === "agente").length,
    collaborators: users.filter((u) => u.role === "collaboratore").length,
  };

  const handleEditRole = (user: User) => {
    setSelectedUser(user);
    setEditRoleDialogOpen(true);
  };

  const handleAssignAgent = (user: User) => {
    setSelectedUser(user);
    setAssignAgentDialogOpen(true);
  };

  const handleEditProducts = (user: User) => {
    setSelectedUser(user);
    setEditProductsDialogOpen(true);
  };

  const handleViewPractices = (user: User) => {
    navigate(`/practices?user=${user.id}`);
  };

  const handleDisableUser = async (user: User) => {
    if (!confirm(`Sei sicuro di voler disattivare ${user.full_name}?`)) return;

    try {
      const { error } = await supabase.auth.admin.updateUserById(user.id, {
        ban_duration: "876000h", // 100 years
      });

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Utente disattivato con successo",
      });

      loadUsers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message,
      });
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`ATTENZIONE: Eliminare ${user.full_name}? Questa azione è irreversibile!`))
      return;

    try {
      const { error } = await supabase.auth.admin.deleteUser(user.id);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Utente eliminato con successo",
      });

      loadUsers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message,
      });
    }
  };

  const handleExportUsers = () => {
    const exportData = filteredUsers.map((user) => ({
      "Nome Completo": user.full_name,
      Email: user.email,
      Telefono: user.phone,
      Ruolo: user.role,
      Agente: user.agent_name || "-",
      Pratiche: user.practice_count,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Utenti");
    XLSX.writeFile(wb, `utenti_${new Date().toISOString().split("T")[0]}.xlsx`);

    toast({
      title: "Successo",
      description: "Dati esportati in Excel",
    });
  };

  return (
    <DashboardLayout>
    <div className="container mx-auto p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold">Gestione Utenti</h1>
          <p className="text-gray-600 mt-1">
            Gestisci utenti, ruoli e gerarchie organizzative
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadUsers} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Aggiorna
          </Button>
          <Button variant="outline" onClick={handleExportUsers}>
            <Download className="h-4 w-4 mr-2" />
            Esporta
          </Button>
          <Button onClick={() => setInviteUserDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invita Utente
          </Button>
        </div>
      </div>

      <UserManagementStats stats={stats} />

      <UserFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        roleFilter={roleFilter}
        onRoleFilterChange={setRoleFilter}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : viewMode === "table" ? (
        <UserTable
          users={filteredUsers}
          onEditRole={handleEditRole}
          onEditProducts={handleEditProducts}
          onAssignAgent={handleAssignAgent}
          onViewPractices={handleViewPractices}
          onDisableUser={handleDisableUser}
          onDeleteUser={handleDeleteUser}
        />
      ) : (
        <OrganizationalChart users={filteredUsers} />
      )}

      <EditRoleDialog
        open={editRoleDialogOpen}
        onOpenChange={setEditRoleDialogOpen}
        user={selectedUser}
        onSuccess={loadUsers}
      />

      <AssignAgentDialog
        open={assignAgentDialogOpen}
        onOpenChange={setAssignAgentDialogOpen}
        user={selectedUser}
        onSuccess={loadUsers}
      />

      <InviteUserDialog
        open={inviteUserDialogOpen}
        onOpenChange={setInviteUserDialogOpen}
        onSuccess={loadUsers}
      />

      {selectedUser && (
        <EditUserProductsDialog
          open={editProductsDialogOpen}
          onOpenChange={setEditProductsDialogOpen}
          userId={selectedUser.id}
          userName={selectedUser.full_name}
          userRole={selectedUser.role}
          onSuccess={loadUsers}
        />
      )}
    </div>
    </DashboardLayout>
  );
};

export default UserManagement;
