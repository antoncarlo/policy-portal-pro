// Ingresso del sito pubblico nel browser. Le pagine sono HTML completo: qui si aggiungono solo menu, movimento,
// avviso della lingua, invio del modulo contatti e video dell'apertura.
import "../site.css";
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
  initLangNotice();
  initContactForm();
  initHeroVideo();
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
