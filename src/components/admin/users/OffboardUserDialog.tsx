import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getMessages, useMessages } from "@/i18n";
import { commonMessages } from "@/i18n/messages/common";
import { roleLabel } from "@/i18n/messages/domain";
import { usersMessages } from "@/i18n/messages/users";
import { callPortalAction } from "@/lib/portalActions";

interface OffboardUser {
  id: string;
  full_name: string;
  role: string;
}

interface Footprint {
  practices: number;
  clients: number;
  collaborators: number;
  batches: number;
  apiKeys: number;
}

interface OffboardUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: OffboardUser | null;
  /** Everybody the portfolio can be handed to. */
  candidates: OffboardUser[];
  onDone: () => void;
}

/** Deleting a user without losing their practices: hand everything over first, then delete (or just deactivate). */
export const OffboardUserDialog = ({ open, onOpenChange, user, candidates, onDone }: OffboardUserDialogProps) => {
  const m = useMessages(usersMessages).offboard;
  const common = useMessages(commonMessages);
  const { toast } = useToast();
  const [footprint, setFootprint] = useState<Footprint | null>(null);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState<"reassign" | "delete" | "disable" | null>(null);

  const loadFootprint = useCallback(async () => {
    if (!user) return;
    setFootprint(null);
    try {
      const result = await callPortalAction<{ footprint: Footprint }>("user_footprint", { userId: user.id });
      setFootprint(result.footprint);
    } catch (error) {
      toast({ variant: "destructive", title: getMessages(commonMessages).error, description: error instanceof Error ? error.message : getMessages(usersMessages).offboard.error });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when the dialog opens for a user
  }, [user?.id]);

  useEffect(() => {
    if (open && user) {
      setTarget("");
      void loadFootprint();
    }
  }, [open, user, loadFootprint]);

  const owns = footprint ? footprint.practices + footprint.clients + footprint.collaborators > 0 : false;
  const hasCollaborators = (footprint?.collaborators ?? 0) > 0;
  const options = candidates.filter((candidate) => candidate.id !== user?.id && (!hasCollaborators || candidate.role === "agente" || candidate.role === "admin"));

  const run = async (kind: "reassign" | "delete" | "disable") => {
    if (!user) return;
    setBusy(kind);
    try {
      if (kind === "reassign") {
        const result = await callPortalAction<{ moved: number; clients: number }>("reassign_user_data", { fromUserId: user.id, toUserId: target });
        toast({ title: getMessages(commonMessages).success, description: getMessages(usersMessages).offboard.reassigned(result.moved, result.clients) });
        await loadFootprint();
      } else if (kind === "delete") {
        await callPortalAction("delete_user", { userId: user.id });
        toast({ title: getMessages(commonMessages).success, description: getMessages(usersMessages).offboard.deleted });
        onDone();
        onOpenChange(false);
      } else {
        await callPortalAction("disable_user", { userId: user.id });
        toast({ title: getMessages(commonMessages).success, description: getMessages(usersMessages).disabled });
        onDone();
        onOpenChange(false);
      }
    } catch (error) {
      toast({ variant: "destructive", title: getMessages(commonMessages).error, description: error instanceof Error ? error.message : getMessages(usersMessages).offboard.error });
    } finally {
      setBusy(null);
    }
  };

  const lines = footprint
    ? [
        footprint.practices > 0 && m.practices(footprint.practices),
        footprint.clients > 0 && m.clients(footprint.clients),
        footprint.collaborators > 0 && m.collaborators(footprint.collaborators),
        footprint.batches > 0 && m.batches(footprint.batches),
        footprint.apiKeys > 0 && m.apiKeys(footprint.apiKeys),
      ].filter((line): line is string => Boolean(line))
    : [];

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-[560px]" data-testid="offboard-dialog">
        <DialogHeader>
          <DialogTitle>{m.title(user?.full_name ?? "")}</DialogTitle>
          <DialogDescription>{m.intro}</DialogDescription>
        </DialogHeader>

        {footprint === null ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {m.loading}
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {lines.length > 0 ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm" data-testid="offboard-owns">
                <p className="font-medium">{m.owns}</p>
                <ul className="mt-1 list-disc pl-5">
                  {lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="rounded-md border border-border bg-muted/40 p-3 text-sm" data-testid="offboard-nothing">
                {m.nothing}
              </p>
            )}

            {owns && (
              <div className="space-y-2">
                <Label>{m.reassignTo}</Label>
                <div className="flex gap-2">
                  <Select value={target} onValueChange={setTarget}>
                    <SelectTrigger data-testid="offboard-target">
                      <SelectValue placeholder={m.choose} />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((candidate) => (
                        <SelectItem key={candidate.id} value={candidate.id}>
                          {candidate.full_name} · {roleLabel(candidate.role)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={() => void run("reassign")} disabled={!target || busy !== null} data-testid="offboard-reassign">
                    {busy === "reassign" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {busy === "reassign" ? m.reassigning : m.reassign}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{m.reassignHint}</p>
              </div>
            )}
            {owns && <p className="text-xs text-muted-foreground">{m.deleteBlocked}</p>}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => void run("disable")} disabled={busy !== null || footprint === null} data-testid="offboard-disable">
            <UserX className="mr-2 h-4 w-4" />
            {m.disableInstead}
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy !== null}>
              {common.cancel}
            </Button>
            <Button variant="destructive" onClick={() => void run("delete")} disabled={busy !== null || footprint === null || owns} data-testid="offboard-delete">
              {busy === "delete" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              {m.deleteForever}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
