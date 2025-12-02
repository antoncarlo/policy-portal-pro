-- Add Pet-specific fields to practices table
-- Codice Fiscale del proprietario e Microchip dell'animale

ALTER TABLE practices
ADD COLUMN IF NOT EXISTS owner_tax_code VARCHAR(16),
ADD COLUMN IF NOT EXISTS pet_microchip VARCHAR(15);

COMMENT ON COLUMN practices.owner_tax_code IS 'Codice Fiscale del proprietario (obbligatorio per polizze Pet)';
COMMENT ON COLUMN practices.pet_microchip IS 'Codice microchip dell''animale (obbligatorio per polizze Pet, max 15 cifre)';
