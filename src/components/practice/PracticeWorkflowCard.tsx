import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Download, FileText, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { stageOf, type PracticeStage } from "@/lib/practiceStages";
import { callWorkflow, type WorkflowActionName } from "@/lib/workflowApi";
import { formatDate, getMessages, useMessages } from "@/i18n";
import { workflowMessages } from "@/i18n/messages/workflow";
import { useQueryClient } from "@tanstack/react-query";

interface PracticeWorkflowCardProps {
  practice: { id: string; status: string; financial_status: string | null; payment_date: string | null };
  isAdmin: boolean;
  /** The practice or its documents changed: the page reloads them. */
  onChanged: () => void;
}

interface WorkflowRow {
  source_portal: string | null;
  source_reference: string | null;
  target_portal: string | null;
  target_reference: string | null;
  sent_at: string | null;
  deliberated_at: string | null;
  deliberation_note: string | null;
  payment_due_date: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  issued_at: string | null;
  info_due_date: string | null;
}

interface FlowDocument {
  id: string;
  file_name: string;
  file_path: string;
  document_type: string | null;
  created_at: string;
}

type ActionKind = "markSent" | "requestInfo" | "provideInfo" | "deliberate" | "reject" | "registerPayment" | "issue" | "reopen";

const STEP_INDEX: Record<PracticeStage, number> = {
  da_lavorare: 0,
  in_valutazione: 1,
  integrazioni: 1,
  deliberata: 2,
  da_emettere: 3,
  emessa: 4,
  non_deliberata: 1,
};

const ACTIONS_BY_STAGE: Record<PracticeStage, ActionKind[]> = {
  da_lavorare: ["markSent", "deliberate", "reject"],
  in_valutazione: ["requestInfo", "deliberate", "reject"],
  integrazioni: ["provideInfo", "deliberate", "reject"],
  deliberata: ["registerPayment", "reject"],
  da_emettere: ["issue"],
  emessa: [],
  non_deliberata: [],
};

const ACTION_API: Record<ActionKind, WorkflowActionName> = {
  markSent: "workflow_mark_sent",
  requestInfo: "workflow_request_info",
  provideInfo: "workflow_provide_info",
  deliberate: "workflow_deliberate",
  reject: "workflow_reject",
  registerPayment: "workflow_register_payment",
  issue: "workflow_issue",
  reopen: "workflow_reopen",
};

const MAX_FILE_BYTES = 12 * 1024 * 1024;
const BUCKET = "practice-documents";

