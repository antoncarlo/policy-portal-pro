import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getMessages, useMessages } from "@/i18n";
import { shellMessages } from "@/i18n/messages/shell";
import { commonMessages } from "@/i18n/messages/common";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const m = useMessages(shellMessages).login;
  const common = useMessages(commonMessages);

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

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
    } else {
      toast({
        title: login.successTitle,
        description: login.successDescription,
      });
    }
  };

  return (
    <div className="relative min-h-screen bg-background flex items-center justify-center p-4">
      <LanguageSwitcher className="absolute right-4 top-4" />
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <img src="/logo.svg" alt="Tecno Advance MGA" className="h-16" />
        </div>

        <Card className="p-6">
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
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
