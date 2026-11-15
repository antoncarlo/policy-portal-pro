// Ingresso del sito pubblico nel browser. Le pagine sono HTML completo: qui si aggiungono solo menu, movimento,
// consenso ai cookie, avviso della lingua, invio del modulo contatti e video dell'apertura.
import "../site.css";
import { initConsent } from "./consent";
import { initContactForm } from "./contact";
import { initHeroVideo } from "./hero-video";
import { initLangNotice } from "./lang";
import { initMenu } from "./menu";
import { initMotion } from "./motion";
import { initReveal } from "./reveal";

const start = () => {
  initMenu();
  initReveal();
  initMotion();
  // Prima il consenso: l'avviso della lingua aspetta che il banner dei cookie sia chiuso.
  initConsent();
  initLangNotice();
  initContactForm();
  initHeroVideo();
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
