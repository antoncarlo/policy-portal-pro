// I soci fondatori e le societa' con cui Tecno lavora. Il testo sui fondatori e' quello approvato dal titolare e si
// pubblica senza varianti; le societa' sono mostrate con il loro logo (scelta del titolare del 16/11/2026), ognuno
// con i suoi colori su una fascia bianca: il nome resta nella pagina come testo alternativo.
import { COMPANY_LOGOS } from "../media";
import { GlassCard } from "./GlassCard";
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
    <section className="section section--white companies" id="compagnie" aria-labelledby="compagnie-titolo">
      <div className="container">
        <SectionHead title={companies.title} id="compagnie-titolo" />
        <ul className="companies__logos" data-reveal>
          {companies.names.map((name) => {
            const logo = COMPANY_LOGOS[name];
            return (
              <li key={name} className="companies__logo">
                <img src={logo.src} alt={name} width={logo.width} height={logo.height} loading="lazy" decoding="async" />
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
};
