// «Quanto costa»: da cosa dipende il premio. Nessun importo: la quotazione arriva dopo l'esame dei documenti.
import { ArrowRight } from "lucide-react";
import { SectionHead, type PageProps } from "./Layout";

export const Cost = ({ content }: PageProps) => {
  const { cost } = content;
  return (
    <section className="section section--tint" id="costo">
      <div className="container cost">
        <div className="cost__main">
          <SectionHead eyebrow={cost.eyebrow} title={cost.title} />
          <p className="answer" data-reveal>
            {cost.answer}
          </p>
          <div className="cost__cta" data-reveal>
            <a className="btn btn--primary btn--lg" href="#contatti">
              {cost.cta}
              <ArrowRight size={18} strokeWidth={1.8} aria-hidden="true" />
            </a>
            <p className="cost__note">{cost.note}</p>
          </div>
        </div>
        <ul className="factors stagger">
          {cost.factors.map((factor, index) => (
            <li key={factor.title} className="factor glass" data-reveal data-glow>
              <span className="factor__num" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="factor__title">{factor.title}</h3>
              <p>{factor.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
