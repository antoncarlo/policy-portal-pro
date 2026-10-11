import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Shield,
  LayoutDashboard,
  FileText,
  Upload,
  Users,
  Settings,
  LogOut,
  UserCog,
  Euro,
  Calendar,
  BarChart3,
  ClipboardList,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useMessages } from "@/i18n";
import { commonMessages } from "@/i18n/messages/common";
import { shellMessages } from "@/i18n/messages/shell";
import { workflowMessages } from "@/i18n/messages/workflow";
import { usePracticeStageCounts } from "@/hooks/usePracticeStageCounts";
import { PracticeLotsMenu } from "@/components/dashboard/PracticeLotsMenu";
import { recordSessionEvent } from "@/lib/audit";
import { PRACTICE_STAGES, isPracticeStage } from "@/lib/practiceStages";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const m = useMessages(shellMessages);
  const common = useMessages(commonMessages);
  const flow = useMessages(workflowMessages);
  const { data: stageCounts } = usePracticeStageCounts();
  const [isAdmin, setIsAdmin] = useState(false);
  const [canAccessVies, setCanAccessVies] = useState(false);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .maybeSingle();

    const isAdminUser = !!roleData;
    setIsAdmin(isAdminUser);

    if (isAdminUser) {
      setCanAccessVies(true);
      return;
    }

    const { data: viesPermission } = await supabase
      .from("user_product_permissions")
      .select("practice_type")
      .eq("user_id", session.user.id)
      .eq("practice_type", "vies")
      .maybeSingle();

    setCanAccessVies(!!viesPermission);
  };

  const handleLogout = async () => {
    // The line goes to the audit log while the session still exists.
    await recordSessionEvent("logout");
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      toast({
        variant: "destructive",
        title: common.error,
        description: m.logout.errorDescription,
      });
    } else {
      toast({
        title: m.logout.title,
        description: m.logout.description,
      });
      navigate("/auth");
    }
  };

  const isActive = (path: string) => location.pathname === path;

  // "Pratiche" opens into its sections; the section in use comes from the address.
  const onPractices = location.pathname === "/practices" || location.pathname.startsWith("/practices/");
  const [practicesOpen, setPracticesOpen] = useState(onPractices);
  useEffect(() => {
    if (onPractices) setPracticesOpen(true);
  }, [onPractices]);
  const stageParam = new URLSearchParams(location.search).get("stage");
  const activeStage = location.pathname === "/practices" && isPracticeStage(stageParam) ? stageParam : null;

  const navItems = [
    { path: "/dashboard", icon: LayoutDashboard, label: m.nav.dashboard },
    { path: "/practices", icon: FileText, label: m.nav.practices },
    { path: "/upload", icon: Upload, label: m.nav.upload },
    { path: "/clients", icon: Users, label: m.nav.clients },
    { path: "/expiry", icon: Calendar, label: m.nav.expiry },
    { path: "/reports", icon: BarChart3, label: m.nav.reports },
    { path: "/questionnaires", icon: ClipboardList, label: m.nav.questionnaires },
    { path: "/vies", icon: ShieldCheck, label: m.nav.vies },
    { path: "/administration", icon: Euro, label: m.nav.administration },
    { path: "/settings", icon: Settings, label: m.nav.settings },
  ];

  // VIES solo a chi ha il prodotto; Questionari solo agli amministratori.
  const visibleNavItems = navItems.filter(
    (item) => (item.path !== "/vies" || canAccessVies) && (item.path !== "/questionnaires" || isAdmin),
  );

  const adminNavItems = [
    { path: "/user-management", icon: UserCog, label: m.nav.userManagement },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed h-full w-64 overflow-y-auto border-r border-border bg-card">
        <div className="p-6 border-b border-border">
          <Link to="/" className="flex items-center justify-center">
            <img src="/logo.svg" alt="Tecno Advance MGA" className="h-12" />
          </Link>
        </div>

        <nav className="space-y-2 p-4 pb-36">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            if (item.path === "/practices") {
              return (
                <div key={item.path}>
                  <div className="flex items-stretch gap-1">
                    <Link to={item.path} className="min-w-0 flex-1">
                      <Button
                        variant={onPractices && !activeStage ? "secondary" : "ghost"}
                        className="h-auto min-h-10 w-full justify-start whitespace-normal text-left leading-snug"
                      >
                        <Icon className="mr-2 h-4 w-4 shrink-0" />
                        <span className="min-w-0 break-words">{item.label}</span>
                        {stageCounts && <span className="ml-auto pl-2 text-xs tabular-nums text-muted-foreground">{stageCounts.total}</span>}
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-auto min-h-10 w-9 shrink-0"
                      aria-label={flow.tabs.menuLabel}
                      aria-expanded={practicesOpen}
                      onClick={() => setPracticesOpen((open) => !open)}
                    >
                      <ChevronDown className={cn("h-4 w-4 transition-transform", practicesOpen && "rotate-180")} />
                    </Button>
                  </div>
                  {practicesOpen && (
                    <div role="group" aria-label={flow.tabs.menuLabel} className="ml-5 mt-1 space-y-0.5 border-l border-border pl-2">
                      {PRACTICE_STAGES.map((stage) => {
                        const count = stageCounts?.counts[stage];
                        const dueSoon = stage === "deliberata" ? stageCounts?.dueSoon ?? 0 : 0;
                        return (
                          <Link key={stage} to={`/practices?stage=${stage}`}>
                            <Button
                              variant={activeStage === stage ? "secondary" : "ghost"}
                              size="sm"
                              className="h-auto min-h-8 w-full justify-start whitespace-normal py-1.5 text-left text-[13px] font-normal leading-snug"
                            >
                              <span className="min-w-0 break-words">{flow.stages[stage]}</span>
                              <span className="ml-auto flex shrink-0 items-center gap-1.5 pl-2">
                                {dueSoon > 0 && (
                                  <span
                                    className="rounded-full bg-amber-500/20 px-1.5 text-[11px] font-semibold tabular-nums text-amber-600 dark:text-amber-400"
                                    title={flow.tabs.dueSoon(dueSoon)}
                                  >
                                    {dueSoon}
                                  </span>
                                )}
                                {count !== undefined && <span className="text-xs tabular-nums text-muted-foreground">{count}</span>}
                              </span>
                            </Button>
                          </Link>
                        );
                      })}
                      <PracticeLotsMenu open={practicesOpen} />
                    </div>
                  )}
                </div>
              );
            }
            return (
              <Link key={item.path} to={item.path}>
                <Button
                  variant={isActive(item.path) ? "secondary" : "ghost"}
                  className="h-auto min-h-10 w-full justify-start whitespace-normal text-left leading-snug"
                >
                  <Icon className="mr-2 h-4 w-4 shrink-0" />
                  <span className="min-w-0 break-words">{item.label}</span>
                </Button>
              </Link>
            );
          })}

          {isAdmin && (
            <>
              <div className="pt-4 pb-2">
                <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {m.nav.adminSection}
                </p>
              </div>
              {adminNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.path} to={item.path}>
                    <Button
                      variant={isActive(item.path) ? "secondary" : "ghost"}
                      className="h-auto min-h-10 w-full justify-start whitespace-normal text-left leading-snug"
                    >
                      <Icon className="mr-2 h-4 w-4 shrink-0" />
                      <span className="min-w-0 break-words">{item.label}</span>
                    </Button>
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 space-y-2 border-t border-border bg-card p-4">
          <LanguageSwitcher className="w-full justify-start" align="start" />
          <Button 
            variant="ghost" 
            className="h-auto min-h-10 w-full justify-start whitespace-normal text-left text-muted-foreground hover:text-foreground"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4 shrink-0" />
            <span>{m.nav.logout}</span>
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 min-w-0 flex-1">
        <div className="w-full max-w-full overflow-x-hidden p-8">{children}</div>
      </main>
    </div>
  );
};
