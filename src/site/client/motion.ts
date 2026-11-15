// Il movimento legato allo scorrimento e al puntatore: barra che si stacca dal fondo, avanzamento della pagina,
// aloni che si spostano, linea dei passi che si disegna, voce di menu della sezione in vista, riflesso e
// inclinazione del vetro sotto il puntatore. Con «riduci movimento» resta solo lo stato della barra.
import { lineProgress } from "./logic";

export function initMotion(): void {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const header = document.querySelector<HTMLElement>("[data-site-header]");
  const progress = document.querySelector<HTMLElement>(".scroll-progress");
  const steps = document.querySelector<HTMLElement>("[data-progress-line]");
  const glows = [...document.querySelectorAll<HTMLElement>(".section__glow")];

  let queued = false;
  const update = () => {
    queued = false;
    const y = window.scrollY;
    header?.classList.toggle("is-scrolled", y > 24);
    if (reduce) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress?.style.setProperty("--page-progress", max > 0 ? (y / max).toFixed(4) : "0");
    for (const glow of glows) glow.style.setProperty("--scroll", String(Math.round(y)));
    if (steps) steps.style.setProperty("--steps-progress", String(lineProgress(steps.getBoundingClientRect(), window.innerHeight)));
  };
  const queue = () => {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(update);
  };
  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", queue);
  update();

  markCurrentSection();
  if (reduce || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  for (const surface of document.querySelectorAll<HTMLElement>("[data-glow]")) {
    surface.addEventListener("pointermove", (event) => {
      const rect = surface.getBoundingClientRect();
      surface.style.setProperty("--mx", `${Math.round(event.clientX - rect.left)}px`);
      surface.style.setProperty("--my", `${Math.round(event.clientY - rect.top)}px`);
      surface.style.setProperty("--glow", "1");
    });
    surface.addEventListener("pointerleave", () => surface.style.setProperty("--glow", "0"));
  }
  for (const surface of document.querySelectorAll<HTMLElement>("[data-tilt]")) {
    surface.addEventListener("pointermove", (event) => {
      const rect = surface.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      surface.style.setProperty("--tilt-x", `${(x * 10).toFixed(2)}deg`);
      surface.style.setProperty("--tilt-y", `${(-y * 8).toFixed(2)}deg`);
    });
    surface.addEventListener("pointerleave", () => {
      surface.style.setProperty("--tilt-x", "0deg");
      surface.style.setProperty("--tilt-y", "0deg");
    });
  }
}

/** Segna nel menu la sezione che occupa il centro dello schermo. */
function markCurrentSection(): void {
  if (!("IntersectionObserver" in window)) return;
  const links = new Map<string, HTMLAnchorElement>();
  for (const link of document.querySelectorAll<HTMLAnchorElement>(".site-nav__list a")) {
    const hash = link.hash.slice(1);
    if (hash) links.set(hash, link);
  }
  if (links.size === 0) return;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        for (const link of links.values()) link.removeAttribute("aria-current");
        links.get(entry.target.id)?.setAttribute("aria-current", "true");
      }
    },
    { rootMargin: "-45% 0px -50% 0px" },
  );
  for (const id of links.keys()) {
    const section = document.getElementById(id);
    if (section) observer.observe(section);
  }
}
