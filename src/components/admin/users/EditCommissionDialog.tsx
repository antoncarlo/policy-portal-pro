import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Trash2 } from "lucide-react";

export interface CommissionBonusTier {
  threshold: number;
  bonus_percentage: number;
  label?: string;
}

interface CommissionUser {
  id: string;
  full_name: string;
  role: string;
  default_commission_percentage?: number | null;
  commission_bonus_tiers?: CommissionBonusTier[] | null;
}

interface EditCommissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: CommissionUser | null;
  onSuccess: () => void;
}

const normalizeTiers = (tiers: CommissionBonusTier[]) => {
  return tiers
    .map((tier) => ({
      threshold: Number(tier.threshold) || 0,
      bonus_percentage: Number(tier.bonus_percentage) || 0,
      label: tier.label?.trim() || "",
    }))
    .filter((tier) => tier.threshold > 0 && tier.bonus_percentage > 0)
    .sort((a, b) => a.threshold - b.threshold);
};

export const EditCommissionDialog = ({
  open,
  onOpenChange,
  user,
  onSuccess,
}: EditCommissionDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [baseCommission, setBaseCommission] = useState("0");
  const [tiers, setTiers] = useState<CommissionBonusTier[]>([]);

  useEffect(() => {
    if (!open || !user) return;

    setBaseCommission(String(user.default_commission_percentage ?? 0));
    setTiers(Array.isArray(user.commission_bonus_tiers) ? user.commission_bonus_tiers : []);
  }, [open, user]);

  const addTier = () => {
    setTiers((current) => [
      ...current,
      {
        threshold: 0,
        bonus_percentage: 1,
        label: "",
      },
    ]);
  };

  const updateTier = (index: number, field: keyof CommissionBonusTier, value: string) => {
    setTiers((current) =>
      current.map((tier, tierIndex) =>
        tierIndex === index
          ? {
              ...tier,
              [field]: field === "label" ? value : Number(value),
            }
          : tier
      )
    );
  };

  const removeTier = (index: number) => {
    setTiers((current) => current.filter((_, tierIndex) => tierIndex !== index));
  };

  const handleSave = async () => {
    if (!user) return;

    const parsedBase = Number(baseCommission);
    if (Number.isNaN(parsedBase) || parsedBase < 0 || parsedBase > 100) {
      toast({
        variant: "destructive",
        title: "Provvigione base non valida",
        description: "Inserisci una percentuale compresa tra 0 e 100.",
      });
      return;
    }

    const normalizedTiers = normalizeTiers(tiers);

    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          default_commission_percentage: parsedBase,
          commission_bonus_tiers: normalizedTiers,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Provvigioni aggiornate",
        description: `Regole provvigionali aggiornate per ${user.full_name}.`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message || "Impossibile aggiornare le provvigioni.",
      });
    } finally {
      setLoading(false);
    }
  };

  const totalBonus = normalizeTiers(tiers).reduce((sum, tier) => sum + tier.bonus_percentage, 0);
  const effectivePreview = (Number(baseCommission) || 0) + totalBonus;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestisci Provvigioni</DialogTitle>
          <DialogDescription>
            Configura la provvigione base e gli eventuali premi produzione per {user?.full_name}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="baseCommission">Provvigione base (%)</Label>
            <Input
              id="baseCommission"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={baseCommission}
              onChange={(event) => setBaseCommission(event.target.value)}
              placeholder="16.00"
            />
            <p className="text-xs text-muted-foreground">
              È la base di partenza individuale. Può essere 16%, 8% o qualsiasi valore definito dall'amministratore.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>Premi produzione</Label>
                <p className="text-xs text-muted-foreground">
                  Ogni scaglione aggiunge una percentuale alla provvigione base quando la produzione annua raggiunge la soglia.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addTier}>
                <Plus className="h-4 w-4 mr-2" />
                Aggiungi scaglione
              </Button>
            </div>

            {tiers.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                Nessuno scaglione configurato. Verrà applicata solo la provvigione base.
              </div>
            ) : (
              <div className="space-y-3">
                {tiers.map((tier, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end rounded-md border p-3">
                    <div className="space-y-2">
                      <Label>Soglia produzione (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={tier.threshold || ""}
                        onChange={(event) => updateTier(index, "threshold", event.target.value)}
                        placeholder="50000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Bonus (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={tier.bonus_percentage || ""}
                        onChange={(event) => updateTier(index, "bonus_percentage", event.target.value)}
                        placeholder="1"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Etichetta</Label>
                      <Input
                        value={tier.label || ""}
                        onChange={(event) => updateTier(index, "label", event.target.value)}
                        placeholder="Oltre 50k"
                      />
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeTier(index)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg bg-muted p-4 text-sm">
            <strong>Anteprima massima configurata:</strong> base {Number(baseCommission) || 0}% + premi {totalBonus}% = {effectivePreview}%.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Annulla
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salva Provvigioni
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
