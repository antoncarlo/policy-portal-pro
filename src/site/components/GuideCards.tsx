// I riquadri delle guide: titolo collegato all'articolo, descrizione, data. Usati nell'indice del blog, in fondo
// agli articoli, nelle pagine per pubblico e nella homepage.
import { ArrowRight } from "lucide-react";
import type { ArticleEntry } from "../blog";
import { formatDate, type Lang } from "../config";
import { pathOf } from "../routes";

export const GuideCards = ({ entries, lang, heading: Heading = "h3" }: { entries: ArticleEntry[]; lang: Lang; heading?: "h2" | "h3" }) => (
  <div className="guide-cards stagger">
    {entries.map((entry) => {
      const article = entry.content[lang];
      return (
        <article key={entry.id} className="guide-card glass" data-reveal data-glow>
          <Heading className="guide-card__title">
            <a href={pathOf(entry.id, lang)}>{article.h1}</a>
          </Heading>
          <p className="guide-card__text">{article.description}</p>
          <p className="guide-card__meta">
            <time dateTime={entry.updated}>{formatDate(lang, entry.updated)}</time>
            <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />
          </p>
        </article>
      );
    })}
  </div>
);
