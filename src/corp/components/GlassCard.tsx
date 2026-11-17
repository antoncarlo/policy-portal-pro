// Una lastra di vetro liquido: sfondo sfocato, bordo luminoso, riflesso che segue il puntatore (src/site/client/motion.ts
// aggiorna --mx, --my e --glow sugli elementi con data-glow). Tutti i riquadri del sito passano di qui.
import type { HTMLAttributes, ReactNode } from "react";

type Tag = "div" | "article" | "section" | "li" | "aside" | "nav";

export interface GlassProps extends HTMLAttributes<HTMLElement> {
  as?: Tag;
  /** "dark": vetro chiaro su fondo scuro. "light": vetro appena brunito su fondo chiaro. */
  tone?: "dark" | "light";
  children: ReactNode;
}

/** La classe propria del componente per prima, poi quelle del vetro. */
export const glassClass = (tone: "dark" | "light" = "dark", own = "") => `${own ? `${own} ` : ""}glass-card${tone === "light" ? " glass-card--light" : ""}`;

export const GlassCard = ({ as = "div", tone = "dark", className = "", children, ...rest }: GlassProps) => {
  const Element = as;
  return (
    <Element className={glassClass(tone, className)} data-glow {...rest}>
      {children}
    </Element>
  );
};
