import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getMessages, useMessages } from "@/i18n";
import { clientsMessages } from "@/i18n/messages/clients";
import { commonMessages } from "@/i18n/messages/common";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Loader2 } from "lucide-react";

interface ClientFormProps {
  client?: Tables<"clients">;
  onSuccess: () => void;
  onCancel: () => void;
}

export const ClientForm = ({ client, onSuccess, onCancel }: ClientFormProps) => {
  const { toast } = useToast();
  const m = useMessages(clientsMessages).form;
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
      if (!user) throw new Error(getMessages(clientsMessages).form.notAuthenticated);

      if (client) {
        // Update existing client
        const { error } = await supabase
          .from("clients")
          .update(formData)
          .eq("id", client.id);

        if (error) throw error;

        toast({
          title: getMessages(clientsMessages).form.updatedTitle,
          description: getMessages(clientsMessages).form.updatedText,
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
          title: getMessages(clientsMessages).form.addedTitle,
          description: getMessages(clientsMessages).form.addedText,
        });
      }

      onSuccess();
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
          <Label htmlFor="first_name">{m.firstName}</Label>
          <Input
            id="first_name"
            name="first_name"
            value={formData.first_name}
            onChange={handleChange}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="last_name">{m.lastName}</Label>
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
          <Label htmlFor="company_name">{m.companyName}</Label>
          <Input
            id="company_name"
            name="company_name"
            value={formData.company_name}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="vat_number">{m.vatNumber}</Label>
          <Input
            id="vat_number"
            name="vat_number"
            value={formData.vat_number}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tax_code">{m.taxCode}</Label>
          <Input
            id="tax_code"
            name="tax_code"
            value={formData.tax_code}
            onChange={handleChange}
          />
        </div>

        {/* Contact Information */}
        <div className="space-y-2">
          <Label htmlFor="email">{m.email}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">{m.phone}</Label>
          <Input
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mobile">{m.mobile}</Label>
          <Input
            id="mobile"
            name="mobile"
            value={formData.mobile}
            onChange={handleChange}
          />
        </div>

        {/* Address */}
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="address_street">{m.street}</Label>
          <Input
            id="address_street"
            name="address_street"
            value={formData.address_street}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address_city">{m.city}</Label>
          <Input
            id="address_city"
            name="address_city"
            value={formData.address_city}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address_province">{m.province}</Label>
          <Input
            id="address_province"
            name="address_province"
            value={formData.address_province}
            onChange={handleChange}
            maxLength={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address_postal_code">{m.postalCode}</Label>
          <Input
            id="address_postal_code"
            name="address_postal_code"
            value={formData.address_postal_code}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address_country">{m.country}</Label>
          <Input
            id="address_country"
            name="address_country"
            value={formData.address_country}
            onChange={handleChange}
          />
        </div>

        {/* Notes */}
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="notes">{m.notes}</Label>
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
          {m.cancel}
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {client ? m.update : m.create}
        </Button>
      </div>
    </form>
  );
};
