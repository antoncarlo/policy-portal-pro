import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Practice {
  id: string;
  practice_number: string;
  client_name: string;
  premium_amount: number | null;
  commission_percentage: number | null;
  commission_amount: number | null;
  financial_status: string;
  payment_date: string | null;
  commission_received_date: string | null;
}

interface EditFinancialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  practice: Practice | null;
  onSuccess: () => void;
}

export const EditFinancialDialog = ({
  open,
  onOpenChange,
  practice,
  onSuccess,
}: EditFinancialDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [premiumAmount, setPremiumAmount] = useState("");
  const [commissionPercentage, setCommissionPercentage] = useState("");
  const [financialStatus, setFinancialStatus] = useState("non_incassata");
  const [paymentDate, setPaymentDate] = useState("");
  const [commissionReceivedDate, setCommissionReceivedDate] = useState("");

  useEffect(() => {
    if (practice) {
      setPremiumAmount(practice.premium_amount?.toString() || "");
      setCommissionPercentage(practice.commission_percentage?.toString() || "");
      setFinancialStatus(practice.financial_status || "non_incassata");
      setPaymentDate(practice.payment_date || "");
      setCommissionReceivedDate(practice.commission_received_date || "");
    }
  }, [practice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!practice) return;

    setLoading(true);

    try {
      const updateData: any = {
        premium_amount: premiumAmount ? parseFloat(premiumAmount) : null,
        commission_percentage: commissionPercentage ? parseFloat(commissionPercentage) : null,
        financial_status: financialStatus,
        payment_date: paymentDate || null,
        commission_received_date: commissionReceivedDate || null,
      };

      const { error } = await supabase
        .from("practices")
        .update(updateData)
        .eq("id", practice.id);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Dati finanziari aggiornati con successo",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  if (!practice) return null;

  const calculatedCommission = premiumAmount && commissionPercentage
    ? (parseFloat(premiumAmount) * parseFloat(commissionPercentage) / 100).toFixed(2)
    : "0.00";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gestione Finanziaria Pratica</DialogTitle>
          <DialogDescription>
            {practice.practice_number} - {practice.client_name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="premiumAmount">Premio Assicurativo (€)</Label>
              <Input
                id="premiumAmount"
                type="number"
                step="0.01"
                min="0"
                value={premiumAmount}
                onChange={(e) => setPremiumAmount(e.target.value)}
                placeholder="1000.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="commissionPercentage">Provvigione (%)</Label>
              <Input
                id="commissionPercentage"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={commissionPercentage}
                onChange={(e) => setCommissionPercentage(e.target.value)}
                placeholder="15.50"
              />
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Provvigione Calcolata:</strong> €{calculatedCommission}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
              La provvigione viene calcolata automaticamente: Premio × Percentuale ÷ 100
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="financialStatus">Stato Finanziario</Label>
            <Select value={financialStatus} onValueChange={setFinancialStatus}>
              <SelectTrigger id="financialStatus">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="non_incassata">Non Incassata</SelectItem>
                <SelectItem value="incassata">Incassata (In attesa provvigioni)</SelectItem>
                <SelectItem value="provvigioni_ricevute">Provvigioni Ricevute</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="paymentDate">Data Incasso Cliente</Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Quando il cliente ha pagato il premio
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="commissionReceivedDate">Data Ricezione Provvigioni</Label>
              <Input
                id="commissionReceivedDate"
                type="date"
                value={commissionReceivedDate}
                onChange={(e) => setCommissionReceivedDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Quando hai ricevuto le provvigioni
              </p>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Salvataggio..." : "Salva Modifiche"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Annulla
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
