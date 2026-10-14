import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/use-media-query";
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
  Menu,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useMessages } from "@/i18n";
import { commonMessages } from "@/i18n/messages/common";
import { shellMessages } from "@/i18n/messages/shell";
import { workflowMessages } from "@/i18n/messages/workflow";
import { usePracticeStageCounts } from "@/hooks/usePracticeStageCounts";
import { useExpiryAlert } from "@/hooks/useExpiryAlert";
import { PracticeLotsMenu } from "@/components/dashboard/PracticeLotsMenu";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { recordSessionEvent } from "@/lib/audit";
import { PRACTICE_STAGES, isPracticeStage } from "@/lib/practiceStages";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
}

const NAV_ITEM = "rounded-xl";

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const m = useMessages(shellMessages);
  const common = useMessages(commonMessages);
  const flow = useMessages(workflowMessages);
  const { data: stageCounts } = usePracticeStageCounts();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [menuOpen, setMenuOpen] = useState(false);
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

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search, isDesktop]);

  const isActive = (path: string) => location.pathname === path;

  // "Pratiche" opens into its sections; the section in use comes from the address.
  const onPractices = location.pathname === "/practices" || location.pathname.startsWith("/practices/");
  const [practicesOpen, setPracticesOpen] = useState(onPractices);
  useEffect(() => {
    if (onPractices) setPracticesOpen(true);
  }, [onPractices]);
  const stageParam = new URLSearchParams(location.search).get("stage");
  const activeStage = location.pathname === "/practices" && isPracticeStage(stageParam) ? stageParam : null;

  const expiringSoon = useExpiryAlert().data ?? 0;

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

  // The same menu in two places: fixed at the side from 1024 px up (PC, iPad landscape), a drawer opened
  // from a top bar below it (phones, iPad portrait). The links close the drawer.
  const renderPanel = ({ withBell, onNavigate }: { withBell: boolean; onNavigate?: (event: React.MouseEvent) => void }) => (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative shrink-0 border-b border-border p-6">
        <Link to="/" className="flex items-center justify-center">
          <img src="/logo.svg" alt="Tecno Advance MGA" className="h-12" />
        </Link>
        {withBell && (
          <div className="absolute right-2 top-2">
            <NotificationBell />
          </div>
        )}
      </div>

        <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-4" onClick={onNavigate}>
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            if (item.path === "/practices") {
              return (
                <div key={item.path}>
                  <div className="flex items-stretch gap-1">
                    <Link to={item.path} className="min-w-0 flex-1">
                      <Button
                        variant={onPractices && !activeStage ? "secondary" : "ghost"}
                        className={cn(NAV_ITEM, "h-auto min-h-10 w-full justify-start whitespace-normal text-left leading-snug")}
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
                  className={cn(NAV_ITEM, "h-auto min-h-10 w-full justify-start whitespace-normal text-left leading-snug")}
                >
                  <Icon className="mr-2 h-4 w-4 shrink-0" />
                  <span className="min-w-0 break-words">{item.label}</span>
                  {item.path === "/expiry" && expiringSoon > 0 && (
                    <span
                      className="ml-auto shrink-0 rounded-full bg-destructive px-1.5 text-[11px] font-semibold tabular-nums text-destructive-foreground"
                      title={m.nav.expiryAlert(expiringSoon)}
                      aria-label={m.nav.expiryAlert(expiringSoon)}
                      data-testid="nav-expiry-alert"
                    >
                      {expiringSoon}
                    </span>
                  )}
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
                      className={cn(NAV_ITEM, "h-auto min-h-10 w-full justify-start whitespace-normal text-left leading-snug")}
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

        <div className="shrink-0 space-y-2 border-t border-border bg-transparent p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {isDesktop ? (
        <aside data-testid="sidebar" className="fixed inset-y-0 left-0 z-30 w-64 border-r border-white/70 bg-white/35 shadow-[8px_0_40px_-24px_rgba(15,58,92,0.35)] backdrop-blur-2xl dark:border-white/10">
          {renderPanel({ withBell: true })}
        </aside>
      ) : (
        <>
          <header
            data-testid="mobile-header"
            className="fixed inset-x-0 top-0 z-40 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center gap-2 border-b border-white/70 bg-white/50 px-2 backdrop-blur-xl dark:border-white/10 pt-[env(safe-area-inset-top)]"
          >
            <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" data-testid="mobile-menu-button" aria-label={m.nav.menu} onClick={() => setMenuOpen(true)}>
              <Menu className="h-6 w-6" />
            </Button>
            <Link to="/dashboard" className="flex min-w-0 flex-1 items-center">
              <img src="/logo.svg" alt="Tecno Advance MGA" className="h-8 max-w-full" />
            </Link>
            <NotificationBell />
          </header>
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetContent side="left" aria-describedby={undefined} className="w-[18rem] max-w-[85vw] gap-0 p-0 sm:max-w-[18rem]" data-testid="mobile-menu">
              <SheetTitle className="sr-only">{m.nav.menu}</SheetTitle>
              {renderPanel({
                withBell: false,
                onNavigate: (event) => {
                  if ((event.target as HTMLElement).closest("a")) setMenuOpen(false);
                },
              })}
            </SheetContent>
          </Sheet>
        </>
      )}

      {/* Main Content */}
      <main className={cn("min-w-0 flex-1", isDesktop ? "ml-64" : "pt-[calc(3.5rem+env(safe-area-inset-top))]")}>
        <div className="w-full max-w-full p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
};
