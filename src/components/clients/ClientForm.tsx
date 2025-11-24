import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ClientFormProps {
  client?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export const ClientForm = ({ client, onSuccess, onCancel }: ClientFormProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: client?.first_name || "",
    last_name: client?.last_name || "",
    company_name: client?.company_name || "",
    vat_number: client?.vat_number || "",
    tax_code: client?.tax_code || "",
    email: client?.email || "",
    phone: client?.phone || "",
    mobile: client?.mobile || "",
    address_street: client?.address_street || "",
    address_city: client?.address_city || "",
    address_province: client?.address_province || "",
    address_postal_code: client?.address_postal_code || "",
    address_country: client?.address_country || "Italia",
    notes: client?.notes || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");

      if (client) {
        // Update existing client
        const { error } = await supabase
          .from("clients")
          .update(formData)
          .eq("id", client.id);

        if (error) throw error;

        toast({
          title: "Cliente aggiornato",
          description: "Le informazioni del cliente sono state aggiornate con successo.",
        });
      } else {
        // Create new client
        const { error } = await supabase
          .from("clients")
          .insert({
            ...formData,
            user_id: user.id,
          });

        if (error) throw error;

        toast({
          title: "Cliente aggiunto",
          description: "Il nuovo cliente è stato aggiunto alla rubrica.",
        });
      }

      onSuccess();
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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Personal Information */}
        <div className="space-y-2">
          <Label htmlFor="first_name">Nome *</Label>
          <Input
            id="first_name"
            name="first_name"
            value={formData.first_name}
            onChange={handleChange}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="last_name">Cognome *</Label>
          <Input
            id="last_name"
            name="last_name"
            value={formData.last_name}
            onChange={handleChange}
            required
          />
        </div>

        {/* Company Information */}
        <div className="space-y-2">
          <Label htmlFor="company_name">Ragione Sociale</Label>
          <Input
            id="company_name"
            name="company_name"
            value={formData.company_name}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="vat_number">Partita IVA</Label>
          <Input
            id="vat_number"
            name="vat_number"
            value={formData.vat_number}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tax_code">Codice Fiscale</Label>
          <Input
            id="tax_code"
            name="tax_code"
            value={formData.tax_code}
            onChange={handleChange}
          />
        </div>

        {/* Contact Information */}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Telefono</Label>
          <Input
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mobile">Cellulare</Label>
          <Input
            id="mobile"
            name="mobile"
            value={formData.mobile}
            onChange={handleChange}
          />
        </div>

        {/* Address */}
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="address_street">Indirizzo</Label>
          <Input
            id="address_street"
            name="address_street"
            value={formData.address_street}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address_city">Città</Label>
          <Input
            id="address_city"
            name="address_city"
            value={formData.address_city}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address_province">Provincia</Label>
          <Input
            id="address_province"
            name="address_province"
            value={formData.address_province}
            onChange={handleChange}
            maxLength={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address_postal_code">CAP</Label>
          <Input
            id="address_postal_code"
            name="address_postal_code"
            value={formData.address_postal_code}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address_country">Paese</Label>
          <Input
            id="address_country"
            name="address_country"
            value={formData.address_country}
            onChange={handleChange}
          />
        </div>

        {/* Notes */}
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="notes">Note</Label>
          <Textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={4}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Annulla
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {client ? "Aggiorna" : "Aggiungi"} Cliente
        </Button>
      </div>
    </form>
  );
};
