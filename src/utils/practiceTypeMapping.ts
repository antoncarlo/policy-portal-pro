// Mappatura tra valori UI (form) e valori enum database
export const PRACTICE_TYPE_MAPPING: Record<string, string> = {
  "Fidejussioni": "fidejussioni",
  "Car": "car",
  "Postuma Decennale": "postuma_decennale",
  "All Risk": "all_risk",
  "RC": "responsabilita_civile",
  "Pet": "pet",
  "Fotovoltaico": "fotovoltaico",
  "Catastrofali": "catastrofali",
  "Azienda": "azienda",
  "Casa": "casa",
  "Risparmio": "risparmio",
  "Salute": "salute"
};

/**
 * Converte un valore practice_type dal formato Title Case del form
 * al formato enum del database
 * 
 * @param uiValue - Valore in Title Case (es. "Car", "RC", "Postuma Decennale")
 * @returns Valore enum database (es. "car", "responsabilita_civile", "postuma_decennale")
 * @throws Error se il valore non è mappato
 */
export function mapPracticeTypeToEnum(uiValue: string): string {
  const enumValue = PRACTICE_TYPE_MAPPING[uiValue];
  
  if (!enumValue) {
    console.error(`Valore practice_type non mappato: "${uiValue}"`);
    console.error("Valori validi:", Object.keys(PRACTICE_TYPE_MAPPING));
    throw new Error(
      `Tipologia pratica non valida: "${uiValue}". ` +
      `Valori accettati: ${Object.keys(PRACTICE_TYPE_MAPPING).join(", ")}`
    );
  }
  
  return enumValue;
}

/**
 * Converte un valore practice_type dall'enum database al formato Title Case
 * per la visualizzazione nell'UI
 * 
 * @param enumValue - Valore enum database (es. "car", "responsabilita_civile")
 * @returns Valore Title Case (es. "Car", "RC")
 */
export function mapEnumToPracticeType(enumValue: string): string {
  // Inverti la mappatura
  const reverseMapping = Object.entries(PRACTICE_TYPE_MAPPING).reduce(
    (acc, [key, value]) => {
      acc[value] = key;
      return acc;
    },
    {} as Record<string, string>
  );
  
  return reverseMapping[enumValue] || enumValue;
}
