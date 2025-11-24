import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, FileText, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export const UploadForm = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles([...files, ...Array.from(e.target.files)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const practiceType = formData.get("practiceType") as string;
    const clientName = formData.get("clientName") as string;
    const clientPhone = formData.get("clientPhone") as string;
    const clientEmail = formData.get("clientEmail") as string;
    const policyNumber = formData.get("policyNumber") as string;
    const notes = formData.get("notes") as string;

    // Validate inputs
    if (!practiceType || !clientName.trim() || !clientPhone.trim() || !clientEmail.trim()) {
      toast({
        variant: "destructive",
        title: "Errore validazione",
        description: "Compila tutti i campi obbligatori.",
      });
      setLoading(false);
      return;
    }

    // Validate files
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
      "image/jpg",
      "image/png",
    ];

    for (const file of files) {
      if (file.size > maxFileSize) {
        toast({
          variant: "destructive",
          title: "File troppo grande",
          description: `${file.name} supera i 10MB consentiti.`,
        });
        setLoading(false);
        return;
      }

      if (!allowedTypes.includes(file.type)) {
        toast({
          variant: "destructive",
          title: "Tipo file non consentito",
          description: `${file.name} non è un tipo di file consentito.`,
        });
        setLoading(false);
        return;
      }
    }

    // Get current user
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Devi essere autenticato per caricare una pratica.",
      });
      setLoading(false);
      return;
    }

    try {
      // Insert practice into database (practice_number auto-generated)
      const { data: practice, error: practiceError } = await supabase
        .from("practices")
        .insert([{
          practice_type: practiceType as any,
          client_name: clientName.trim(),
          client_phone: clientPhone.trim(),
          client_email: clientEmail.trim(),
          policy_number: policyNumber?.trim() || null,
          notes: notes?.trim() || null,
          user_id: session.user.id,
        }])
        .select()
        .single();

      if (practiceError) {
        console.error("Practice insert error:", practiceError);
        throw new Error(practiceError.message || "Errore durante l'inserimento della pratica");
      }

      if (!practice) {
        throw new Error("La pratica non è stata creata correttamente");
      }

      console.log("Practice created successfully:", practice);

      // Upload documents if any
      if (files.length > 0) {
        const uploadPromises = files.map(async (file) => {
          const fileExt = file.name.split(".").pop();
          const fileName = `${practice.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

          // Upload to storage
          const { error: uploadError } = await supabase.storage
            .from("practice-documents")
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          // Create document record
          const { error: docError } = await supabase
            .from("practice_documents")
            .insert({
              practice_id: practice.id,
              file_name: file.name,
              file_path: fileName,
              file_size: file.size,
              mime_type: file.type,
              uploaded_by: session.user.id,
            });

          if (docError) throw docError;
        });

        await Promise.all(uploadPromises);

        toast({
          title: "Pratica caricata con successo",
          description: `Pratica ${practice.practice_number} creata con ${files.length} documento/i allegato/i.`,
        });
      } else {
        toast({
          title: "Pratica caricata con successo",
          description: `Pratica ${practice.practice_number} creata correttamente.`,
        });
      }

      // Reset form
      e.currentTarget.reset();
      setFiles([]);
      
      // Navigate to practices page
      navigate("/practices");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        variant: "destructive",
        title: "Errore caricamento",
        description: error.message || "Si è verificato un errore durante il caricamento. Verifica i permessi e riprova.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card className="p-6 space-y-6">
        {/* Info message about automatic practice number */}
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            ℹ️ <strong>Numero Pratica Automatico:</strong> Il numero della pratica verrà generato automaticamente dal sistema nel formato PR-YYYY-NNNN
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="practiceType">Tipo Pratica</Label>
            <Select name="practiceType" required>
              <SelectTrigger id="practiceType">
                <SelectValue placeholder="Seleziona tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="casa">Casa</SelectItem>
                <SelectItem value="vita">Vita</SelectItem>
                <SelectItem value="salute">Salute</SelectItem>
                <SelectItem value="responsabilita">Responsabilità Civile</SelectItem>
                <SelectItem value="altro">Altro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientName">Nome Cliente</Label>
            <Input
              id="clientName"
              name="clientName"
              placeholder="Mario Rossi"
              required
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientPhone">Telefono Cliente</Label>
            <Input
              id="clientPhone"
              name="clientPhone"
              type="tel"
              placeholder="+39 123 456 7890"
              required
              maxLength={20}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientEmail">Email Cliente</Label>
            <Input
              id="clientEmail"
              name="clientEmail"
              type="email"
              placeholder="mario.rossi@example.com"
              required
              maxLength={255}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="policyNumber">Numero Polizza</Label>
            <Input
              id="policyNumber"
              name="policyNumber"
              placeholder="POL-2024-001"
              maxLength={50}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Note e Dettagli</Label>
          <Textarea
            id="notes"
            name="notes"
            placeholder="Inserisci eventuali note o dettagli aggiuntivi sulla pratica..."
            rows={4}
            maxLength={2000}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Documenti Allegati</Label>
            {files.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {files.length} file selezionato/i
              </span>
            )}
          </div>
          
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <div className="p-3 rounded-full bg-primary/10">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Clicca per caricare o trascina i file
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, DOC, DOCX, JPG, PNG (max 10MB per file)
                </p>
              </div>
            </label>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                File caricati ({files.length})
              </p>
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-accent/50"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-4 pt-4">
          <Button type="submit" size="lg" disabled={loading}>
            {loading ? "Caricamento..." : "Carica Pratica"}
          </Button>
        </div>
      </Card>
    </form>
  );
};
