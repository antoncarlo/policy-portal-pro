// Condizioni fisse delle fideiussioni VIES, usate dalla creazione delle pratiche
// e dal controllo finale prima dell'invio: un solo punto di verità.

/** Importo garantito (massimale della fideiussione), distinto dal premio di polizza. */
export const VIES_GUARANTEED_AMOUNT = 50000;
/**
 * Premio fisso di polizza, scomposto come nella "Liquidazione del premio" delle bozze della compagnia (Markel, bozza
 * 1514223 del 9/11/2026): premio netto € 1.616,16 + accessori € 161,62 (10% del netto) + diritti di emissione € 0,00 =
 * imponibile € 1.777,78; + imposte € 222,22 (imposta sulle assicurazioni del ramo cauzioni, 12,5% dell'imponibile) =
 * premio finito € 2.000,00.
 */
export const VIES_PREMIUM_GROSS = 2000;
export const VIES_PREMIUM_TAX_RATE = 0.125;
export const VIES_PREMIUM_TAXABLE = Math.round((VIES_PREMIUM_GROSS / (1 + VIES_PREMIUM_TAX_RATE)) * 100) / 100;
export const VIES_PREMIUM_TAXES = Math.round((VIES_PREMIUM_GROSS - VIES_PREMIUM_TAXABLE) * 100) / 100;
export const VIES_PREMIUM_NET = 1616.16;
export const VIES_PREMIUM_FEES = 0;
export const VIES_PREMIUM_ACCESSORIES = Math.round((VIES_PREMIUM_TAXABLE - VIES_PREMIUM_NET - VIES_PREMIUM_FEES) * 100) / 100;
export const VIES_DURATION_MONTHS = 36;
export const VIES_MAX_PRACTICES_PER_SHEET = 20;

/**
 * Modalità prova: true consente di creare (e inviare) più pratiche VIES per la stessa
 * società, per ripetere le prove sugli stessi file; la pagina VIES lo segnala con un avviso.
 * In uso reale resta false: una società già presente nel portale, caricata da chiunque,
 * blocca la riga al caricamento e al controllo finale prima dell'invio.
 */
export const VIES_ALLOW_DUPLICATE_PRACTICES = false;
