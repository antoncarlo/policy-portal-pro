// Le due pagine per pubblico: titolo, risposta diretta, sezioni, domande frequenti, invito a scrivere e le guide
// scritte per quel lettore. Sopra il titolo non c'e' nulla.
import { ArrowRight, LogIn } from "lucide-react";
import { findArticle, type ArticleEntry, type ArticleId } from "../blog";
import { CONTENT_UPDATED, PORTAL_LOGIN_PATH, formatDate } from "../config";
import { Blocks } from "../components/Blocks";
import { FaqList } from "../components/FaqList";
import { GuideCards } from "../components/GuideCards";
import { Inline } from "../components/Inline";
import type { PageProps } from "../components/Layout";
import type { AudienceId } from "../content/types";
import { sectionHref } from "../links";
import { pathOf } from "../routes";

/** Le guide proposte a ogni pubblico, in ordine di utilita': si mostrano le prime tre gia' pubblicate. */
const GUIDES: Record<AudienceId, ArticleId[]> = {
  representatives: ["lotto-pratiche", "firma-p7m", "garanzia-rappresentante", "richiesta-polizza", "garanzia-vies"],
  sellers: ["venditori-marketplace", "documenti", "forme-garanzia", "garanzia-vies"],
};
export const guidesFor = (id: AudienceId): ArticleEntry[] => GUIDES[id].flatMap((guide) => findArticle(guide) ?? []).slice(0, 3);

export const AudiencePage = ({ page, content }: PageProps) => {
  const id = page.id as AudienceId;
  const audience = content.audiencePages[id];
  const guides = guidesFor(id);
  return (
    <article className="legal audience-page" data-audience={id}>
      <header className="legal__hero audience-page__hero">
        <div className="container container--narrow">
          <h1 className="legal__title">{content.meta[id].h1}</h1>
          <p className="audience-page__lead">
            <Inline text={audience.lead} lang={page.lang} />
          </p>
          <div className="audience-page__actions">
            <a className="btn btn--bronze" href={sectionHref(page, "contatti")}>
              {content.nav.contact}
              <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />
            </a>
            <a className="btn btn--glass" href={PORTAL_LOGIN_PATH}>
              <LogIn size={16} strokeWidth={1.8} aria-hidden="true" />
              {content.nav.portal}
            </a>
          </div>
        </div>
      </header>
      <div className="container container--narrow legal__body article__body">
        {audience.sections.map((section) => (
          <section key={section.id} id={section.id}>
            <h2>{section.heading}</h2>
            <Blocks blocks={section.blocks} lang={page.lang} />
          </section>
        ))}
        <section id="domande-frequenti">
          <h2>{content.blog.faqTitle}</h2>
          <FaqList items={audience.faq} lang={page.lang} />
        </section>
        <aside className="article__cta">
          <h2>{audience.cta.title}</h2>
          <p>{audience.cta.text}</p>
          <a className="btn btn--bronze" href={sectionHref(page, "contatti")}>
            {audience.cta.button}
            <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />
          </a>
        </aside>
        <nav className="article__related" aria-labelledby="guide-collegate">
          {guides.length > 0 ? (
            <>
              <h2 id="guide-collegate">{audience.guidesTitle}</h2>
              <GuideCards entries={guides} lang={page.lang} />
            </>
          ) : null}
          <a className="link-arrow" href={pathOf("blog", page.lang)}>
            {content.blog.allGuides}
            <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />
          </a>
        </nav>
        <p className="legal__updated">
          {content.whatIs.disclaimer} {content.whatIs.updated} <time dateTime={CONTENT_UPDATED}>{formatDate(page.lang, CONTENT_UPDATED)}</time>.
        </p>
      </div>
    </article>
  );
};
