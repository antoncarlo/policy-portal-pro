import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type PracticeStatus = "in_lavorazione" | "in_attesa" | "approvata" | "rifiutata" | "completata";

interface PracticeStatusFormProps {
  practiceId: string;
  currentStatus: PracticeStatus;
  onStatusUpdate: () => void;
}

export const PracticeStatusForm = ({ 
  practiceId, 
  currentStatus,
  onStatusUpdate 
}: PracticeStatusFormProps) => {
  const { toast } = useToast();
  const [status, setStatus] = useState<PracticeStatus>(currentStatus);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (status === currentStatus) {
      toast({
        title: "Nessuna modifica",
        description: "Lo stato selezionato è uguale a quello attuale.",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from("practices")
        .update({ status })
        .eq("id", practiceId);

      if (error) throw error;

      toast({
        title: "Stato aggiornato",
        description: "Lo stato della pratica è stato modificato con successo.",
      });

      onStatusUpdate();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore aggiornamento",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
        <AlertCircle className="h-5 w-5" />
        Gestione Stato
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="status">Stato Pratica</Label>
          <Select value={status} onValueChange={(value) => setStatus(value as PracticeStatus)}>
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="in_lavorazione">In Lavorazione</SelectItem>
              <SelectItem value="in_attesa">In Attesa</SelectItem>
              <SelectItem value="approvata">Approvata</SelectItem>
              <SelectItem value="completata">Completata</SelectItem>
              <SelectItem value="rifiutata">Rifiutata</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" disabled={loading || status === currentStatus}>
          {loading ? "Aggiornamento..." : "Aggiorna Stato"}
        </Button>
      </form>
    </Card>
  );
};
