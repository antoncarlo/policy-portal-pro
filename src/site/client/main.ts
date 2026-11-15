// Ingresso del sito pubblico nel browser. Le pagine sono HTML completo: qui si aggiungono solo menu, movimento,
// avviso della lingua e video dell'apertura.
import "../site.css";
import { initHeroVideo } from "./hero-video";
import { initLangNotice } from "./lang";
import { initMenu } from "./menu";
import { initMotion } from "./motion";
import { initReveal } from "./reveal";

const start = () => {
  initMenu();
  initReveal();
  initMotion();
  initLangNotice();
  initHeroVideo();
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
