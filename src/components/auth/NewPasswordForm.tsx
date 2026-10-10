import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMessages, useMessages } from "@/i18n";
import { passwordMessages } from "@/i18n/messages/passwords";
import { settingsMessages } from "@/i18n/messages/settings";
import { checkPassword } from "@/lib/passwordPolicy";

interface NewPasswordFormProps {
  /** Salva la password. Se lancia un errore, il messaggio (o il codice del server) viene mostrato sotto i campi. */
  onSubmit: (password: string) => Promise<void>;
  /** Errore da mostrare perche' arrivato da un passaggio successivo (es. dopo il codice dell'app). */
  externalError?: string | null;
}

/** Nuova password con conferma e regole del portale (minimo 12 caratteri, una maiuscola, un numero). */
export const NewPasswordForm = ({ onSubmit, externalError = null }: NewPasswordFormProps) => {
  const m = useMessages(passwordMessages).form;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const rules = getMessages(settingsMessages).security;
    const problem = checkPassword(password);
    if (problem) return setError(rules[problem]);
    if (password !== confirm) return setError(rules.mismatch);
    setError(null);
    setSaving(true);
    try {
      await onSubmit(password);
    } catch (e) {
      const code = (e as { code?: string } | null)?.code;
      setError(
        code === "same_password" ? getMessages(passwordMessages).form.sameAsCurrent
        : code === "weak_password" ? getMessages(passwordMessages).form.rules
        : e instanceof Error ? e.message : getMessages(passwordMessages).forgot.error,
      );
    } finally {
      setSaving(false);
    }
  };

  const shown = error ?? externalError;
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="new-password">{m.newPassword}</Label>
        <div className="relative">
          <Input
            id="new-password"
            type={visible ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className="pr-10"
            required
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
            onClick={() => setVisible((value) => !value)}
            aria-label={visible ? m.hide : m.show}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{m.rules}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">{m.confirmPassword}</Label>
        <Input
          id="confirm-password"
          type={visible ? "text" : "password"}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
        />
      </div>
      {shown && (
        <p className="text-sm text-destructive" role="alert">
          {shown}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {saving ? m.submitting : m.submit}
      </Button>
    </form>
  );
};
