// Domande frequenti: ogni risposta e' nell'HTML (anche da chiusa) e negli stessi termini nei dati strutturati.
import { ChevronDown } from "lucide-react";
import { SectionHead, type PageProps } from "./Layout";

export const Faq = ({ content }: PageProps) => {
  const { faq } = content;
  return (
    <section className="section" id="domande">
      <div className="container container--narrow">
        <SectionHead eyebrow={faq.eyebrow} title={faq.title} intro={faq.intro} />
        <div className="faq">
          {faq.items.map((item, index) => (
            <details key={item.q} className="faq__item glass" open={index === 0} data-reveal>
              <summary>
                <h3 className="faq__q">{item.q}</h3>
                <ChevronDown className="faq__icon" size={20} strokeWidth={1.8} aria-hidden="true" />
              </summary>
              <p className="faq__a">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
};
