// L'apertura animata della homepage. Che parta o no lo decide /intro.js prima che la pagina sia disegnata (classe
// «intro» sulla pagina); l'animazione e' tutta nello stile. Qui la si spegne: a fine corsa, oppure subito se chi
// legge tocca, scorre o preme un tasto, perche' nessuno debba aspettare per usare la pagina.

/** Durata dell'apertura nello stile (src/corp/corp.css), con un margine. */
export const INTRO_MS = 3200;
const SKIP_EVENTS = ["wheel", "touchstart", "pointerdown", "keydown", "scroll"] as const;

/** `onEnd`: cio' che aspetta la fine dell'apertura (il video di sfondo); subito, se l'apertura non c'e'. */
export function initIntro(onEnd: () => void = () => {}): void {
  const root = document.documentElement;
  if (!root.classList.contains("intro")) {
    onEnd();
    return;
  }
  let timer = 0;
  const end = () => {
    root.classList.remove("intro");
    window.clearTimeout(timer);
    for (const name of SKIP_EVENTS) window.removeEventListener(name, end);
    onEnd();
  };
  for (const name of SKIP_EVENTS) window.addEventListener(name, end, { passive: true });
  timer = window.setTimeout(end, INTRO_MS);
}
