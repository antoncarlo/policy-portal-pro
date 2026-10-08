import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getMessages, useMessages } from "@/i18n";
import { commonMessages } from "@/i18n/messages/common";
import { settingsMessages } from "@/i18n/messages/settings";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileText, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";

export const PracticeTemplatesSettings = () => {
  const { toast } = useToast();
  const m = useMessages(settingsMessages).templates;
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
    } catch (error) {
      console.error("Error loading agent settings:", error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(getMessages(commonMessages).notAuthenticated);

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
        title: getMessages(commonMessages).success,
        description: getMessages(settingsMessages).templates.saved,
      });
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

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    field: "digital_signature_url" | "company_logo_url"
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(getMessages(commonMessages).notAuthenticated);

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
        title: getMessages(commonMessages).success,
        description: getMessages(settingsMessages).templates.uploaded,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: getMessages(commonMessages).error,
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
        <h2 className="text-xl font-semibold">{m.title}</h2>
      </div>

      <div className="space-y-6">
        {/* Email Template */}
        <div className="space-y-2">
          <Label htmlFor="email_template">{m.emailTemplate}</Label>
          <Textarea
            id="email_template"
            value={settings.email_template}
            onChange={(e) =>
              setSettings({ ...settings, email_template: e.target.value })
            }
            placeholder={m.emailPlaceholder}
            rows={8}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            {m.variables}
          </p>
        </div>

        {/* Digital Signature */}
        <div className="space-y-2">
          <Label htmlFor="digital_signature">{m.signature}</Label>
          <div className="flex gap-2">
            <Input
              id="digital_signature"
              value={settings.digital_signature_url}
              onChange={(e) =>
                setSettings({ ...settings, digital_signature_url: e.target.value })
              }
              placeholder={m.signaturePlaceholder}
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
              alt={m.signature}
              className="mt-2 max-h-20 border rounded"
            />
          )}
        </div>

        {/* Company Logo */}
        <div className="space-y-2">
          <Label htmlFor="company_logo">{m.logo}</Label>
          <div className="flex gap-2">
            <Input
              id="company_logo"
              value={settings.company_logo_url}
              onChange={(e) =>
                setSettings({ ...settings, company_logo_url: e.target.value })
              }
              placeholder={m.logoPlaceholder}
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
              alt={m.logo}
              className="mt-2 max-h-20 border rounded"
            />
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={loading || uploading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {m.save}
          </Button>
        </div>
      </div>
    </Card>
  );
};
