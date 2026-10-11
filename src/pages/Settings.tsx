import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { SecuritySettings } from "@/components/settings/SecuritySettings";
import { MfaSettings } from "@/components/settings/MfaSettings";
import { PreferencesSettings } from "@/components/settings/PreferencesSettings";
import { CollaboratorsSettings } from "@/components/settings/CollaboratorsSettings";
import { PracticeTemplatesSettings } from "@/components/settings/PracticeTemplatesSettings";
import { SystemSettings } from "@/components/settings/admin/SystemSettings";
import { PortalStatistics } from "@/components/settings/admin/PortalStatistics";
import { ActivityLogs } from "@/components/settings/admin/ActivityLogs";
import { BackupSettings } from "@/components/settings/admin/BackupSettings";
import { SMTPSettings } from "@/components/settings/admin/SMTPSettings";
import { ApiLogsSettings } from "@/components/settings/admin/ApiLogsSettings";
import { ApiKeysSettings } from "@/components/settings/admin/ApiKeysSettings";
import { ApiKeyMappingSettings } from "@/components/settings/admin/ApiKeyMappingSettings";
import { ConnectionsSettings } from "@/components/settings/admin/ConnectionsSettings";
import { SessionsSettings } from "@/components/settings/SessionsSettings";
import { User, Lock, Settings2, Users, FileText, Shield, BarChart3, Activity, Database, Mail, Monitor, Webhook, Key, Link2, Cable } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMessages } from "@/i18n";
import { settingsMessages } from "@/i18n/messages/settings";
import { connectionsMessages } from "@/i18n/messages/connections";

