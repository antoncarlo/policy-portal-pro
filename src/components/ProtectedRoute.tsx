import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useMessages } from "@/i18n";
import { commonMessages } from "@/i18n/messages/common";
import { getMfaGate } from "@/lib/mfa";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Pagine che servono proprio per completare la verifica in due passaggi (non possono richiederla). */
  skipMfaGate?: boolean;
}

export const ProtectedRoute = ({ children, skipMfaGate = false }: ProtectedRouteProps) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const common = useMessages(commonMessages);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let active = true;

    // Sessione valida e, se serve, verifica in due passaggi completata (aal2).
    const checkAccess = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      if (!session) {
        navigate("/auth");
        setLoading(false);
        return;
      }
      if (!skipMfaGate) {
        try {
          const gate = await getMfaGate(session.user.id);
          if (!active) return;
          if (gate === "challenge") {
            navigate("/auth"); // il codice dell'app si chiede nella pagina di accesso
            setLoading(false);
            return;
          }
          if (gate === "enroll") {
            navigate("/mfa-setup");
            setLoading(false);
            return;
          }
        } catch {
          // Controllo non riuscito: per sicurezza non si mostra la pagina
          navigate("/auth");
          setLoading(false);
          return;
        }
      }
      setAuthenticated(true);
      setLoading(false);
    };

    void checkAccess();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        navigate("/auth");
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [navigate, skipMfaGate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">{common.loading}</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }

  return <>{children}</>;
};
