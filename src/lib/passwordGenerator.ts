// Generatore di password per i nuovi utenti: usa il generatore crittografico del browser
// (crypto.getRandomValues) e garantisce almeno un carattere di ogni classe, cosi' resta valido
// anche se in Supabase si attivano i requisiti "maiuscole, minuscole, cifre e simboli".
// Niente caratteri ambigui (0/O, 1/l/I) e niente apici o barre, che creano problemi quando
// la password viene copiata o scritta in un messaggio.

const LOWER = "abcdefghijkmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%&*?-_=+";
const ALL = LOWER + UPPER + DIGITS + SYMBOLS;

export const GENERATED_PASSWORD_LENGTH = 16;

/** Intero uniforme in [0, max) senza distorsione (rejection sampling). */
const randomInt = (max: number): number => {
  const limit = Math.floor(0x100000000 / max) * max;
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return buffer[0] % max;
};

const pick = (alphabet: string) => alphabet.charAt(randomInt(alphabet.length));

export function generateSecurePassword(length: number = GENERATED_PASSWORD_LENGTH): string {
  if (length < 8) throw new Error("La password generata deve avere almeno 8 caratteri");
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < length) chars.push(pick(ALL));
  // Fisher-Yates con lo stesso generatore sicuro, cosi' le classi garantite non stanno sempre in testa
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
