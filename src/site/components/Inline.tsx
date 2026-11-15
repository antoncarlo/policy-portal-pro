// Un testo degli articoli o delle pagine per pubblico, con i collegamenti scritti nella forma «[testo](bersaglio)»
// (src/site/inline.ts). Un bersaglio che non esiste resta testo semplice: i test lo segnalano prima.
import type { Lang } from "../config";
import { parseInline, resolveTarget } from "../inline";

export const Inline = ({ text, lang }: { text: string; lang: Lang }) => (
  <>
    {parseInline(text).map((part, index) => {
      if (typeof part === "string") return part;
      const link = resolveTarget(part.target, lang);
      if (!link) return part.label;
      return link.external ? (
        <a key={index} href={link.href} target="_blank" rel="noopener noreferrer">
          {part.label}
        </a>
      ) : (
        <a key={index} href={link.href}>
          {part.label}
        </a>
      );
    })}
  </>
);
