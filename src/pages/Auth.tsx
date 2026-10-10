import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getMessages, useMessages } from "@/i18n";
import { shellMessages } from "@/i18n/messages/shell";
import { commonMessages } from "@/i18n/messages/common";
import { passwordMessages } from "@/i18n/messages/passwords";
import { MfaChallenge } from "@/components/auth/MfaChallenge";
import { getMfaGate } from "@/lib/mfa";
import { mustChangePassword } from "@/lib/passwordPolicy";

// Documenti pubblicati sul sito della società
const PRIVACY_URL = "https://tecnomga.com/wp-content/uploads/2025/12/Informativaprivacytecno-1_1.pdf";
const TERMS_URL = "https://tecnomga.com/wp-content/uploads/2025/12/terms-and-conditions.pdf";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  // "credentials": email e password; "mfa": codice dell'app di autenticazione (secondo passo)
  const [stage, setStage] = useState<"credentials" | "mfa">("credentials");
  const routing = useRef(false);
  const m = useMessages(shellMessages).login;
  const common = useMessages(commonMessages);
  const forgotLink = useMessages(passwordMessages).forgot.link;

  // Dopo l'accesso decide dove andare: codice dell'app, cambio della password provvisoria o portale.
  const routeAfterAuth = useCallback(
    async (user: User) => {
      if (routing.current) return;
      routing.current = true;
      try {
        if ((await getMfaGate()) === "challenge") setStage("mfa");
        else navigate(mustChangePassword(user) ? "/change-password" : "/dashboard");
      } catch {
        // Se il controllo non e' possibile non si entra nel portale: si resta sull'accesso
        setStage("credentials");
      } finally {
        routing.current = false;
      }
    },
    [navigate],
  );

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) void routeAfterAuth(session.user);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setStage("credentials");
        return;
      }
      // MFA_CHALLENGE_VERIFIED: la sessione e' diventata aal2, si puo' entrare.
      // Non si chiamano altri metodi di Supabase dentro il listener (blocco della libreria): si rimanda.
      if (session && (event === "SIGNED_IN" || event === "MFA_CHALLENGE_VERIFIED")) {
        const user = session.user;
        setTimeout(() => void routeAfterAuth(user), 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [routeAfterAuth]);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("signin-email") as string;
    const password = formData.get("signin-password") as string;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    const login = getMessages(shellMessages).login;
    if (error) {
      toast({
        variant: "destructive",
        title: login.errorTitle,
        description: error.message === "Invalid login credentials"
          ? login.invalidCredentials
          : error.message,
      });
    }
    // In caso di successo ci pensa onAuthStateChange: codice dell'app oppure ingresso nel portale
  };

  const handleMfaVerified = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) await routeAfterAuth(session.user);
  };

  const handleMfaSignOut = async () => {
    await supabase.auth.signOut();
    setStage("credentials");
  };

  return (
    <div className="relative min-h-screen bg-background flex items-center justify-center p-4">
      <LanguageSwitcher className="absolute right-4 top-4" />
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <img src="/logo.svg" alt="Tecno Advance MGA" className="h-16" />
        </div>

        <Card className="p-6">
          {stage === "mfa" ? (
            <MfaChallenge onVerified={handleMfaVerified} onSignOut={handleMfaSignOut} />
          ) : (
            <>
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-foreground">{m.title}</h2>
            <p className="text-muted-foreground mt-2">
              {m.subtitle}
            </p>
          </div>

          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signin-email">{common.email}</Label>
              <Input
                id="signin-email"
                name="signin-email"
                type="email"
                placeholder={m.emailPlaceholder}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signin-password">{common.password}</Label>
              <Input
                id="signin-password"
                name="signin-password"
                type="password"
                placeholder="••••••••"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? m.submitting : m.submit}
            </Button>
            <p className="text-center text-sm">
              <Link to="/forgot-password" className="text-muted-foreground underline hover:text-foreground">
                {forgotLink}
              </Link>
            </p>
          </form>
            </>
          )}
        </Card>

        <div className="mt-6 space-y-2 text-center text-xs text-muted-foreground">
          <p>{m.storageNotice}</p>
          <p className="space-x-3">
            <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              {m.privacy}
            </a>
            <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              {m.terms}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
