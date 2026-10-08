import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Settings2 } from "lucide-react";
import { changeLanguage } from "@/i18n/changeLanguage";
import { LANGUAGES, getMessages, useLanguage, useMessages, type Language } from "@/i18n";
import { commonMessages } from "@/i18n/messages/common";
import { preferencesMessages } from "@/i18n/messages/settings";

export const PreferencesSettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const m = useMessages(preferencesMessages);
  const language = useLanguage();
  const [preferences, setPreferences] = useState({
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- legacy loader intentionally runs only for the dependency list below
  }, []);

  const loadPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("theme, timezone, date_format, email_notifications")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      if (data) {
        setPreferences({
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
    } catch (error) {
      toast({
        variant: "destructive",
        title: getMessages(commonMessages).error,
        description: error.message,
      });
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(getMessages(commonMessages).notAuthenticated);

      const { error } = await supabase
        .from("profiles")
        .update({
          language,
          theme: preferences.theme,
          timezone: preferences.timezone,
          date_format: preferences.date_format,
          email_notifications: preferences.email_notifications,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: getMessages(commonMessages).success,
        description: getMessages(preferencesMessages).saved,
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

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Settings2 className="h-5 w-5" />
        <h2 className="text-xl font-semibold">{m.title}</h2>
      </div>

      <div className="space-y-6">
        {/* Language and Theme */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="language">{m.language}</Label>
            <Select value={language} onValueChange={(value) => changeLanguage(value as Language)}>
              <SelectTrigger id="language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((entry) => (
                  <SelectItem key={entry.code} value={entry.code}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{m.languageHint}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="theme">{m.theme}</Label>
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
                <SelectItem value="light">{m.themeLight}</SelectItem>
                <SelectItem value="dark">{m.themeDark}</SelectItem>
                <SelectItem value="auto">{m.themeAuto}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Date Format and Timezone */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="date_format">{m.dateFormat}</Label>
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
                {Object.entries(m.dateFormats).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">{m.timezone}</Label>
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
                {Object.entries(m.timezones).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Email Notifications */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">{m.emailNotifications}</h3>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notify_new_practice">{m.newPractice}</Label>
              <p className="text-sm text-muted-foreground">
                {m.newPracticeHint}
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
              <Label htmlFor="notify_status_change">{m.statusChange}</Label>
              <p className="text-sm text-muted-foreground">
                {m.statusChangeHint}
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
              <Label htmlFor="notify_new_document">{m.newDocument}</Label>
              <p className="text-sm text-muted-foreground">
                {m.newDocumentHint}
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
            {m.save}
          </Button>
        </div>
      </div>
    </Card>
  );
};
