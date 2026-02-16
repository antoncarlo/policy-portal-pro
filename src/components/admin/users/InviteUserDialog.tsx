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
import { Loader2, Mail, User, Phone, Shield, Percent, Package } from "lucide-react";

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
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    phone: "",
    role: "collaboratore",
    password: "",
    default_commission_percentage: "0",
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

    // Validate product selection for agente/collaboratore
    if ((formData.role === "agente" || formData.role === "collaboratore") && selectedProducts.length === 0) {
      toast({
        variant: "destructive",
        title: "Selezione prodotti richiesta",
        description: "Seleziona almeno un prodotto per questo ruolo.",
      });
      return;
    }

    setLoading(true);
    try {
      // Get session token for authorization
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Devi essere autenticato per creare utenti");
      }

      // Call API route to create user
      const response = await fetch('/api/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          phone: formData.phone,
          role: formData.role,
          default_commission_percentage: parseFloat(formData.default_commission_percentage) || 0,
          allowed_products: selectedProducts,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante la creazione dell\'utente');
      }

      if (data.error) {
        throw new Error(data.error);
      }

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
      setSelectedProducts([]);
      setFormData({
        email: "",
        full_name: "",
        phone: "",
        role: "collaboratore",
        password: "",
        default_commission_percentage: "0",
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

          {(formData.role === "agente" || formData.role === "collaboratore") && (
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
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto border rounded-md p-3">
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

          <div className="space-y-2">
            <Label htmlFor="commission">
              Provvigione Default (%)
            </Label>
            <div className="relative">
              <Percent className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="commission"
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="15.00"
                value={formData.default_commission_percentage}
                onChange={(e) => handleChange("default_commission_percentage", e.target.value)}
                className="pl-10"
              />
            </div>
            <p className="text-xs text-gray-500">
              Percentuale che verrà pre-compilata automaticamente quando l'utente crea una pratica
            </p>
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
