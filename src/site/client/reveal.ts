// La comparsa allo scorrimento. Il contenuto e' visibile nell'HTML: qui si nasconde solo cio' che sta sotto lo
// schermo, per farlo comparire quando entra. Con «riduci movimento» non si nasconde nulla.
export function initReveal(): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.remove("is-waiting");
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -6% 0px", threshold: 0.05 },
  );
  const fold = window.innerHeight * 0.94;
  for (const item of document.querySelectorAll<HTMLElement>("[data-reveal]")) {
    if (item.getBoundingClientRect().top <= fold) continue;
    item.classList.add("is-waiting");
    observer.observe(item);
  }
  // Prima della stampa tutto torna visibile.
  window.addEventListener("beforeprint", () => {
    for (const item of document.querySelectorAll(".is-waiting")) item.classList.remove("is-waiting");
  });
}
