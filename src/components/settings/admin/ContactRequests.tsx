// Impostazioni → «Richieste di contatto» (solo amministratori): le richieste arrivate dal modulo del sito pubblico
// VIES. Si leggono, si risponde per email e si segnano come gestite; il testo della richiesta non si modifica.
import { useCallback, useEffect, useState } from "react";
import { Inbox, Loader2, Mail, MailWarning, RefreshCw, RotateCcw, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime, getMessages, useMessages } from "@/i18n";
import { commonMessages } from "@/i18n/messages/common";
import { contactRequestsMessages } from "@/i18n/messages/contactRequests";
import { supabase } from "@/integrations/supabase/client";
import { contactReplyHref, contactStatusChange, countToHandle, type ContactRequestRow, type ContactRequestStatus } from "@/lib/contactRequests";

type Filter = "all" | ContactRequestStatus;
const FILTERS: Filter[] = ["new", "handled", "all"];
const PAGE_SIZE = 200;

export const ContactRequests = () => {
  const m = useMessages(contactRequestsMessages);
  const { toast } = useToast();
  const [rows, setRows] = useState<ContactRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>("new");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("contact_requests").select("*").order("created_at", { ascending: false }).limit(PAGE_SIZE);
    setFailed(Boolean(error));
    setRows(error ? [] : ((data ?? []) as ContactRequestRow[]));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const change = async (row: ContactRequestRow, status: ContactRequestStatus) => {
    setBusy(row.id);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("no user");
      const update = contactStatusChange(status, user.id, new Date());
      const { error } = await supabase.from("contact_requests").update(update).eq("id", row.id);
      if (error) throw error;
      setRows((current) => current.map((item) => (item.id === row.id ? { ...item, ...update } : item)));
    } catch {
      toast({ variant: "destructive", title: getMessages(commonMessages).error, description: getMessages(contactRequestsMessages).updateError });
    } finally {
      setBusy(null);
    }
  };

  const shown = rows.filter((row) => filter === "all" || (filter === "handled" ? row.status === "handled" : row.status !== "handled"));
  const toHandle = countToHandle(rows);

  return (
    <Card className="p-6" data-testid="contact-requests">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Inbox className="h-5 w-5" />
          <h2 className="text-xl font-semibold">{m.title}</h2>
          {toHandle > 0 && (
            <Badge className="bg-primary text-primary-foreground" data-testid="contact-requests-count">
              {m.toHandle(toHandle)}
            </Badge>
          )}
        </div>
        <Button variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          {m.refresh}
        </Button>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{m.intro}</p>

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label={m.title}>
        {FILTERS.map((value) => (
          <Button key={value} variant={filter === value ? "default" : "outline"} size="sm" aria-pressed={filter === value} onClick={() => setFilter(value)} data-testid={`contact-requests-filter-${value}`}>
            {m.filters[value]}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{m.loading}</p>
      ) : failed ? (
        <p className="py-8 text-center text-sm text-destructive" role="alert">
          {m.loadError}
        </p>
      ) : shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{rows.length === 0 ? m.empty : m.emptyFiltered}</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((row) => {
            const handled = row.status === "handled";
            return (
              <li key={row.id} className="rounded-lg border bg-card/60 p-4" data-testid="contact-request" data-status={handled ? "handled" : "new"}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{row.company}</h3>
                      <Badge variant={handled ? "outline" : "default"}>{handled ? m.statuses.handled : m.statuses.new}</Badge>
                      {!row.email_sent && (
                        <Badge variant="destructive" title={row.email_error ? m.emailNotSentReason(row.email_error) : undefined}>
                          <MailWarning className="mr-1 h-3 w-3" />
                          {m.emailNotSent}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm">
                      {row.name} · {m.roles[row.role] ?? row.role} · {row.country}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {m.receivedOn(formatDateTime(row.created_at))} · {m.fromPage(m.languages[row.lang] ?? row.lang, row.page ?? "")}
                      {handled && row.handled_at ? ` · ${m.handledOn(formatDateTime(row.handled_at))}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <a href={contactReplyHref(row)}>
                        <Mail className="mr-2 h-4 w-4" />
                        {m.reply}
                      </a>
                    </Button>
                    <Button variant={handled ? "ghost" : "default"} size="sm" disabled={busy === row.id} onClick={() => void change(row, handled ? "new" : "handled")}>
                      {busy === row.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : handled ? <RotateCcw className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                      {handled ? m.reopen : m.markHandled}
                    </Button>
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap break-words rounded-md bg-muted/60 p-3 text-sm">{row.message}</p>
                <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Email</dt>
                    <dd className="break-all">{row.email}</dd>
                  </div>
                  {row.phone && (
                    <div>
                      <dt className="text-xs text-muted-foreground">{m.phone}</dt>
                      <dd>{row.phone}</dd>
                    </div>
                  )}
                  {row.volume && (
                    <div>
                      <dt className="text-xs text-muted-foreground">{m.volume}</dt>
                      <dd>{row.volume}</dd>
                    </div>
                  )}
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
};
