import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, useMessages } from "@/i18n";
import { clientDataMessages } from "@/i18n/messages/clientData";
import { clientLabel, type ClientLite, type DuplicateGroup } from "@/lib/clientDuplicates";
import { mergeClients } from "@/lib/clientsApi";

interface DuplicateClientsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: DuplicateGroup[];
  onMerged: () => void;
}

/** One block per group of possible duplicates: choose who stays, then merge after a confirmation. */
export const DuplicateClientsDialog = ({ open, onOpenChange, groups, onMerged }: DuplicateClientsDialogProps) => {
  const m = useMessages(clientDataMessages).duplicates;
  const { toast } = useToast();
  const [keep, setKeep] = useState<Record<number, string>>({});
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [pending, setPending] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const ids = useMemo(() => groups.flatMap((group) => group.clients.map((client) => client.id)), [groups]);

  useEffect(() => {
    if (!open || ids.length === 0) return;
    let cancelled = false;
    void supabase
      .from("practices")
      .select("client_id")
      .in("client_id", ids)
      .then(({ data }) => {
        if (cancelled) return;
        const next = new Map<string, number>();
        for (const row of data ?? []) if (row.client_id) next.set(row.client_id, (next.get(row.client_id) ?? 0) + 1);
        setCounts(next);
        // The default keeper: the one with most practices, the oldest on a tie.
        setKeep((current) => {
          const chosen = { ...current };
          groups.forEach((group, index) => {
            if (chosen[index] && group.clients.some((client) => client.id === chosen[index])) return;
            chosen[index] = [...group.clients].sort((a, b) => (next.get(b.id) ?? 0) - (next.get(a.id) ?? 0))[0].id;
          });
          return chosen;
        });
      });
    return () => {
      cancelled = true;
    };
  }, [open, ids, groups]);

  const keeperOf = (index: number): ClientLite => groups[index].clients.find((client) => client.id === keep[index]) ?? groups[index].clients[0];

  const run = async () => {
    if (pending === null) return;
    const group = groups[pending];
    const keeper = keeperOf(pending);
    setBusy(true);
    try {
      const result = await mergeClients(
        keeper.id,
        group.clients.filter((client) => client.id !== keeper.id).map((client) => client.id),
      );
      toast({ title: m.doneTitle, description: m.doneText(result.practicesMoved) });
      setPending(null);
      onMerged();
    } catch (error) {
      toast({ variant: "destructive", title: m.errorTitle, description: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto" data-testid="duplicates-dialog">
          <DialogHeader>
            <DialogTitle>{m.title}</DialogTitle>
            <DialogDescription>{m.intro}</DialogDescription>
          </DialogHeader>
          {groups.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{m.none}</p>
          ) : (
            <div className="space-y-4">
              {groups.map((group, index) => (
                <section key={group.clients.map((client) => client.id).join("-")} className="rounded-md border border-border p-3" data-testid="duplicate-group">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.reasons.map((reason) => m.reason[reason]).join(" · ")}</p>
                  <RadioGroup value={keep[index] ?? group.clients[0].id} onValueChange={(value) => setKeep((current) => ({ ...current, [index]: value }))}>
                    {group.clients.map((client) => (
                      <div key={client.id} className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50">
                        <RadioGroupItem value={client.id} id={`keep-${client.id}`} className="mt-1" />
                        <Label htmlFor={`keep-${client.id}`} className="min-w-0 flex-1 cursor-pointer font-normal">
                          <span className="block font-medium" data-testid="duplicate-name">{clientLabel(client)}</span>
                          <span className="block break-all text-xs text-muted-foreground">
                            {[client.email, client.phone || client.mobile, client.tax_code, client.vat_number].filter(Boolean).join(" · ") || "—"}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {m.practices(counts.get(client.id) ?? 0)} · {m.created(formatDate(client.created_at))}
                            {keep[index] === client.id ? ` · ${m.keep}` : ""}
                          </span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                  <div className="mt-2 flex justify-end">
                    <Button size="sm" onClick={() => setPending(index)} data-testid="merge-group">
                      {m.merge(group.clients.length)}
                    </Button>
                  </div>
                </section>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {m.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={pending !== null} onOpenChange={(next) => !busy && !next && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{pending !== null ? m.confirmText(clientLabel(keeperOf(pending)), groups[pending].clients.length) : ""}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{m.cancel}</AlertDialogCancel>
            <AlertDialogAction
              data-testid="merge-confirm"
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                void run();
              }}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {busy ? m.merging : m.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
