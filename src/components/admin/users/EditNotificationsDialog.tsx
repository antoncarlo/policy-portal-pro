import { useEffect, useState } from "react";
import { Loader2, Mail, Plus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getMessages, useMessages } from "@/i18n";
import { commonMessages } from "@/i18n/messages/common";
import { usersMessages } from "@/i18n/messages/users";
import { callPortalAction } from "@/lib/portalActions";

export const MAX_NOTIFICATION_EMAILS = 3;

interface NotificationUser {
  id: string;
  full_name: string;
  email: string;
}

interface EditNotificationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: NotificationUser | null;
}

type EventKey = "status_change" | "new_practice" | "documents" | "notes";
const EVENT_KEYS: EventKey[] = ["status_change", "new_practice", "documents", "notes"];
const DEFAULT_FLAGS: Record<EventKey, boolean> = { status_change: true, new_practice: true, documents: true, notes: true };

const EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/** The administrator chooses, for one user, where the portal's notification emails go and for which events. */
export const EditNotificationsDialog = ({ open, onOpenChange, user }: EditNotificationsDialogProps) => {
  const m = useMessages(usersMessages).notifications;
  const common = useMessages(commonMessages);
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [emails, setEmails] = useState<string[]>([]);
  const [flags, setFlags] = useState<Record<EventKey, boolean>>(DEFAULT_FLAGS);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    setLoading(true);
    setDirty(false);
    void (async () => {
      const { data, error } = await supabase
        .from("user_notification_settings")
        .select("notification_emails, status_change, new_practice, documents, notes")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        toast({ variant: "destructive", title: getMessages(commonMessages).error, description: getMessages(usersMessages).notifications.loadError });
        setEmails([]);
        setFlags(DEFAULT_FLAGS);
      } else {
        // No row yet: the defaults apply (sign-in email, every event on).
        setEmails(data?.notification_emails ?? []);
        setFlags({
          status_change: data?.status_change ?? true,
          new_practice: data?.new_practice ?? true,
          documents: data?.documents ?? true,
          notes: data?.notes ?? true,
        });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the dialog opens for a user
  }, [open, user?.id]);

  const changeEmails = (next: string[]) => {
    setEmails(next);
    setDirty(true);
  };

  const handleSave = async () => {
    if (!user) return;
    const cleaned = emails.map((address) => address.trim()).filter(Boolean);
    const invalid = cleaned.find((address) => !EMAIL_PATTERN.test(address));
    if (invalid) {
      toast({ variant: "destructive", title: getMessages(usersMessages).notifications.invalidTitle, description: getMessages(usersMessages).notifications.invalidText(invalid) });
      return;
    }
    const unique = [...new Set(cleaned.map((address) => address.toLowerCase()))].slice(0, MAX_NOTIFICATION_EMAILS);

    setSaving(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const { error } = await supabase
        .from("user_notification_settings")
        .upsert({ user_id: user.id, notification_emails: unique, ...flags, updated_by: session?.user.id ?? null }, { onConflict: "user_id" });
      if (error) throw error;
      setEmails(unique);
      setDirty(false);
      toast({ title: getMessages(usersMessages).notifications.savedTitle, description: getMessages(usersMessages).notifications.savedText(user.full_name) });
    } catch (error) {
      toast({
        variant: "destructive",
        title: getMessages(commonMessages).error,
        description: error instanceof Error && error.message ? error.message : getMessages(usersMessages).notifications.saveError,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!user) return;
    if (dirty) {
      toast({ title: getMessages(usersMessages).notifications.saveFirst });
      return;
    }
    setTesting(true);
    try {
      const result = await callPortalAction<{ sent: boolean; to?: string[]; reason?: string }>("send_test_notification", { userId: user.id });
      if (result.sent) {
        toast({ title: getMessages(usersMessages).notifications.testSent((result.to ?? []).join(", ")) });
      } else {
        toast({ variant: "destructive", title: getMessages(usersMessages).notifications.testNotSent, description: result.reason });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: getMessages(commonMessages).error,
        description: error instanceof Error && error.message ? error.message : getMessages(usersMessages).notifications.testError,
      });
    } finally {
      setTesting(false);
    }
  };

  const labels: Record<EventKey, { label: string; hint: string }> = {
    status_change: { label: m.statusChange, hint: m.statusChangeHint },
    new_practice: { label: m.newPractice, hint: m.newPracticeHint },
    documents: { label: m.documents, hint: m.documentsHint },
    notes: { label: m.notes, hint: m.notesHint },
  };
  const busy = loading || saving || testing;

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[620px]" data-testid="notifications-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {m.title}
          </DialogTitle>
          <DialogDescription>{m.description(user?.full_name ?? "")}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-2">
            <div className="space-y-2">
              <Label>{m.addresses}</Label>
              <p className="text-xs text-muted-foreground">{m.addressesHint(user?.email ?? "")}</p>
              <div className="space-y-2">
                {emails.map((address, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      type="email"
                      inputMode="email"
                      autoComplete="off"
                      value={address}
                      placeholder={m.addressPlaceholder}
                      aria-label={`${m.addresses} ${index + 1}`}
                      data-testid="notification-email"
                      onChange={(event) => changeEmails(emails.map((value, position) => (position === index ? event.target.value : value)))}
                    />
                    <Button type="button" variant="ghost" size="icon" aria-label={m.removeAddress} onClick={() => changeEmails(emails.filter((_, position) => position !== index))}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ))}
              </div>
              {emails.length < MAX_NOTIFICATION_EMAILS && (
                <Button type="button" variant="outline" size="sm" onClick={() => changeEmails([...emails, ""])} data-testid="notification-add">
                  <Plus className="mr-2 h-4 w-4" />
                  {m.addAddress}
                </Button>
              )}
            </div>

            <div className="space-y-4">
              <Label>{m.events}</Label>
              {EVENT_KEYS.map((key) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label htmlFor={`notify-${key}`}>{labels[key].label}</Label>
                    <p className="text-xs text-muted-foreground">{labels[key].hint}</p>
                  </div>
                  <Switch
                    id={`notify-${key}`}
                    checked={flags[key]}
                    onCheckedChange={(checked) => {
                      setFlags((current) => ({ ...current, [key]: checked }));
                      setDirty(true);
                    }}
                  />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">{m.ownSwitches}</p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={() => void handleTest()} disabled={busy} data-testid="notification-test">
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {m.sendTest}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              {common.cancel}
            </Button>
            <Button onClick={() => void handleSave()} disabled={busy} data-testid="notification-save">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {m.save}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
