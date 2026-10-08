import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  VIES_POLICY_MIME_TYPE,
  buildViesPolicyFileName,
  generateViesPolicyPdf,
  missingViesPolicyData,
  viesPolicyInputFromPractice,
  viesPolicyPdfToBytes,
  type ViesPolicyPracticeSource,
} from "@/lib/viesPolicyPdf";
import { getMessages, useMessages } from "@/i18n";
import { practiceDetailMessages } from "@/i18n/messages/practiceDetail";

const PRACTICE_DOCUMENTS_BUCKET = "practice-documents";

interface ViesPolicyDocumentCardProps {
  practice: ViesPolicyPracticeSource & { id: string };
  onDocumentCreated?: () => void;
}

/**
 * Documento di polizza VIES (frontespizio + testo della garanzia / Annex III)
 * generato dai dati della pratica: scaricabile o allegabile ai documenti.
 */
export const ViesPolicyDocumentCard = ({ practice, onDocumentCreated }: ViesPolicyDocumentCardProps) => {
  const { toast } = useToast();
  const [working, setWorking] = useState(false);
  const m = useMessages(practiceDetailMessages).viesPolicy;

  const input = useMemo(() => viesPolicyInputFromPractice(practice), [practice]);
  const missing = missingViesPolicyData(input);
  const fileName = buildViesPolicyFileName(input);

  const buildBlob = () =>
    new Blob([viesPolicyPdfToBytes(generateViesPolicyPdf(input)) as BlobPart], { type: VIES_POLICY_MIME_TYPE });

  const handleDownload = () => {
    const url = URL.createObjectURL(buildBlob());
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAttach = async () => {
    setWorking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error(getMessages(practiceDetailMessages).viesPolicy.invalidSession);
      const blob = buildBlob();
      const filePath = `${practice.id}/${Date.now()}-${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from(PRACTICE_DOCUMENTS_BUCKET)
        .upload(filePath, blob, { contentType: VIES_POLICY_MIME_TYPE, upsert: false });
      if (uploadError) throw uploadError;
      const { error: dbError } = await supabase.from("practice_documents").insert({
        practice_id: practice.id,
        file_name: fileName,
        file_path: filePath,
        file_size: blob.size,
        mime_type: VIES_POLICY_MIME_TYPE,
        uploaded_by: session.user.id,
      });
      if (dbError) {
        await supabase.storage.from(PRACTICE_DOCUMENTS_BUCKET).remove([filePath]);
        throw dbError;
      }
      const text = getMessages(practiceDetailMessages).viesPolicy;
      toast({ title: text.attachedTitle, description: text.attachedText(fileName) });
      onDocumentCreated?.();
    } catch (error) {
      toast({
        variant: "destructive",
        title: getMessages(practiceDetailMessages).viesPolicy.errorTitle,
        description: error instanceof Error ? error.message : getMessages(practiceDetailMessages).viesPolicy.errorText,
      });
    } finally {
      setWorking(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            {m.title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {missing.length ? m.missing(missing.map((field) => m.missingFields[field] ?? field).join(", ")) : m.ready}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={missing.length > 0 || working}>
            <Download className="h-4 w-4 mr-2" />
            {m.download}
          </Button>
          <Button size="sm" onClick={handleAttach} disabled={missing.length > 0 || working}>
            <FileText className="h-4 w-4 mr-2" />
            {working ? m.generating : m.attach}
          </Button>
        </div>
      </div>
    </Card>
  );
};
