// Il video dell'apertura: l'immagine fissa e' nell'HTML; il video si carica solo a pagina pronta, e solo se chi
// legge non ha chiesto meno movimento o meno dati.
import { shouldPlayVideo } from "./logic";

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

export function initHeroVideo(): void {
  const video = document.querySelector<HTMLVideoElement>("video[data-hero-video]");
  if (!video) return;
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  const play = shouldPlayVideo({
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    saveData: connection?.saveData,
    effectiveType: connection?.effectiveType,
  });
  if (!play) return;
  const start = () => {
    for (const source of video.querySelectorAll<HTMLSourceElement>("source[data-src]")) source.src = source.dataset.src ?? "";
    video.load();
    video.play().catch(() => {
      // riproduzione automatica rifiutata dal browser: resta l'immagine fissa
    });
  };
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
}
