import { useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { MailX } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { MfaChallenge } from "@/components/auth/MfaChallenge";
import { NewPasswordForm } from "@/components/auth/NewPasswordForm";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getMessages, useMessages } from "@/i18n";
import { commonMessages } from "@/i18n/messages/common";
import { passwordMessages } from "@/i18n/messages/passwords";
import { supabase } from "@/integrations/supabase/client";
import { getMfaGate } from "@/lib/mfa";
import { callPortalAction } from "@/lib/portalActions";
import { refreshAfterPasswordChange } from "@/lib/passwordSession";

type Stage = "form" | "mfa" | "invalid";

/**
 * Pagina del link dell'email (benvenuto o password dimenticata): "?token_hash=...&type=recovery".
 * Il link si consuma solo quando l'utente invia la nuova password, cosi' un'anteprima automatica
 * dell'email non lo brucia. Chi ha attivato l'app di autenticazione inserisce anche il codice.
 */
const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params] = useSearchParams();
  const tokenHash = params.get("token_hash");
  const welcome = params.get("kind") === "welcome";
  const m = useMessages(passwordMessages);
  const [stage, setStage] = useState<Stage>(tokenHash ? "form" : "invalid");
  const [error, setError] = useState<string | null>(null);
  const verified = useRef(false);
  const pending = useRef("");

  const finish = async (password: string) => {
    await callPortalAction("set_password", { password });
    const stillSignedIn = await refreshAfterPasswordChange(); // la sessione riceve il flag aggiornato
    toast({ title: getMessages(commonMessages).success, description: getMessages(passwordMessages).reset.done });
    navigate(stillSignedIn ? "/dashboard" : "/auth", { replace: true });
  };

  const submit = async (password: string) => {
    setError(null);
    if (!verified.current) {
      const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash ?? "", type: "recovery" });
      if (verifyError) {
        setStage("invalid");
        return;
      }
      verified.current = true;
    }
    if ((await getMfaGate()) === "challenge") {
      pending.current = password;
      setStage("mfa");
      return;
    }
    await finish(password);
  };

  const afterCode = async () => {
    setStage("form");
    try {
      await finish(pending.current);
    } catch (e) {
      const code = (e as { code?: string } | null)?.code;
      setError(code === "same_password" ? getMessages(passwordMessages).form.sameAsCurrent : e instanceof Error ? e.message : null);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (stage === "invalid") {
    return (
      <AuthShell title={m.reset.invalidTitle}>
        <div className="space-y-4 text-center">
          <MailX className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{m.reset.invalidText}</p>
          <Button asChild className="w-full">
            <Link to="/forgot-password">{m.reset.requestNew}</Link>
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link to="/auth">{m.forgot.back}</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  if (stage === "mfa") {
    return (
      <AuthShell title="">
        <MfaChallenge onVerified={afterCode} onSignOut={signOut} />
      </AuthShell>
    );
  }

  return (
    <AuthShell title={welcome ? m.reset.welcomeTitle : m.reset.resetTitle} subtitle={welcome ? m.reset.welcomeSubtitle : m.reset.resetSubtitle}>
      <NewPasswordForm onSubmit={submit} externalError={error} />
    </AuthShell>
  );
};

export default ResetPassword;
