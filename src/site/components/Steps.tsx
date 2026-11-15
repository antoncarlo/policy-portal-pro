// «Come funziona»: i cinque passi, dai documenti alla polizza emessa. La linea che li unisce si disegna con lo
// scorrimento (src/site/client/reveal.ts); senza JavaScript e' gia' tutta disegnata.
import { SectionHead, type PageProps } from "./Layout";

export const Steps = ({ content }: PageProps) => {
  const { steps } = content;
  return (
    <section className="section" id="come-funziona">
      <div className="container">
        <SectionHead eyebrow={steps.eyebrow} title={steps.title} intro={steps.intro} />
        <ol className="steps" data-progress-line>
          {steps.items.map((step, index) => (
            <li key={step.title} className="step" data-step={index + 1} data-reveal>
              <span className="step__num" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="step__body glass" data-glow>
                <h3 className="step__title">{step.title}</h3>
                <p>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="steps__outcome" data-reveal>
          {steps.outcome}
        </p>
      </div>
    </section>
  );
};
