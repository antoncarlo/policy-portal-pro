import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { composeNotes, extractNotesSections } from "@/lib/practiceSummary";
import { getMessages, useMessages } from "@/i18n";
import { practiceDetailMessages } from "@/i18n/messages/practiceDetail";

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
  const m = useMessages(practiceDetailMessages).notes;

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
        title: getMessages(practiceDetailMessages).notes.savedTitle,
        description: getMessages(practiceDetailMessages).notes.savedText,
      });
      onNotesSaved?.(composed);
    } catch (error) {
      toast({
        variant: "destructive",
        title: getMessages(practiceDetailMessages).notes.errorTitle,
        description: error instanceof Error ? error.message : getMessages(practiceDetailMessages).notes.errorText,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold text-foreground mb-1 flex items-center gap-2">
        <FileText className="h-5 w-5" />
        {m.title}
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        {m.subtitle}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="notes">{m.label}</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={m.placeholder}
            rows={6}
          />
        </div>

        <Button type="submit" disabled={loading}>
          {loading ? m.saving : m.save}
        </Button>
      </form>
    </Card>
  );
};
