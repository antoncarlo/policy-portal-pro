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
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getMessages, useMessages } from "@/i18n";
import { practiceDetailMessages } from "@/i18n/messages/practiceDetail";
import { PRACTICE_STATUSES, practiceStatusLabel } from "@/i18n/messages/domain";

type PracticeStatus = "in_lavorazione" | "in_attesa" | "approvata" | "rifiutata" | "completata";

interface PracticeStatusFormProps {
  practiceId: string;
  currentStatus: PracticeStatus;
  onStatusUpdate: () => void;
  userRole?: string;
}

export const PracticeStatusForm = ({ 
  practiceId, 
  currentStatus,
  onStatusUpdate,
  userRole 
}: PracticeStatusFormProps) => {
  const { toast } = useToast();
  const [status, setStatus] = useState<PracticeStatus>(currentStatus);
  const [loading, setLoading] = useState(false);
  const canEditStatus = userRole === 'admin';
  const m = useMessages(practiceDetailMessages).status;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (status === currentStatus) {
      toast({
        title: getMessages(practiceDetailMessages).status.noChangeTitle,
        description: getMessages(practiceDetailMessages).status.noChangeText,
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
        title: getMessages(practiceDetailMessages).status.updatedTitle,
        description: getMessages(practiceDetailMessages).status.updatedText,
      });

      onStatusUpdate();
    } catch (error) {
      toast({
        variant: "destructive",
        title: getMessages(practiceDetailMessages).status.errorTitle,
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
        {m.title}
      </h2>

      {!canEditStatus ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{m.current}</span>
            <Badge variant="secondary">{practiceStatusLabel(currentStatus)}</Badge>
          </div>
          <div className="p-3 bg-muted/50 border border-muted rounded-md text-sm text-muted-foreground">
            {m.readOnly}
          </div>
        </div>
      ) : (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="status">{m.label}</Label>
          <Select value={status} onValueChange={(value) => setStatus(value as PracticeStatus)}>
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRACTICE_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {practiceStatusLabel(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" disabled={loading || status === currentStatus}>
          {loading ? m.updating : m.update}
        </Button>
      </form>
      )}
    </Card>
  );
};
