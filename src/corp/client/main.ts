// Ingresso del sito aziendale nel browser. Le pagine sono HTML completo: qui si aggiungono solo menu, movimento
// (comparsa allo scorrimento, riflesso del vetro sotto il puntatore, video dell'apertura), modulo di preventivo,
// consenso ai cookie e avviso della lingua.
// I comportamenti sono gli stessi del sito del portale: leggono solo attributi e classi della pagina.
import "../corp.css";
import { initConsent } from "../../site/client/consent";
import { initHeroVideo } from "../../site/client/hero-video";
import { initLangNotice } from "../../site/client/lang";
import { initMenu } from "../../site/client/menu";
import { initMotion } from "../../site/client/motion";
import { initReveal } from "../../site/client/reveal";
import { initIntro } from "./intro";
import { initQuoteForm } from "./quote";

const start = () => {
  // Per prima: l'apertura animata si spegne da sola o al primo gesto di chi legge. Il video di sfondo aspetta che
  // sia finita (durante l'apertura si vede l'immagine ferma, identica al suo primo fotogramma), poi parte a pagina
  // pronta, mai con «riduci movimento» o con il risparmio dati.
  initIntro(initHeroVideo);
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
