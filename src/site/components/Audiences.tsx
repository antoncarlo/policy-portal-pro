// «Per chi»: i due pubblici del sito, chi gestisce le garanzie per i propri clienti e chi deve prestarla. Ogni
// riquadro porta alla pagina dedicata.
import { ArrowRight, Briefcase, Check, Globe } from "lucide-react";
import { AUDIENCE_IDS } from "../content/types";
import { pathOf } from "../routes";
import { SectionHead, type PageProps } from "./Layout";

const ICONS = [Briefcase, Globe];

export const Audiences = ({ page, content }: PageProps) => {
  const { audiences } = content;
  return (
    <section className="section section--tint" id="per-chi">
      <div className="container">
        <SectionHead title={audiences.title} />
        <div className="audiences stagger">
          {audiences.items.map((item, index) => {
            const Icon = ICONS[index % ICONS.length];
            return (
              <article key={item.title} className={index === 1 ? "audience audience--dark glass-dark" : "audience glass"} data-reveal data-glow>
                <span className={index === 1 ? "icon-badge icon-badge--bronze" : "icon-badge"}>
                  <Icon size={24} strokeWidth={1.6} aria-hidden="true" />
                </span>
                <h3 className="audience__title">{item.title}</h3>
                <p className="audience__text">{item.text}</p>
                <ul className="checks">
                  {item.points.map((point) => (
                    <li key={point}>
                      <Check size={16} strokeWidth={2.2} aria-hidden="true" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
                <a className="link-arrow" href={pathOf(AUDIENCE_IDS[index], page.lang)}>
                  {item.more}
                  <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />
                </a>
                <a className="audience__contact" href="#contatti">
                  {item.cta}
                </a>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};
