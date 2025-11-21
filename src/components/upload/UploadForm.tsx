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

export const UploadForm = () => {
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles([...files, ...Array.from(e.target.files)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Pratica caricata con successo",
      description: "La pratica è stata creata e i documenti sono stati caricati.",
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card className="p-6 space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="practiceNumber">Numero Pratica</Label>
            <Input
              id="practiceNumber"
              placeholder="PR-2024-001"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="practiceType">Tipo Pratica</Label>
            <Select required>
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
              placeholder="Mario Rossi"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientPhone">Telefono Cliente</Label>
            <Input
              id="clientPhone"
              type="tel"
              placeholder="+39 123 456 7890"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientEmail">Email Cliente</Label>
            <Input
              id="clientEmail"
              type="email"
              placeholder="mario.rossi@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="policyNumber">Numero Polizza</Label>
            <Input
              id="policyNumber"
              placeholder="POL-2024-001"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Note e Dettagli</Label>
          <Textarea
            id="notes"
            placeholder="Inserisci eventuali note o dettagli aggiuntivi sulla pratica..."
            rows={4}
          />
        </div>

        <div className="space-y-4">
          <Label>Documenti</Label>
          
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
          <Button type="submit" size="lg">
            Carica Pratica
          </Button>
          <Button type="button" variant="outline" size="lg">
            Salva come Bozza
          </Button>
        </div>
      </Card>
    </form>
  );
};
