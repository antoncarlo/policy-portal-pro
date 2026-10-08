import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileArchive, FileText, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDate, getMessages, useMessages } from "@/i18n";
import { practiceDetailMessages } from "@/i18n/messages/practiceDetail";

interface Document {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

interface PracticeDocumentsProps {
  practiceId: string;
  /** Cambiando questo valore l'elenco viene ricaricato (es. dopo la generazione del preventivo Pet). */
  refreshToken?: number;
}

const buildDocumentStoragePath = (practiceId: string, file: File, index: number) => {
  const safeName = file.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "documento";

  return `${practiceId}/${Date.now()}-${index}-${safeName}`;
};

const getMimeType = (file: File) => {
  if (file.type) return file.type;
  if (file.name.toLowerCase().endsWith(".zip")) return "application/zip";
  return "application/octet-stream";
};

const documentsText = () => getMessages(practiceDetailMessages).documents;

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const PRACTICE_DOCUMENTS_BUCKET = "practice-documents";
const VIES_BATCH_FILES_BUCKET = "vies-batch-files";
const VIES_BATCH_FILES_PREFIX = `${VIES_BATCH_FILES_BUCKET}://`;

const getDocumentStorageReference = (filePath: string) => {
  if (filePath.startsWith(VIES_BATCH_FILES_PREFIX)) {
    return {
      bucket: VIES_BATCH_FILES_BUCKET,
      path: filePath.slice(VIES_BATCH_FILES_PREFIX.length),
      isViesBatchReference: true,
    };
  }

  return {
    bucket: PRACTICE_DOCUMENTS_BUCKET,
    path: filePath,
    isViesBatchReference: false,
  };
};

export const PracticeDocuments = ({ practiceId, refreshToken = 0 }: PracticeDocumentsProps) => {
  const { toast } = useToast();
  const m = useMessages(practiceDetailMessages).documents;
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- legacy loader intentionally runs only for the dependency list below
  }, [practiceId, refreshToken]);

  const loadDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from("practice_documents")
        .select("*")
        .eq("practice_id", practiceId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: documentsText().loadErrorTitle,
        description: getErrorMessage(error, documentsText().loadErrorText),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files ?? []);
    if (selectedFiles.length === 0) return;

    setUploading(true);
    const uploadedPaths: string[] = [];
    const insertedDocumentIds: string[] = [];

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error(documentsText().notAuthenticated);

      for (const [index, file] of selectedFiles.entries()) {
        const filePath = buildDocumentStoragePath(practiceId, file, index);

        const { error: uploadError } = await supabase.storage
          .from(PRACTICE_DOCUMENTS_BUCKET)
          .upload(filePath, file, {
            contentType: getMimeType(file),
            upsert: false,
          });

        if (uploadError) throw uploadError;
        uploadedPaths.push(filePath);

        const { data: insertedDocument, error: dbError } = await supabase
          .from("practice_documents")
          .insert({
            practice_id: practiceId,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            mime_type: getMimeType(file),
            uploaded_by: session.user.id,
          })
          .select("id")
          .single();

        if (dbError) throw dbError;
        if (insertedDocument?.id) insertedDocumentIds.push(insertedDocument.id);
      }

      toast({
        title: selectedFiles.length === 1 ? documentsText().uploadedOne : documentsText().uploadedMany,
        description: selectedFiles.length === 1
          ? documentsText().uploadedOneText
          : documentsText().uploadedManyText(selectedFiles.length),
      });

      loadDocuments();
    } catch (error) {
      if (insertedDocumentIds.length) {
        await supabase.from("practice_documents").delete().in("id", insertedDocumentIds);
      }
      if (uploadedPaths.length) {
        await supabase.storage.from(PRACTICE_DOCUMENTS_BUCKET).remove(uploadedPaths);
      }

      toast({
        variant: "destructive",
        title: documentsText().uploadErrorTitle,
        description: getErrorMessage(error, documentsText().uploadErrorText),
      });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDownload = async (document: Document) => {
    try {
      const storageReference = getDocumentStorageReference(document.file_path);
      const { data, error } = await supabase.storage
        .from(storageReference.bucket)
        .download(storageReference.path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = document.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        variant: "destructive",
        title: documentsText().downloadErrorTitle,
        description: getErrorMessage(error, documentsText().downloadErrorText),
      });
    }
  };

  const handleDelete = async (document: Document) => {
    if (!confirm(documentsText().confirmDelete)) return;

    try {
      const storageReference = getDocumentStorageReference(document.file_path);
      if (!storageReference.isViesBatchReference) {
        const { error: storageError } = await supabase.storage
          .from(storageReference.bucket)
          .remove([storageReference.path]);

        if (storageError) throw storageError;
      }

      const { error: dbError } = await supabase
        .from("practice_documents")
        .delete()
        .eq("id", document.id);

      if (dbError) throw dbError;

      toast({
        title: documentsText().deletedTitle,
        description: documentsText().deletedText,
      });

      loadDocuments();
    } catch (error) {
      toast({
        variant: "destructive",
        title: documentsText().deleteErrorTitle,
        description: getErrorMessage(error, documentsText().deleteErrorText),
      });
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {m.title}
        </h2>
        <div>
          <input
            type="file"
            onChange={handleUpload}
            className="hidden"
            id="document-upload"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.zip,application/zip,application/x-zip-compressed"
            multiple
          />
          <Button
            asChild
            size="sm"
            disabled={uploading}
          >
            <label htmlFor="document-upload" className="cursor-pointer">
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? m.uploading : m.upload}
            </label>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : documents.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          {m.empty}
        </p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-accent/50"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {doc.file_name.toLowerCase().endsWith(".zip") || doc.mime_type.includes("zip") ? (
                  <FileArchive className="h-4 w-4 text-primary flex-shrink-0" />
                ) : (
                  <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {doc.file_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(doc.file_size / 1024).toFixed(2)} KB • {formatDate(doc.created_at)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDownload(doc)}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(doc)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
