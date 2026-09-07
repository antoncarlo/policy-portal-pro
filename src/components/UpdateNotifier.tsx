import { useEffect, useRef } from "react";
import { toast } from "sonner";

const CHECK_INTERVAL_MS = 3 * 60 * 1000;
const TOAST_ID = "app-update-available";

/**
 * Controlla periodicamente /version.json (generato ad ogni build) e, se il
 * portale e' stato ridistribuito, mostra un avviso persistente con il pulsante
 * "Ricarica". Evita che una scheda aperta da ore continui a usare codice vecchio.
 */
export const UpdateNotifier = () => {
  const notified = useRef(false);

  useEffect(() => {
    if (typeof __BUILD_ID__ !== "string" || !__BUILD_ID__) return;

    const check = async () => {
      if (notified.current || document.visibilityState === "hidden") return;
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { buildId?: string };
        if (data.buildId && data.buildId !== __BUILD_ID__) {
          notified.current = true;
          toast.info("Nuova versione del portale disponibile", {
            id: TOAST_ID,
            description: "Ricarica la pagina per usare le ultime funzionalità.",
            duration: Infinity,
            action: { label: "Ricarica", onClick: () => window.location.reload() },
          });
        }
      } catch {
        // rete assente o risposta non valida: riproviamo al prossimo giro
      }
    };

    const timer = window.setInterval(check, CHECK_INTERVAL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    void check();

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  return null;
};
