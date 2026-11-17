// Apertura animata della homepage: decide, prima che la pagina sia disegnata, se accenderla (classe «intro»).
// Solo al primo arrivo: non da un'altra pagina del sito, non tornando indietro, non verso una sezione, mai con
// «riduci movimento». Nel dubbio la pagina resta ferma. Provato in tests/corp/intro.test.ts.
(function () {
  try {
    var root = document.documentElement;
    if (root.getAttribute("data-page") !== "home" || location.hash) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (performance.getEntriesByType("navigation")[0].type === "back_forward") return;
    if (document.referrer && new URL(document.referrer).origin === location.origin) return;
    root.classList.add("intro");
  } catch (error) {
    /* pagina ferma */
  }
})();
