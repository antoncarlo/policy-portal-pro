import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { SecuritySettings } from "@/components/settings/SecuritySettings";
import { PreferencesSettings } from "@/components/settings/PreferencesSettings";
import { CollaboratorsSettings } from "@/components/settings/CollaboratorsSettings";
import { PracticeTemplatesSettings } from "@/components/settings/PracticeTemplatesSettings";
import { SystemSettings } from "@/components/settings/admin/SystemSettings";
import { PortalStatistics } from "@/components/settings/admin/PortalStatistics";
import { ActivityLogs } from "@/components/settings/admin/ActivityLogs";
import { User, Lock, Settings2, Users, FileText, Shield, BarChart3, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Settings = () => {
  const [activeTab, setActiveTab] = useState("profile");
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
          <h1 className="text-3xl font-bold text-foreground">Impostazioni</h1>
          <p className="text-muted-foreground mt-1">
            Gestisci il tuo account e le preferenze
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className={`grid w-full ${showAdminTabs ? 'grid-cols-8' : showAgentTabs ? 'grid-cols-5' : 'grid-cols-3'} lg:w-auto lg:inline-grid`}>
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profilo</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              <span className="hidden sm:inline">Sicurezza</span>
            </TabsTrigger>
            <TabsTrigger value="preferences" className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              <span className="hidden sm:inline">Preferenze</span>
            </TabsTrigger>
            
            {showAgentTabs && (
              <>
                <TabsTrigger value="collaborators" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Collaboratori</span>
                </TabsTrigger>
                <TabsTrigger value="templates" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Pratiche</span>
                </TabsTrigger>
              </>
            )}
            
            {showAdminTabs && (
              <>
                <TabsTrigger value="system" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  <span className="hidden sm:inline">Sistema</span>
                </TabsTrigger>
                <TabsTrigger value="statistics" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Statistiche</span>
                </TabsTrigger>
                <TabsTrigger value="logs" className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  <span className="hidden sm:inline">Log</span>
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <ProfileSettings />
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            <SecuritySettings />
          </TabsContent>

          <TabsContent value="preferences" className="space-y-4">
            <PreferencesSettings />
          </TabsContent>

          {showAgentTabs && (
            <>
              <TabsContent value="collaborators" className="space-y-4">
                <CollaboratorsSettings />
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
            </>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
