import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getMessages, useMessages } from "@/i18n";
import { commonMessages } from "@/i18n/messages/common";
import { usersMessages } from "@/i18n/messages/users";

interface CompanyUser {
  id: string;
  full_name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: CompanyUser | null;
}

const EMPTY = { company_name: "", company_tax_code: "", company_address: "" };

/**
 * The company of a user who loads practices (e.g. the collaborator Italy4VAT S.r.l.): the statement of their lots is
 * addressed to it. Only an administrator changes it (the database refuses it to everyone else).
 */
export const EditCompanyDialog = ({ open, onOpenChange, user }: Props) => {
  const { toast } = useToast();
  const m = useMessages(usersMessages).company;
  const common = useMessages(commonMessages);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setForm(EMPTY);
    setLoading(true);
    void supabase
      .from("profiles")
      .select("company_name, company_tax_code, company_address")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        setLoading(false);
        if (error) {
          toast({ variant: "destructive", title: getMessages(commonMessages).error, description: getMessages(usersMessages).company.loadError });
          return;
        }
        setForm({ company_name: data?.company_name ?? "", company_tax_code: data?.company_tax_code ?? "", company_address: data?.company_address ?? "" });
      });
  }, [open, user, toast]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const clean = (value: string) => value.replace(/\s+/g, " ").trim() || null;
    const { data, error } = await supabase
      .from("profiles")
      .update({
        company_name: clean(form.company_name),
        company_tax_code: clean(form.company_tax_code)?.replace(/\s+/g, "").toUpperCase() ?? null,
        company_address: clean(form.company_address),
      })
      .eq("id", user.id)
      .select("id");
    setSaving(false);
    const text = getMessages(usersMessages).company;
    // No row updated means the database refused it (only an administrator may): say so instead of a silent success.
    if (error || !data?.length) {
      toast({ variant: "destructive", title: text.saveError, description: error?.message });
      return;
    }
    toast({ title: text.saved(user.full_name) });
    onOpenChange(false);
  };

  const field = (key: keyof typeof EMPTY, label: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`company-${key}`}>{label}</Label>
      <Input
        id={`company-${key}`}
        data-testid={`company-${key}`}
        value={form[key]}
        disabled={loading || saving}
        onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{m.title}</DialogTitle>
          <DialogDescription>{user ? m.description(user.full_name) : null}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {field("company_name", m.name)}
          {field("company_tax_code", m.taxCode)}
          {field("company_address", m.address)}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {common.cancel}
          </Button>
          <Button onClick={() => void save()} disabled={loading || saving} data-testid="company-save">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {m.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
