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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DashboardLayoutProps {
  children: ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
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
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Impossibile disconnettersi.",
      });
    } else {
      toast({
        title: "Disconnesso",
        description: "Sei stato disconnesso con successo.",
      });
      navigate("/auth");
    }
  };

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/practices", icon: FileText, label: "Pratiche" },
    { path: "/upload", icon: Upload, label: "Carica Pratica" },
    { path: "/clients", icon: Users, label: "Clienti" },
    { path: "/expiry", icon: Calendar, label: "Scadenzario" },
    { path: "/reports", icon: BarChart3, label: "Report" },
    { path: "/questionnaires", icon: ClipboardList, label: "Questionari" },
    { path: "/vies", icon: ShieldCheck, label: "VIES" },
    { path: "/administration", icon: Euro, label: "Amministrazione" },
    { path: "/settings", icon: Settings, label: "Impostazioni" },
  ];

  const visibleNavItems = navItems.filter((item) => item.path !== "/vies" || canAccessVies);

  const adminNavItems = [
    { path: "/user-management", icon: UserCog, label: "Gestione Utenti" },
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

        <nav className="space-y-2 p-4 pb-24">
          {visibleNavItems.map((item) => {
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

          {isAdmin && (
            <>
              <div className="pt-4 pb-2">
                <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Amministrazione
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

        <div className="absolute bottom-0 left-0 right-0 border-t border-border bg-card p-4">
          <Button 
            variant="ghost" 
            className="h-auto min-h-10 w-full justify-start whitespace-normal text-left text-muted-foreground hover:text-foreground"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4 shrink-0" />
            <span>Esci</span>
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
