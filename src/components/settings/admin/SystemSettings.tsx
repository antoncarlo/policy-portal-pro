import { getMessages, useMessages } from "@/i18n";
import { commonMessages } from "@/i18n/messages/common";
import { systemMessages } from "@/i18n/messages/system";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Settings2, Upload, Shield } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";

export const SystemSettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const m = useMessages(systemMessages).system;
  const [settings, setSettings] = useState({
    // Identity
    portal_name: "Tecno Advance MGA",
    portal_logo_url: "/logo.svg",
    
    // Email
    sender_email: "noreply@tecnomga.com",
    sender_name: "Tecno Advance MGA",
    support_email: "",
    
    // Security
    password_min_length: 8,
    password_require_uppercase: true,
    password_require_numbers: true,
    session_timeout_minutes: 30,
    max_login_attempts: 5,
    lockout_duration_minutes: 15,
    
    // Storage
    storage_limit_per_user_gb: 1,
    
    // Localization
    default_language: "it",
    default_timezone: "Europe/Rome",
    default_date_format: "DD/MM/YYYY",
  });

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- legacy loader intentionally runs only for the dependency list below
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("*")
        .single();

      if (error) throw error;

      if (data) {
        setSettings({
          portal_name: data.portal_name || "Tecno Advance MGA",
          portal_logo_url: data.portal_logo_url || "/logo.svg",
          sender_email: data.sender_email || "noreply@tecnomga.com",
          sender_name: data.sender_name || "Tecno Advance MGA",
          support_email: data.support_email || "",
          password_min_length: data.password_min_length || 8,
          password_require_uppercase: data.password_require_uppercase ?? true,
          password_require_numbers: data.password_require_numbers ?? true,
          session_timeout_minutes: data.session_timeout_minutes || 30,
          max_login_attempts: data.max_login_attempts || 5,
          lockout_duration_minutes: data.lockout_duration_minutes || 15,
          storage_limit_per_user_gb: data.storage_limit_per_user_gb || 1,
          default_language: data.default_language || "it",
          default_timezone: data.default_timezone || "Europe/Rome",
          default_date_format: data.default_date_format || "DD/MM/YYYY",
        });
      }
    } catch (error) {
      console.error("Error loading system settings:", error);
      toast({
        variant: "destructive",
        title: getMessages(commonMessages).error,
        description: getMessages(systemMessages).system.loadError,
      });
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: existingSettings } = await supabase
        .from("system_settings")
        .select("id")
        .single();

      const { error } = await supabase
        .from("system_settings")
        .update(settings)
        .eq("id", existingSettings?.id);

      if (error) throw error;

      toast({
        title: getMessages(commonMessages).success,
        description: getMessages(systemMessages).system.saved,
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

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `portal-logo-${Date.now()}.${fileExt}`;
      const filePath = `system/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("practice-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("practice-documents")
        .getPublicUrl(filePath);

      setSettings({ ...settings, portal_logo_url: publicUrl });

      toast({
        title: getMessages(commonMessages).success,
        description: getMessages(systemMessages).system.logoUploaded,
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
        <Settings2 className="h-5 w-5" />
        <h2 className="text-xl font-semibold">{m.title}</h2>
      </div>

      <Tabs defaultValue="identity" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="identity">{m.tabIdentity}</TabsTrigger>
          <TabsTrigger value="email">{m.tabEmail}</TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="h-4 w-4 mr-2" />
            {m.tabSecurity}
          </TabsTrigger>
          <TabsTrigger value="localization">{m.tabLocalization}</TabsTrigger>
        </TabsList>

        {/* Identity Tab */}
        <TabsContent value="identity" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="portal_name">{m.portalName}</Label>
            <Input
              id="portal_name"
              value={settings.portal_name}
              onChange={(e) => setSettings({ ...settings, portal_name: e.target.value })}
              placeholder="Tecno Advance MGA"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="portal_logo">{m.portalLogo}</Label>
            <div className="flex gap-2">
              <Input
                id="portal_logo"
                value={settings.portal_logo_url}
                onChange={(e) => setSettings({ ...settings, portal_logo_url: e.target.value })}
                placeholder={m.logoUrl}
                disabled={uploading}
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById("logo-upload-system")?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
              </Button>
              <input
                id="logo-upload-system"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </div>
            {settings.portal_logo_url && (
              <img
                src={settings.portal_logo_url}
                alt={m.logoAlt}
                className="mt-2 max-h-16 border rounded"
              />
            )}
          </div>
        </TabsContent>

        {/* Email Tab */}
        <TabsContent value="email" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sender_email">{m.senderEmail}</Label>
            <Input
              id="sender_email"
              type="email"
              value={settings.sender_email}
              onChange={(e) => setSettings({ ...settings, sender_email: e.target.value })}
              placeholder="noreply@assicuraportal.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sender_name">{m.senderName}</Label>
            <Input
              id="sender_name"
              value={settings.sender_name}
              onChange={(e) => setSettings({ ...settings, sender_name: e.target.value })}
              placeholder="Tecno Advance MGA"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="support_email">{m.supportEmail}</Label>
            <Input
              id="support_email"
              type="email"
              value={settings.support_email}
              onChange={(e) => setSettings({ ...settings, support_email: e.target.value })}
              placeholder="support@assicuraportal.com"
            />
          </div>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">{m.passwordPolicy}</h3>
            
            <div className="space-y-2">
              <Label>{m.minLength(settings.password_min_length)}</Label>
              <Slider
                value={[settings.password_min_length]}
                onValueChange={([value]) => setSettings({ ...settings, password_min_length: value })}
                min={6}
                max={20}
                step={1}
                className="w-full"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="require_uppercase">{m.requireUppercase}</Label>
              <Switch
                id="require_uppercase"
                checked={settings.password_require_uppercase}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, password_require_uppercase: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="require_numbers">{m.requireNumbers}</Label>
              <Switch
                id="require_numbers"
                checked={settings.password_require_numbers}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, password_require_numbers: checked })
                }
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-semibold">{m.sessions}</h3>
            
            <div className="space-y-2">
              <Label htmlFor="session_timeout">{m.sessionTimeout}</Label>
              <Input
                id="session_timeout"
                type="number"
                value={settings.session_timeout_minutes}
                onChange={(e) =>
                  setSettings({ ...settings, session_timeout_minutes: parseInt(e.target.value) || 30 })
                }
                min={5}
                max={1440}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_attempts">{m.maxAttempts}</Label>
              <Input
                id="max_attempts"
                type="number"
                value={settings.max_login_attempts}
                onChange={(e) =>
                  setSettings({ ...settings, max_login_attempts: parseInt(e.target.value) || 5 })
                }
                min={3}
                max={10}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lockout_duration">{m.lockoutDuration}</Label>
              <Input
                id="lockout_duration"
                type="number"
                value={settings.lockout_duration_minutes}
                onChange={(e) =>
                  setSettings({ ...settings, lockout_duration_minutes: parseInt(e.target.value) || 15 })
                }
                min={5}
                max={60}
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-semibold">{m.storage}</h3>
            
            <div className="space-y-2">
              <Label htmlFor="storage_limit">{m.storageLimit}</Label>
              <Input
                id="storage_limit"
                type="number"
                step="0.1"
                value={settings.storage_limit_per_user_gb}
                onChange={(e) =>
                  setSettings({ ...settings, storage_limit_per_user_gb: parseFloat(e.target.value) || 1 })
                }
                min={0.1}
                max={10}
              />
            </div>
          </div>
        </TabsContent>

        {/* Localization Tab */}
        <TabsContent value="localization" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="default_language">{m.defaultLanguage}</Label>
            <select
              id="default_language"
              value={settings.default_language}
              onChange={(e) => setSettings({ ...settings, default_language: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="it">Italiano</option>
              <option value="en">English</option>
              <option value="zh">中文</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="default_timezone">{m.defaultTimezone}</Label>
            <select
              id="default_timezone"
              value={settings.default_timezone}
              onChange={(e) => setSettings({ ...settings, default_timezone: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="Europe/Rome">Europe/Rome (GMT+1)</option>
              <option value="Europe/London">Europe/London (GMT+0)</option>
              <option value="Asia/Shanghai">Asia/Shanghai (GMT+8)</option>
              <option value="America/New_York">America/New York (GMT-5)</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="default_date_format">{m.defaultDateFormat}</Label>
            <select
              id="default_date_format"
              value={settings.default_date_format}
              onChange={(e) => setSettings({ ...settings, default_date_format: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="DD/MM/YYYY">{m.dateFormats.dmy}</option>
              <option value="MM/DD/YYYY">{m.dateFormats.mdy}</option>
              <option value="YYYY-MM-DD">{m.dateFormats.ymd}</option>
            </select>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end pt-6 border-t mt-6">
        <Button onClick={handleSave} disabled={loading || uploading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {m.save}
        </Button>
      </div>
    </Card>
  );
};
