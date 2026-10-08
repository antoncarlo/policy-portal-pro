// Condizioni fisse delle fideiussioni VIES, usate dalla creazione delle pratiche
// e dal controllo finale prima dell'invio: un solo punto di verità.

/** Importo garantito (massimale della fideiussione), distinto dal premio di polizza. */
export const VIES_GUARANTEED_AMOUNT = 50000;
/**
 * Premio fisso di polizza: il lordo comprende l'imposta sulle assicurazioni del
 * ramo cauzioni (12,5%). Senza accessori il premio netto coincide con l'imponibile.
 */
export const VIES_PREMIUM_GROSS = 2000;
export const VIES_PREMIUM_TAX_RATE = 0.125;
export const VIES_PREMIUM_TAXABLE = Math.round((VIES_PREMIUM_GROSS / (1 + VIES_PREMIUM_TAX_RATE)) * 100) / 100;
export const VIES_PREMIUM_TAXES = Math.round((VIES_PREMIUM_GROSS - VIES_PREMIUM_TAXABLE) * 100) / 100;
export const VIES_DURATION_MONTHS = 36;
export const VIES_MAX_PRACTICES_PER_SHEET = 20;

/**
 * TEMPORANEO, modalità prova: consente di creare (e inviare) più pratiche VIES per
 * la stessa società, per ripetere le prove sugli stessi file. Da riportare a false
 * prima dell'uso reale: la pagina VIES mostra un avviso finché resta attiva.
 */
export const VIES_ALLOW_DUPLICATE_PRACTICES = true;
