import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PracticeNotesProps {
  practiceId: string;
  initialNotes: string;
}

export const PracticeNotes = ({ practiceId, initialNotes }: PracticeNotesProps) => {
  const { toast } = useToast();
  
  // Filter out JSON data and show only textual notes
  const getTextualNotes = (notesContent: string) => {
    if (!notesContent) return '';
    
    // Check if content contains the policy data header
    if (notesContent.includes('--- Dati Specifici Polizza ---')) {
      // This is policy data, return empty string
      return '';
    }
    
    try {
      // Try to parse as JSON
      JSON.parse(notesContent);
      // If it's valid JSON (policy data), return empty string
      return '';
    } catch {
      // If it's not JSON and doesn't have the header, it's textual notes - return as is
      return notesContent;
    }
  };
  
  const [notes, setNotes] = useState(getTextualNotes(initialNotes));
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from("practices")
        .update({ notes })
        .eq("id", practiceId);

      if (error) throw error;

      toast({
        title: "Note aggiornate",
        description: "Le note sono state salvate con successo.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore salvataggio",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
        <FileText className="h-5 w-5" />
        Note e Dettagli
      </h2>

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
