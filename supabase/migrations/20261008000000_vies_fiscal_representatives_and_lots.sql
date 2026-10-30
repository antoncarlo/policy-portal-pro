-- VIES in Amministrazione: anagrafica dei rappresentanti fiscali censiti e
-- lotti Excel numerati per rappresentante ("Excel Lotto 1", "Excel Lotto 2", …),
-- con estratto conto, saldo e provvigioni del lotto.

CREATE TABLE IF NOT EXISTS public.vies_fiscal_representatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  tax_code text NOT NULL,
  administrator_name text,
  administrator_tax_code text,
  address text,
  pec text,
  visura_reference text,
  visura_storage_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vies_fiscal_representatives_user_tax_code_key UNIQUE (user_id, tax_code)
);

ALTER TABLE public.vies_fiscal_representatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their VIES fiscal representatives" ON public.vies_fiscal_representatives
  FOR SELECT USING (user_id = (SELECT auth.uid()) OR has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Users can create their VIES fiscal representatives" ON public.vies_fiscal_representatives
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()) OR has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Users can update their VIES fiscal representatives" ON public.vies_fiscal_representatives
  FOR UPDATE USING (user_id = (SELECT auth.uid()) OR has_role((SELECT auth.uid()), 'admin'::app_role))
  WITH CHECK (user_id = (SELECT auth.uid()) OR has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Users can delete their VIES fiscal representatives" ON public.vies_fiscal_representatives
  FOR DELETE USING (user_id = (SELECT auth.uid()) OR has_role((SELECT auth.uid()), 'admin'::app_role));

CREATE TRIGGER update_vies_fiscal_representatives_updated_at
  BEFORE UPDATE ON public.vies_fiscal_representatives
  FOR EACH ROW EXECUTE FUNCTION public.update_vies_updated_at();

ALTER TABLE public.vies_batches
  ADD COLUMN IF NOT EXISTS fiscal_representative_id uuid REFERENCES public.vies_fiscal_representatives(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lot_number integer,
  ADD COLUMN IF NOT EXISTS paid_at date,
  ADD COLUMN IF NOT EXISTS commission_percentage numeric(5,2),
  ADD COLUMN IF NOT EXISTS withholding_percentage numeric(5,2),
  ADD COLUMN IF NOT EXISTS commissions_received_at date,
  ADD COLUMN IF NOT EXISTS statement_generated_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS vies_batches_representative_lot_key
  ON public.vies_batches (fiscal_representative_id, lot_number)
  WHERE fiscal_representative_id IS NOT NULL AND lot_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS vies_batches_fiscal_representative_idx ON public.vies_batches (fiscal_representative_id);