const today = () => new Date().toISOString().slice(0, 10);
/** The term proposed for the information requested: a week from today. */
const INFO_TERM_DAYS = 7;
const defaultInfoTerm = () => new Date(Date.now() + INFO_TERM_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** Whole days from today to a YYYY-MM-DD date (negative: already past). */
const daysUntil = (date: string) => {
  const target = new Date(`${date}T00:00:00`);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
};

const safeName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "documento.pdf";

const emptyForm = { portal: "", reference: "", message: "", note: "", reason: "", dueDate: "", paymentDate: today(), policyNumber: "", file: null as File | null };

export const PracticeWorkflowCard = ({ practice, isAdmin, onChanged }: PracticeWorkflowCardProps) => {
  const m = useMessages(workflowMessages);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const stage = stageOf(practice);
  const [workflow, setWorkflow] = useState<WorkflowRow | null>(null);
  const [documents, setDocuments] = useState<FlowDocument[]>([]);
  const [requestedInfo, setRequestedInfo] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ActionKind | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof emptyForm, string>>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data: flow }, { data: docs }, { data: events }] = await Promise.all([
      supabase.from("practice_workflow").select("*").eq("practice_id", practice.id).maybeSingle(),
      supabase
        .from("practice_documents")
        .select("id, file_name, file_path, document_type, created_at")
        .eq("practice_id", practice.id)
        .in("document_type", ["bozza_deliberata", "polizza_emessa"])
        .order("created_at", { ascending: false }),
      supabase
        .from("practice_events")
        .select("description")
        .eq("practice_id", practice.id)
        .eq("event_type", "workflow_info_requested")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
    setWorkflow((flow as WorkflowRow | null) ?? null);
    setDocuments((docs as FlowDocument[] | null) ?? []);
    const description = events?.[0]?.description as string | undefined;
    setRequestedInfo(description ? description.replace(/^[^:]*:\s*/, "") : null);
  }, [practice.id]);

  useEffect(() => {
    void load();
  }, [load, practice.status, practice.financial_status]);

  const openDialog = (kind: ActionKind) => {
    setForm({ ...emptyForm, paymentDate: today(), dueDate: kind === "requestInfo" ? defaultInfoTerm() : "" });
    setErrors({});
    setDialog(kind);
  };

  const uploadPdf = async (file: File, type: "bozza_deliberata" | "polizza_emessa") => {
    const path = `${practice.id}/${type}-${Date.now()}-${safeName(file.name)}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: "application/pdf", upsert: false });
    if (error) throw new Error(error.message);
    return { path, document: { file_name: file.name, mime_type: "application/pdf", storage_path: path } };
  };

  const validate = (kind: ActionKind) => {
    const found: typeof errors = {};
    const t = m.dialogs;
    if (kind === "requestInfo" && !form.message.trim()) found.message = t.required;
    if (kind === "reject" && !form.reason.trim()) found.reason = t.required;
    if ((kind === "deliberate" || kind === "issue") && form.file) {
      if (!(form.file.type === "application/pdf" || /\.pdf$/i.test(form.file.name))) found.file = t.deliberate.draftInvalid;
      else if (form.file.size > MAX_FILE_BYTES) found.file = t.deliberate.draftTooBig;
    }
    setErrors(found);
    return Object.keys(found).length === 0;
  };

  const run = async () => {
    if (!dialog || !validate(dialog)) return;
    setBusy(true);
    let uploadedPath: string | null = null;
    try {
      const payload: Record<string, unknown> = { practiceId: practice.id };
      if (dialog === "markSent") Object.assign(payload, { portalName: form.portal.trim() || undefined, reference: form.reference.trim() || undefined });
      if (dialog === "requestInfo") Object.assign(payload, { message: form.message.trim(), dueDate: form.dueDate || undefined });
      if (dialog === "provideInfo") payload.message = form.message.trim() || undefined;
      if (dialog === "reject") payload.reason = form.reason.trim();
      if (dialog === "reopen") payload.reason = form.reason.trim() || undefined;
      if (dialog === "registerPayment") payload.paymentDate = form.paymentDate || undefined;
      if (dialog === "deliberate") {
        Object.assign(payload, { paymentDueDate: form.dueDate || undefined, note: form.note.trim() || undefined });
        if (form.file) {
          const uploaded = await uploadPdf(form.file, "bozza_deliberata");
          uploadedPath = uploaded.path;
          payload.draft = uploaded.document;
        }
      }
      if (dialog === "issue") {
        payload.policyNumber = form.policyNumber.trim() || undefined;
        if (form.file) {
          const uploaded = await uploadPdf(form.file, "polizza_emessa");
          uploadedPath = uploaded.path;
          payload.document = uploaded.document;
        }
      }
      const result = await callWorkflow<{ to?: string; stage?: string }>(ACTION_API[dialog], payload);
      const next = (result.to ?? result.stage) as PracticeStage | undefined;
      toast({ title: m.actions.done, description: next && next in m.stages ? m.actions.doneText(m.stages[next]) : undefined });
      setDialog(null);
      void queryClient.invalidateQueries({ queryKey: ["practice-stage-counts"] });
      onChanged();
      void load();
    } catch (error) {
      // The server refused: the file uploaded for it is not left behind.
      if (uploadedPath) await supabase.storage.from(BUCKET).remove([uploadedPath]);
      toast({ variant: "destructive", title: m.actions.error, description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const downloadDocument = async (document: FlowDocument) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(document.file_path, 60, { download: document.file_name });
    if (error || !data?.signedUrl) {
      toast({ variant: "destructive", title: getMessages(workflowMessages).card.downloadError, description: error?.message });
      return;
    }
    window.location.assign(data.signedUrl);
  };

  const current = STEP_INDEX[stage];
  const finished = stage === "emessa";
  const due = workflow?.payment_due_date ?? null;
  const dueDays = due ? daysUntil(due) : null;
  const dueUrgent = stage === "deliberata" && dueDays !== null && dueDays <= 7;
  const rows: Array<[string, string | null]> = [];
  if (workflow?.source_portal) rows.push([m.card.source(workflow.source_portal), workflow.source_reference]);
  if (workflow?.sent_at) rows.push([workflow.target_portal ? m.card.sentTo(workflow.target_portal === "manuale" ? m.card.manual : workflow.target_portal) : m.card.sentOn, formatDate(workflow.sent_at)]);
  if (workflow?.target_reference) rows.push([m.card.reference, workflow.target_reference]);
  if (workflow?.deliberated_at && stage !== "da_lavorare" && stage !== "non_deliberata") rows.push([m.card.deliberatedOn, formatDate(workflow.deliberated_at)]);
  if (practice.payment_date && (stage === "da_emettere" || stage === "emessa")) rows.push([m.card.paidOn, formatDate(practice.payment_date)]);
  if (workflow?.issued_at && stage === "emessa") rows.push([m.card.issuedOn, formatDate(workflow.issued_at)]);
  if (workflow?.rejected_at && stage === "non_deliberata") rows.push([m.card.rejectedOn, formatDate(workflow.rejected_at)]);

  const actions = isAdmin ? [...ACTIONS_BY_STAGE[stage], ...(stage === "da_lavorare" ? [] : (["reopen"] as ActionKind[]))] : [];
  const field = (key: keyof typeof emptyForm) => ({
    value: form[key] as string,
    onChange: (event: { target: { value: string } }) => setForm((previous) => ({ ...previous, [key]: event.target.value })),
  });
  const t = m.dialogs;
  const fileInput = (label: string, hint?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor="workflow-file">{label}</Label>
      <Input
        id="workflow-file"
        type="file"
        accept="application/pdf,.pdf"
        onChange={(event) => setForm((previous) => ({ ...previous, file: event.target.files?.[0] ?? null }))}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {errors.file && <p className="text-xs text-destructive">{errors.file}</p>}
    </div>
  );

  return (
    <Card className="p-6" data-testid="workflow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-foreground">{m.card.title}</h3>
        <Badge variant="secondary" data-testid="workflow-stage">{m.stages[stage]}</Badge>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">{m.stageHints[stage]}</p>

      <ol className="mb-5 grid grid-cols-5 gap-2" aria-label={m.card.title}>
        {m.card.steps.map((label, index) => {
          const done = index < current || finished;
          const active = index === current && !finished && stage !== "non_deliberata";
          return (
            <li key={label} className="flex min-w-0 flex-col items-center gap-1.5 text-center">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary bg-primary/10 text-primary ring-2 ring-primary/30",
                  !done && !active && "border-border text-muted-foreground",
                  stage === "non_deliberata" && index === current && "border-primary bg-primary text-primary-foreground",
                )}
              >
                {done || (stage === "non_deliberata" && index === current) ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <span className={cn("break-words text-[11px] leading-tight", active ? "font-semibold text-foreground" : "text-muted-foreground")}>{label}</span>
            </li>
          );
        })}
      </ol>
      {stage === "integrazioni" && (
        <div className="mb-4 rounded-md border border-orange-500/30 bg-orange-500/10 p-3 text-sm">
          <p className="font-medium text-orange-600 dark:text-orange-400">{m.card.requestedInfo}</p>
          {requestedInfo && <p className="mt-1 text-foreground">{requestedInfo}</p>}
          {workflow?.info_due_date && (
            <p
              className={cn("mt-1 text-xs font-medium", workflow.info_due_date < today() ? "text-destructive" : "text-muted-foreground")}
              data-testid="info-due"
            >
              {workflow.info_due_date < today() ? m.card.infoOverdue(formatDate(workflow.info_due_date)) : m.card.infoDue(formatDate(workflow.info_due_date))}
            </p>
          )}
        </div>
      )}
      {stage === "non_deliberata" && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
          <p className="font-medium text-destructive">{m.card.rejectedStep}</p>
          {workflow?.rejection_reason && (
            <p className="mt-1 text-foreground">
              {m.card.rejectionReason}: {workflow.rejection_reason}
            </p>
          )}
        </div>
      )}
      {(stage === "deliberata" || stage === "da_emettere" || stage === "emessa") && due && (
        <div
          className={cn(
            "mb-4 flex items-start gap-2 rounded-md border p-3 text-sm",
            dueUrgent ? "border-amber-500/40 bg-amber-500/10" : "border-border bg-muted/40",
          )}
        >
          {dueUrgent && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />}
          <div>
            <span className="text-muted-foreground">{m.card.paymentDue}: </span>
            <span className="font-medium text-foreground">{formatDate(due)}</span>
            {stage === "deliberata" && dueDays !== null && (
              <span className={cn("ml-2", dueUrgent ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                ({dueDays < 0 ? m.card.overdue(-dueDays) : dueDays === 0 ? m.card.dueToday : m.card.daysLeft(dueDays)})
              </span>
            )}
          </div>
        </div>
      )}

      {(rows.length > 0 || workflow?.deliberation_note) && (
        <dl className="mb-4 space-y-1.5 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex flex-wrap gap-x-2">
              <dt className="text-muted-foreground">{label}{value ? ":" : ""}</dt>
              {value && <dd className="font-medium text-foreground">{value}</dd>}
            </div>
          ))}
          {workflow?.deliberation_note && stage !== "non_deliberata" && (
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-muted-foreground">{m.card.companyNote}:</dt>
              <dd className="text-foreground">{workflow.deliberation_note}</dd>
            </div>
          )}
        </dl>
      )}

      {documents.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-sm font-medium text-foreground">{m.card.documents}</p>
          <ul className="space-y-2">
            {documents.map((document) => (
              <li key={document.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{document.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {document.document_type === "polizza_emessa" ? m.card.issuedPolicy : m.card.draft} · {formatDate(document.created_at)}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => void downloadDocument(document)}>
                  <Download className="mr-1.5 h-4 w-4" />
                  {m.card.download}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {actions.length > 0 && (
        <div className="border-t border-border pt-4">
          <p className="mb-1 text-sm font-medium text-foreground">{m.actions.title}</p>
          <p className="mb-3 text-xs text-muted-foreground">{m.actions.hint}</p>
          <div className="flex flex-wrap gap-2">
            {actions.map((kind) => (
              <Button
                key={kind}
                size="sm"
                variant={kind === "reject" ? "destructive" : kind === "reopen" ? "outline" : "default"}
                onClick={() => openDialog(kind)}
                data-testid={`workflow-action-${kind}`}
              >
                {m.actions[kind]}
              </Button>
            ))}
          </div>
        </div>
      )}

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && !busy && setDialog(null)}>
        <DialogContent>
          {dialog && (
            <>
              <DialogHeader>
                <DialogTitle>{t[dialog].title}</DialogTitle>
                <DialogDescription>{t[dialog].text}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {dialog === "markSent" && (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="workflow-portal">{t.markSent.portal}</Label>
                      <Input id="workflow-portal" placeholder={t.markSent.portalPlaceholder} {...field("portal")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="workflow-reference">{t.markSent.reference}</Label>
                      <Input id="workflow-reference" {...field("reference")} />
                    </div>
                  </>
                )}
                {(dialog === "requestInfo" || dialog === "provideInfo") && (
                  <div className="space-y-1.5">
                    <Label htmlFor="workflow-message">{dialog === "requestInfo" ? t.requestInfo.message : t.provideInfo.message}</Label>
                    <Textarea id="workflow-message" rows={4} {...field("message")} />
                    {errors.message && <p className="text-xs text-destructive">{errors.message}</p>}
                  </div>
                )}
                {dialog === "requestInfo" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="workflow-info-due">{t.requestInfo.dueDate}</Label>
                    <Input id="workflow-info-due" type="date" min={today()} {...field("dueDate")} />
                    <p className="text-xs text-muted-foreground">{t.requestInfo.dueHint}</p>
                  </div>
                )}
                {dialog === "deliberate" && (
                  <>
                    {fileInput(t.deliberate.draft, t.deliberate.draftHint)}
                    <div className="space-y-1.5">
                      <Label htmlFor="workflow-due">{t.deliberate.dueDate}</Label>
                      <Input id="workflow-due" type="date" min={today()} {...field("dueDate")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="workflow-note">{t.deliberate.note}</Label>
                      <Textarea id="workflow-note" rows={3} {...field("note")} />
                    </div>
                  </>
                )}
                {(dialog === "reject" || dialog === "reopen") && (
                  <div className="space-y-1.5">
                    <Label htmlFor="workflow-reason">{dialog === "reject" ? t.reject.reason : t.reopen.reason}</Label>
                    <Textarea id="workflow-reason" rows={3} {...field("reason")} />
                    {errors.reason && <p className="text-xs text-destructive">{errors.reason}</p>}
                  </div>
                )}
                {dialog === "registerPayment" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="workflow-paid">{t.registerPayment.date}</Label>
                    <Input id="workflow-paid" type="date" max={today()} {...field("paymentDate")} />
                  </div>
                )}
                {dialog === "issue" && (
                  <>
                    {fileInput(t.issue.document)}
                    <div className="space-y-1.5">
                      <Label htmlFor="workflow-policy">{t.issue.policyNumber}</Label>
                      <Input id="workflow-policy" {...field("policyNumber")} />
                    </div>
                  </>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" disabled={busy} onClick={() => setDialog(null)}>
                  {m.actions.cancel}
                </Button>
                <Button disabled={busy} onClick={() => void run()} data-testid="workflow-confirm">
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {busy ? m.actions.working : m.actions.confirm}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
