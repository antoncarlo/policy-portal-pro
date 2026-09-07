import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, PawPrint } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { buildPetSummary, extractNotesSections } from "@/lib/practiceSummary";
import { canGeneratePetQuote, generatePetQuotePdf, petQuotePdfToBytes } from "@/lib/petQuotePdf";
import {
  PET_QUOTE_ATTACHMENTS,
  PET_QUOTE_ZIP_MIME_TYPE,
  buildPetQuoteZip,
  buildPetQuoteZipFileName,
  loadPetQuoteAttachments,
} from "@/lib/petQuoteBundle";
import { requestPetQuoteDocument } from "@/lib/petQuoteClient";

interface PetQuoteDocumentCardProps {
  practice: {
    id: string;
    practice_number: string;
    client_name: string;
    owner_tax_code: string | null;
    pet_microchip: string | null;
    premium_gross: number | null;
    notes: string | null;
  };
  onDocumentCreated?: () => void;
}

/**
 * Card "Ricapitolo Richiesta" per le pratiche Pet: genera il PDF del preventivo
 * (stesso layout/testo della mail inviata al cliente) e lo salva tra i documenti
 * della pratica. Utile per le pratiche create prima dell'automatismo o per
 * rigenerare il documento dopo una modifica delle coperture.
 */
export const PetQuoteDocumentCard = ({ practice, onDocumentCreated }: PetQuoteDocumentCardProps) => {
  const { toast } = useToast();
  const [working, setWorking] = useState(false);

  const pet = useMemo(() => {
    const { specificFields } = extractNotesSections(practice.notes);
    return buildPetSummary({
      practice_type: "pet",
      owner_tax_code: practice.owner_tax_code,
      pet_microchip: practice.pet_microchip,
      premium_gross: practice.premium_gross,
      specific_fields: specificFields,
    });
  }, [practice.notes, practice.owner_tax_code, practice.pet_microchip, practice.premium_gross]);

  const canGenerate = canGeneratePetQuote(pet);
  const fileName = buildPetQuoteZipFileName(pet?.name);

  /** ZIP con il PDF del preventivo e la documentazione contrattuale Helpet (CGA, DIP). */
  const buildZipBytes = async () => {
    if (!canGeneratePetQuote(pet)) return null;
    const doc = generatePetQuotePdf({
      practiceNumber: practice.practice_number,
      clientName: practice.client_name,
      pet,
    });
    const attachments = await loadPetQuoteAttachments();
    return buildPetQuoteZip({
      petName: pet.name,
      quotePdf: petQuotePdfToBytes(doc),
      attachments,
    });
  };

  const handleDownload = async () => {
    setWorking(true);
    try {
      const bytes = await buildZipBytes();
      if (!bytes) return;
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: PET_QUOTE_ZIP_MIME_TYPE }));
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setWorking(false);
    }
  };

  const handleAttach = async () => {
    setWorking(true);
    try {
      // Generazione lato server: il browser invia solo la richiesta
      const result = await requestPetQuoteDocument(practice.id);
      toast({ title: "Ricapitolo Richiesta allegato", description: `${result.file_name} è ora disponibile tra i documenti della pratica.` });
      onDocumentCreated?.();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Errore generazione preventivo",
        description: error instanceof Error ? error.message : "Non è stato possibile generare il pacchetto.",
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
            <PawPrint className="h-5 w-5" />
            Ricapitolo Richiesta {pet?.name ? `per ${pet.name}` : ""}
          </h2>
          <p className="text-sm text-muted-foreground">
            {canGenerate
              ? `Pacchetto ZIP con il preventivo in PDF (stesso layout e testo della mail inviata al cliente) e la documentazione contrattuale Helpet: ${PET_QUOTE_ATTACHMENTS.map((a) => a.label).join(", ")}.`
              : "Per generare il preventivo servono le coperture selezionate o il premio annuale nei dati della pratica."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={!canGenerate || working}>
            <Download className="h-4 w-4 mr-2" />
            Scarica
          </Button>
          <Button size="sm" onClick={handleAttach} disabled={!canGenerate || working}>
            <FileText className="h-4 w-4 mr-2" />
            {working ? "Generazione..." : "Allega ai documenti"}
          </Button>
        </div>
      </div>
    </Card>
  );
};
