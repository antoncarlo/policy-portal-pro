import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, Circle, Clock, Download, FileSignature, FileText, Loader2, Send, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { fetchLotCycle, type LotCycleData } from "@/lib/lotFlowApi";
import { LOT_STEP_ACTOR, type LotStepId } from "@/lib/lotCycle";
import { downloadDraftsBundle } from "@/lib/signingBundle";
import { buildClientStatement } from "@/lib/lotStatement";
import { saveBlob } from "@/lib/signingTemplates";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, formatDateTime, getMessages, useMessages } from "@/i18n";
import { lotCycleMessages } from "@/i18n/messages/lotCycle";
import { LotBulkDocumentsDialog, type BulkMode } from "./LotBulkDocumentsDialog";
import { LotPaymentCheckDialog, LotPaymentDialog, LotSentDialog, LotVerifyDialog } from "./LotCycleDialogs";

type DialogName = BulkMode | "verify" | "payment" | "check" | "sent" | null;

interface Props {
  batchId: string;
  /** "Lotto 3" (or the lot's name). */
  title: string;
  isAdmin: boolean;
  /** The lot's own actions, already in the page (the signing ZIP, the signed upload, the whole-lot download). */
  onDownloadSigning: () => void;
  onUploadSigned: () => void;
  onDownloadLot: () => void;
  busy: boolean;
  /** Called after a step so the practices list is read again. */
  onChanged: () => void;
  /** Changes when the practices list was reloaded: the cycle is read again with it. */
  refreshKey?: number;
}

/**
 * Where the lot is in its cycle (bozze, verifica, pagamento, copie, firme, invio, polizze emesse) and what the
 * person looking at it has to do next. The administrator and the fiscal representative see the same steps; each
 * one gets the buttons of the steps that are theirs. Every step is recorded in the lot's register.
 */
