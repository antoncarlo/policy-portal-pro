import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { composeNotes, extractNotesSections } from "@/lib/practiceSummary";

interface PracticeNotesProps {
  practiceId: string;
  initialNotes: string;
  onNotesSaved?: (notes: string | null) => void;
}

/**
 * Note e appunti della pratica (per l'assuntore / il partner).
 * I dati specifici della polizza e la chiave di idempotenza del webhook sono
 * salvati nello stesso campo `notes`, ma non vengono mostrati qui: al salvataggio
 * vengono preservati e riaccodati, cosi' il riepilogo non va perso.
 */
export const PracticeNotes = ({ practiceId, initialNotes, onNotesSaved }: PracticeNotesProps) => {
  const { toast } = useToast();
  const sections = extractNotesSections(initialNotes);

  const [notes, setNotes] = useState(sections.textualNotes);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const composed = composeNotes({
        idempotencyKey: sections.idempotencyKey,
        textualNotes: notes,
        specificFields: sections.specificFields,
      });

      const { error } = await supabase
        .from("practices")
        .update({ notes: composed })
        .eq("id", practiceId);

      if (error) throw error;

      toast({
        title: "Note aggiornate",
        description: "Le note sono state salvate con successo.",
      });
      onNotesSaved?.(composed);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Errore salvataggio",
        description: error instanceof Error ? error.message : "Errore imprevisto durante il salvataggio.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold text-foreground mb-1 flex items-center gap-2">
        <FileText className="h-5 w-5" />
        Note e Appunti
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Appunti per l'assuntore o per il partner. I dati della polizza sono nel riepilogo in alto.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="notes">Note Pratica</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Inserisci note o dettagli aggiuntivi sulla pratica..."
            rows={6}
          />
        </div>

        <Button type="submit" disabled={loading}>
          {loading ? "Salvataggio..." : "Salva Note"}
        </Button>
      </form>
    </Card>
  );
};
