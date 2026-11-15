// Il menu su telefono e tablet: il pulsante apre il pannello delle sezioni; si chiude scegliendo una voce, con Esc,
// toccando fuori o allargando la finestra.
export function initMenu(): void {
  const header = document.querySelector<HTMLElement>("[data-site-header]");
  const toggle = header?.querySelector<HTMLButtonElement>(".menu-toggle");
  const nav = header?.querySelector<HTMLElement>("#site-menu");
  if (!header || !toggle || !nav) return;

  const isOpen = () => header.classList.contains("menu-open");
  const set = (open: boolean) => {
    header.classList.toggle("menu-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  };
  toggle.addEventListener("click", () => set(!isOpen()));
  nav.addEventListener("click", (event) => {
    if ((event.target as Element).closest("a")) set(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen()) {
      set(false);
      toggle.focus();
    }
  });
  document.addEventListener("click", (event) => {
    if (isOpen() && !header.contains(event.target as Node)) set(false);
  });
  window.matchMedia("(min-width: 1300px)").addEventListener("change", () => set(false));
}
