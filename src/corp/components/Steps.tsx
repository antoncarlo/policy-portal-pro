// Come si richiede un preventivo: tre passi, senza tempi promessi.
import { GlassCard } from "./GlassCard";
import { SectionHead, type PageProps } from "./Layout";

export const Steps = ({ content }: PageProps) => {
  const { steps } = content.home;
  return (
    <section className="section section--light steps" id="come-funziona" aria-labelledby="come-funziona-titolo">
      <div className="container">
        <SectionHead title={steps.title} id="come-funziona-titolo" />
        <ol className="steps__list">
          {steps.items.map((step, index) => (
            <GlassCard as="li" tone="light" className="step" key={step.title} data-reveal>
              <span className="step__number" aria-hidden="true">
                {index + 1}
              </span>
              <h3 className="step__title">{step.title}</h3>
              <p>{step.text}</p>
            </GlassCard>
          ))}
        </ol>
      </div>
    </section>
  );
};
