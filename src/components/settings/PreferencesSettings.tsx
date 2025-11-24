import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Settings2 } from "lucide-react";

export const PreferencesSettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState({
    language: "it",
    theme: "auto",
    timezone: "Europe/Rome",
    date_format: "DD/MM/YYYY",
    email_notifications: {
      new_practice: true,
      status_change: true,
      new_document: true,
    },
  });

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("language, theme, timezone, date_format, email_notifications")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      if (data) {
        setPreferences({
          language: data.language || "it",
          theme: data.theme || "auto",
          timezone: data.timezone || "Europe/Rome",
          date_format: data.date_format || "DD/MM/YYYY",
          email_notifications: data.email_notifications || {
            new_practice: true,
            status_change: true,
            new_document: true,
          },
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message,
      });
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utente non autenticato");

      const { error } = await supabase
        .from("profiles")
        .update({
          language: preferences.language,
          theme: preferences.theme,
          timezone: preferences.timezone,
          date_format: preferences.date_format,
          email_notifications: preferences.email_notifications,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Preferenze aggiornate correttamente",
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
        <Settings2 className="h-5 w-5" />
        <h2 className="text-xl font-semibold">Preferenze</h2>
      </div>

      <div className="space-y-6">
        {/* Language and Theme */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="language">Lingua</Label>
            <Select
              value={preferences.language}
              onValueChange={(value) =>
                setPreferences({ ...preferences, language: value })
              }
            >
              <SelectTrigger id="language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="it">Italiano</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="theme">Tema</Label>
            <Select
              value={preferences.theme}
              onValueChange={(value) =>
                setPreferences({ ...preferences, theme: value })
              }
            >
              <SelectTrigger id="theme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Chiaro</SelectItem>
                <SelectItem value="dark">Scuro</SelectItem>
                <SelectItem value="auto">Automatico</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Date Format and Timezone */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="date_format">Formato Data</Label>
            <Select
              value={preferences.date_format}
              onValueChange={(value) =>
                setPreferences({ ...preferences, date_format: value })
              }
            >
              <SelectTrigger id="date_format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DD/MM/YYYY">GG/MM/AAAA</SelectItem>
                <SelectItem value="MM/DD/YYYY">MM/GG/AAAA</SelectItem>
                <SelectItem value="YYYY-MM-DD">AAAA-MM-GG</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Fuso Orario</Label>
            <Select
              value={preferences.timezone}
              onValueChange={(value) =>
                setPreferences({ ...preferences, timezone: value })
              }
            >
              <SelectTrigger id="timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Europe/Rome">Europa/Roma (GMT+1)</SelectItem>
                <SelectItem value="Europe/London">Europa/Londra (GMT+0)</SelectItem>
                <SelectItem value="America/New_York">America/New York (GMT-5)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Email Notifications */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Notifiche Email</h3>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notify_new_practice">Nuove Pratiche</Label>
              <p className="text-sm text-muted-foreground">
                Ricevi un'email quando viene creata una nuova pratica
              </p>
            </div>
            <Switch
              id="notify_new_practice"
              checked={preferences.email_notifications.new_practice}
              onCheckedChange={(checked) =>
                setPreferences({
                  ...preferences,
                  email_notifications: {
                    ...preferences.email_notifications,
                    new_practice: checked,
                  },
                })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notify_status_change">Cambio Stato</Label>
              <p className="text-sm text-muted-foreground">
                Ricevi un'email quando lo stato di una pratica cambia
              </p>
            </div>
            <Switch
              id="notify_status_change"
              checked={preferences.email_notifications.status_change}
              onCheckedChange={(checked) =>
                setPreferences({
                  ...preferences,
                  email_notifications: {
                    ...preferences.email_notifications,
                    status_change: checked,
                  },
                })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notify_new_document">Nuovi Documenti</Label>
              <p className="text-sm text-muted-foreground">
                Ricevi un'email quando viene caricato un nuovo documento
              </p>
            </div>
            <Switch
              id="notify_new_document"
              checked={preferences.email_notifications.new_document}
              onCheckedChange={(checked) =>
                setPreferences({
                  ...preferences,
                  email_notifications: {
                    ...preferences.email_notifications,
                    new_document: checked,
                  },
                })
              }
            />
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salva Preferenze
          </Button>
        </div>
      </div>
    </Card>
  );
};
