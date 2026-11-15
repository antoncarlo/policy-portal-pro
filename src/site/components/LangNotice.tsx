// L'avviso per chi ha il browser in un'altra lingua del sito: scritto nella lingua del browser, nascosto finche'
// src/site/client/lang.ts non decide di mostrarlo. Non reindirizza mai da solo.
import { HREFLANG, LANGS } from "../config";
import { contentFor } from "../content";
import { pathOf, type PageRef } from "../routes";

export const LangNotice = ({ page }: { page: PageRef }) => (
  <>
    {LANGS.filter((lang) => lang !== page.lang).map((lang) => {
      const { langNotice } = contentFor(lang);
      return (
        <div key={lang} className="lang-notice glass-strong" data-lang-notice={lang} lang={HREFLANG[lang]} role="region" aria-label={langNotice.action} hidden>
          <p>{langNotice.text}</p>
          <a className="btn btn--primary btn--sm" href={pathOf(page.id, lang)}>
            {langNotice.action}
          </a>
          <button type="button" className="btn btn--ghost btn--sm" data-lang-dismiss>
            {langNotice.dismiss}
          </button>
        </div>
      );
    })}
  </>
);
