import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useMessages } from "@/i18n";
import { commonMessages } from "@/i18n/messages/common";
import { getMfaGate } from "@/lib/mfa";
import { mustChangePassword } from "@/lib/passwordPolicy";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Pagina per cambiare la password provvisoria: non puo' rimandare a se stessa. */
  skipPasswordGate?: boolean;
}

export const ProtectedRoute = ({ children, skipPasswordGate = false }: ProtectedRouteProps) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const common = useMessages(commonMessages);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let active = true;

    // Sessione valida, codice dell'app inserito (se l'utente l'ha attivata) e password non provvisoria.
    const checkAccess = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      if (!session) {
        navigate("/auth");
        setLoading(false);
        return;
      }
      try {
        if ((await getMfaGate()) === "challenge") {
          if (!active) return;
          navigate("/auth"); // il codice dell'app si chiede nella pagina di accesso
          setLoading(false);
          return;
        }
      } catch {
        // Controllo non riuscito: per sicurezza non si mostra la pagina
        if (!active) return;
        navigate("/auth");
        setLoading(false);
        return;
      }
      if (!active) return;
      if (!skipPasswordGate && mustChangePassword(session.user)) {
        navigate("/change-password");
        setLoading(false);
        return;
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
  }, [navigate, skipPasswordGate]);

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
