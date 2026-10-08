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
import { EditCommissionDialog } from "@/components/admin/users/EditCommissionDialog";
import * as XLSX from "xlsx";
import { callPortalAction } from "@/lib/portalActions";
import { getMessages, useMessages } from "@/i18n";
import { commonMessages } from "@/i18n/messages/common";
import { roleLabel } from "@/i18n/messages/domain";
import { usersMessages } from "@/i18n/messages/users";

interface User {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  avatar_url: string | null;
  role: string;
  agent_name: string | null;
  practice_count: number;
  default_commission_percentage?: number | null;
  commission_bonus_tiers?: Array<{ threshold: number; bonus_percentage: number; label?: string }> | null;
}

const UserManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const m = useMessages(usersMessages);
  const common = useMessages(commonMessages);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"table" | "org">("table");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editRoleDialogOpen, setEditRoleDialogOpen] = useState(false);
  const [editProductsDialogOpen, setEditProductsDialogOpen] = useState(false);
  const [editCommissionDialogOpen, setEditCommissionDialogOpen] = useState(false);
  const [assignAgentDialogOpen, setAssignAgentDialogOpen] = useState(false);
  const [inviteUserDialogOpen, setInviteUserDialogOpen] = useState(false);

  useEffect(() => {
    checkAccess();
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- legacy loader intentionally runs only for the dependency list below
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
        title: getMessages(usersMessages).accessDeniedTitle,
        description: getMessages(usersMessages).accessDeniedText,
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
    } catch (error) {
      toast({
        variant: "destructive",
        title: getMessages(commonMessages).error,
        description: getMessages(usersMessages).loadError,
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

  const handleEditCommission = (user: User) => {
    setSelectedUser(user);
    setEditCommissionDialogOpen(true);
  };

  const handleViewPractices = (user: User) => {
    navigate(`/practices?user=${user.id}`);
  };

  const handleDisableUser = async (user: User) => {
    if (!confirm(getMessages(usersMessages).confirmDisable(user.full_name))) return;

    try {
      await callPortalAction("disable_user", { userId: user.id });

      toast({
        title: getMessages(commonMessages).success,
        description: getMessages(usersMessages).disabled,
      });

      loadUsers();
    } catch (error) {
      toast({
        variant: "destructive",
        title: getMessages(commonMessages).error,
        description: error.message,
      });
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!confirm(getMessages(usersMessages).confirmDelete(user.full_name))) return;

    try {
      await callPortalAction("delete_user", { userId: user.id });

      toast({
        title: getMessages(commonMessages).success,
        description: getMessages(usersMessages).deleted,
      });

      loadUsers();
    } catch (error) {
      toast({
        variant: "destructive",
        title: getMessages(commonMessages).error,
        description: error.message,
      });
    }
  };

  const handleExportUsers = () => {
    const text = getMessages(usersMessages);
    const columns = text.exportColumns;
    const exportData = filteredUsers.map((user) => ({
      [columns.fullName]: user.full_name,
      [columns.email]: user.email,
      [columns.phone]: user.phone,
      [columns.role]: roleLabel(user.role),
      [columns.agent]: user.agent_name || "-",
      [columns.baseCommission]: user.default_commission_percentage ?? 0,
      [columns.bonuses]: Array.isArray(user.commission_bonus_tiers) && user.commission_bonus_tiers.length > 0
        ? user.commission_bonus_tiers
            .map((tier) => text.exportTier(tier.label || text.commission.tier, tier.threshold, tier.bonus_percentage))
            .join("; ")
        : "-",
      [columns.practices]: user.practice_count,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, text.exportSheet);
    XLSX.writeFile(wb, `${text.exportFile}_${new Date().toISOString().split("T")[0]}.xlsx`);

    toast({
      title: getMessages(commonMessages).success,
      description: text.exported,
    });
  };

  return (
    <DashboardLayout>
    <div className="container mx-auto p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold">{m.title}</h1>
          <p className="text-gray-600 mt-1">
            {m.subtitle}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadUsers} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {common.refresh}
          </Button>
          <Button variant="outline" onClick={handleExportUsers}>
            <Download className="h-4 w-4 mr-2" />
            {m.export}
          </Button>
          <Button onClick={() => setInviteUserDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            {m.invite}
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
          onEditCommission={handleEditCommission}
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

      <EditCommissionDialog
        open={editCommissionDialogOpen}
        onOpenChange={setEditCommissionDialogOpen}
        user={selectedUser}
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
