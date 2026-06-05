import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { requiredDocumentsConfig } from "@/config/requiredDocuments";
import { mapPracticeTypeToEnum } from "@/utils/practiceTypeMapping";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Upload,
  XCircle,
} from "lucide-react";

interface UploadedDocumentFile {
  docId: string;
  file: File;
}

interface DocumentUploadSectionProps {
  practiceType: string;
  uploadedFiles: UploadedDocumentFile[];
  onFilesChange: (files: UploadedDocumentFile[]) => void;
  isAdmin?: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"];
const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/jpg",
  "image/png",
];

const formatFileSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

export const DocumentUploadSection = ({
  practiceType,
  uploadedFiles,
  onFilesChange,
}: DocumentUploadSectionProps) => {
  const { toast } = useToast();

  const normalizedPracticeType = practiceType ? mapPracticeTypeToEnum(practiceType).toLowerCase() : "";
  const typeConfig = requiredDocumentsConfig.find(
    (config) => config.practiceType.toLowerCase() === normalizedPracticeType
  );
  const requiredDocuments = typeConfig?.requiredDocuments ?? [];
  const questionnaireDocuments = requiredDocuments.filter((doc) => doc.isQuestionnaire);
  const uploadedDocIds = new Set(uploadedFiles.map((item) => item.docId));
  const missingDocuments = requiredDocuments.filter((doc) => !uploadedDocIds.has(doc.id));
  const completedCount = requiredDocuments.length - missingDocuments.length;
  const completionPercentage = requiredDocuments.length > 0
    ? Math.round((completedCount / requiredDocuments.length) * 100)
    : 0;

  const handleFileSelect = (docId: string, fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;

    const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
    const isAcceptedExtension = ACCEPTED_EXTENSIONS.includes(extension);
    const isAcceptedMimeType = ACCEPTED_MIME_TYPES.includes(file.type);

    if (!isAcceptedExtension || !isAcceptedMimeType) {
      toast({
        variant: "destructive",
        title: "Tipo file non consentito",
        description: `${file.name} non è un tipo di file consentito. Usa PDF, Word, JPG o PNG.`,
      });
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast({
        variant: "destructive",
        title: "File troppo grande",
        description: `${file.name} supera il limite massimo di 10 MB.`,
      });
      return;
    }

    onFilesChange([
      ...uploadedFiles.filter((item) => item.docId !== docId),
      { docId, file },
    ]);
  };

  const removeFile = (docId: string) => {
    onFilesChange(uploadedFiles.filter((item) => item.docId !== docId));
  };

  if (!practiceType) {
    return (
      <Card className="p-4 border-dashed">
        <div className="flex items-start gap-3 text-sm text-muted-foreground">
          <FileText className="h-5 w-5 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Documenti obbligatori</p>
            <p>Seleziona prima il tipo di pratica per visualizzare i documenti richiesti.</p>
          </div>
        </div>
      </Card>
    );
  }

  if (requiredDocuments.length === 0) {
    return (
      <Card className="p-4 border-dashed">
        <div className="flex items-start gap-3 text-sm text-muted-foreground">
          <AlertTriangle className="h-5 w-5 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Nessuna configurazione documentale trovata</p>
            <p>Non sono stati configurati documenti obbligatori per la tipologia selezionata.</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {questionnaireDocuments.length > 0 && (
        <Card className="p-4 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-amber-700 dark:text-amber-300 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-900 dark:text-amber-100">
                  Questo tipo di pratica richiede questionari da compilare
                </h3>
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Scarica il questionario, fallo compilare e firmare dal cliente, poi allegalo tra i documenti richiesti.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {questionnaireDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-white p-3 dark:border-amber-800 dark:bg-background sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-sm">{doc.label}</p>
                    <p className="text-xs text-muted-foreground">{doc.description}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => doc.questionnaireFile && window.open(doc.questionnaireFile, "_blank")}
                    disabled={!doc.questionnaireFile}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Scarica Questionario
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        <div>
          <h3 className="text-base font-semibold">Documenti obbligatori</h3>
          <p className="text-sm text-muted-foreground">
            Allega un file per ogni documento richiesto. Sono accettati PDF, Word, JPG e PNG fino a 10 MB per file.
          </p>
        </div>

        {requiredDocuments.map((doc) => {
          const uploadedFile = uploadedFiles.find((item) => item.docId === doc.id)?.file;
          const inputId = `required-document-${doc.id}`;

          return (
            <Card key={doc.id} className="p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                  {uploadedFile ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-1" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600 mt-1" />
                  )}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{doc.label}</p>
                      <Badge variant={doc.isQuestionnaire ? "secondary" : "destructive"} className={doc.isQuestionnaire ? "bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-900 dark:text-amber-100" : undefined}>
                        {doc.isQuestionnaire ? "OBBLIGATORIO — Questionario Firmato" : "OBBLIGATORIO"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{doc.description}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:min-w-[280px]">
                  <input
                    id={inputId}
                    type="file"
                    accept={ACCEPTED_EXTENSIONS.join(",")}
                    className="hidden"
                    onChange={(event) => {
                      handleFileSelect(doc.id, event.target.files);
                      event.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById(inputId)?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Allega {doc.label}
                  </Button>

                  {uploadedFile && (
                    <div className="flex items-center justify-between gap-2 rounded-md bg-muted p-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{uploadedFile.name}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(uploadedFile.size)}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(doc.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{completedCount} di {requiredDocuments.length} documenti allegati</span>
            <span className="text-muted-foreground">{completionPercentage}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>

          {missingDocuments.length === 0 ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
              <strong>Tutti i documenti obbligatori sono stati allegati.</strong> Puoi procedere con il caricamento della pratica.
            </div>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <strong>Documenti ancora mancanti:</strong> {missingDocuments.map((doc) => doc.label).join(", ")}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
