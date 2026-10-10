import { getMessages, LANGUAGES, useLanguage, useMessages } from "@/i18n";
import { commonMessages } from "@/i18n/messages/common";
import { passwordMessages } from "@/i18n/messages/passwords";
import { practiceTypeLabel, roleLabel } from "@/i18n/messages/domain";
import { ASSIGNABLE_PRODUCTS, usersMessages } from "@/i18n/messages/users";
import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Mail, User, Phone, Shield, Percent, Package, Plus, Trash2 } from "lucide-react";
import { generateSecurePassword } from "@/lib/passwordGenerator";

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface CommissionBonusTier {
  threshold: number;
  bonus_percentage: number;
  label?: string;
}

const normalizeTiers = (tiers: CommissionBonusTier[]) =>
  tiers
    .map((tier) => ({
      threshold: Number(tier.threshold) || 0,
      bonus_percentage: Number(tier.bonus_percentage) || 0,
      label: tier.label?.trim() || "",
    }))
    .filter((tier) => tier.threshold > 0 && tier.bonus_percentage > 0)
    .sort((a, b) => a.threshold - b.threshold);

export const InviteUserDialog = ({
  open,
  onOpenChange,
  onSuccess,
}: InviteUserDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [commissionBonusTiers, setCommissionBonusTiers] = useState<CommissionBonusTier[]>([]);
  const m = useMessages(usersMessages);
  const common = useMessages(commonMessages);
  const language = useLanguage();
  const invite = useMessages(passwordMessages).invite;
  const [sendWelcome, setSendWelcome] = useState(true);
  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    phone: "",
    role: "collaboratore",
    language: language as string,
    password: "",
    default_commission_percentage: "0",
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addCommissionTier = () => {
    setCommissionBonusTiers((current) => [
      ...current,
      { threshold: 0, bonus_percentage: 1, label: "" },
    ]);
  };

  const updateCommissionTier = (index: number, field: keyof CommissionBonusTier, value: string) => {
    setCommissionBonusTiers((current) =>
      current.map((tier, tierIndex) =>
        tierIndex === index
          ? { ...tier, [field]: field === "label" ? value : Number(value) }
          : tier
      )
    );
  };

  const removeCommissionTier = (index: number) => {
    setCommissionBonusTiers((current) => current.filter((_, tierIndex) => tierIndex !== index));
  };

  const generateRandomPassword = () => {
    setFormData((prev) => ({ ...prev, password: generateSecurePassword() }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.full_name || !formData.password) {
      toast({
        variant: "destructive",
        title: getMessages(commonMessages).error,
        description: getMessages(usersMessages).create.requiredFields,
      });
      return;
    }

    // Validate product selection for agente/collaboratore
    if ((formData.role === "agente" || formData.role === "collaboratore") && selectedProducts.length === 0) {
      toast({
        variant: "destructive",
        title: getMessages(usersMessages).products.requiredTitle,
        description: getMessages(usersMessages).products.requiredText,
      });
      return;
    }

    setLoading(true);
    try {
      // Get session token for authorization
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error(getMessages(usersMessages).create.mustBeSignedIn);
      }

      const normalizedCommissionBonusTiers = normalizeTiers(commissionBonusTiers);

      // Call API route to create user
      const response = await fetch('/api/portal-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'create_user',
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          phone: formData.phone,
          role: formData.role,
          language: formData.language,
          send_welcome: sendWelcome,
          default_commission_percentage: parseFloat(formData.default_commission_percentage) || 0,
          commission_bonus_tiers: normalizedCommissionBonusTiers,
          allowed_products: selectedProducts,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || getMessages(usersMessages).create.createError);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: getMessages(commonMessages).success,
        description: getMessages(usersMessages).create.created(formData.full_name),
      });

      if (sendWelcome) {
        const welcome = getMessages(passwordMessages).invite;
        toast(
          data.welcome?.sent
            ? { title: getMessages(commonMessages).success, description: welcome.welcomeSent(formData.email) }
            : { variant: "destructive", title: getMessages(commonMessages).error, description: welcome.welcomeFailed(data.welcome?.reason ?? "?") },
        );
      }
      // Show password to admin
      toast({
        title: getMessages(usersMessages).create.passwordTitle,
        description: getMessages(usersMessages).create.passwordText(formData.password),
        duration: 10000,
      });

      onSuccess();
      onOpenChange(false);
      setSelectedProducts([]);
      setCommissionBonusTiers([]);
      setFormData({
        email: "",
        full_name: "",
        phone: "",
        role: "collaboratore",
        language: language as string,
        password: "",
        default_commission_percentage: "0",
      });
      setSendWelcome(true);
    } catch (error) {
      toast({
        variant: "destructive",
        title: getMessages(commonMessages).error,
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{m.create.inviteTitle}</DialogTitle>
          <DialogDescription>
            {m.create.inviteText}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4 overflow-y-auto max-h-[60vh]">
          <div className="space-y-2">
            <Label htmlFor="full_name">
              {m.create.fullName} <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="full_name"
                placeholder={m.create.fullNamePlaceholder}
                value={formData.full_name}
                onChange={(e) => handleChange("full_name", e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">
              {m.create.email} <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="email"
                type="email"
                placeholder={m.create.emailPlaceholder}
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">{m.create.phone}</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="phone"
                placeholder="+39 123 456 7890"
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">
              {m.create.role} <span className="text-red-500">*</span>
            </Label>
            <Select value={formData.role} onValueChange={(value) => handleChange("role", value)}>
              <SelectTrigger>
                <SelectValue placeholder={m.create.selectRole} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-red-600" />
                    <span>{roleLabel("admin", language)}</span>
                  </div>
                </SelectItem>
                <SelectItem value="agente">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-blue-600" />
                    <span>{roleLabel("agente", language)}</span>
                  </div>
                </SelectItem>
                <SelectItem value="collaboratore">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-green-600" />
                    <span>{roleLabel("collaboratore", language)}</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="user_language">{invite.languageLabel}</Label>
            <Select value={formData.language} onValueChange={(value) => handleChange("language", value)}>
              <SelectTrigger id="user_language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((entry) => (
                  <SelectItem key={entry.code} value={entry.code}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">{invite.languageHint}</p>
          </div>

          {(formData.role === "agente" || formData.role === "collaboratore") && (
            <div className="space-y-2">
              <Label>
                <Package className="h-4 w-4 inline mr-2" />
                {m.products.allowed}
              </Label>
              <div className="text-sm text-muted-foreground mb-2">
                {m.products.hint}
                {selectedProducts.length > 0 && (
                  <span className="ml-2 font-semibold text-primary">{m.products.selectedCount(selectedProducts.length)}</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto border rounded-md p-3">
                {ASSIGNABLE_PRODUCTS.map((product) => (
                  <label key={product} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      value={product}
                      checked={selectedProducts.includes(product)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedProducts([...selectedProducts, product]);
                        } else {
                          setSelectedProducts(selectedProducts.filter(p => p !== product));
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">{practiceTypeLabel(product, language)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="commission">
              {m.commission.base}
            </Label>
            <div className="relative">
              <Percent className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="commission"
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="16.00"
                value={formData.default_commission_percentage}
                onChange={(e) => handleChange("default_commission_percentage", e.target.value)}
                className="pl-10"
              />
            </div>
            <p className="text-xs text-gray-500">
              {m.create.baseHint}
            </p>
          </div>

          <div className="space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>{m.commission.bonuses}</Label>
                <p className="text-xs text-gray-500">
                  {m.create.bonusesHint}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addCommissionTier}>
                <Plus className="h-4 w-4 mr-2" />
                {m.commission.tier}
              </Button>
            </div>

            {commissionBonusTiers.length === 0 ? (
              <p className="text-sm text-muted-foreground">{m.create.noBonuses}</p>
            ) : (
              <div className="space-y-3">
                {commissionBonusTiers.map((tier, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end rounded-md bg-muted/40 p-3">
                    <div className="space-y-1">
                      <Label>{m.commission.thresholdShort}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={tier.threshold || ""}
                        onChange={(e) => updateCommissionTier(index, "threshold", e.target.value)}
                        placeholder="50000"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>{m.commission.bonus}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={tier.bonus_percentage || ""}
                        onChange={(e) => updateCommissionTier(index, "bonus_percentage", e.target.value)}
                        placeholder="1"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>{m.commission.label}</Label>
                      <Input
                        value={tier.label || ""}
                        onChange={(e) => updateCommissionTier(index, "label", e.target.value)}
                        placeholder={m.commission.labelPlaceholder}
                      />
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeCommissionTier(index)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">
              {m.create.password} <span className="text-red-500">*</span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="password"
                type="text"
                placeholder={m.create.passwordPlaceholder}
                value={formData.password}
                onChange={(e) => handleChange("password", e.target.value)}
                required
              />
              <Button type="button" variant="outline" onClick={generateRandomPassword}>
                {m.create.generate}
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              {m.create.passwordHint}
            </p>
          </div>

          <label className="flex items-start gap-2 rounded-md border p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={sendWelcome}
              onChange={(e) => setSendWelcome(e.target.checked)}
              className="mt-1 rounded border-gray-300"
            />
            <span className="text-sm">
              <span className="font-medium">{invite.sendWelcome}</span>
              <span className="block text-xs text-gray-500">{invite.sendWelcomeHint}</span>
            </span>
          </label>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {common.cancel}
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {m.create.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
