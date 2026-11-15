// Le pagine di testo, con il solo titolo in apertura: Privacy (chi tratta i dati, perche', per quanto, con chi, quali diritti) e Cookie (cosa si
// salva nel browser, per nome). Stessa struttura nelle tre lingue.
import { CONTENT_UPDATED, formatDate } from "../config";
import type { PageProps } from "../components/Layout";
import { Rich } from "../components/Rich";
import type { LegalSection } from "../content/types";

const Section = ({ section, ...props }: PageProps & { section: LegalSection }) => {
  // Un primo paragrafo che finisce con i due punti introduce l'elenco; altrimenti l'elenco viene prima.
  const lead = section.list.length > 0 && /[:：]$/.test(section.paragraphs[0] ?? "") ? section.paragraphs.slice(0, 1) : [];
  const rest = section.paragraphs.slice(lead.length);
  const paragraph = (text: string) => (
    <p key={text}>
      <Rich text={text} {...props} />
    </p>
  );
  return (
    <section>
      <h2>{section.title}</h2>
      {lead.map(paragraph)}
      {section.list.length > 0 ? (
        <ul>
          {section.list.map((item) => (
            <li key={item}>
              <Rich text={item} {...props} />
            </li>
          ))}
        </ul>
      ) : null}
      {rest.map(paragraph)}
    </section>
  );
};

export const LegalPage = (props: PageProps) => {
  const { page, content } = props;
  const meta = content.meta[page.id];
  const { legal } = content;
  return (
    <article className="legal">
      <header className="legal__hero">
        <div className="container container--narrow">
          <h1 className="legal__title">{meta.h1}</h1>
        </div>
      </header>
      <div className="container container--narrow legal__body">
        {page.id === "cookie" ? (
          <>
            {legal.cookie.intro.map((section) => (
              <Section key={section.title} section={section} {...props} />
            ))}
            <section>
              <h2>{legal.cookie.tableTitle}</h2>
              <div className="table-wrap glass">
                <table className="compare">
                  <thead>
                    <tr>
                      <th scope="col">{legal.cookie.columns.name}</th>
                      <th scope="col">{legal.cookie.columns.purpose}</th>
                      <th scope="col">{legal.cookie.columns.duration}</th>
                      <th scope="col">{legal.cookie.columns.owner}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {legal.cookie.rows.map((row) => (
                      <tr key={row.name}>
                        <th scope="row">
                          <code>{row.name}</code>
                        </th>
                        <td data-label={legal.cookie.columns.purpose}>{row.purpose}</td>
                        <td data-label={legal.cookie.columns.duration}>{row.duration}</td>
                        <td data-label={legal.cookie.columns.owner}>{row.owner}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            {legal.cookie.after.map((section) => (
              <Section key={section.title} section={section} {...props} />
            ))}
          </>
        ) : (
          legal.privacy.sections.map((section) => <Section key={section.title} section={section} {...props} />)
        )}
        <p className="legal__updated">
          {legal.updated} <time dateTime={CONTENT_UPDATED}>{formatDate(page.lang, CONTENT_UPDATED)}</time>
        </p>
      </div>
    </article>
  );
};
