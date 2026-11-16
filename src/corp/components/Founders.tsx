// I soci fondatori e le societa' con cui Tecno lavora. Il testo sui fondatori e' quello approvato dal titolare e si
// pubblica senza varianti; le societa' sono citate per nome, senza loghi.
import { GlassCard, glassClass } from "./GlassCard";
import { SectionHead, type PageProps } from "./Layout";

export const Founders = ({ content }: PageProps) => {
  const { founders } = content.home;
  return (
    <section className="section founders" id="fondatori" aria-labelledby="fondatori-titolo">
      <div className="container container--narrow">
        <SectionHead title={founders.title} id="fondatori-titolo" />
        <GlassCard className="founders__card" data-reveal>
          <p>{founders.text}</p>
        </GlassCard>
      </div>
    </section>
  );
};

export const Companies = ({ content }: PageProps) => {
  const { companies } = content.home;
  return (
    <section className="section companies" id="compagnie" aria-labelledby="compagnie-titolo">
      <div className="container">
        <SectionHead title={companies.title} id="compagnie-titolo" />
        <ul className="companies__list" data-reveal>
          {companies.names.map((name) => (
            <li key={name} className={glassClass("dark", "companies__name")} data-glow>
              {name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
