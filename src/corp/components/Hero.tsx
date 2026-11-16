// L'apertura: il mondo di notte sotto lo scudo di vetro. L'immagine ferma e' nell'HTML e arriva per prima; il video
// a ciclo continuo lo avvia il browser solo a pagina pronta (src/site/client/hero-video.ts), mai con «riduci
// movimento» o con il risparmio dati.
import { ArrowDown, ArrowRight } from "lucide-react";
import { HERO_POSTER, HERO_VIDEO } from "../media";
import { glassClass } from "./GlassCard";
import type { PageProps } from "./Layout";

export const Hero = ({ page, content }: PageProps) => {
  const { hero } = content.home;
  return (
    <section className="hero" id="apertura">
      <div className="hero__media">
        <img className="hero__poster" src={HERO_POSTER.src} alt={hero.posterAlt} width={HERO_POSTER.width} height={HERO_POSTER.height} {...{ fetchpriority: "high" }} decoding="async" />
        <video className="hero__video" data-hero-video muted loop playsInline preload="none" aria-hidden="true" tabIndex={-1}>
          {HERO_VIDEO.map((file) => (
            <source key={file.src} data-src={file.src} type={file.type} />
          ))}
        </video>
      </div>
      <div className="container hero__inner">
        <div className="hero__copy">
          <h1 className="hero__title">{content.meta[page.id].h1}</h1>
          <p className="hero__lead">{hero.lead}</p>
          <div className="hero__actions">
            <a className="btn btn--bronze" href="#preventivo">
              {hero.primary}
              <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />
            </a>
            <a className="btn btn--ghost" href="#prodotti">
              {hero.secondary}
              <ArrowDown size={16} strokeWidth={1.8} aria-hidden="true" />
            </a>
          </div>
          <ul className="hero__chips">
            {hero.chips.map((chip) => (
              <li key={chip} className={glassClass("dark", "chip")}>
                {chip}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};
