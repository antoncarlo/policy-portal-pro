-- Update practice types and add new fields
-- Step 1: Add new practice types to the enum
ALTER TYPE practice_type ADD VALUE IF NOT EXISTS 'fidejussioni';
ALTER TYPE practice_type ADD VALUE IF NOT EXISTS 'car';
ALTER TYPE practice_type ADD VALUE IF NOT EXISTS 'postuma_decennale';
ALTER TYPE practice_type ADD VALUE IF NOT EXISTS 'all_risk';
ALTER TYPE practice_type ADD VALUE IF NOT EXISTS 'responsabilita_civile';
ALTER TYPE practice_type ADD VALUE IF NOT EXISTS 'pet';
ALTER TYPE practice_type ADD VALUE IF NOT EXISTS 'fotovoltaico';
ALTER TYPE practice_type ADD VALUE IF NOT EXISTS 'catastrofali';
ALTER TYPE practice_type ADD VALUE IF NOT EXISTS 'azienda';
ALTER TYPE practice_type ADD VALUE IF NOT EXISTS 'risparmio';

-- Step 2: Add new columns to practices table
ALTER TABLE practices 
ADD COLUMN IF NOT EXISTS beneficiary TEXT,
ADD COLUMN IF NOT EXISTS policy_start_date DATE,
ADD COLUMN IF NOT EXISTS policy_end_date DATE;

-- Step 3: Add new column to profiles table for client address
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS address TEXT;

-- Add comments
COMMENT ON COLUMN practices.beneficiary IS 'Beneficiario della polizza (facoltativo)';
COMMENT ON COLUMN practices.policy_start_date IS 'Data inizio validità polizza';
COMMENT ON COLUMN practices.policy_end_date IS 'Data fine validità polizza';
COMMENT ON COLUMN profiles.address IS 'Indirizzo del cliente';
