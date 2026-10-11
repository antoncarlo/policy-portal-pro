import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { getPortalStatus, type PortalStatus } from "@/lib/workflowApi";
import { formatDateTime, useMessages } from "@/i18n";
import { connectionsMessages } from "@/i18n/messages/connections";

interface IntegrationEvent {
  id: string;
  direction: "inbound" | "outbound";
  portal_id: string;
  event_type: string;
  status: "received" | "processed" | "ignored" | "failed";
  error: string | null;
  created_at: string;
}

const STATUS_CLASS: Record<IntegrationEvent["status"], string> = {
  received: "bg-muted text-muted-foreground",
  processed: "bg-green-500/15 text-green-700 dark:text-green-400",
  ignored: "bg-muted text-muted-foreground",
  failed: "bg-destructive/15 text-destructive",
};

const CopyableAddress = ({ label, value, copyLabel, copiedLabel }: { label: string; value: string; copyLabel: string; copiedLabel: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Without clipboard access the address can still be selected by hand.
    }
  };
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-md bg-muted px-2 py-1.5 text-xs">{value}</code>
        <Button type="button" variant="outline" size="sm" onClick={() => void copy()} aria-label={`${copyLabel}: ${label}`}>
          {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
          {copied ? copiedLabel : copyLabel}
        </Button>
      </div>
    </div>
  );
};

/** Connections with other portals (administrators): what is ready, the addresses to give out, the latest exchanges. */
export const ConnectionsSettings = () => {
  const m = useMessages(connectionsMessages).settings;
  const [status, setStatus] = useState<PortalStatus | null>(null);
  const [events, setEvents] = useState<IntegrationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [portalStatus, { data }] = await Promise.all([
        getPortalStatus(),
        supabase
          .from("integration_events")
          .select("id, direction, portal_id, event_type, status, error, created_at")
          .order("created_at", { ascending: false })
          .limit(30),
      ]);
      setStatus(portalStatus);
      setEvents((data as IntegrationEvent[] | null) ?? []);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const flag = (ready: boolean, missing: string) =>
    ready ? (
      <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/15 dark:text-green-400">{m.ready}</Badge>
    ) : (
      <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-400">
        {missing}
      </Badge>
    );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>{m.title}</CardTitle>
              <CardDescription>{m.description}</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
              {m.refresh}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {failed && <p className="text-sm text-destructive">{m.loadError}</p>}
          {status && (
            <>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">{m.portalsTitle}</h3>
                {status.portals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{m.noPortals}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{m.columns.portal}</TableHead>
                          <TableHead>{m.columns.address}</TableHead>
                          <TableHead>{m.columns.send}</TableHead>
                          <TableHead>{m.columns.receive}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {status.portals.map((portal) => (
                          <TableRow key={portal.id}>
                            <TableCell className="font-medium">
                              {portal.name}
                              <span className="ml-2 text-xs text-muted-foreground">{portal.id}</span>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{portal.host || "—"}</TableCell>
                            <TableCell>{flag(portal.can_send, m.sendNoKey)}</TableCell>
                            <TableCell>{flag(portal.can_receive, m.receiveNoSecret)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">{m.addressesTitle}</h3>
                <CopyableAddress label={m.callback} value={status.callback_url} copyLabel={m.copy} copiedLabel={m.copied} />
                <CopyableAddress label={m.intake} value={status.intake_url} copyLabel={m.copy} copiedLabel={m.copied} />
                <CopyableAddress label={m.intakeStatus} value={status.intake_status_url} copyLabel={m.copy} copiedLabel={m.copied} />
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">{m.emailTitle}</h3>
                <p className="text-sm text-muted-foreground">{status.email_ready ? m.emailReady : m.emailNotReady}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{m.eventsTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">{m.noEvents}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{m.eventColumns.date}</TableHead>
                    <TableHead>{m.eventColumns.direction}</TableHead>
                    <TableHead>{m.eventColumns.portal}</TableHead>
                    <TableHead>{m.eventColumns.event}</TableHead>
                    <TableHead>{m.eventColumns.status}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(event.created_at)}</TableCell>
                      <TableCell>{event.direction === "inbound" ? m.inbound : m.outbound}</TableCell>
                      <TableCell>{event.portal_id}</TableCell>
                      <TableCell className="font-mono text-xs">{event.event_type}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={STATUS_CLASS[event.status]} title={event.error ?? undefined}>
                          {m.statuses[event.status]}
                        </Badge>
                        {event.error && <p className="mt-1 max-w-xs break-words text-xs text-destructive">{event.error}</p>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
