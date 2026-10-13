import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, Download, FileSignature, Loader2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { requestNotificationFlush } from "@/lib/portalActions";
import { cn } from "@/lib/utils";
import { stageOf } from "@/lib/practiceStages";
import {
  PRACTICE_DOCUMENTS_BUCKET,
  SIGNED_DOCUMENT_TYPES,
  signedDocumentPath,
  signingStatus,
  storageReferenceOf,
  type SigningSlot,
  type SigningSlotId,
} from "@/lib/signingDocuments";
import { downloadSigningTemplate, listSigningTemplates, saveBlob, type TemplateInfo } from "@/lib/signingTemplates";
import { formatDate, getMessages, useMessages } from "@/i18n";
import { signingMessages } from "@/i18n/messages/signing";

interface SigningDocumentsCardProps {
  practice: { id: string; practice_number: string; status: string; financial_status: string | null };
  isAdmin: boolean;
  /** Cambiando il valore l'elenco viene ricaricato (es. dopo una deliberazione). */
  refreshToken?: number;
  /** Un documento firmato e' stato caricato: la pagina ricarica i documenti. */
  onChanged?: () => void;
}

interface SignedDocument {
  id: string;
  file_name: string;
  file_path: string;
  document_type: string | null;
  created_at: string;
}

const MAX_FILE_BYTES = 12 * 1024 * 1024;

/**
 * Documenti da firmare della pratica (flusso VIES): per ognuno il modello da scaricare, la copia
 * firmata da caricare e lo stato. Il rappresentante fiscale li firma dal proprio sistema, anche in
 * blocco, e li ricarica qui o con lo ZIP del lotto.
 */
