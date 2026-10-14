import { useCallback, useEffect, useState } from "react";
import { Check, CheckCircle2, ChevronDown, Download, FileSignature, FileText, Loader2, Send, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { EYEBROW, GLASS, GLASS_BUTTON, PRIMARY_BUTTON, SERIF, STAGE } from "./lotGlass";
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

  if (failed && !data) return <div className={cn(GLASS, "p-4 text-sm text-muted-foreground")} data-testid="lot-cycle-error">{m.log.error}</div>;
  if (!data) return <div className={cn(GLASS, "p-4 text-sm text-muted-foreground")} data-testid="lot-cycle-loading">{m.log.loading}</div>;

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
      className={cn("h-9 rounded-lg px-3.5", options.primary ? PRIMARY_BUTTON : GLASS_BUTTON)}
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
    <section className={STAGE} data-testid="lot-cycle" aria-label={m.title(title)}>
      {/* Due aloni sfocati dietro al vetro: il blu del marchio e il bronzo. */}
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-28 -z-10 h-72 w-72 rounded-full bg-[hsl(205,70%,32%)]/15 blur-3xl dark:bg-[hsl(205,70%,40%)]/20" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -right-20 -z-10 h-72 w-72 rounded-full bg-[hsl(30,45%,60%)]/25 blur-3xl dark:bg-[hsl(30,45%,55%)]/15" />

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={EYEBROW}>{m.eyebrow}</p>
          <h2 className={cn(SERIF, "mt-1 text-2xl font-semibold leading-tight text-foreground")}>{title}</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{m.intro}</p>
        </div>
        <span
          data-testid="lot-cycle-turn"
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium",
            mine && !cycle.closed
              ? "bg-primary text-primary-foreground shadow-[0_8px_18px_-10px_rgba(15,58,92,0.9)]"
              : "border border-white/70 bg-white/60 text-foreground/80 backdrop-blur dark:border-white/15 dark:bg-white/10",
          )}
        >
          <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", mine && !cycle.closed ? "bg-[hsl(30,45%,68%)]" : cycle.closed ? "bg-emerald-600" : "bg-foreground/40")} />
          {turn}
        </span>
      </header>

      <div className={cn(GLASS, "mt-5 px-3 py-5 sm:px-5")}>
        <ol className="grid gap-y-1 lg:grid-cols-8 lg:gap-y-0" data-testid="lot-cycle-steps">
          {cycle.steps.map((step, index) => {
            const state = step.done ? "done" : step.id === current ? "current" : "todo";
            const previous = index > 0 ? cycle.steps[index - 1] : null;
            return (
              <li key={step.id} data-testid={`lot-step-${step.id}`} data-state={state} className="relative flex gap-3 pb-4 last:pb-0 lg:flex-col lg:items-center lg:gap-2 lg:pb-0 lg:text-center">
                {/* Il filo che unisce i passaggi: pieno fino a dove si e' arrivati, sfumato verso il bronzo sul passaggio in corso. */}
                {previous && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-[15px] top-[-1.4rem] h-[calc(100%-0.4rem)] w-px lg:left-auto lg:right-1/2 lg:top-[15px] lg:h-px lg:w-full",
                      previous.done && step.done && "bg-primary/55",
                      previous.done && !step.done && "bg-gradient-to-b from-primary/55 to-[hsl(30,45%,58%)] lg:bg-gradient-to-r",
                      !previous.done && "bg-foreground/15",
                    )}
                  />
                )}
                <span
                  className={cn(
                    "relative z-10 flex h-[31px] w-[31px] shrink-0 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums transition-colors",
                    state === "done" && "bg-primary text-primary-foreground shadow-[0_6px_14px_-8px_rgba(15,58,92,0.9)]",
                    state === "current" && "bg-white text-primary ring-2 ring-[hsl(30,45%,58%)] ring-offset-2 ring-offset-white/60 shadow-[0_8px_20px_-8px_rgba(176,137,104,0.8)] dark:bg-slate-900 dark:text-white",
                    state === "todo" && "border border-foreground/15 bg-white/50 text-muted-foreground dark:bg-white/5",
                  )}
                >
                  {state === "done" ? <Check className="h-4 w-4" strokeWidth={2.5} /> : index + 1}
                </span>
                <div className="min-w-0 lg:px-1">
                  <p className={cn("text-[13px] font-medium leading-snug", state === "todo" ? "text-muted-foreground" : "text-foreground")}>{m.steps[step.id]}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {m.actor[step.actor]}
                    {step.at ? ` · ${formatDate(step.at)}` : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className={cn(GLASS, "mt-4 p-4 sm:p-5")}>
        <p className={EYEBROW}>{cycle.closed ? m.eyebrowClosed : m.eyebrowNext}</p>
        <h3 className={cn(SERIF, "mt-1 text-lg font-semibold text-foreground")}>{current ? m.steps[current] : m.turn.closed}</h3>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-foreground/80" data-testid="lot-cycle-hint">{hint}</p>
        {current === "sign" && cycle.active.length > 0 && (
          <div className="mt-3 max-w-md">
            <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10" role="progressbar" aria-valuemin={0} aria-valuemax={cycle.active.length} aria-valuenow={signedDone}>
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-[hsl(30,45%,58%)] transition-all" style={{ width: `${(signedDone / cycle.active.length) * 100}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{m.signedProgress(signedDone, cycle.active.length)}</p>
          </div>
        )}
        {cycle.waiting.length > 0 && (
          <p className="mt-3 flex items-center gap-2 text-xs text-[hsl(30,40%,36%)] dark:text-[hsl(30,40%,68%)]" data-testid="lot-cycle-waiting">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[hsl(30,45%,58%)]" />
            {m.waiting(cycle.waiting.length)}
          </p>
        )}
        {nextActions.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{nextActions}</div>}
      </div>

      <div className="mt-3">
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:bg-white/50" onClick={() => setShowLog((open) => !open)} aria-expanded={showLog} data-testid="lot-cycle-log-toggle">
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showLog && "rotate-180")} />
          {showLog ? m.log.hide : m.log.show}
        </Button>
        {showLog && (
          <ol className={cn(GLASS, "mt-2 divide-y divide-foreground/5 overflow-hidden")} data-testid="lot-cycle-log">
            {data.events.length === 0 ? (
              <li className="px-4 py-3 text-sm text-muted-foreground">{m.log.empty}</li>
            ) : (
              data.events.map((event) => (
                <li key={event.id} className="flex gap-3 px-4 py-3" data-testid="lot-cycle-event">
                  <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[hsl(30,45%,58%)]" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{m.eventLabels[event.event_type] ?? event.event_type}</p>
                    <p className="text-xs text-muted-foreground">{event.description}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground/80">{formatDateTime(event.created_at)}</p>
                  </div>
                </li>
              ))
            )}
          </ol>
        )}
      </div>

      {(["drafts", "copies", "issued"] as const).map((mode) => (
        <LotBulkDocumentsDialog key={mode} open={dialog === mode} mode={mode} batchId={batchId} onOpenChange={(open) => !open && setDialog(null)} onDone={changed} />
      ))}
      <LotVerifyDialog open={dialog === "verify"} batchId={batchId} data={data} onOpenChange={(open) => !open && setDialog(null)} onDone={changed} />
      <LotPaymentDialog open={dialog === "payment"} batchId={batchId} data={data} onOpenChange={(open) => !open && setDialog(null)} onDone={changed} />
      <LotPaymentCheckDialog open={dialog === "check"} batchId={batchId} data={data} onOpenChange={(open) => !open && setDialog(null)} onDone={changed} />
      <LotSentDialog open={dialog === "sent"} batchId={batchId} data={data} onOpenChange={(open) => !open && setDialog(null)} onDone={changed} />
    </section>
  );
};

