import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileText, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";

export const PracticeTemplatesSettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [settings, setSettings] = useState({
    email_template: "",
    digital_signature_url: "",
    company_logo_url: "",
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if agent_settings table exists and load data
      const { data, error } = await supabase
        .from("agent_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 = no rows returned
        throw error;
      }

      if (data) {
        setSettings({
          email_template: data.email_template || "",
          digital_signature_url: data.digital_signature_url || "",
          company_logo_url: data.company_logo_url || "",
        });
      }
    } catch (error: any) {
      console.error("Error loading agent settings:", error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utente non autenticato");

      // Upsert agent settings
      const { error } = await supabase
        .from("agent_settings")
        .upsert({
          user_id: user.id,
          email_template: settings.email_template,
          digital_signature_url: settings.digital_signature_url,
          company_logo_url: settings.company_logo_url,
        });

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Impostazioni pratiche salvate correttamente",
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

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    field: "digital_signature_url" | "company_logo_url"
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utente non autenticato");

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${field}-${Date.now()}.${fileExt}`;
      const filePath = `agent-assets/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("practice-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("practice-documents")
        .getPublicUrl(filePath);

      setSettings({ ...settings, [field]: publicUrl });

      toast({
        title: "Successo",
        description: "File caricato correttamente",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message,
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <FileText className="h-5 w-5" />
        <h2 className="text-xl font-semibold">Impostazioni Pratiche</h2>
      </div>

      <div className="space-y-6">
        {/* Email Template */}
        <div className="space-y-2">
          <Label htmlFor="email_template">Template Email per Clienti</Label>
          <Textarea
            id="email_template"
            value={settings.email_template}
            onChange={(e) =>
              setSettings({ ...settings, email_template: e.target.value })
            }
            placeholder="Gentile Cliente,&#10;&#10;La informiamo che la sua pratica [NUMERO_PRATICA] è stata...&#10;&#10;Cordiali saluti,&#10;[NOME_AGENTE]"
            rows={8}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Variabili disponibili: [NUMERO_PRATICA], [NOME_CLIENTE], [NOME_AGENTE], [STATO_PRATICA]
          </p>
        </div>

        {/* Digital Signature */}
        <div className="space-y-2">
          <Label htmlFor="digital_signature">Firma Digitale</Label>
          <div className="flex gap-2">
            <Input
              id="digital_signature"
              value={settings.digital_signature_url}
              onChange={(e) =>
                setSettings({ ...settings, digital_signature_url: e.target.value })
              }
              placeholder="URL firma digitale"
              disabled={uploading}
            />
            <Button
              variant="outline"
              onClick={() => document.getElementById("signature-upload")?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
            </Button>
            <input
              id="signature-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileUpload(e, "digital_signature_url")}
            />
          </div>
          {settings.digital_signature_url && (
            <img
              src={settings.digital_signature_url}
              alt="Firma digitale"
              className="mt-2 max-h-20 border rounded"
            />
          )}
        </div>

        {/* Company Logo */}
        <div className="space-y-2">
          <Label htmlFor="company_logo">Logo Aziendale</Label>
          <div className="flex gap-2">
            <Input
              id="company_logo"
              value={settings.company_logo_url}
              onChange={(e) =>
                setSettings({ ...settings, company_logo_url: e.target.value })
              }
              placeholder="URL logo aziendale"
              disabled={uploading}
            />
            <Button
              variant="outline"
              onClick={() => document.getElementById("logo-upload")?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
            </Button>
            <input
              id="logo-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileUpload(e, "company_logo_url")}
            />
          </div>
          {settings.company_logo_url && (
            <img
              src={settings.company_logo_url}
              alt="Logo aziendale"
              className="mt-2 max-h-20 border rounded"
            />
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={loading || uploading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salva Impostazioni
          </Button>
        </div>
      </div>
    </Card>
  );
};
