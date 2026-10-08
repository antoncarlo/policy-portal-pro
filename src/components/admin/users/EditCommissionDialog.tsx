import { getMessages, useMessages } from "@/i18n";
import { commonMessages } from "@/i18n/messages/common";
import { usersMessages } from "@/i18n/messages/users";
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
  const m = useMessages(usersMessages).commission;
  const common = useMessages(commonMessages);

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
        title: getMessages(usersMessages).commission.invalidTitle,
        description: getMessages(usersMessages).commission.invalidText,
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
        title: getMessages(usersMessages).commission.updatedTitle,
        description: getMessages(usersMessages).commission.updatedText(user.full_name),
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: getMessages(commonMessages).error,
        description: error.message || getMessages(usersMessages).commission.updateError,
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
          <DialogTitle>{m.title}</DialogTitle>
          <DialogDescription>
            {m.description(user?.full_name ?? "")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="baseCommission">{m.base}</Label>
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
              {m.baseHint}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>{m.bonuses}</Label>
                <p className="text-xs text-muted-foreground">
                  {m.bonusesHint}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addTier}>
                <Plus className="h-4 w-4 mr-2" />
                {m.addTier}
              </Button>
            </div>

            {tiers.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                {m.noTiers}
              </div>
            ) : (
              <div className="space-y-3">
                {tiers.map((tier, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end rounded-md border p-3">
                    <div className="space-y-2">
                      <Label>{m.threshold}</Label>
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
                      <Label>{m.bonus}</Label>
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
                      <Label>{m.label}</Label>
                      <Input
                        value={tier.label || ""}
                        onChange={(event) => updateTier(index, "label", event.target.value)}
                        placeholder={m.labelPlaceholder}
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
            <strong>{m.previewTitle}</strong> {m.preview(Number(baseCommission) || 0, totalBonus, effectivePreview)}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {common.cancel}
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {m.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
