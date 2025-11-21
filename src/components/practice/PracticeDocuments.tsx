import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Upload, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
}

export const PracticeDocuments = ({ practiceId }: PracticeDocumentsProps) => {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, [practiceId]);

  const loadDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from("practice_documents")
        .select("*")
        .eq("practice_id", practiceId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore caricamento documenti",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setUploading(true);
    const file = e.target.files[0];

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non autenticato");

      const fileExt = file.name.split(".").pop();
      const fileName = `${practiceId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("practice-documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from("practice_documents")
        .insert({
          practice_id: practiceId,
          file_name: file.name,
          file_path: fileName,
          file_size: file.size,
          mime_type: file.type,
          uploaded_by: session.user.id,
        });

      if (dbError) throw dbError;

      toast({
        title: "Documento caricato",
        description: "Il documento è stato caricato con successo.",
      });

      loadDocuments();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore caricamento",
        description: error.message,
      });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDownload = async (document: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from("practice-documents")
        .download(document.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = document.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore download",
        description: error.message,
      });
    }
  };

  const handleDelete = async (document: Document) => {
    if (!confirm("Sei sicuro di voler eliminare questo documento?")) return;

    try {
      const { error: storageError } = await supabase.storage
        .from("practice-documents")
        .remove([document.file_path]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from("practice_documents")
        .delete()
        .eq("id", document.id);

      if (dbError) throw dbError;

      toast({
        title: "Documento eliminato",
        description: "Il documento è stato eliminato con successo.",
      });

      loadDocuments();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore eliminazione",
        description: error.message,
      });
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Documenti
        </h2>
        <div>
          <input
            type="file"
            onChange={handleUpload}
            className="hidden"
            id="document-upload"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          />
          <Button
            asChild
            size="sm"
            disabled={uploading}
          >
            <label htmlFor="document-upload" className="cursor-pointer">
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? "Caricamento..." : "Carica"}
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
          Nessun documento allegato
        </p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-accent/50"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {doc.file_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(doc.file_size / 1024).toFixed(2)} KB • {new Date(doc.created_at).toLocaleDateString("it-IT")}
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
