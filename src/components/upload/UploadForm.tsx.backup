import { useState, useRef } from "react";
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
  const formRef = useRef<HTMLFormElement>(null);

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
    const clientAddress = formData.get("clientAddress") as string;
    const beneficiary = formData.get("beneficiary") as string;
    const policyStartDate = formData.get("policyStartDate") as string;
    const policyEndDate = formData.get("policyEndDate") as string;
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

    // Validate dates if provided
    if (policyStartDate && policyEndDate) {
      const startDate = new Date(policyStartDate);
      const endDate = new Date(policyEndDate);
      if (endDate < startDate) {
        toast({
          variant: "destructive",
          title: "Errore validazione",
          description: "La data di fine polizza non può essere precedente alla data di inizio.",
        });
        setLoading(false);
        return;
      }
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
      // Find or create client first
      let clientId: string | null = null;
      
      // Try to find existing client by email
      if (clientEmail.trim()) {
        const { data: existingClient } = await supabase
          .from("clients")
          .select("id")
          .eq("email", clientEmail.trim().toLowerCase())
          .eq("user_id", session.user.id)
          .single();
        
        if (existingClient) {
          clientId = existingClient.id;
          
          // Update client address if provided
          if (clientAddress.trim()) {
            await supabase
              .from("profiles")
              .update({ address: clientAddress.trim() })
              .eq("id", clientId);
          }
        }
      }
      
      // If not found by email, try by phone and name
      if (!clientId && clientPhone.trim()) {
        const { data: existingClient } = await supabase
          .from("clients")
          .select("id")
          .eq("phone", clientPhone.trim())
          .eq("user_id", session.user.id)
          .single();
        
        if (existingClient) {
          clientId = existingClient.id;
          
          // Update client address if provided
          if (clientAddress.trim()) {
            await supabase
              .from("profiles")
              .update({ address: clientAddress.trim() })
              .eq("id", clientId);
          }
        }
      }
      
      // If client doesn't exist, create a new one
      if (!clientId) {
        const nameParts = clientName.trim().split(' ');
        const firstName = nameParts[0] || clientName.trim();
        const lastName = nameParts.slice(1).join(' ') || 'N/A';
        
        const { data: newClient, error: clientError } = await supabase
          .from("clients")
          .insert({
            first_name: firstName,
            last_name: lastName,
            email: clientEmail.trim() || null,
            phone: clientPhone.trim() || null,
            user_id: session.user.id,
          })
          .select("id")
          .single();
        
        if (!clientError && newClient) {
          clientId = newClient.id;
          
          // Add address to profile if provided
          if (clientAddress.trim()) {
            await supabase
              .from("profiles")
              .update({ address: clientAddress.trim() })
              .eq("id", clientId);
          }
        }
      }
      
      // Insert practice into database (practice_number auto-generated)
      const { data: practice, error: practiceError } = await supabase
        .from("practices")
        .insert([{
          practice_type: practiceType as any,
          client_name: clientName.trim(),
          client_phone: clientPhone.trim(),
          client_email: clientEmail.trim(),
          beneficiary: beneficiary?.trim() || null,
          policy_start_date: policyStartDate || null,
          policy_end_date: policyEndDate || null,
          notes: notes?.trim() || null,
          user_id: session.user.id,
          client_id: clientId,
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
      if (formRef.current) {
        formRef.current.reset();
      }
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
    <form ref={formRef} onSubmit={handleSubmit}>
      <Card className="p-6 space-y-6">
        {/* Info message about automatic practice number */}
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            ℹ️ <strong>Numero Pratica Automatico:</strong> Il numero della pratica verrà generato automaticamente dal sistema nel formato PR-YYYY-NNNN
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="practiceType">Tipo Pratica *</Label>
            <Select name="practiceType" required>
              <SelectTrigger id="practiceType">
                <SelectValue placeholder="Seleziona tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fidejussioni">Fidejussioni</SelectItem>
                <SelectItem value="car">Car</SelectItem>
                <SelectItem value="postuma_decennale">Postuma Decennale</SelectItem>
                <SelectItem value="all_risk">All Risk</SelectItem>
                <SelectItem value="responsabilita_civile">Responsabilità Civile</SelectItem>
                <SelectItem value="pet">Pet</SelectItem>
                <SelectItem value="fotovoltaico">Fotovoltaico</SelectItem>
                <SelectItem value="catastrofali">Catastrofali</SelectItem>
                <SelectItem value="azienda">Azienda</SelectItem>
                <SelectItem value="casa">Casa</SelectItem>
                <SelectItem value="risparmio">Risparmio</SelectItem>
                <SelectItem value="salute">Salute</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientName">Nome Cliente *</Label>
            <Input
              id="clientName"
              name="clientName"
              placeholder="Mario Rossi"
              required
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientPhone">Telefono Cliente *</Label>
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
            <Label htmlFor="clientEmail">Email Cliente *</Label>
            <Input
              id="clientEmail"
              name="clientEmail"
              type="email"
              placeholder="mario.rossi@example.com"
              required
              maxLength={255}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="clientAddress">Indirizzo Cliente</Label>
            <Input
              id="clientAddress"
              name="clientAddress"
              placeholder="Via Roma 123, 00100 Roma"
              maxLength={255}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="beneficiary">Beneficiario</Label>
            <Input
              id="beneficiary"
              name="beneficiary"
              placeholder="Nome del beneficiario"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="policyStartDate">Data Inizio Polizza</Label>
            <Input
              id="policyStartDate"
              name="policyStartDate"
              type="date"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="policyEndDate">Data Fine Polizza</Label>
            <Input
              id="policyEndDate"
              name="policyEndDate"
              type="date"
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
          <div>
            <Label htmlFor="file-upload">Documenti Allegati</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Carica i documenti relativi alla pratica (PDF, Word, Immagini - Max 10MB per file)
            </p>
            <div className="flex items-center gap-2">
              <Input
                id="file-upload"
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
              <Upload className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <Label>File selezionati ({files.length})</Label>
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-muted rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="text-sm">{file.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
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
            </div>
          )}
        </div>

        <div className="flex gap-4 pt-4">
          <Button
            type="submit"
            disabled={loading}
            className="flex-1"
          >
            {loading ? "Caricamento..." : "Carica Pratica"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/practices")}
            disabled={loading}
          >
            Annulla
          </Button>
        </div>
      </Card>
    </form>
  );
};
