// La pagina di un articolo: titolo, chi lo firma e quando, la risposta diretta, le sezioni, le domande frequenti,
// le fonti ufficiali, l'invito a scrivere e le guide collegate. Sopra il titolo non c'e' nulla.
import { ArrowRight, ArrowUpRight, ChevronDown } from "lucide-react";
import { AUTHOR, articleOf, relatedOf, type ArticleId } from "../blog";
import { formatDate } from "../config";
import { Blocks } from "../components/Blocks";
import { GuideCards } from "../components/GuideCards";
import { Inline } from "../components/Inline";
import type { PageProps } from "../components/Layout";
import { sectionHref } from "../links";
import { pathOf } from "../routes";

export const ArticlePage = ({ page, content }: PageProps) => {
  const entry = articleOf(page.id as ArticleId);
  const article = entry.content[page.lang];
  const { blog } = content;
  const related = relatedOf(entry);
  return (
    <article className="legal article" data-article={entry.id}>
      <header className="legal__hero article__hero">
        <div className="container container--narrow">
          <h1 className="legal__title">{article.h1}</h1>
          <p className="article__byline">
            <span>
              {blog.by} <strong>{AUTHOR.name}</strong>, {AUTHOR.organization}
            </span>
            <span>
              {blog.published} <time dateTime={entry.published}>{formatDate(page.lang, entry.published)}</time>
            </span>
          </p>
        </div>
      </header>
      <div className="container container--narrow legal__body article__body">
        <section className="article__summary glass" aria-labelledby="in-breve">
          <h2 id="in-breve">{blog.summaryTitle}</h2>
          <p>
            <Inline text={article.summary} lang={page.lang} />
          </p>
        </section>
        {article.sections.map((section) => (
          <section key={section.id} id={section.id}>
            <h2>{section.heading}</h2>
            <Blocks blocks={section.blocks} lang={page.lang} />
          </section>
        ))}
        <section id="domande-frequenti">
          <h2>{blog.faqTitle}</h2>
          <div className="faq">
            {article.faq.map((item, index) => (
              <details key={item.q} className="faq__item glass" open={index === 0}>
                <summary>
                  <h3 className="faq__q">{item.q}</h3>
                  <ChevronDown className="faq__icon" size={20} strokeWidth={1.8} aria-hidden="true" />
                </summary>
                <p className="faq__a">
                  <Inline text={item.a} lang={page.lang} />
                </p>
              </details>
            ))}
          </div>
        </section>
        <section className="sources" id="fonti">
          <h2>{blog.sourcesTitle}</h2>
          <ul className="sources__list">
            {article.sources.map((source) => (
              <li key={source.href}>
                <a href={source.href} target="_blank" rel="noopener noreferrer">
                  {source.label}
                  <ArrowUpRight size={14} strokeWidth={1.8} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
          <p className="sources__note">
            {content.whatIs.disclaimer}{" "}
            <span className="sources__updated">
              {blog.updated} <time dateTime={entry.updated}>{formatDate(page.lang, entry.updated)}</time>.
            </span>
          </p>
        </section>
        <aside className="article__cta">
          <h2>{blog.cta.title}</h2>
          <p>{blog.cta.text}</p>
          <a className="btn btn--bronze" href={sectionHref(page, "contatti")}>
            {blog.cta.button}
            <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />
          </a>
        </aside>
        <nav className="article__related" aria-labelledby="guide-collegate">
          {related.length > 0 ? (
            <>
              <h2 id="guide-collegate">{blog.relatedTitle}</h2>
              <GuideCards entries={related} lang={page.lang} />
            </>
          ) : null}
          <a className="link-arrow" href={pathOf("blog", page.lang)}>
            {blog.allGuides}
            <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />
          </a>
        </nav>
      </div>
    </article>
  );
};
