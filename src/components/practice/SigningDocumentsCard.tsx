import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Clock, Download, FileSignature, Loader2, Send, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { requestNotificationFlush } from "@/lib/portalActions";
import { cn } from "@/lib/utils";
import { stageOf } from "@/lib/practiceStages";
import { callWorkflow } from "@/lib/workflowApi";
import {
  COMPANY_COPY_DOCUMENT_TYPE,
  PRACTICE_DOCUMENTS_BUCKET,
  SIGNED_DOCUMENT_TYPES,
  companyCopyPath,
  isSigningStage,
  signaturesComplete,
  signedDocumentPath,
  signingStatus,
  storageReferenceOf,
  type SigningSlot,
  type SigningSlotId,
} from "@/lib/signingDocuments";
import { listSigningTemplates, saveBlob, type TemplateInfo } from "@/lib/signingTemplates";
import { generateSigningDocument, loadPrefillInputs } from "@/lib/signingPrefillData";
import { formatDate, getMessages, useMessages } from "@/i18n";
import { signingMessages } from "@/i18n/messages/signing";

interface SigningDocumentsCardProps {
  practice: { id: string; practice_number: string; status: string; financial_status: string | null };
  isAdmin: boolean;
  /** Cambiando il valore l'elenco viene ricaricato (es. dopo una deliberazione). */
  refreshToken?: number;
  /** Un documento e' stato caricato o le copie sono state trasmesse: la pagina ricarica i documenti. */
  onChanged?: () => void;
}

interface FlowDocument {
  id: string;
  file_name: string;
  file_path: string;
  document_type: string | null;
  created_at: string;
}

const MAX_FILE_BYTES = 12 * 1024 * 1024;

/**
 * Documenti da firmare della pratica (flusso VIES), dopo la deliberazione e nell'ordine di firma:
 * la polizza nella copia per la Compagnia, privacy, MUP, antiriciclaggio. La bozza si controlla,
 * non si firma. Con tutte le copie firmate caricate, il portale le trasmette da solo alla compagnia.
 */
