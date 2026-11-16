// Ingresso del sito aziendale nel browser. Le pagine sono HTML completo: qui si aggiungono solo menu, movimento
// (comparsa allo scorrimento, riflesso del vetro sotto il puntatore), modulo di preventivo, consenso ai cookie e
// avviso della lingua.
// I comportamenti sono gli stessi del sito del portale: leggono solo attributi e classi della pagina.
import "../corp.css";
import { initConsent } from "../../site/client/consent";
import { initLangNotice } from "../../site/client/lang";
import { initMenu } from "../../site/client/menu";
import { initMotion } from "../../site/client/motion";
import { initReveal } from "../../site/client/reveal";
import { initQuoteForm } from "./quote";

const start = () => {
  initMenu();
  initReveal();
  initMotion();
  initQuoteForm();
  // Prima il consenso: l'avviso della lingua aspetta che il banner dei cookie sia chiuso.
  initConsent();
  initLangNotice();
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