const Settings = () => {
  const [activeTab, setActiveTab] = useState("profile");
  const m = useMessages(settingsMessages);
  const connections = useMessages(connectionsMessages).settings;
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    loadUserRole();
  }, []);

  const loadUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      setUserRole(data?.role || null);
    } catch (error) {
      console.error("Error loading user role:", error);
    }
  };

  const isAgent = userRole === "agente";
  const isAdmin = userRole === "admin";
  const showAgentTabs = isAgent || isAdmin;
  const showAdminTabs = isAdmin;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{m.title}</h1>
          <p className="text-muted-foreground mt-1">
            {m.subtitle}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex h-auto min-h-10 w-full flex-wrap items-start justify-start gap-2 rounded-none bg-transparent p-0 text-muted-foreground">
            <TabsTrigger value="profile" className="group h-10 shrink-0 rounded-lg border border-border/70 bg-card px-3 shadow-sm data-[state=active]:border-primary/40 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2" aria-label={m.tabs.profile} title={m.tabs.profile}>
              <User className="h-4 w-4" />
              <span className="hidden group-data-[state=active]:inline sm:inline">{m.tabs.profile}</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="group h-10 shrink-0 rounded-lg border border-border/70 bg-card px-3 shadow-sm data-[state=active]:border-primary/40 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2" aria-label={m.tabs.security} title={m.tabs.security}>
              <Lock className="h-4 w-4" />
              <span className="hidden group-data-[state=active]:inline sm:inline">{m.tabs.security}</span>
            </TabsTrigger>
            <TabsTrigger value="preferences" className="group h-10 shrink-0 rounded-lg border border-border/70 bg-card px-3 shadow-sm data-[state=active]:border-primary/40 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2" aria-label={m.tabs.preferences} title={m.tabs.preferences}>
              <Settings2 className="h-4 w-4" />
              <span className="hidden group-data-[state=active]:inline sm:inline">{m.tabs.preferences}</span>
            </TabsTrigger>
            <TabsTrigger value="sessions" className="group h-10 shrink-0 rounded-lg border border-border/70 bg-card px-3 shadow-sm data-[state=active]:border-primary/40 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2" aria-label={m.tabs.sessions} title={m.tabs.sessions}>
              <Monitor className="h-4 w-4" />
              <span className="hidden group-data-[state=active]:inline sm:inline">{m.tabs.sessions}</span>
            </TabsTrigger>

            {showAgentTabs && (
              <>
                <TabsTrigger value="collaborators" className="group h-10 shrink-0 rounded-lg border border-border/70 bg-card px-3 shadow-sm data-[state=active]:border-primary/40 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2" aria-label={m.tabs.collaborators} title={m.tabs.collaborators}>
                  <Users className="h-4 w-4" />
                  <span className="hidden group-data-[state=active]:inline sm:inline">{m.tabs.collaborators}</span>
                </TabsTrigger>
                <TabsTrigger value="templates" className="group h-10 shrink-0 rounded-lg border border-border/70 bg-card px-3 shadow-sm data-[state=active]:border-primary/40 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2" aria-label={m.tabs.templates} title={m.tabs.templates}>
                  <FileText className="h-4 w-4" />
                  <span className="hidden group-data-[state=active]:inline sm:inline">{m.tabs.templates}</span>
                </TabsTrigger>
              </>
            )}

            {showAdminTabs && (
              <>
                <TabsTrigger value="system" className="group h-10 shrink-0 rounded-lg border border-border/70 bg-card px-3 shadow-sm data-[state=active]:border-primary/40 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2" aria-label={m.tabs.system} title={m.tabs.system}>
                  <Shield className="h-4 w-4" />
                  <span className="hidden group-data-[state=active]:inline sm:inline">{m.tabs.system}</span>
                </TabsTrigger>
                <TabsTrigger value="statistics" className="group h-10 shrink-0 rounded-lg border border-border/70 bg-card px-3 shadow-sm data-[state=active]:border-primary/40 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2" aria-label={m.tabs.statistics} title={m.tabs.statistics}>
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden group-data-[state=active]:inline sm:inline">{m.tabs.statistics}</span>
                </TabsTrigger>
                <TabsTrigger value="logs" className="group h-10 shrink-0 rounded-lg border border-border/70 bg-card px-3 shadow-sm data-[state=active]:border-primary/40 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2" aria-label={m.tabs.logs} title={m.tabs.logs}>
                  <Activity className="h-4 w-4" />
                  <span className="hidden group-data-[state=active]:inline sm:inline">{m.tabs.logs}</span>
                </TabsTrigger>
                <TabsTrigger value="backup" className="group h-10 shrink-0 rounded-lg border border-border/70 bg-card px-3 shadow-sm data-[state=active]:border-primary/40 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2" aria-label={m.tabs.backup} title={m.tabs.backup}>
                  <Database className="h-4 w-4" />
                  <span className="hidden group-data-[state=active]:inline sm:inline">{m.tabs.backup}</span>
                </TabsTrigger>
                <TabsTrigger value="smtp" className="group h-10 shrink-0 rounded-lg border border-border/70 bg-card px-3 shadow-sm data-[state=active]:border-primary/40 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2" aria-label={m.tabs.email} title={m.tabs.email}>
                  <Mail className="h-4 w-4" />
                  <span className="hidden group-data-[state=active]:inline sm:inline">{m.tabs.email}</span>
                </TabsTrigger>
                <TabsTrigger value="api-logs" className="group h-10 shrink-0 rounded-lg border border-border/70 bg-card px-3 shadow-sm data-[state=active]:border-primary/40 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2" aria-label={m.tabs.apiLogs} title={m.tabs.apiLogs}>
                  <Webhook className="h-4 w-4" />
                  <span className="hidden group-data-[state=active]:inline sm:inline">{m.tabs.apiLogs}</span>
                </TabsTrigger>
                <TabsTrigger value="api-keys" className="group h-10 shrink-0 rounded-lg border border-border/70 bg-card px-3 shadow-sm data-[state=active]:border-primary/40 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2" aria-label={m.tabs.apiKeys} title={m.tabs.apiKeys}>
                  <Key className="h-4 w-4" />
                  <span className="hidden group-data-[state=active]:inline sm:inline">{m.tabs.apiKeys}</span>
                </TabsTrigger>
                <TabsTrigger value="api-mapping" className="group h-10 shrink-0 rounded-lg border border-border/70 bg-card px-3 shadow-sm data-[state=active]:border-primary/40 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2" aria-label={m.tabs.apiMapping} title={m.tabs.apiMapping}>
                  <Link2 className="h-4 w-4" />
                  <span className="hidden group-data-[state=active]:inline sm:inline">{m.tabs.apiMapping}</span>
                </TabsTrigger>
                <TabsTrigger value="connections" className="group h-10 shrink-0 rounded-lg border border-border/70 bg-card px-3 shadow-sm data-[state=active]:border-primary/40 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2" aria-label={connections.title} title={connections.title}>
                  <Cable className="h-4 w-4" />
                  <span className="hidden group-data-[state=active]:inline sm:inline">{connections.title}</span>
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <ProfileSettings />
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            <SecuritySettings />
            <MfaSettings />
          </TabsContent>

          <TabsContent value="preferences" className="space-y-4">
            <PreferencesSettings />
          </TabsContent>

          <TabsContent value="sessions" className="space-y-4">
            <SessionsSettings />
          </TabsContent>

          {showAgentTabs && (
            <>
              <TabsContent value="collaborators" className="space-y-4">
                <CollaboratorsSettings canAddCollaborators={isAdmin} />
              </TabsContent>

              <TabsContent value="templates" className="space-y-4">
                <PracticeTemplatesSettings />
              </TabsContent>
            </>
          )}

          {showAdminTabs && (
            <>
              <TabsContent value="system" className="space-y-4">
                <SystemSettings />
              </TabsContent>

              <TabsContent value="statistics" className="space-y-4">
                <PortalStatistics />
              </TabsContent>

              <TabsContent value="logs" className="space-y-4">
                <ActivityLogs />
              </TabsContent>

              <TabsContent value="backup" className="space-y-4">
                <BackupSettings />
              </TabsContent>

              <TabsContent value="smtp" className="space-y-4">
                <SMTPSettings />
              </TabsContent>

              <TabsContent value="api-logs" className="space-y-4">
                <ApiLogsSettings />
              </TabsContent>

              <TabsContent value="api-keys" className="space-y-4">
                <ApiKeysSettings />
              </TabsContent>

              <TabsContent value="api-mapping" className="space-y-4">
                <ApiKeyMappingSettings />
              </TabsContent>

              <TabsContent value="connections" className="space-y-4">
                <ConnectionsSettings />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
