import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Monitor, Smartphone, Tablet, LogOut, Shield } from "lucide-react";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Session {
  id: string;
  user_agent: string;
  ip_address: string;
  last_active: string;
  is_current: boolean;
}

export const SessionsSettings = () => {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLogoutAll, setShowLogoutAll] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    try {
      // Get current session
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      // In a real implementation, you would fetch sessions from a sessions table
      // For now, we'll show the current session as an example
      const mockSessions: Session[] = [
        {
          id: "current",
          user_agent: navigator.userAgent,
          ip_address: "Current Device",
          last_active: new Date().toISOString(),
          is_current: true,
        },
      ];

      setSessions(mockSessions);
    } catch (error: any) {
      console.error("Error loading sessions:", error);
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Impossibile caricare le sessioni",
      });
    } finally {
      setLoading(false);
    }
  };

  const getDeviceIcon = (userAgent: string) => {
    const ua = userAgent.toLowerCase();
    if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
      return <Smartphone className="h-5 w-5" />;
    } else if (ua.includes("tablet") || ua.includes("ipad")) {
      return <Tablet className="h-5 w-5" />;
    }
    return <Monitor className="h-5 w-5" />;
  };

  const getDeviceName = (userAgent: string) => {
    const ua = userAgent.toLowerCase();
    if (ua.includes("chrome")) return "Chrome Browser";
    if (ua.includes("firefox")) return "Firefox Browser";
    if (ua.includes("safari")) return "Safari Browser";
    if (ua.includes("edge")) return "Edge Browser";
    return "Browser Sconosciuto";
  };

  const getOS = (userAgent: string) => {
    const ua = userAgent.toLowerCase();
    if (ua.includes("windows")) return "Windows";
    if (ua.includes("mac")) return "macOS";
    if (ua.includes("linux")) return "Linux";
    if (ua.includes("android")) return "Android";
    if (ua.includes("ios") || ua.includes("iphone") || ua.includes("ipad")) return "iOS";
    return "Sistema Sconosciuto";
  };

  const handleLogoutSession = async (sessionId: string) => {
    try {
      if (sessionId === "current") {
        // Logout current session
        await supabase.auth.signOut();
        window.location.href = "/";
      } else {
        // In a real implementation, you would revoke the specific session
        toast({
          title: "Successo",
          description: "Sessione terminata",
        });
        loadSessions();
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message,
      });
    }
  };

  const handleLogoutAll = async () => {
    try {
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message,
      });
    }
  };

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Sessioni Attive</h2>
          </div>
          {sessions.length > 1 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowLogoutAll(true)}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Termina Tutte
            </Button>
          )}
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          Gestisci i dispositivi che hanno effettuato l'accesso al tuo account. Per sicurezza, termina le sessioni che non riconosci.
        </p>

        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Caricamento sessioni...
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nessuna sessione attiva
            </div>
          ) : (
            sessions.map((session) => (
              <Card key={session.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <div className="p-3 bg-muted rounded-lg">
                      {getDeviceIcon(session.user_agent)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{getDeviceName(session.user_agent)}</h3>
                        {session.is_current && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                            Sessione Corrente
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {getOS(session.user_agent)} • {session.ip_address}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Ultimo accesso: {format(new Date(session.last_active), "dd/MM/yyyy HH:mm")}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleLogoutSession(session.id)}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    {session.is_current ? "Esci" : "Termina"}
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h3 className="font-semibold mb-2">Suggerimenti per la Sicurezza</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Termina le sessioni che non riconosci immediatamente</li>
            <li>• Non condividere mai le tue credenziali di accesso</li>
            <li>• Usa sempre una password forte e unica</li>
            <li>• Esci sempre quando usi dispositivi condivisi</li>
          </ul>
        </div>
      </Card>

      <AlertDialog open={showLogoutAll} onOpenChange={setShowLogoutAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminare tutte le sessioni?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione terminerà tutte le sessioni attive, inclusa quella corrente. Dovrai effettuare nuovamente l'accesso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogoutAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Termina Tutte
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
