// Perche' un broker: tre fatti, ciascuno con la sua fonte (Codice delle assicurazioni private, Registro Unico).
import { ArrowUpRight } from "lucide-react";
import { RUI_CHECK_URL } from "../config";
import { GlassCard } from "./GlassCard";
import { SectionHead, type PageProps } from "./Layout";

export const Broker = ({ content }: PageProps) => {
  const { broker } = content.home;
  return (
    <section className="section section--light broker" id="broker" aria-labelledby="broker-titolo">
      <div className="container">
        <SectionHead title={broker.title} id="broker-titolo" />
        <div className="broker__grid">
          {broker.points.map((point, index) => (
            <GlassCard as="article" tone="light" className="broker-card" key={point.title} data-reveal>
              <span className="broker-card__number" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="broker-card__title">{point.title}</h3>
              <p>{point.text}</p>
            </GlassCard>
          ))}
        </div>
        <div className="sources" data-reveal>
          <a className="link-arrow" href={RUI_CHECK_URL} target="_blank" rel="noopener noreferrer">
            {broker.ruiCheck}
            <ArrowUpRight size={15} strokeWidth={1.8} aria-hidden="true" />
          </a>
          <p className="sources__title">{broker.sourcesTitle}</p>
          <ul className="sources__list">
            {broker.sources.map((source) => (
              <li key={source.href}>
                <a href={source.href} target="_blank" rel="noopener noreferrer">
                  {source.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};
