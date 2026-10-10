import { useNavigate } from "react-router-dom";
import { AuthShell } from "@/components/auth/AuthShell";
import { NewPasswordForm } from "@/components/auth/NewPasswordForm";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getMessages, useMessages } from "@/i18n";
import { commonMessages } from "@/i18n/messages/common";
import { passwordMessages } from "@/i18n/messages/passwords";
import { supabase } from "@/integrations/supabase/client";
import { callPortalAction } from "@/lib/portalActions";
import { currentSessionEmail, signInAfterPasswordChange } from "@/lib/passwordSession";

/** Primo accesso con la password provvisoria data dall'amministratore: va sostituita prima di entrare nel portale. */
const ChangePassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const m = useMessages(passwordMessages).change;

  const submit = async (password: string) => {
    const email = await currentSessionEmail();
    await callPortalAction("set_password", { password });
    const stillSignedIn = await signInAfterPasswordChange(email, password); // la vecchia sessione e' stata annullata dal cambio
    toast({ title: getMessages(commonMessages).success, description: getMessages(passwordMessages).reset.done });
    navigate(stillSignedIn ? "/dashboard" : "/auth", { replace: true });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <AuthShell title={m.title} subtitle={m.text}>
      <div className="space-y-3">
        <NewPasswordForm onSubmit={submit} />
        <Button variant="ghost" className="w-full" onClick={signOut}>
          {m.signOut}
        </Button>
      </div>
    </AuthShell>
  );
};

export default ChangePassword;
