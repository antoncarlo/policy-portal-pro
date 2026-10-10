import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getLanguage, useMessages } from "@/i18n";
import { commonMessages } from "@/i18n/messages/common";
import { passwordMessages } from "@/i18n/messages/passwords";
import { shellMessages } from "@/i18n/messages/shell";

/** Richiesta del link per scegliere una nuova password (la risposta e' sempre la stessa, l'indirizzo esista o no). */
const ForgotPassword = () => {
  const m = useMessages(passwordMessages).forgot;
  const login = useMessages(shellMessages).login;
  const common = useMessages(commonMessages);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), language: getLanguage() }),
      });
      if (response.status === 400) setError(m.invalidEmail);
      else if (response.status === 429) setError(m.tooMany);
      else if (!response.ok) setError(m.error);
      else setSent(true);
    } catch {
      setError(m.error);
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthShell title={sent ? m.sentTitle : m.title} subtitle={sent ? undefined : m.subtitle}>
      {sent ? (
        <div className="space-y-4 text-center">
          <MailCheck className="mx-auto h-10 w-10 text-primary" />
          <p className="text-sm text-muted-foreground">{m.sentText}</p>
          <Button asChild variant="outline" className="w-full">
            <Link to="/auth">{m.back}</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="forgot-email">{common.email}</Label>
            <Input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={login.emailPlaceholder}
              autoComplete="email"
              required
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={sending}>
            {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {sending ? m.submitting : m.submit}
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link to="/auth">{m.back}</Link>
          </Button>
        </form>
      )}
    </AuthShell>
  );
};

export default ForgotPassword;
