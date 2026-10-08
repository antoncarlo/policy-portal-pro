import { getMessages, useLanguage, useMessages } from "@/i18n";
import { commonMessages } from "@/i18n/messages/common";
import { roleLabel } from "@/i18n/messages/domain";
import { usersMessages } from "@/i18n/messages/users";
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
  const m = useMessages(usersMessages);
  const common = useMessages(commonMessages);
  const language = useLanguage();

  const roles = [
    {
      value: "admin",
      label: roleLabel("admin", language),
      description: m.roleDescriptions.admin,
      icon: Shield,
      color: "text-red-600",
    },
    {
      value: "agente",
      label: roleLabel("agente", language),
      description: m.roleDescriptions.agente,
      icon: Briefcase,
      color: "text-blue-600",
    },
    {
      value: "collaboratore",
      label: roleLabel("collaboratore", language),
      description: m.roleDescriptions.collaboratore,
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
        title: getMessages(commonMessages).success,
        description: getMessages(usersMessages).editRole.updated(roleLabel(selectedRole)),
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: getMessages(commonMessages).error,
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
          <DialogTitle>{m.editRole.title}</DialogTitle>
          <DialogDescription>
            {m.editRole.user(user.full_name, user.email)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{m.editRole.current}</Label>
            <div className="p-3 bg-gray-50 rounded-md">
              <span className="font-medium">
                {roles.find(r => r.value === user.role)?.label || user.role}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <Label>{m.editRole.next}</Label>
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
              {m.editRole.warning}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {common.cancel}
          </Button>
          <Button onClick={handleSave} disabled={loading || selectedRole === user.role}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {m.editRole.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
