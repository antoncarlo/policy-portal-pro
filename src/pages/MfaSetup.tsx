import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { MfaEnroll } from "@/components/auth/MfaEnroll";
import { useMessages } from "@/i18n";
import { mfaMessages } from "@/i18n/messages/mfa";
import { supabase } from "@/integrations/supabase/client";
import { getMfaGate } from "@/lib/mfa";

/** Configurazione obbligatoria della verifica in due passaggi (account amministratore senza fattore). */
const MfaSetup = () => {
  const navigate = useNavigate();
  const m = useMessages(mfaMessages).forced;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return navigate("/auth");
      const gate = await getMfaGate(session.user.id);
      if (!active) return;
      if (gate === "challenge") return navigate("/auth");
      if (gate === "ok") return navigate("/dashboard");
      setReady(true);
    })().catch(() => navigate("/auth"));
    return () => {
      active = false;
    };
  }, [navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (!ready) return null;

  return (
    <div className="relative min-h-screen bg-background flex items-center justify-center p-4">
      <LanguageSwitcher className="absolute right-4 top-4" />
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <img src="/logo.svg" alt="Tecno Advance MGA" className="h-16" />
        </div>
        <Card className="space-y-4 p-6">
          <div className="text-center">
            <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-primary" />
            <h2 className="text-2xl font-bold text-foreground">{m.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{m.text}</p>
          </div>
          <MfaEnroll autoStart onDone={() => navigate("/dashboard")} />
        </Card>
        <Button variant="ghost" className="w-full" onClick={signOut}>
          {m.signOut}
        </Button>
      </div>
    </div>
  );
};

export default MfaSetup;