export const SigningDocumentsCard = ({ practice, isAdmin, refreshToken = 0, onChanged }: SigningDocumentsCardProps) => {
  const m = useMessages(signingMessages);
  const { toast } = useToast();
  const stage = stageOf(practice);
  const signing = isSigningStage(stage);
  const [documents, setDocuments] = useState<FlowDocument[]>([]);
  const [templates, setTemplates] = useState<Map<SigningSlotId, TemplateInfo>>(new Map());
  const [sentAt, setSentAt] = useState<string | null>(null);
  const [busy, setBusy] = useState<SigningSlotId | "company_copy" | "send" | "policy" | null>(null);
  const sendingRef = useRef(false);
  // Numero di polizza della compagnia: arriva dopo la delibera, con la copia per la Compagnia.
  const [policyNumber, setPolicyNumber] = useState<string>("");
  const [policyDraft, setPolicyDraft] = useState<string>("");

  const load = useCallback(async () => {
    const [{ data: rows }, { data: flow }, found, { data: practiceRow }] = await Promise.all([
      supabase
        .from("practice_documents")
        .select("id, file_name, file_path, document_type, created_at")
        .eq("practice_id", practice.id)
        .in("document_type", [...SIGNED_DOCUMENT_TYPES, COMPANY_COPY_DOCUMENT_TYPE])
        .order("created_at", { ascending: false }),
      supabase.from("practice_workflow").select("signed_sent_at").eq("practice_id", practice.id).maybeSingle(),
      listSigningTemplates(),
      supabase.from("practices").select("policy_number").eq("id", practice.id).maybeSingle(),
    ]);
    const saved = ((practiceRow as { policy_number?: string | null } | null)?.policy_number ?? "").trim();
    // "VIES-<n>" e' il riferimento interno del portale, non il numero della compagnia.
    const real = /^VIES-/i.test(saved) ? "" : saved;
    setPolicyNumber(real);
    setPolicyDraft((current) => current || real);
    const wanted = new Set([...SIGNED_DOCUMENT_TYPES, COMPANY_COPY_DOCUMENT_TYPE]);
    setDocuments(((rows as FlowDocument[] | null) ?? []).filter((row) => wanted.has(row.document_type ?? "")));
    setSentAt(((flow as { signed_sent_at?: string | null } | null)?.signed_sent_at as string | null | undefined) ?? null);
    setTemplates(found);
  }, [practice.id]);

  useEffect(() => {
    void load();
  }, [load, practice.status, practice.financial_status, refreshToken]);

  const status = useMemo(() => signingStatus(documents, stage), [documents, stage]);
  const signedCount = status.filter((entry) => entry.signed).length;
  const complete = signaturesComplete(documents, stage);

  const fail = (title: string, error: unknown) =>
    toast({ variant: "destructive", title, description: error instanceof Error ? error.message : undefined });

  /** Con tutte le firme caricate le copie partono verso la compagnia (una volta sola). */
  const sendSigned = useCallback(
    async (options: { resend?: boolean; silent?: boolean } = {}) => {
      if (sendingRef.current) return;
      sendingRef.current = true;
      setBusy("send");
      const text = getMessages(signingMessages).card;
      try {
        const result = await callWorkflow<{ sentAt?: string; changed?: boolean }>("workflow_send_signed", { practiceId: practice.id, resend: options.resend === true });
        if (result.changed && !options.silent) toast({ title: text.sentToastTitle, description: text.sentToastText });
        onChanged?.();
        await load();
        // La risposta del server vince su una lettura del database ancora indietro.
        if (result.sentAt) setSentAt(result.sentAt);
      } catch (error) {
        fail(text.sendErrorTitle, error);
      } finally {
        sendingRef.current = false;
        setBusy(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast and fail are stable for this card's purposes
    [practice.id, load, onChanged],
  );

  // L'ultima firma caricata (anche da un'altra pagina, es. lo ZIP del lotto) fa partire la trasmissione.
  // Parte una volta sola per pratica: se il server rifiuta, resta il pulsante manuale.
  const autoSentForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!complete || sentAt || busy !== null) return;
    if (autoSentForRef.current === practice.id) return;
    autoSentForRef.current = practice.id;
    void sendSigned({ silent: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the set of signatures becomes complete
  }, [complete, sentAt, practice.id]);

  const savePolicyNumber = async () => {
    const value = policyDraft.trim();
    if (!value) return;
    setBusy("policy");
    const text = getMessages(signingMessages).card;
    try {
      await callWorkflow("workflow_set_policy_number", { practiceId: practice.id, policyNumber: value });
      setPolicyNumber(value);
      toast({ title: text.policyNumberSaved, description: value });
      onChanged?.();
    } catch (error) {
      fail(text.policyNumberError, error);
    } finally {
      setBusy(null);
    }
  };

  const downloadTemplate = async (slot: SigningSlot) => {
    try {
      const input = (await loadPrefillInputs([practice.id])).get(practice.id) ?? null;
      saveBlob(await generateSigningDocument(slot.id, input), `${slot.order}_${slot.id}_${practice.practice_number}.pdf`);
    } catch (error) {
      fail(getMessages(signingMessages).card.downloadErrorTitle, error);
    }
  };

  const downloadStored = async (document: FlowDocument) => {
    try {
      const reference = storageReferenceOf(document.file_path);
      const { data, error } = await supabase.storage.from(reference.bucket).download(reference.path);
      if (error || !data) throw error ?? new Error("empty");
      saveBlob(data, document.file_name);
    } catch (error) {
      fail(getMessages(signingMessages).card.downloadErrorTitle, error);
    }
  };

  const checkPdf = (file: File) => {
    const text = getMessages(signingMessages).card;
    if (!(file.type === "application/pdf" || /\.pdf$/i.test(file.name))) throw new Error(text.onlyPdf);
    if (file.size > MAX_FILE_BYTES) throw new Error(text.tooBig);
  };

  const storeDocument = async (file: File, path: string, documentType: string) => {
    const text = getMessages(signingMessages).card;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error(text.notAuthenticated);
    const { error: uploadError } = await supabase.storage.from(PRACTICE_DOCUMENTS_BUCKET).upload(path, file, { contentType: "application/pdf", upsert: false });
    if (uploadError) throw new Error(uploadError.message);
    const { error: insertError } = await supabase.from("practice_documents").insert({
      practice_id: practice.id,
      file_name: file.name,
      file_path: path,
      file_size: file.size,
      mime_type: "application/pdf",
      uploaded_by: session.user.id,
      document_type: documentType,
    });
    if (insertError) {
      await supabase.storage.from(PRACTICE_DOCUMENTS_BUCKET).remove([path]);
      throw new Error(insertError.message);
    }
  };

  const uploadSigned = async (slot: SigningSlot, file: File) => {
    const text = getMessages(signingMessages).card;
    setBusy(slot.id);
    try {
      checkPdf(file);
      await storeDocument(file, signedDocumentPath(practice.id, slot.id, file.name), slot.signedType);
      toast({ title: text.uploadedTitle, description: text.uploadedText(m.slots[slot.id].label) });
      requestNotificationFlush();
      onChanged?.();
      await load();
    } catch (error) {
      fail(text.uploadErrorTitle, error);
    } finally {
      setBusy(null);
    }
  };

  const uploadCompanyCopy = async (file: File) => {
    const text = getMessages(signingMessages).card;
    setBusy("company_copy");
    try {
      checkPdf(file);
      await storeDocument(file, companyCopyPath(practice.id, file.name), COMPANY_COPY_DOCUMENT_TYPE);
      toast({ title: text.companyCopyUploadedTitle, description: text.companyCopyUploadedText });
      requestNotificationFlush();
      onChanged?.();
      await load();
    } catch (error) {
      fail(text.uploadErrorTitle, error);
    } finally {
      setBusy(null);
    }
  };

  const fileInputId = (key: string) => `signing-upload-${practice.id}-${key}`;

  return (
    <Card className="p-6" data-testid="signing-card">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <FileSignature className="h-5 w-5" />
          {m.card.title}
        </h2>
        {signing && (
          <Badge variant={complete ? "default" : "secondary"} data-testid="signing-progress">
            {m.card.progress(signedCount, status.length)}
          </Badge>
        )}
      </div>
      <p className="mb-5 text-sm text-muted-foreground">{isAdmin ? m.card.introAdmin : m.card.intro}</p>

      {!signing && (
        <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-sm text-muted-foreground" data-testid="signing-before">
          {m.card.beforeSigning}
        </div>
      )}

      {signing && (sentAt || complete) && (
        <div
          className={cn("mb-4 rounded-md border p-3 text-sm", sentAt ? "border-green-500/40 bg-green-500/10" : "border-blue-500/30 bg-blue-500/10")}
          data-testid={sentAt ? "signing-sent" : "signing-sending"}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className={cn("font-medium", sentAt ? "text-green-700 dark:text-green-400" : "text-blue-700 dark:text-blue-300")}>
                {sentAt ? m.card.sentTitle(formatDate(sentAt)) : m.card.readyToSend}
              </p>
              {sentAt && <p className="mt-1 text-foreground">{m.card.sentText}</p>}
            </div>
            <Button size="sm" variant={sentAt ? "outline" : "default"} disabled={busy !== null} onClick={() => void sendSigned({ resend: Boolean(sentAt) })} data-testid="signing-send">
              {busy === "send" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
              {busy === "send" ? m.card.sending : sentAt ? m.card.resendAction : m.card.sendAction}
            </Button>
          </div>
        </div>
      )}

      {signing && isAdmin && (
        <div className="mb-4 rounded-md border p-3" data-testid="signing-policy-number">
          <Label htmlFor="signing-policy-input" className="text-sm font-medium">{m.card.policyNumber}</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">{m.card.policyNumberHint}</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Input id="signing-policy-input" value={policyDraft} maxLength={100} onChange={(event) => setPolicyDraft(event.target.value)} className="sm:max-w-sm" />
            <Button size="sm" variant="outline" disabled={busy !== null || !policyDraft.trim() || policyDraft.trim() === policyNumber} onClick={() => void savePolicyNumber()} data-testid="signing-policy-save">
              {busy === "policy" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {m.card.policyNumberSave}
            </Button>
          </div>
        </div>
      )}

      {signing && (
        <ol className="space-y-3">
          {status.map(({ slot, source, signed }) => {
            const template = templates.get(slot.id);
            const slotText = m.slots[slot.id];
            const canDownload = slot.hasTemplate ? slot.builtIn || Boolean(template) : Boolean(source);
            return (
              <li
                key={slot.id}
                className={cn("rounded-lg border p-4", signed ? "border-green-500/40 bg-green-500/5" : "border-border")}
                data-testid={`signing-slot-${slot.id}`}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-muted-foreground">{m.card.stepLabel(slot.order)}</span>
                      {signed ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" /> : <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />}
                      <p className="font-medium text-foreground">{slotText.label}</p>
                      {signed ? (
                        <Badge variant="outline" className="border-green-500/40 text-green-700 dark:text-green-400">{m.card.signedOn(formatDate(signed.created_at))}</Badge>
                      ) : (
                        <Badge variant="outline">{m.card.toSign}</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{slotText.description}</p>
                    {signed && <p className="mt-1 truncate text-xs text-muted-foreground">{signed.file_name}</p>}
                    {slot.hasTemplate && !slot.builtIn && !template && (
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{isAdmin ? m.card.templateMissingAdmin : m.card.templateMissing}</p>
                    )}
                    {!slot.hasTemplate && !source && (
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{isAdmin ? m.card.companyCopyMissingAdmin : m.card.companyCopyMissing}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    {slot.hasTemplate ? (
                      <Button variant="outline" size="sm" disabled={!canDownload} onClick={() => void downloadTemplate(slot)}>
                        <Download className="mr-1.5 h-4 w-4" />
                        {m.card.template}
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" disabled={!canDownload} onClick={() => source && void downloadStored(source)} data-testid="signing-company-copy-download">
                        <Download className="mr-1.5 h-4 w-4" />
                        {m.card.companyCopy}
                      </Button>
                    )}
                    {!slot.hasTemplate && isAdmin && (
                      <>
                        <input
                          id={fileInputId("company_copy")}
                          type="file"
                          accept="application/pdf,.pdf"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = "";
                            if (file) void uploadCompanyCopy(file);
                          }}
                        />
                        <Button asChild size="sm" variant="outline" disabled={busy !== null}>
                          <label htmlFor={fileInputId("company_copy")} className="cursor-pointer" data-testid="signing-company-copy-upload">
                            {busy === "company_copy" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
                            {m.card.uploadCompanyCopy}
                          </label>
                        </Button>
                      </>
                    )}
                    {signed && (
                      <Button variant="outline" size="sm" onClick={() => void downloadStored(signed)}>
                        <Download className="mr-1.5 h-4 w-4" />
                        {m.card.downloadSigned}
                      </Button>
                    )}
                    <input
                      id={fileInputId(slot.id)}
                      type="file"
                      accept="application/pdf,.pdf"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (file) void uploadSigned(slot, file);
                      }}
                    />
                    <Button asChild size="sm" variant={signed ? "ghost" : "default"} disabled={busy !== null}>
                      <label htmlFor={fileInputId(slot.id)} className="cursor-pointer" data-testid={`signing-upload-${slot.id}`}>
                        {busy === slot.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
                        {busy === slot.id ? m.card.uploading : signed ? m.card.replaceSigned : m.card.uploadSigned}
                      </label>
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {signing && complete && <p className="mt-4 text-sm font-medium text-green-700 dark:text-green-400">{m.card.allSigned}</p>}
    </Card>
  );
};
