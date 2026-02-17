import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Package } from "lucide-react";

interface EditUserProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  userId: string;
  userName: string;
  userRole: string;
}

export const EditUserProductsDialog = ({
  open,
  onOpenChange,
  onSuccess,
  userId,
  userName,
  userRole,
}: EditUserProductsDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [initialProducts, setInitialProducts] = useState<string[]>([]);

  useEffect(() => {
    if (open && userId) {
      loadUserProducts();
    }
  }, [open, userId]);

  const loadUserProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("user_product_permissions")
        .select("practice_type")
        .eq("user_id", userId);

      if (error) throw error;

      const products = data?.map(p => p.practice_type) || [];
      setSelectedProducts(products);
      setInitialProducts(products);
    } catch (error: any) {
      console.error("Error loading user products:", error);
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Impossibile caricare i prodotti dell'utente",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate product selection for agente/collaboratore
    if ((userRole === "agente" || userRole === "collaboratore") && selectedProducts.length === 0) {
      toast({
        variant: "destructive",
        title: "Selezione prodotti richiesta",
        description: "Seleziona almeno un prodotto per questo ruolo.",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");

      // Delete existing permissions
      const { error: deleteError } = await supabase
        .from("user_product_permissions")
        .delete()
        .eq("user_id", userId);

      if (deleteError) throw deleteError;

      // Insert new permissions
      if (selectedProducts.length > 0) {
        const { error: insertError } = await supabase
          .from("user_product_permissions")
          .insert(
            selectedProducts.map(productType => ({
              user_id: userId,
              practice_type: productType,
              created_by: user.id,
            }))
          );

        if (insertError) throw insertError;
      }

      toast({
        title: "Successo",
        description: `Permessi prodotto aggiornati per ${userName}`,
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

  const productList = [
    { value: "pet", label: "Pet" },
    { value: "car", label: "Car" },
    { value: "casa", label: "Casa" },
    { value: "salute", label: "Salute" },
    { value: "fidejussioni", label: "Fidejussioni" },
    { value: "postuma_decennale", label: "Postuma Decennale" },
    { value: "all_risk", label: "All Risk" },
    { value: "responsabilita_civile", label: "RC" },
    { value: "fotovoltaico", label: "Fotovoltaico" },
    { value: "catastrofali", label: "Catastrofali" },
    { value: "azienda", label: "Azienda" },
    { value: "risparmio", label: "Risparmio" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifica Permessi Prodotto</DialogTitle>
          <DialogDescription>
            Gestisci i prodotti assegnati a {userName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>
              <Package className="h-4 w-4 inline mr-2" />
              Prodotti Consentiti
            </Label>
            <div className="text-sm text-muted-foreground mb-2">
              Seleziona quali tipologie di polizze l'utente può gestire
              {selectedProducts.length > 0 && (
                <span className="ml-2 font-semibold text-primary">({selectedProducts.length} selezionati)</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto border rounded-md p-3">
              {productList.map((product) => (
                <label key={product.value} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    value={product.value}
                    checked={selectedProducts.includes(product.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedProducts([...selectedProducts, product.value]);
                      } else {
                        setSelectedProducts(selectedProducts.filter(p => p !== product.value));
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">{product.label}</span>
                </label>
              ))}
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Annulla
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salva Modifiche
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
