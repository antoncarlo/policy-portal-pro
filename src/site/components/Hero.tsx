// L'apertura: titolo, i tre dati della garanzia, i due inviti. Lo sfondo e' un'immagine di vetro e luce (un video
// breve in ciclo, quando si puo') con aloni che si muovono piano;
// la scheda di vetro a destra e' una polizza stilizzata, decorativa (i dati veri sono nell'elenco sotto).
import { ArrowRight, Check, FileSignature, LogIn, ShieldCheck } from "lucide-react";
import { PORTAL_LOGIN_PATH } from "../config";
import type { PageProps } from "./Layout";

/** Una parola con il trattino («non-EU») non va spezzata su due righe: nel titolo si vedrebbe «non-» a fine riga. */
const keepHyphenated = (text: string) =>
  text.split(/(\S+-\S+)/).map((part, index) =>
    index % 2 === 1 ? (
      <span key={index} className="nowrap">
        {part}
      </span>
    ) : (
      part
    ),
  );

export const Hero = ({ page, content }: PageProps) => {
  const { hero } = content;
  return (
    <section className="hero" data-testid="site-hero">
      <div className="hero__bg" aria-hidden="true">
        {/* L'immagine fissa c'e' subito; il video lo carica src/site/client/hero-video.ts, a pagina pronta e solo
            se chi legge non ha chiesto meno movimento o meno dati. */}
        <video className="hero__media" data-hero-video muted loop playsInline preload="none" poster="/site-media/vies-vetro-apertura.webp" aria-hidden="true" tabIndex={-1}>
          <source data-src="/site-media/vies-vetro-apertura.webm" type="video/webm" />
          <source data-src="/site-media/vies-vetro-apertura.mp4" type="video/mp4" />
        </video>
        <span className="hero__shade" />
        <span className="aurora aurora--a" />
        <span className="aurora aurora--b" />
        <span className="aurora aurora--c" />
        <span className="hero__grid" />
      </div>
      <div className="container hero__inner">
        <div className="hero__copy">
          <p className="eyebrow eyebrow--light hero__eyebrow">{hero.eyebrow}</p>
          <h1 className="hero__title">{keepHyphenated(content.meta[page.id].h1)}</h1>
          <p className="hero__lead">{hero.lead}</p>
          <div className="hero__cta">
            <a className="btn btn--bronze btn--lg" href="#contatti">
              {hero.primary}
              <ArrowRight size={18} strokeWidth={1.8} aria-hidden="true" />
            </a>
            <a className="btn btn--glass btn--lg" href={PORTAL_LOGIN_PATH}>
              <LogIn size={18} strokeWidth={1.8} aria-hidden="true" />
              {hero.secondary}
            </a>
          </div>
          <p className="hero__note">{hero.note}</p>
        </div>
        <div className="hero__visual" aria-hidden="true" data-tilt>
          <div className="policy-card policy-card--back glass-dark" />
          <div className="policy-card glass-dark">
            <div className="policy-card__head">
              <span className="policy-card__seal">
                <ShieldCheck size={22} strokeWidth={1.6} />
              </span>
              <span className="policy-card__title">{hero.card.title}</span>
              <span className="pill pill--done">{hero.card.status}</span>
            </div>
            <div className="policy-card__row">
              <span>{hero.card.beneficiaryLabel}</span>
              <strong>{hero.card.beneficiary}</strong>
            </div>
            <div className="policy-card__grid">
              {hero.facts.slice(0, 2).map((fact) => (
                <div key={fact.label}>
                  <span>{fact.label}</span>
                  <strong>{fact.value}</strong>
                </div>
              ))}
            </div>
            <div className="policy-card__foot">
              <span className="policy-card__signed">
                <Check size={14} strokeWidth={2.4} />
                {hero.card.signed}
              </span>
              <svg className="policy-card__signature" viewBox="0 0 120 36" width="120" height="36">
                <path d="M4 26c8-14 14-20 18-18s-6 22-2 22 10-18 15-18-2 14 2 14 8-12 12-12 0 10 4 10 9-9 14-9-3 9 2 9 12-6 18-8 16-3 27-2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <span className="chip chip--a glass-dark">
            <FileSignature size={15} strokeWidth={1.8} />
            .p7m
          </span>
          <span className="chip chip--b glass-dark">{hero.facts[2].value}</span>
        </div>
      </div>
      <div className="container">
        <dl className="hero__facts">
          {hero.facts.map((fact) => (
            <div key={fact.label} className="fact glass-dark" data-glow>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
};
