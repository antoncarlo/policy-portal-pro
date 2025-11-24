import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Shield, Briefcase, UserCheck, AlertTriangle } from "lucide-react";

interface EditRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  } | null;
  onSuccess: () => void;
}

export const EditRoleDialog = ({
  open,
  onOpenChange,
  user,
  onSuccess,
}: EditRoleDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState(user?.role || "collaboratore");

  const roles = [
    {
      value: "admin",
      label: "Admin",
      description: "Accesso completo al sistema, gestione utenti e configurazioni",
      icon: Shield,
      color: "text-red-600",
    },
    {
      value: "agente",
      label: "Agente",
      description: "Gestisce collaboratori e le loro pratiche",
      icon: Briefcase,
      color: "text-blue-600",
    },
    {
      value: "collaboratore",
      label: "Collaboratore",
      description: "Gestisce solo le proprie pratiche",
      icon: UserCheck,
      color: "text-green-600",
    },
  ];

  const handleSave = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: selectedRole })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Successo",
        description: `Ruolo aggiornato a ${roles.find(r => r.value === selectedRole)?.label}`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Modifica Ruolo Utente</DialogTitle>
          <DialogDescription>
            Utente: {user.full_name} ({user.email})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Ruolo Attuale</Label>
            <div className="p-3 bg-gray-50 rounded-md">
              <span className="font-medium">
                {roles.find(r => r.value === user.role)?.label || user.role}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Nuovo Ruolo</Label>
            <RadioGroup value={selectedRole} onValueChange={setSelectedRole}>
              {roles.map((role) => {
                const Icon = role.icon;
                return (
                  <div
                    key={role.value}
                    className={`flex items-start space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      selectedRole === role.value
                        ? "border-primary bg-primary/5"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() => setSelectedRole(role.value)}
                  >
                    <RadioGroupItem value={role.value} id={role.value} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className={`h-5 w-5 ${role.color}`} />
                        <Label
                          htmlFor={role.value}
                          className="font-semibold cursor-pointer"
                        >
                          {role.label}
                        </Label>
                      </div>
                      <p className="text-sm text-gray-600">{role.description}</p>
                    </div>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-800">
              Il cambio ruolo è immediato e l'utente vedrà le nuove autorizzazioni al prossimo accesso.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Annulla
          </Button>
          <Button onClick={handleSave} disabled={loading || selectedRole === user.role}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salva Modifiche
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
