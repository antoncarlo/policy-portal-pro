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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Mail, User, Phone, Shield } from "lucide-react";

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const InviteUserDialog = ({
  open,
  onOpenChange,
  onSuccess,
}: InviteUserDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    phone: "",
    role: "collaboratore",
    password: "",
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const generateRandomPassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData((prev) => ({ ...prev, password }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.full_name || !formData.password) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Compila tutti i campi obbligatori",
      });
      return;
    }

    setLoading(true);
    try {
      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: formData.email,
        password: formData.password,
        email_confirm: true,
        user_metadata: {
          full_name: formData.full_name,
          phone: formData.phone,
        },
      });

      if (authError) throw authError;

      // Create profile
      const { error: profileError } = await supabase.from("profiles").insert({
        id: authData.user.id,
        email: formData.email,
        full_name: formData.full_name,
        phone: formData.phone,
      });

      if (profileError) throw profileError;

      // Create user role
      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: authData.user.id,
        role: formData.role,
      });

      if (roleError) throw roleError;

      toast({
        title: "Successo",
        description: `Utente ${formData.full_name} creato con successo`,
      });

      // Show password to admin
      toast({
        title: "Password Generata",
        description: `Password temporanea: ${formData.password}`,
        duration: 10000,
      });

      onSuccess();
      onOpenChange(false);
      setFormData({
        email: "",
        full_name: "",
        phone: "",
        role: "collaboratore",
        password: "",
      });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Invita Nuovo Utente</DialogTitle>
          <DialogDescription>
            Crea un nuovo account utente per il portale
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">
              Nome Completo <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="full_name"
                placeholder="Mario Rossi"
                value={formData.full_name}
                onChange={(e) => handleChange("full_name", e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">
              Email <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="email"
                type="email"
                placeholder="mario.rossi@example.com"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefono</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="phone"
                placeholder="+39 123 456 7890"
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">
              Ruolo <span className="text-red-500">*</span>
            </Label>
            <Select value={formData.role} onValueChange={(value) => handleChange("role", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona ruolo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-red-600" />
                    <span>Admin</span>
                  </div>
                </SelectItem>
                <SelectItem value="agente">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-blue-600" />
                    <span>Agente</span>
                  </div>
                </SelectItem>
                <SelectItem value="collaboratore">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-green-600" />
                    <span>Collaboratore</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">
              Password Temporanea <span className="text-red-500">*</span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="password"
                type="text"
                placeholder="Genera o inserisci password"
                value={formData.password}
                onChange={(e) => handleChange("password", e.target.value)}
                required
              />
              <Button type="button" variant="outline" onClick={generateRandomPassword}>
                Genera
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              L'utente dovrà cambiare la password al primo accesso
            </p>
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Annulla
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crea Utente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