export const LotCyclePanel = ({ batchId, title, isAdmin, onDownloadSigning, onUploadSigned, onDownloadLot, busy, onChanged, refreshKey = 0 }: Props) => {
  const m = useMessages(lotCycleMessages);
  const { toast } = useToast();
  const [data, setData] = useState<LotCycleData | null>(null);
  const [failed, setFailed] = useState(false);
  const [dialog, setDialog] = useState<DialogName>(null);
  const [showLog, setShowLog] = useState(false);
  const [working, setWorking] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await fetchLotCycle(batchId));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [batchId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const changed = () => {
    void load();
    onChanged();
  };

  if (failed && !data) return <Card className="p-4 text-sm text-muted-foreground" data-testid="lot-cycle-error">{m.log.error}</Card>;
  if (!data) return <Card className="p-4 text-sm text-muted-foreground" data-testid="lot-cycle-loading">{m.log.loading}</Card>;

  const { cycle } = data;
  const current = cycle.current;
  const mine = current ? isAdmin || LOT_STEP_ACTOR[current] === "collaborator" : false;
  const turn = cycle.closed ? m.turn.closed : current ? (LOT_STEP_ACTOR[current] === "admin" ? (isAdmin ? m.turn.you : m.turn.admin) : isAdmin ? m.turn.collaborator : m.turn.you) : m.turn.closed;
  const signedDone = cycle.active.length - (cycle.missing.sign?.length ?? 0);

  const run = async (key: string, task: () => Promise<void>) => {
    setWorking(key);
    try {
      await task();
    } catch (error) {
      toast({ variant: "destructive", title: getMessages(lotCycleMessages).draftsBundle.errorTitle, description: error instanceof Error ? error.message : undefined });
    } finally {
      setWorking(null);
    }
  };

  const downloadDrafts = () =>
    run("drafts", async () => {
      const text = getMessages(lotCycleMessages).draftsBundle;
      const result = await downloadDraftsBundle({ batchId, fileLabel: text.zipName(title), labels: { readme: text.readme, readmeText: text.readmeText } });
      toast(result.files === 0 ? { variant: "destructive", title: text.errorTitle, description: text.nothing } : { title: text.zipName(title), description: text.done(result.practices, result.files) });
    });

  const downloadStatement = () =>
    run("statement", async () => {
      const statement = await buildClientStatement(batchId);
      saveBlob(statement.blob, statement.fileName);
      const text = getMessages(lotCycleMessages).toast;
      toast({ title: text.statementTitle, description: text.statementText(statement.policies, formatCurrency(statement.total)) });
    });

  const button = (testId: string, label: string, onClick: () => void, icon: JSX.Element, options: { primary?: boolean; busyKey?: string } = {}) => (
    <Button
      key={testId}
      size="sm"
      variant={options.primary ? "default" : "outline"}
      disabled={busy || working !== null}
      onClick={onClick}
      data-testid={testId}
    >
      {options.busyKey && working === options.busyKey ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : icon}
      {label}
    </Button>
  );

  const actions = (step: LotStepId): JSX.Element[] => {
    const admin = isAdmin;
    const own = mine;
    switch (step) {
      case "drafts":
        return admin ? [button("lot-action-drafts", m.buttons.uploadDrafts, () => setDialog("drafts"), <Upload className="mr-1.5 h-4 w-4" />, { primary: true })] : [];
      case "verify":
        return own
          ? [
              button("lot-action-download-drafts", m.buttons.downloadDrafts, () => void downloadDrafts(), <Download className="mr-1.5 h-4 w-4" />, { busyKey: "drafts" }),
              button("lot-action-verify", m.buttons.confirmDrafts, () => setDialog("verify"), <CheckCircle2 className="mr-1.5 h-4 w-4" />, { primary: true }),
            ]
          : [];
      case "payment":
        return own
          ? [
              button("lot-action-statement", m.buttons.downloadStatement, () => void downloadStatement(), <FileText className="mr-1.5 h-4 w-4" />, { busyKey: "statement" }),
              button("lot-action-payment", m.buttons.submitPayment, () => setDialog("payment"), <Upload className="mr-1.5 h-4 w-4" />, { primary: true }),
            ]
          : [];
      case "payment_check":
        return admin ? [button("lot-action-check", m.buttons.checkPayment, () => setDialog("check"), <CheckCircle2 className="mr-1.5 h-4 w-4" />, { primary: true })] : [];
      case "copies":
        return admin ? [button("lot-action-copies", m.buttons.uploadCopies, () => setDialog("copies"), <Upload className="mr-1.5 h-4 w-4" />, { primary: true })] : [];
      case "sign":
        return own
          ? [
              button("lot-action-sign-download", m.buttons.downloadSigning, onDownloadSigning, <FileSignature className="mr-1.5 h-4 w-4" />),
              button("lot-action-sign-upload", m.buttons.uploadSigned, onUploadSigned, <Upload className="mr-1.5 h-4 w-4" />, { primary: true }),
            ]
          : [];
      case "send":
        return admin
          ? [
              button("lot-action-download-lot", m.buttons.downloadLot, onDownloadLot, <Download className="mr-1.5 h-4 w-4" />),
              button("lot-action-sent", m.buttons.markSent, () => setDialog("sent"), <Send className="mr-1.5 h-4 w-4" />, { primary: true }),
            ]
          : [];
      case "issued":
        return admin ? [button("lot-action-issued", m.buttons.uploadIssued, () => setDialog("issued"), <Upload className="mr-1.5 h-4 w-4" />, { primary: true })] : [];
    }
  };

  const closedActions = cycle.closed ? [button("lot-action-download-all", m.buttons.downloadAll, onDownloadLot, <Download className="mr-1.5 h-4 w-4" />, { primary: true })] : [];
  const hint = current ? m.hints[current][isAdmin ? "admin" : "collaborator"] : m.closedHint;
  const nextActions = current ? actions(current) : closedActions;

  return (
    <Card className="space-y-4 p-4" data-testid="lot-cycle">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{m.title(title)}</h2>
          <p className="text-xs text-muted-foreground">{m.intro}</p>
        </div>
        <Badge variant={mine && !cycle.closed ? "default" : "outline"} data-testid="lot-cycle-turn">{turn}</Badge>
      </div>

      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" data-testid="lot-cycle-steps">
        {cycle.steps.map((step, index) => {
          const state = step.done ? "done" : step.id === current ? "current" : "todo";
          return (
            <li
              key={step.id}
              data-testid={`lot-step-${step.id}`}
              data-state={state}
              className={cn(
                "flex items-start gap-2 rounded-md border p-2 text-sm",
                state === "done" && "border-green-500/40 bg-green-500/5",
                state === "current" && "border-primary bg-primary/5",
                state === "todo" && "text-muted-foreground",
              )}
            >
              {state === "done" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> : state === "current" ? <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0" />}
              <div className="min-w-0">
                <p className="font-medium leading-snug">{index + 1}. {m.steps[step.id]}</p>
                <p className="text-xs text-muted-foreground">
                  {m.actor[step.actor]}
                  {step.at ? ` · ${formatDate(step.at)}` : ""}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="rounded-md border bg-muted/30 p-3">
        <p className="text-sm" data-testid="lot-cycle-hint">{hint}</p>
        {current === "sign" && cycle.active.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{m.signedProgress(signedDone, cycle.active.length)}</p>}
        {cycle.waiting.length > 0 && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400" data-testid="lot-cycle-waiting">{m.waiting(cycle.waiting.length)}</p>}
        {nextActions.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{nextActions}</div>}
      </div>

      <div>
        <Button variant="ghost" size="sm" className="h-7 gap-1 px-1 text-xs" onClick={() => setShowLog((open) => !open)} aria-expanded={showLog} data-testid="lot-cycle-log-toggle">
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showLog && "rotate-180")} />
          {showLog ? m.log.hide : m.log.show}
        </Button>
        {showLog && (
          <ul className="mt-2 divide-y rounded-md border text-sm" data-testid="lot-cycle-log">
            {data.events.length === 0 ? (
              <li className="px-3 py-2 text-muted-foreground">{m.log.empty}</li>
            ) : (
              data.events.map((event) => (
                <li key={event.id} className="px-3 py-2" data-testid="lot-cycle-event">
                  <p className="font-medium">{m.eventLabels[event.event_type] ?? event.event_type}</p>
                  <p className="text-xs text-muted-foreground">{event.description}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(event.created_at)}</p>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {(["drafts", "copies", "issued"] as const).map((mode) => (
        <LotBulkDocumentsDialog key={mode} open={dialog === mode} mode={mode} batchId={batchId} onOpenChange={(open) => !open && setDialog(null)} onDone={changed} />
      ))}
      <LotVerifyDialog open={dialog === "verify"} batchId={batchId} data={data} onOpenChange={(open) => !open && setDialog(null)} onDone={changed} />
      <LotPaymentDialog open={dialog === "payment"} batchId={batchId} data={data} onOpenChange={(open) => !open && setDialog(null)} onDone={changed} />
      <LotPaymentCheckDialog open={dialog === "check"} batchId={batchId} data={data} onOpenChange={(open) => !open && setDialog(null)} onDone={changed} />
      <LotSentDialog open={dialog === "sent"} batchId={batchId} data={data} onOpenChange={(open) => !open && setDialog(null)} onDone={changed} />
    </Card>
  );
};

