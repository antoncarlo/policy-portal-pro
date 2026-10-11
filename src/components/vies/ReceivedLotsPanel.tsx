import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, FileArchive, Inbox, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDate, useMessages } from "@/i18n";
import { connectionsMessages } from "@/i18n/messages/connections";

export interface IntakeLotFile {
  kind: "excel" | "zip" | "visura";
  file_name: string;
  storage_path: string;
  size: number;
}

export interface IntakeLot {
  id: string;
  source_portal: string;
  source_reference: string;
  status: "uploading" | "received" | "processing" | "processed" | "rejected";
  files: IntakeLotFile[];
  expected_rows: number | null;
  fiscal_representative_name: string | null;
  notes: string | null;
  rejected_reason: string | null;
  received_at: string | null;
  created_at: string;
}

interface ReceivedLotsPanelProps {
  /** Lot whose files are loaded in the flow right now. */
  activeLotId: string | null;
  /** Loads the lot's files into the page; resolves when they are in. */
  onLoad: (lot: IntakeLot) => Promise<void>;
  /** Changing it reloads the list. */
  refreshKey: number;
}

const BADGE_CLASS: Record<IntakeLot["status"], string> = {
  uploading: "bg-muted text-muted-foreground",
  received: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  processing: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  processed: "bg-green-500/15 text-green-700 dark:text-green-400",
  rejected: "bg-destructive/15 text-destructive",
};

/** Lots other portals sent in through the API, waiting to be loaded into the usual VIES flow. */
export const ReceivedLotsPanel = ({ activeLotId, onLoad, refreshKey }: ReceivedLotsPanelProps) => {
  const m = useMessages(connectionsMessages).intake;
  const { toast } = useToast();
  const [lots, setLots] = useState<IntakeLot[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<IntakeLot | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);

  const load = useCallback(async () => {
    setLoadingList(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id).eq("role", "admin").maybeSingle();
      setCanManage(Boolean(role));
    }
    const { data } = await supabase
      .from("vies_intake_lots")
      .select("id, source_portal, source_reference, status, files, expected_rows, fiscal_representative_name, notes, rejected_reason, received_at, created_at")
      .neq("status", "uploading")
      .order("created_at", { ascending: false })
      .limit(30);
    setLots((data as unknown as IntakeLot[] | null) ?? []);
    setLoadingList(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const open = lots.filter((lot) => lot.status === "received" || lot.status === "processing");
  const history = lots.filter((lot) => lot.status === "processed" || lot.status === "rejected");
  const visible = showHistory ? [...open, ...history] : open;

  // Nothing to show and nothing can be done: the panel stays out of the way.
  if (!loadingList && lots.length === 0) return null;

  const handleLoad = async (lot: IntakeLot) => {
    setBusyId(lot.id);
    try {
      await onLoad(lot);
      toast({ title: m.loadedTitle, description: m.loadedText(lot.source_portal) });
      await load();
    } catch (error) {
      toast({ variant: "destructive", title: m.errorTitle, description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusyId(null);
    }
  };

  const confirmReject = async () => {
    if (!rejecting) return;
    if (!reason.trim()) {
      setReasonError(true);
      return;
    }
    setBusyId(rejecting.id);
    const { error } = await supabase
      .from("vies_intake_lots")
      .update({ status: "rejected", rejected_reason: reason.trim() })
      .eq("id", rejecting.id)
      .in("status", ["received", "processing"]);
    setBusyId(null);
    if (error) {
      toast({ variant: "destructive", title: m.errorTitle, description: error.message });
      return;
    }
    toast({ title: m.rejectedTitle });
    setRejecting(null);
    setReason("");
    await load();
  };

  return (
    <Card data-testid="received-lots">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5" />
              {m.title}
              {open.length > 0 && <Badge className="bg-amber-500 text-white hover:bg-amber-500">{open.length}</Badge>}
            </CardTitle>
            <CardDescription>{m.description}</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loadingList}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${loadingList ? "animate-spin" : ""}`} />
            {m.refresh}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {visible.length === 0 && !loadingList && <p className="text-sm text-muted-foreground">{m.empty}</p>}
        {visible.map((lot) => {
          const zips = lot.files.filter((file) => file.kind === "zip").length;
          const hasVisura = lot.files.some((file) => file.kind === "visura");
          const active = activeLotId === lot.id;
          return (
            <div key={lot.id} className="rounded-lg border border-border p-3" data-testid="received-lot">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <FileArchive className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="break-all font-medium text-foreground">{m.source(lot.source_portal, lot.source_reference)}</span>
                    <Badge className={BADGE_CLASS[lot.status]} variant="secondary">
                      {m.statuses[lot.status]}
                    </Badge>
                    {active && (
                      <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {m.active}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {[
                      lot.received_at ? m.receivedOn(formatDate(lot.received_at)) : null,
                      m.files(zips, hasVisura),
                      lot.expected_rows ? m.expectedRows(lot.expected_rows) : null,
                      lot.fiscal_representative_name ? m.representative(lot.fiscal_representative_name) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {lot.notes && <p className="text-xs text-muted-foreground">{lot.notes}</p>}
                  {lot.rejected_reason && <p className="text-xs text-destructive">{m.rejectedReason(lot.rejected_reason)}</p>}
                </div>
                {canManage && (lot.status === "received" || lot.status === "processing") && (
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" onClick={() => void handleLoad(lot)} disabled={busyId !== null} data-testid="received-lot-load">
                      {busyId === lot.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                      {busyId === lot.id ? m.loading : m.load}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId !== null}
                      onClick={() => {
                        setRejecting(lot);
                        setReason("");
                        setReasonError(false);
                      }}
                    >
                      {m.reject}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {history.length > 0 && (
          <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setShowHistory((value) => !value)}>
            {showHistory ? m.hideHistory : m.showHistory}
          </Button>
        )}
      </CardContent>

      <Dialog open={rejecting !== null} onOpenChange={(openState) => !openState && busyId === null && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m.rejectTitle}</DialogTitle>
            <DialogDescription>{m.rejectText}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="lot-reject-reason">{m.rejectReason}</Label>
            <Textarea id="lot-reject-reason" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
            {reasonError && <p className="text-xs text-destructive">{m.rejectRequired}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)} disabled={busyId !== null}>
              {m.cancel}
            </Button>
            <Button variant="destructive" onClick={() => void confirmReject()} disabled={busyId !== null}>
              {m.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
