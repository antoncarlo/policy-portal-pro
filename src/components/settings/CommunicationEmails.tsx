import { useEffect, useState } from "react";
import { Loader2, Mail, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getMessages, useMessages } from "@/i18n";
import { myWorkMessages } from "@/i18n/messages/myWork";

const MAX_ADDRESSES = 3;
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/**
 * Le e-mail di comunicazione dell'utente (massimo 3): gli avvisi del portale arrivano qui; senza indirizzi
 * si usa l'e-mail di accesso. L'utente cambia solo gli indirizzi: gli eventi li sceglie l'amministratore.
 */
export const CommunicationEmails = () => {
  const m = useMessages(myWorkMessages).emails;
  const { toast } = useToast();
  const [addresses, setAddresses] = useState<string[]>([]);
  const [loginEmail, setLoginEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      setLoginEmail(user.email ?? "");
      const { data } = await supabase.from("user_notification_settings").select("notification_emails").eq("user_id", user.id).maybeSingle();
      if (!cancelled) setAddresses(data?.notification_emails ?? []);
    })()
      .catch(() => undefined)
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const change = (index: number, value: string) => {
    setError(null);
    setAddresses((current) => current.map((address, position) => (position === index ? value : address)));
  };

  const save = async () => {
    const text = getMessages(myWorkMessages).emails;
    const clean = [...new Set(addresses.map((address) => address.trim().toLowerCase()).filter(Boolean))];
    if (clean.length > MAX_ADDRESSES) return setError(text.tooMany);
    if (clean.some((address) => !EMAIL.test(address))) return setError(text.invalid);
    setSaving(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("set_my_notification_emails", { p_emails: clean });
      if (rpcError) throw new Error(rpcError.message);
      setAddresses(data ?? clean);
      toast({ title: text.saved, description: text.savedText((data ?? clean).length) });
    } catch (failure) {
      toast({ variant: "destructive", title: text.error, description: failure instanceof Error ? failure.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6" data-testid="communication-emails">
      <div className="mb-1 flex items-center gap-2">
        <Mail className="h-5 w-5" />
        <h2 className="text-xl font-semibold">{m.title}</h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{m.intro}</p>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <div className="space-y-2">
          {addresses.map((address, index) => (
            <div key={index} className="flex gap-2">
              <Input
                type="email"
                value={address}
                placeholder={m.placeholder}
                maxLength={254}
                aria-label={`${m.title} ${index + 1}`}
                onChange={(event) => change(index, event.target.value)}
                data-testid={`comm-email-${index}`}
              />
              <Button type="button" variant="ghost" size="icon" aria-label={m.remove} onClick={() => setAddresses((current) => current.filter((_, position) => position !== index))}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {addresses.length === 0 && loginEmail && <p className="text-sm text-muted-foreground">{m.loginAddress(loginEmail)}</p>}
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            {addresses.length < MAX_ADDRESSES && (
              <Button type="button" variant="outline" size="sm" onClick={() => setAddresses((current) => [...current, ""])} data-testid="comm-email-add">
                <Plus className="mr-1.5 h-4 w-4" />
                {m.add}
              </Button>
            )}
            <Button type="button" size="sm" disabled={saving} onClick={() => void save()} data-testid="comm-email-save">
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {m.save}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};
