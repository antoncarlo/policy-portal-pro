import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Shield, Users as UsersIcon, Package, Percent, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

type UserRole = "admin" | "agente" | "collaboratore";

interface UserWithRole {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
  default_commission_percentage?: number | null;
  commission_bonus_tiers?: CommissionBonusTier[] | null;
}

interface CommissionBonusTier {
  threshold: number;
  bonus_percentage: number;
  label?: string;
}

const normalizeTiers = (tiers: CommissionBonusTier[]) =>
  tiers
    .map((tier) => ({
      threshold: Number(tier.threshold) || 0,
      bonus_percentage: Number(tier.bonus_percentage) || 0,
      label: tier.label?.trim() || "",
    }))
    .filter((tier) => tier.threshold > 0 && tier.bonus_percentage > 0)
    .sort((a, b) => a.threshold - b.threshold);

const AdminUsers = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<UserRole | "">("");
  const [commissionBonusTiers, setCommissionBonusTiers] = useState<CommissionBonusTier[]>([]);

  useEffect(() => {
    checkAdminAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- legacy loader intentionally runs only for the dependency list below
  }, []);

  const checkAdminAccess = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      toast({
        variant: "destructive",
        title: "Accesso negato",
        description: "Solo gli amministratori possono accedere a questa pagina.",
      });
      navigate("/dashboard");
      return;
    }

    setIsAdmin(true);
    loadUsers();
  };

  const loadUsers = async () => {
    setLoading(true);
    
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, full_name, created_at, default_commission_percentage, commission_bonus_tiers");

    if (profiles) {
      const usersWithRoles = await Promise.all(
        profiles.map(async (profile) => {
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", profile.id)
            .single();

          return {
            ...profile,
            role: roleData?.role || "collaboratore" as UserRole,
          };
        })
      );

      setUsers(usersWithRoles);
    }

    setLoading(false);
  };

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Validate product selection for agente/collaboratore
    if ((selectedRole === "agente" || selectedRole === "collaboratore") && selectedProducts.length === 0) {
      toast({
        variant: "destructive",
        title: "Selezione prodotti richiesta",
        description: "Seleziona almeno un prodotto per questo ruolo.",
      });
      return;
    }
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const fullName = formData.get("full_name") as string;
    const role = formData.get("role") as UserRole;
    const defaultCommissionPercentage = Number(formData.get("default_commission_percentage") || 0);
    const normalizedCommissionBonusTiers = normalizeTiers(commissionBonusTiers);

    // Create user via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: fullName,
        },
      },
    });

    if (authError) {
      toast({
        variant: "destructive",
        title: "Errore creazione utente",
        description: authError.message,
      });
      return;
    }

    if (authData.user) {
      await supabase
        .from("profiles")
        .update({
          default_commission_percentage: defaultCommissionPercentage,
          commission_bonus_tiers: normalizedCommissionBonusTiers,
        })
        .eq("id", authData.user.id);

      // Assign role
      const { data: { session } } = await supabase.auth.getSession();
      
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: authData.user.id,
          role: role,
          created_by: session?.user.id,
          parent_agent_id: role === "collaboratore" ? session?.user.id : null,
        });

      if (roleError) {
        toast({
          variant: "destructive",
          title: "Errore assegnazione ruolo",
          description: roleError.message,
        });
        return;
      }

      // Assign product permissions for agente and collaboratore
      if (role === "agente" || role === "collaboratore") {
        if (selectedProducts.length > 0) {
          const { error: permError } = await supabase
            .from("user_product_permissions")
            .insert(
              selectedProducts.map(productType => ({
                user_id: authData.user.id,
                practice_type: productType,
                created_by: session?.user.id,
              }))
            );

          if (permError) {
            toast({
              variant: "destructive",
              title: "Errore assegnazione prodotti",
              description: permError.message,
            });
            return;
          }
        }
      }

      toast({
        title: "Utente creato!",
        description: `${fullName} è stato creato con ruolo ${role}${selectedProducts.length > 0 ? ` con ${selectedProducts.length} prodotti assegnati` : ''}.`,
      });

      setDialogOpen(false);
      setSelectedProducts([]);
      setSelectedRole("");
      setCommissionBonusTiers([]);
      loadUsers();
      e.currentTarget.reset();
    }
  };

  const addCommissionTier = () => {
    setCommissionBonusTiers((current) => [...current, { threshold: 0, bonus_percentage: 1, label: "" }]);
  };

  const updateCommissionTier = (index: number, field: keyof CommissionBonusTier, value: string) => {
    setCommissionBonusTiers((current) =>
      current.map((tier, tierIndex) =>
        tierIndex === index ? { ...tier, [field]: field === "label" ? value : Number(value) } : tier
      )
    );
  };

  const removeCommissionTier = (index: number) => {
    setCommissionBonusTiers((current) => current.filter((_, tierIndex) => tierIndex !== index));
  };

  const getRoleBadge = (role: UserRole) => {
    const variants: Record<UserRole, { label: string; className: string }> = {
      admin: { label: "ADMIN", className: "bg-destructive text-destructive-foreground" },
      agente: { label: "AGENTE", className: "bg-primary text-primary-foreground" },
      collaboratore: { label: "COLLABORATORE", className: "bg-secondary text-secondary-foreground" },
    };

    return (
      <Badge className={variants[role].className}>
        {variants[role].label}
      </Badge>
    );
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-foreground">Gestione Utenti</h1>
            <p className="text-muted-foreground mt-1">
              Gestisci tutti gli utenti della piattaforma
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="h-auto min-h-10 w-full whitespace-normal text-center md:w-auto">
                <UserPlus className="mr-2 h-4 w-4 shrink-0" />
                <span>Crea Nuovo Utente</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto overflow-x-hidden sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Crea Nuovo Utente</DialogTitle>
                <DialogDescription>
                  Inserisci i dettagli del nuovo utente e assegna un ruolo
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Nome Completo</Label>
                  <Input
                    id="full_name"
                    name="full_name"
                    placeholder="Mario Rossi"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="mario.rossi@example.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password Temporanea</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Ruolo</Label>
                  <Select name="role" required onValueChange={(value) => setSelectedRole(value as UserRole)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona ruolo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          ADMIN
                        </div>
                      </SelectItem>
                      <SelectItem value="agente">
                        <div className="flex items-center gap-2">
                          <UsersIcon className="h-4 w-4" />
                          AGENTE
                        </div>
                      </SelectItem>
                      <SelectItem value="collaboratore">
                        <div className="flex items-center gap-2">
                          <UsersIcon className="h-4 w-4" />
                          COLLABORATORE
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(selectedRole === "agente" || selectedRole === "collaboratore") && (
                  <div className="space-y-2">
                    <Label>
                      <Package className="h-4 w-4 inline mr-2" />
                      Prodotti Consentiti
                    </Label>
                    <div className="text-sm text-muted-foreground mb-2">
                      Seleziona quali tipologie di polizze l'utente può gestire
                      {selectedProducts.length > 0 && (
                        <span className="ml-2 font-semibold text-primary">({selectedProducts.length} selezionati)</span>
                      )}
                    </div>
                    <div className="grid max-h-60 grid-cols-1 gap-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
                      {[
                        { value: "pet", label: "Pet" },
                        { value: "car", label: "Car" },
                        { value: "casa", label: "Casa" },
                        { value: "salute", label: "Salute" },
                        { value: "fidejussioni", label: "Fidejussioni" },
                        { value: "postuma_decennale", label: "Postuma Decennale" },
                        { value: "all_risk", label: "All Risk" },
                        { value: "responsabilita_civile", label: "RC" },
                        { value: "fotovoltaico", label: "Fotovoltaico" },
                        { value: "catastrofali", label: "Catastrofali" },
                        { value: "azienda", label: "Azienda" },
                        { value: "risparmio", label: "Risparmio" },
                        { value: "vies", label: "VIES" },
                      ].map((product) => (
                        <label key={product.value} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            value={product.value}
                            checked={selectedProducts.includes(product.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedProducts([...selectedProducts, product.value]);
                              } else {
                                setSelectedProducts(selectedProducts.filter(p => p !== product.value));
                              }
                            }}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm">{product.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {(selectedRole === "agente" || selectedRole === "collaboratore") && (
                  <div className="space-y-3 rounded-md border p-3">
                    <div className="space-y-2">
                      <Label htmlFor="default_commission_percentage">
                        <Percent className="h-4 w-4 inline mr-2" />
                        Provvigione Base (%)
                      </Label>
                      <Input
                        id="default_commission_percentage"
                        name="default_commission_percentage"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="16.00"
                      />
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <Label>Premi produzione</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addCommissionTier} className="h-auto min-h-9 w-full whitespace-normal sm:w-auto">
                        <Plus className="mr-2 h-4 w-4 shrink-0" />
                        <span>Scaglione</span>
                      </Button>
                    </div>
                    {commissionBonusTiers.map((tier, index) => (
                      <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end rounded-md bg-muted/40 p-3">
                        <Input type="number" step="0.01" min="0" placeholder="Soglia €" value={tier.threshold || ""} onChange={(e) => updateCommissionTier(index, "threshold", e.target.value)} />
                        <Input type="number" step="0.01" min="0" max="100" placeholder="Bonus %" value={tier.bonus_percentage || ""} onChange={(e) => updateCommissionTier(index, "bonus_percentage", e.target.value)} />
                        <Input placeholder="Etichetta" value={tier.label || ""} onChange={(e) => updateCommissionTier(index, "label", e.target.value)} />
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeCommissionTier(index)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <Button type="submit" className="w-full">
                  Crea Utente
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="overflow-hidden">
          <div className="w-full overflow-x-auto">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Ruolo</TableHead>
                <TableHead>Provvigione</TableHead>
                <TableHead>Data Creazione</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    Caricamento...
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nessun utente trovato
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="max-w-[220px] break-words font-medium">{user.full_name}</TableCell>
                    <TableCell className="max-w-[260px] break-all">{user.email}</TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell>
                      {user.role === "agente" || user.role === "collaboratore" ? (
                        <div className="space-y-1">
                          <Badge variant="secondary">Base {Number(user.default_commission_percentage || 0).toFixed(2)}%</Badge>
                          {Array.isArray(user.commission_bonus_tiers) && user.commission_bonus_tiers.length > 0 && (
                            <div className="text-xs text-muted-foreground">{user.commission_bonus_tiers.length} scaglione/i</div>
                          )}
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {new Date(user.created_at).toLocaleDateString("it-IT")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminUsers;
