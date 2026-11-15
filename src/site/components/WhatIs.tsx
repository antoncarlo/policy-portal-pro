// «Cos'e' la garanzia VIES»: la risposta diretta, i fatti della norma, il confronto tra le tre forme di garanzia,
// cosa cambia dal 2027 e le fonti ufficiali. Ogni affermazione ha la sua fonte collegata.
import { ArrowUpRight, CalendarClock } from "lucide-react";
import { CONTENT_UPDATED, formatDate } from "../config";
import { SectionHead, type PageProps } from "./Layout";

export const WhatIs = ({ page, content }: PageProps) => {
  const { whatIs } = content;
  return (
    <section className="section" id="cos-e">
      <div className="container">
        <SectionHead eyebrow={whatIs.eyebrow} title={whatIs.title} />
        <p className="answer" data-reveal>
          {whatIs.answer}
        </p>
        <dl className="facts stagger">
          {whatIs.facts.map((fact) => (
            <div key={fact.term} className="facts__item glass" data-reveal data-glow>
              <dt>{fact.term}</dt>
              <dd>{fact.text}</dd>
            </div>
          ))}
        </dl>

        <div className="forms" data-reveal>
          <h3 className="block-title">{whatIs.formsTitle}</h3>
          <p className="block-intro">{whatIs.formsIntro}</p>
          <div className="table-wrap glass">
            <table className="compare">
              <thead>
                <tr>
                  <th scope="col">{whatIs.formsColumns.form}</th>
                  <th scope="col">{whatIs.formsColumns.issuer}</th>
                  <th scope="col">{whatIs.formsColumns.commitment}</th>
                </tr>
              </thead>
              <tbody>
                {whatIs.forms.map((row, index) => (
                  <tr key={row.form} className={index === whatIs.forms.length - 1 ? "compare__ours" : undefined}>
                    <th scope="row">{row.form}</th>
                    <td data-label={whatIs.formsColumns.issuer}>{row.issuer}</td>
                    <td data-label={whatIs.formsColumns.commitment}>{row.commitment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="law glass" data-reveal>
          <span className="icon-badge icon-badge--bronze">
            <CalendarClock size={22} strokeWidth={1.6} aria-hidden="true" />
          </span>
          <div>
            <h3 className="block-title">{whatIs.lawTitle}</h3>
            <p>{whatIs.law}</p>
          </div>
        </aside>

        <div className="sources" data-reveal>
          <h3 className="sources__title">{whatIs.sourcesTitle}</h3>
          <ul className="sources__list">
            {whatIs.sources.map((source) => (
              <li key={source.href}>
                <a href={source.href} target="_blank" rel="noopener noreferrer">
                  {source.label}
                  <ArrowUpRight size={14} strokeWidth={1.8} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
          <p className="sources__note">
            {whatIs.disclaimer}{" "}
            <span className="sources__updated">
              {whatIs.updated} <time dateTime={CONTENT_UPDATED}>{formatDate(page.lang, CONTENT_UPDATED)}</time>.
            </span>
          </p>
        </div>
      </div>
    </section>
  );
};
