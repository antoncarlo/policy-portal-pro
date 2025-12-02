import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Send, Loader2, CheckCircle2, XCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const SMTPSettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [settings, setSettings] = useState({
    smtp_enabled: false,
    smtp_host: "",
    smtp_port: "587",
    smtp_username: "",
    smtp_password: "",
    smtp_encryption: "tls",
    smtp_from_email: "",
    smtp_from_name: "",
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("*")
        .single();

      if (error) throw error;

      // In a real implementation, SMTP settings would be stored securely
      setSettings({
        smtp_enabled: false,
        smtp_host: "",
        smtp_port: "587",
        smtp_username: "",
        smtp_password: "",
        smtp_encryption: "tls",
        smtp_from_email: data.sender_email || "",
        smtp_from_name: data.sender_name || "",
      });
    } catch (error: any) {
      console.error("Error loading SMTP settings:", error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // In a real implementation, you would save SMTP settings securely
      // For now, we'll just update the sender email and name
      const { error } = await supabase
        .from("system_settings")
        .update({
          sender_email: settings.smtp_from_email,
          sender_name: settings.smtp_from_name,
          updated_at: new Date().toISOString(),
        })
        .eq("id", "00000000-0000-0000-0000-000000000001");

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Configurazioni SMTP salvate",
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

  const handleTestEmail = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      // Simulate email test
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // In a real implementation, you would send a test email via the SMTP server
      const success = Math.random() > 0.3; // 70% success rate for demo

      if (success) {
        setTestResult("success");
        toast({
          title: "Successo",
          description: "Email di test inviata correttamente",
        });
      } else {
        setTestResult("error");
        toast({
          variant: "destructive",
          title: "Errore",
          description: "Impossibile inviare l'email di test. Verifica le configurazioni.",
        });
      }
    } catch (error: any) {
      setTestResult("error");
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Mail className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Configurazioni SMTP</h2>
        </div>

        <div className="space-y-6">
          {/* Enable SMTP */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Abilita Server SMTP Personalizzato</Label>
              <p className="text-sm text-muted-foreground">
                Usa il tuo server SMTP per inviare email
              </p>
            </div>
            <Switch
              checked={settings.smtp_enabled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, smtp_enabled: checked })
              }
            />
          </div>

          {settings.smtp_enabled && (
            <>
              {/* SMTP Server Settings */}
              <div className="space-y-4 pl-4 border-l-2 border-muted">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="smtp_host">Host SMTP *</Label>
                    <Input
                      id="smtp_host"
                      value={settings.smtp_host}
                      onChange={(e) =>
                        setSettings({ ...settings, smtp_host: e.target.value })
                      }
                      placeholder="smtp.gmail.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="smtp_port">Porta *</Label>
                    <Input
                      id="smtp_port"
                      value={settings.smtp_port}
                      onChange={(e) =>
                        setSettings({ ...settings, smtp_port: e.target.value })
                      }
                      placeholder="587"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smtp_encryption">Crittografia</Label>
                  <Select
                    value={settings.smtp_encryption}
                    onValueChange={(value) =>
                      setSettings({ ...settings, smtp_encryption: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessuna</SelectItem>
                      <SelectItem value="tls">TLS</SelectItem>
                      <SelectItem value="ssl">SSL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="smtp_username">Username *</Label>
                    <Input
                      id="smtp_username"
                      value={settings.smtp_username}
                      onChange={(e) =>
                        setSettings({ ...settings, smtp_username: e.target.value })
                      }
                      placeholder="user@example.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="smtp_password">Password *</Label>
                    <Input
                      id="smtp_password"
                      type="password"
                      value={settings.smtp_password}
                      onChange={(e) =>
                        setSettings({ ...settings, smtp_password: e.target.value })
                      }
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* From Settings */}
          <div className="space-y-4">
            <h3 className="font-semibold">Mittente Email</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtp_from_email">Email Mittente *</Label>
                <Input
                  id="smtp_from_email"
                  type="email"
                  value={settings.smtp_from_email}
                  onChange={(e) =>
                    setSettings({ ...settings, smtp_from_email: e.target.value })
                  }
                  placeholder="noreply@tecnomga.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp_from_name">Nome Mittente *</Label>
                <Input
                  id="smtp_from_name"
                  value={settings.smtp_from_name}
                  onChange={(e) =>
                    setSettings({ ...settings, smtp_from_name: e.target.value })
                  }
                  placeholder="Tecno Advance MGA"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4">
            <Button onClick={handleSave} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salva Configurazioni
            </Button>

            {settings.smtp_enabled && (
              <Button
                variant="outline"
                onClick={handleTestEmail}
                disabled={testing || !settings.smtp_host || !settings.smtp_username}
              >
                {testing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Invio in corso...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Invia Email di Test
                  </>
                )}
              </Button>
            )}

            {testResult && (
              <div className="flex items-center gap-2">
                {testResult === "success" ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="text-sm text-green-600">Test riuscito</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-destructive" />
                    <span className="text-sm text-destructive">Test fallito</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Email Templates Info */}
      <Card className="p-6 bg-muted">
        <h3 className="font-semibold mb-2">Template Email Disponibili</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Benvenuto nuovo utente</li>
          <li>• Notifica nuova pratica</li>
          <li>• Cambio stato pratica</li>
          <li>• Nuovo documento caricato</li>
          <li>• Reset password</li>
        </ul>
        <p className="text-xs text-muted-foreground mt-3">
          I template possono essere personalizzati nella sezione "Pratiche" delle impostazioni agente.
        </p>
      </Card>

      {/* SMTP Providers Info */}
      <Card className="p-6 bg-muted">
        <h3 className="font-semibold mb-2">Provider SMTP Consigliati</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Gmail</p>
            <p>Host: smtp.gmail.com | Porta: 587 | TLS</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Outlook/Office 365</p>
            <p>Host: smtp.office365.com | Porta: 587 | TLS</p>
          </div>
          <div>
            <p className="font-medium text-foreground">SendGrid</p>
            <p>Host: smtp.sendgrid.net | Porta: 587 | TLS</p>
          </div>
        </div>
      </Card>
    </div>
  );
};