export const SigningDocumentsCard = ({ practice, isAdmin, refreshToken = 0, onChanged }: SigningDocumentsCardProps) => {
  const m = useMessages(signingMessages);
  const { toast } = useToast();
  const stage = stageOf(practice);
  const [documents, setDocuments] = useState<SignedDocument[]>([]);
  const [draft, setDraft] = useState<SignedDocument | null>(null);
  const [templates, setTemplates] = useState<Map<SigningSlotId, TemplateInfo>>(new Map());
  const [busy, setBusy] = useState<SigningSlotId | null>(null);

  const load = useCallback(async () => {
    const [{ data: signed }, { data: drafts }, found] = await Promise.all([
      supabase
        .from("practice_documents")
        .select("id, file_name, file_path, document_type, created_at")
        .eq("practice_id", practice.id)
        .in("document_type", SIGNED_DOCUMENT_TYPES)
        .order("created_at", { ascending: false }),
      supabase
        .from("practice_documents")
        .select("id, file_name, file_path, document_type, created_at")
        .eq("practice_id", practice.id)
        .eq("document_type", "bozza_deliberata")
        .order("created_at", { ascending: false })
        .limit(1),
      listSigningTemplates(),
    ]);
    setDocuments(((signed as SignedDocument[] | null) ?? []).filter((row) => SIGNED_DOCUMENT_TYPES.includes(row.document_type ?? "")));
    setDraft(((drafts as SignedDocument[] | null) ?? []).find((row) => row.document_type === "bozza_deliberata") ?? null);
    setTemplates(found);
  }, [practice.id]);

  useEffect(() => {
    void load();
  }, [load, practice.status, practice.financial_status, refreshToken]);

  const status = useMemo(() => signingStatus(documents, stage), [documents, stage]);
  const available = status.filter((entry) => entry.available);
  const signedCount = available.filter((entry) => entry.signed).length;

  const fail = (title: string, error: unknown) =>
    toast({ variant: "destructive", title, description: error instanceof Error ? error.message : undefined });

  const downloadTemplate = async (slot: SigningSlot) => {
    try {
      const blob = await downloadSigningTemplate(slot.id);
      saveBlob(blob, `${slot.id}_${practice.practice_number}.pdf`);
    } catch (error) {
      fail(getMessages(signingMessages).card.downloadErrorTitle, error);
    }
  };

  const downloadStored = async (document: SignedDocument) => {
    try {
      const reference = storageReferenceOf(document.file_path);
      const { data, error } = await supabase.storage.from(reference.bucket).download(reference.path);
      if (error || !data) throw error ?? new Error("empty");
      saveBlob(data, document.file_name);
    } catch (error) {
      fail(getMessages(signingMessages).card.downloadErrorTitle, error);
    }
  };

  const uploadSigned = async (slot: SigningSlot, file: File) => {
    const text = getMessages(signingMessages).card;
    if (!(file.type === "application/pdf" || /\.pdf$/i.test(file.name))) return fail(text.uploadErrorTitle, new Error(text.onlyPdf));
    if (file.size > MAX_FILE_BYTES) return fail(text.uploadErrorTitle, new Error(text.tooBig));
    setBusy(slot.id);
    const path = signedDocumentPath(practice.id, slot.id, file.name);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error(text.notAuthenticated);
      const { error: uploadError } = await supabase.storage
        .from(PRACTICE_DOCUMENTS_BUCKET)
        .upload(path, file, { contentType: "application/pdf", upsert: false });
      if (uploadError) throw new Error(uploadError.message);
      const { error: insertError } = await supabase.from("practice_documents").insert({
        practice_id: practice.id,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        mime_type: "application/pdf",
        uploaded_by: session.user.id,
        document_type: slot.signedType,
      });
      if (insertError) {
        await supabase.storage.from(PRACTICE_DOCUMENTS_BUCKET).remove([path]);
        throw new Error(insertError.message);
      }
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

  const fileInputId = (slot: SigningSlotId) => `signing-upload-${practice.id}-${slot}`;

  return (
    <Card className="p-6" data-testid="signing-card">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <FileSignature className="h-5 w-5" />
          {m.card.title}
        </h2>
        <Badge variant={signedCount === available.length && available.length > 0 ? "default" : "secondary"} data-testid="signing-progress">
          {m.card.progress(signedCount, available.length)}
        </Badge>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">{isAdmin ? m.card.introAdmin : m.card.intro}</p>

      <ul className="space-y-3">
        {status.map(({ slot, available: isAvailable, signed }) => {
          const template = templates.get(slot.id);
          const slotText = m.slots[slot.id];
          const source: SignedDocument | null = slot.hasTemplate ? null : draft;
          return (
            <li
              key={slot.id}
              className={cn("rounded-lg border p-4", signed ? "border-green-500/40 bg-green-500/5" : isAvailable ? "border-border" : "border-dashed border-border bg-muted/30")}
              data-testid={`signing-slot-${slot.id}`}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {signed ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" /> : <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    <p className="font-medium text-foreground">{slotText.label}</p>
                    {signed ? (
                      <Badge variant="outline" className="border-green-500/40 text-green-700 dark:text-green-400">{m.card.signedOn(formatDate(signed.created_at))}</Badge>
                    ) : isAvailable ? (
                      <Badge variant="outline">{m.card.toSign}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">{m.card.notYet}</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{slotText.description}</p>
                  {!isAvailable && <p className="mt-1 text-xs text-muted-foreground">{m.card.notYetHint}</p>}
                  {signed && <p className="mt-1 truncate text-xs text-muted-foreground">{signed.file_name}</p>}
                  {isAvailable && slot.hasTemplate && !template && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{isAdmin ? m.card.templateMissingAdmin : m.card.templateMissing}</p>
                  )}
                  {isAvailable && !slot.hasTemplate && !source && <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{m.card.draftMissing}</p>}
                </div>
                {isAvailable && (
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    {slot.hasTemplate ? (
                      <Button variant="outline" size="sm" disabled={!template} onClick={() => void downloadTemplate(slot)}>
                        <Download className="mr-1.5 h-4 w-4" />
                        {m.card.template}
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" disabled={!source} onClick={() => source && void downloadStored(source)}>
                        <Download className="mr-1.5 h-4 w-4" />
                        {m.card.draftToSign}
                      </Button>
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
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {available.length > 0 && signedCount === available.length && (
        <p className="mt-4 text-sm font-medium text-green-700 dark:text-green-400">{m.card.allSigned}</p>
      )}
    </Card>
  );
};
