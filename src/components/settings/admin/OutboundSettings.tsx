import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { listWebhooks, removeWebhook, retryDeliveries, setWebhook, testWebhook, type PartnerKeyRow } from "@/lib/workflowApi";
import { formatDateTime, useMessages } from "@/i18n";
import { outboundMessages } from "@/i18n/messages/connections";

interface DeliveryRow {
  id: string;
  target_kind: "source" | "portal";
  target_label: string | null;
  event_type: string;
  status: "pending" | "delivered" | "failed";
  attempts: number;
  last_error: string | null;
  next_attempt_at: string;
  created_at: string;
  payload: { practice?: { number?: string }; lot?: { source_reference?: string } } | null;
}

const STATUS_CLASS: Record<DeliveryRow["status"], string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  delivered: "bg-green-500/15 text-green-700 dark:text-green-400",
  failed: "bg-destructive/15 text-destructive",
};

/** Notifications going out: the address of each representative's portal and the log of what was delivered. */
export const OutboundSettings = () => {
  const m = useMessages(outboundMessages);
  const { toast } = useToast();
  const [keys, setKeys] = useState<PartnerKeyRow[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<PartnerKeyRow | null>(null);
  const [form, setForm] = useState({ url: "", active: true, rotate: false });
  const [formError, setFormError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, { data }] = await Promise.all([
        listWebhooks(),
        supabase
          .from("outbound_deliveries")
          .select("id, target_kind, target_label, event_type, status, attempts, last_error, next_attempt_at, created_at, payload")
          .order("created_at", { ascending: false })
          .limit(40),
      ]);
      setKeys(list.keys);
      setDeliveries((data as unknown as DeliveryRow[] | null) ?? []);
    } catch {
      // The section stays as it was: the page shows the connections' own error.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openEditor = (key: PartnerKeyRow) => {
    setEditing(key);
    setForm({ url: key.webhook?.url ?? "", active: key.webhook?.active ?? true, rotate: false });
    setFormError(null);
  };

  const save = async () => {
    if (!editing) return;
    setBusy(`save-${editing.id}`);
    setFormError(null);
    try {
      const result = await setWebhook({ apiKeyId: editing.id, url: form.url.trim() || undefined, active: form.active, rotateSecret: form.rotate });
      toast({ title: m.sources.saved });
      setEditing(null);
      if (result.secret) {
        setSecret(result.secret);
        setCopied(false);
      }
      await load();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : m.sources.errorTitle);
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!editing) return;
    setBusy(`remove-${editing.id}`);
    try {
      await removeWebhook(editing.id);
      toast({ title: m.sources.removed });
      setEditing(null);
      await load();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : m.sources.errorTitle);
    } finally {
      setBusy(null);
    }
  };

  const test = async (key: PartnerKeyRow) => {
    setBusy(`test-${key.id}`);
    try {
      const result = await testWebhook(key.id);
      toast(
        result.delivered
          ? { title: m.sources.testOk(result.status) }
          : { variant: "destructive", title: m.sources.errorTitle, description: m.sources.testFailed(result.error ?? "") },
      );
      await load();
    } catch (error) {
      toast({ variant: "destructive", title: m.sources.errorTitle, description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(null);
    }
  };

  const retry = async (id?: string) => {
    setBusy(id ? `retry-${id}` : "retry-all");
    try {
      const result = await retryDeliveries(id);
      toast({ title: m.deliveries.retried(result.delivered, result.attempted) });
      await load();
    } catch (error) {
      toast({ variant: "destructive", title: m.sources.errorTitle, description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(null);
    }
  };

  const copySecret = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      // Without clipboard access the secret can still be selected by hand.
    }
  };

  const hasUndelivered = deliveries.some((delivery) => delivery.status !== "delivered");

  return (
    <div className="space-y-6">
      <Card data-testid="webhook-sources">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">{m.sources.title}</CardTitle>
              <CardDescription>{m.sources.description}</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">{m.sources.empty}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{m.sources.columns.key}</TableHead>
                    <TableHead>{m.sources.columns.notifications}</TableHead>
                    <TableHead>{m.sources.columns.queue}</TableHead>
                    <TableHead className="text-right">{m.sources.columns.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((key) => (
                    <TableRow key={key.id} data-testid="webhook-key">
                      <TableCell>
                        <p className="font-medium">{key.name}</p>
                        <p className="text-xs text-muted-foreground">{key.key_prefix}…</p>
                        {!key.is_active && <p className="text-xs text-destructive">{m.sources.inactiveKey}</p>}
                        {key.is_active && !key.mapped && <p className="text-xs text-amber-700 dark:text-amber-400">{m.sources.notMapped}</p>}
                      </TableCell>
                      <TableCell>
                        {key.webhook ? (
                          <div className="space-y-1">
                            <Badge
                              variant="secondary"
                              className={key.webhook.active ? "bg-green-500/15 text-green-700 dark:text-green-400" : "bg-muted text-muted-foreground"}
                            >
                              {key.webhook.active ? m.sources.active : m.sources.paused}
                            </Badge>
                            <p className="max-w-xs break-all text-xs text-muted-foreground">{key.webhook.url}</p>
                          </div>
                        ) : (
                          <Badge variant="outline">{m.sources.notConfigured}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {key.pending + key.failed === 0 ? (
                          m.sources.none
                        ) : (
                          <div className="space-y-0.5">
                            {key.pending > 0 && <p className="text-amber-700 dark:text-amber-400">{m.sources.pending(key.pending)}</p>}
                            {key.failed > 0 && <p className="text-destructive">{m.sources.failed(key.failed)}</p>}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {key.webhook && (
                            <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void test(key)}>
                              {busy === `test-${key.id}` ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                              {busy === `test-${key.id}` ? m.sources.testing : m.sources.test}
                            </Button>
                          )}
                          <Button size="sm" onClick={() => openEditor(key)} data-testid="webhook-configure">
                            {m.sources.configure}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="outbound-deliveries">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">{m.deliveries.title}</CardTitle>
              <CardDescription>{m.deliveries.description}</CardDescription>
            </div>
            {hasUndelivered && (
              <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void retry()} data-testid="deliveries-retry-all">
                {busy === "retry-all" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
                {m.deliveries.retryAll}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {deliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground">{m.deliveries.empty}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{m.deliveries.columns.date}</TableHead>
                    <TableHead>{m.deliveries.columns.recipient}</TableHead>
                    <TableHead>{m.deliveries.columns.event}</TableHead>
                    <TableHead>{m.deliveries.columns.practice}</TableHead>
                    <TableHead>{m.deliveries.columns.status}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map((delivery) => (
                    <TableRow key={delivery.id} data-testid="delivery-row">
                      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(delivery.created_at)}</TableCell>
                      <TableCell>
                        <p>{delivery.target_label ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{delivery.target_kind === "source" ? m.deliveries.source : m.deliveries.portal}</p>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{delivery.event_type}</TableCell>
                      <TableCell className="text-xs">{delivery.payload?.practice?.number ?? delivery.payload?.lot?.source_reference ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={STATUS_CLASS[delivery.status]}>
                          {m.deliveries.statuses[delivery.status]}
                        </Badge>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {delivery.attempts} · {delivery.status === "pending" ? m.deliveries.nextAttempt(formatDateTime(delivery.next_attempt_at)) : ""}
                        </p>
                        {delivery.last_error && delivery.status !== "delivered" && (
                          <p className="mt-0.5 max-w-xs break-words text-xs text-destructive">{delivery.last_error}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {delivery.status !== "delivered" && (
                          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void retry(delivery.id)}>
                            {m.deliveries.retry}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && busy === null && setEditing(null)}>
        <DialogContent>
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>{m.sources.dialogTitle(editing.name)}</DialogTitle>
                <DialogDescription>{m.sources.dialogText}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="webhook-url">{m.sources.url}</Label>
                  <Input id="webhook-url" type="url" placeholder={m.sources.urlPlaceholder} value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="webhook-active">{m.sources.enabled}</Label>
                  <Switch id="webhook-active" checked={form.active} onCheckedChange={(active) => setForm({ ...form, active })} />
                </div>
                {editing.webhook && (
                  <div className="flex items-start gap-2">
                    <Checkbox id="webhook-rotate" checked={form.rotate} onCheckedChange={(value) => setForm({ ...form, rotate: value === true })} />
                    <div className="space-y-0.5">
                      <Label htmlFor="webhook-rotate">{m.sources.rotate}</Label>
                      <p className="text-xs text-muted-foreground">{m.sources.rotateHint}</p>
                    </div>
                  </div>
                )}
                {formError && <p className="text-sm text-destructive" role="alert">{formError}</p>}
              </div>
              <DialogFooter className="gap-2 sm:justify-between">
                <div>
                  {editing.webhook && (
                    <Button variant="ghost" className="text-destructive" disabled={busy !== null} onClick={() => void remove()}>
                      {m.sources.remove}
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" disabled={busy !== null} onClick={() => setEditing(null)}>
                    {m.sources.cancel}
                  </Button>
                  <Button disabled={busy !== null || !form.url.trim()} onClick={() => void save()} data-testid="webhook-save">
                    {busy?.startsWith("save-") && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {m.sources.save}
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={secret !== null} onOpenChange={() => undefined}>
        <DialogContent onInteractOutside={(event) => event.preventDefault()} onEscapeKeyDown={(event) => event.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{m.sources.secretTitle}</DialogTitle>
            <DialogDescription>{m.sources.secretText}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-md bg-muted px-2 py-2 text-xs" data-testid="webhook-secret">
              {secret}
            </code>
            <Button type="button" variant="outline" size="sm" onClick={() => void copySecret()}>
              {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
              {copied ? m.sources.copied : m.sources.copy}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setSecret(null)}>{m.sources.close}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
