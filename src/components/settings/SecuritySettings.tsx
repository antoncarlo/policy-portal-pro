import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Lock, Eye, EyeOff } from "lucide-react";

export const SecuritySettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    new: false,
    confirm: false,
  });
  const [passwords, setPasswords] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return "La password deve essere di almeno 8 caratteri";
    }
    if (!/[A-Z]/.test(password)) {
      return "La password deve contenere almeno una lettera maiuscola";
    }
    if (!/[0-9]/.test(password)) {
      return "La password deve contenere almeno un numero";
    }
    return null;
  };

  const handleChangePassword = async () => {
    // Validation
    if (!passwords.newPassword || !passwords.confirmPassword) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Compila tutti i campi",
      });
      return;
    }

    if (passwords.newPassword !== passwords.confirmPassword) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Le password non coincidono",
      });
      return;
    }

    const validationError = validatePassword(passwords.newPassword);
    if (validationError) {
      toast({
        variant: "destructive",
        title: "Password non valida",
        description: validationError,
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwords.newPassword,
      });

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Password modificata correttamente",
      });

      // Reset form
      setPasswords({
        newPassword: "",
        confirmPassword: "",
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
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Lock className="h-5 w-5" />
        <h2 className="text-xl font-semibold">Sicurezza</h2>
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium mb-4">Cambio Password</h3>
          <div className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="new_password">Nuova Password *</Label>
              <div className="relative">
                <Input
                  id="new_password"
                  type={showPasswords.new ? "text" : "password"}
                  value={passwords.newPassword}
                  onChange={(e) =>
                    setPasswords({ ...passwords, newPassword: e.target.value })
                  }
                  placeholder="Inserisci la nuova password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() =>
                    setShowPasswords({ ...showPasswords, new: !showPasswords.new })
                  }
                >
                  {showPasswords.new ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Minimo 8 caratteri, 1 maiuscola, 1 numero
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm_password">Conferma Password *</Label>
              <div className="relative">
                <Input
                  id="confirm_password"
                  type={showPasswords.confirm ? "text" : "password"}
                  value={passwords.confirmPassword}
                  onChange={(e) =>
                    setPasswords({ ...passwords, confirmPassword: e.target.value })
                  }
                  placeholder="Conferma la nuova password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() =>
                    setShowPasswords({
                      ...showPasswords,
                      confirm: !showPasswords.confirm,
                    })
                  }
                >
                  {showPasswords.confirm ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <Button onClick={handleChangePassword} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cambia Password
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};
